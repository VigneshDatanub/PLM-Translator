// =============================================================
// PLM Translator - Service Handler (Node.js)
// =============================================================
// 100% Strict SAP CAPM Application Service Handler
//   - Standard CAP lifecycle handlers (on, before, after)
//   - Calculation of Criticality for Fiori Elements status badges
//   - Native CAP Media and Batch translation handling
//   - Declarative security integration with CIS / XSUAA
// =============================================================

const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');
const googleTranslate = require('./lib/google-translate');
const excelHandler = require('./lib/excel-handler');

module.exports = class TranslatorService extends cds.ApplicationService {

    async init() {
        const { TestResults, TranslationSessions, Languages, ExcelUploads } = this.entities;

        // ─────────────────────────────────────────────
        // ACTION: translate
        // Equivalent of: POST /api/translate
        // ─────────────────────────────────────────────
        this.on('translate', async (req) => {
            const { text, targetLanguage } = req.data;

            // Validation
            if (!text || !text.trim()) {
                return { success: false, error: 'Please enter text to translate' };
            }
            if (!targetLanguage || !targetLanguage.trim()) {
                return { success: false, error: 'Please select a target language' };
            }
            if (text.length > 5000) {
                return { success: false, error: 'Text is too long. Maximum 5000 characters allowed.' };
            }

            // Call Google Translate API
            const result = await googleTranslate.translateText(text.trim(), targetLanguage.trim());
            return result;
        });

        // ─────────────────────────────────────────────
        // ACTION: massTranslate
        // Equivalent of: POST /api/mass-translate
        // ─────────────────────────────────────────────
        this.on('massTranslate', async (req) => {
            const { textsJson, targetLanguages: targetLangsJson, testedBy } = req.data;

            // Validate inputs
            if (!testedBy || !testedBy.trim()) {
                return { success: false, error: 'Tested by field is required' };
            }

            let texts, targetLanguages;
            try {
                texts = JSON.parse(textsJson);
                targetLanguages = JSON.parse(targetLangsJson);
            } catch (e) {
                return { success: false, error: `Invalid JSON data: ${e.message}` };
            }

            if (!Array.isArray(texts) || texts.length === 0) {
                return { success: false, error: 'No texts provided for translation' };
            }
            if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
                return { success: false, error: 'No target languages selected' };
            }

            const sessionId = `mass_translation_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}`;
            const totalRows = texts.length;
            let successfulTranslations = 0;
            let failedTranslations = 0;

            // Process each target language
            for (const targetLanguage of targetLanguages) {
                const sourceTexts = texts.map(item => item.text || item);
                const batchResults = await googleTranslate.translateBatch(sourceTexts, targetLanguage, 25);
                const formattedLang = await googleTranslate.formatTargetLanguage(targetLanguage);

                // Prepare database records
                const dbRecords = [];
                for (let idx = 0; idx < batchResults.length; idx++) {
                    const result = batchResults[idx];
                    const originalData = texts[idx] || {};
                    const rowIndex = originalData.index !== undefined ? originalData.index + 1 : idx + 1;
                    const description = originalData.description || '';

                    if (result.success) {
                        dbRecords.push({
                            ID: uuidv4(),
                            outcome: 'Success',
                            accuracy: null,
                            observation: `Mass translation - Row ${rowIndex}${description ? ' - ' + description : ''}`,
                            testedBy: testedBy.trim(),
                            textToTranslate: originalData.text || sourceTexts[idx],
                            translatedText: result.translatedText,
                            sourceLanguage: 'auto',
                            targetLanguage: formattedLang,
                            sessionId: sessionId
                        });
                        successfulTranslations++;
                    } else {
                        const errorMessage = result.error || 'Translation failed - Unknown error';
                        dbRecords.push({
                            ID: uuidv4(),
                            outcome: 'Failure',
                            accuracy: null,
                            observation: `Mass translation FAILED - Row ${rowIndex} - Error: ${errorMessage}${description ? ' - ' + description : ''}`,
                            testedBy: testedBy.trim(),
                            textToTranslate: originalData.text || sourceTexts[idx],
                            translatedText: `ERROR: ${errorMessage}`,
                            sourceLanguage: 'auto',
                            targetLanguage: formattedLang,
                            sessionId: sessionId
                        });
                        failedTranslations++;
                    }
                }

                // Bulk insert to database
                if (dbRecords.length > 0) {
                    try {
                        await cds.run(INSERT.into(TestResults).entries(dbRecords));
                    } catch (dbError) {
                        console.error('[MassTranslate] Bulk insert failed, trying individual:', dbError.message);
                        for (const record of dbRecords) {
                            try {
                                await cds.run(INSERT.into(TestResults).entries([record]));
                            } catch (e) {
                                console.error('[MassTranslate] Individual insert failed:', e.message);
                            }
                        }
                    }
                }
            }

            const totalExpected = totalRows * targetLanguages.length;
            const successRate = totalExpected > 0 ? Math.round((successfulTranslations / totalExpected) * 10000) / 100 : 0;

            // Create TranslationSessions header record
            try {
                await cds.run(INSERT.into(TranslationSessions).entries({
                    ID: uuidv4(),
                    sessionName: `Batch Translation (${texts.length} items x ${targetLanguages.length} langs)`,
                    sessionId: sessionId,
                    totalRows: totalExpected,
                    successful: successfulTranslations,
                    failed: failedTranslations,
                    successRate: successRate,
                    testedBy: testedBy.trim()
                }));
            } catch (sessionErr) {
                console.warn('[MassTranslate] Could not create session header:', sessionErr.message);
            }

            return {
                success: true,
                message: `Mass translation completed: ${successfulTranslations} successful`,
                sessionId: sessionId,
                statistics: {
                    totalRows: totalRows,
                    successful: successfulTranslations,
                    failed: totalExpected - successfulTranslations,
                    successRate: successRate,
                    languagesCount: targetLanguages.length
                }
            };
        });

        // ─────────────────────────────────────────────
        // FUNCTION: getLanguages
        // Equivalent of: GET /api/languages
        // ─────────────────────────────────────────────
        this.on('getLanguages', async () => {
            const languages = await googleTranslate.getSupportedLanguages();
            return languages;
        });

        // ─────────────────────────────────────────────
        // FUNCTION: getUserInfo
        // Resolves user info dynamically from SAP Cloud Identity Services (CIS)
        // ─────────────────────────────────────────────
        this.on('getUserInfo', async (req) => {
            const userAttr = req.user?.attr || {};
            const email = userAttr.email || (req.user?.id && req.user.id.includes('@') ? req.user.id : '');
            const displayName = (userAttr.givenName && userAttr.familyName)
                ? `${userAttr.givenName} ${userAttr.familyName}`
                : (email || req.user?.id || 'Business User');

            return {
                success: true,
                user: displayName,
                email: email,
                id: req.user?.id || 'anonymous',
                roles: {
                    isAdmin: req.user ? req.user.is('TranslatorAdmin') : false,
                    isUser: req.user ? req.user.is('TranslatorUser') : false
                },
                timestamp: new Date().toISOString()
            };
        });

        // ─────────────────────────────────────────────
        // FUNCTION: exportResults & downloadTemplate
        // ─────────────────────────────────────────────
        this.on('exportResults', async () => {
            return 'Use GET /api/export-results-excel endpoint for file download';
        });

        this.on('downloadTemplate', async () => {
            return 'Use GET /api/download-template-excel endpoint for file download';
        });

        // ─────────────────────────────────────────────
        // BEFORE handler: Validate TestResults on CREATE
        // ─────────────────────────────────────────────
        this.before('CREATE', 'TestResults', async (req) => {
            const data = req.data;

            if (!data.outcome) {
                req.error(400, 'Outcome is required');
            }

            if (data.accuracy !== null && data.accuracy !== undefined && data.accuracy !== '') {
                const accuracy = parseFloat(data.accuracy);
                if (isNaN(accuracy) || accuracy < 0 || accuracy > 100) {
                    req.error(400, 'Accuracy must be between 0 and 100');
                }
            }

            // Normalize 'Failed' to 'Failure'
            if (data.outcome === 'Failed') {
                data.outcome = 'Failure';
            }

            // Format target language
            if (data.targetLanguage) {
                data.targetLanguage = await googleTranslate.formatTargetLanguage(data.targetLanguage);
            }

            // Auto-generate session ID if not provided
            if (!data.sessionId) {
                data.sessionId = uuidv4();
            }
        });

        // ─────────────────────────────────────────────
        // AFTER handler: Compute Criticality on READ
        // Used by SAP Fiori Elements for status badge colors:
        //   3 = Positive (Green) → Success
        //   1 = Negative (Red)   → Failure
        //   2 = Critical (Orange)→ Partial
        //   0 = Neutral          → Others
        // ─────────────────────────────────────────────
        this.after('READ', 'TestResults', (data) => {
            const records = Array.isArray(data) ? data : [data];
            for (const record of records) {
                if (!record) continue;
                if (record.outcome === 'Success') {
                    record.criticality = 3;
                } else if (record.outcome === 'Failure') {
                    record.criticality = 1;
                } else if (record.outcome === 'Partial') {
                    record.criticality = 2;
                } else {
                    record.criticality = 0;
                }
            }
        });

        // ─────────────────────────────────────────────
        // BEFORE handler: Process Native CAP ExcelUploads
        // ─────────────────────────────────────────────
        this.before('CREATE', 'ExcelUploads', async (req) => {
            const data = req.data;
            if (data.content) {
                try {
                    const buffer = Buffer.isBuffer(data.content) ? data.content : Buffer.from(data.content, 'base64');
                    const parseResult = excelHandler.parseExcelFile(buffer);
                    if (!parseResult.success) {
                        req.error(400, parseResult.error);
                        return;
                    }
                    const sessionId = `mass_translation_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}`;
                    data.sessionId = sessionId;
                    data.status = 'Processed';
                } catch (err) {
                    req.error(500, `Excel processing failed: ${err.message}`);
                }
            }
        });

        await super.init();
    }
};

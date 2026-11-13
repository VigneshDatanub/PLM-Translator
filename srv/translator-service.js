// =============================================================
// PLM Translator - Service Handler (Node.js)
// =============================================================
// 100% Strict SAP CAPM Application Service Handler
//   - Standard CAP lifecycle handlers (on, before, after)
//   - Calculation of Criticality for Fiori Elements status badges
//   - Native CAP Media and Batch translation handling
//   - Transaction audit logging for all translation & evaluation actions
//   - Declarative security integration with CIS / XSUAA
// =============================================================

const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');
const googleTranslate = require('./lib/google-translate');
const excelHandler = require('./lib/excel-handler');

module.exports = class TranslatorService extends cds.ApplicationService {

    async init() {
        const { TestResults, TranslationSessions, Languages, ExcelUploads, TestResultTransactions } = this.entities;

        // ─────────────────────────────────────────────
        // ACTION: singleTranslate (100% Native SAP Fiori Elements Action Dialog)
        // ─────────────────────────────────────────────
        this.on('singleTranslate', async (req) => {
            const { targetLanguage, sourceText, outcome, accuracy, testedBy, observation } = req.data;

            if (!sourceText || !sourceText.trim()) {
                return req.error(400, 'Please enter source text to translate.');
            }
            if (!targetLanguage || !targetLanguage.trim()) {
                return req.error(400, 'Please select a target language.');
            }

            // 1. Call Google Cloud Translate API
            let translatedText = '';
            let sourceLang = 'auto';
            let recordOutcome = outcome || 'Success';

            const transResult = await googleTranslate.translateText(sourceText.trim(), targetLanguage.trim());
            if (transResult && transResult.success) {
                translatedText = transResult.translatedText;
                sourceLang = transResult.sourceLanguage || 'auto';
            } else {
                const errMsg = (transResult && transResult.error) || 'Google Translate API unavailable';
                translatedText = `[Translation unavailable: ${errMsg}]`;
                if (!outcome) {
                    recordOutcome = 'Failure';
                }
            }

            const formattedLang = await googleTranslate.formatTargetLanguage(targetLanguage.trim());
            const recordId = uuidv4();
            const userId = req.user?.id || (testedBy && testedBy.trim()) || 'Business User';
            const now = new Date().toISOString();
            const parsedAccuracy = (accuracy !== null && accuracy !== undefined && accuracy !== '') ? parseFloat(accuracy) : (recordOutcome === 'Failure' ? 0 : 95);

            // 2. Persist to TestResults
            const newRecord = {
                ID: recordId,
                outcome: recordOutcome,
                accuracy: parsedAccuracy,
                observation: (observation && observation.trim()) || '',
                testedBy: (testedBy && testedBy.trim()) || userId,
                textToTranslate: sourceText.trim(),
                translatedText: translatedText,
                sourceLanguage: sourceLang,
                targetLanguage: formattedLang,
                sessionId: uuidv4(),
                createdBy: userId,
                createdAt: now,
                modifiedBy: userId,
                modifiedAt: now,
                IsActiveEntity: true
            };

            await cds.run(INSERT.into(TestResults).entries(newRecord));

            // 3. Record transaction audit trail
            await cds.run(INSERT.into(TestResultTransactions).entries({
                ID: uuidv4(),
                result_ID: recordId,
                action: 'Single Translation Created',
                performedBy: userId,
                outcome: recordOutcome,
                accuracy: parsedAccuracy,
                details: `Single translation created for target language: ${formattedLang}`,
                createdBy: userId,
                createdAt: now,
                modifiedBy: userId,
                modifiedAt: now
            }));

            // Return created record for Fiori Elements
            return newRecord;
        });

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

            const userId = req.user?.id || testedBy.trim() || 'Business User';
            const now = new Date().toISOString();

            // Process each target language
            for (const targetLanguage of targetLanguages) {
                const sourceTexts = texts.map(item => item.text || item);
                const batchResults = await googleTranslate.translateBatch(sourceTexts, targetLanguage, 25);
                const formattedLang = await googleTranslate.formatTargetLanguage(targetLanguage);

                // Prepare database records and transaction audit records
                const dbRecords = [];
                const txRecords = [];

                for (let idx = 0; idx < batchResults.length; idx++) {
                    const result = batchResults[idx];
                    const originalData = texts[idx] || {};
                    const rowIndex = originalData.index !== undefined ? originalData.index + 1 : idx + 1;
                    const description = originalData.description || '';
                    const recordId = uuidv4();

                    if (result.success) {
                        dbRecords.push({
                            ID: recordId,
                            outcome: 'Success',
                            accuracy: null,
                            observation: `Mass translation - Row ${rowIndex}${description ? ' - ' + description : ''}`,
                            testedBy: testedBy.trim(),
                            textToTranslate: originalData.text || sourceTexts[idx],
                            translatedText: result.translatedText,
                            sourceLanguage: 'auto',
                            targetLanguage: formattedLang,
                            sessionId: sessionId,
                            createdBy: userId,
                            createdAt: now,
                            modifiedBy: userId,
                            modifiedAt: now
                        });
                        txRecords.push({
                            ID: uuidv4(),
                            result_ID: recordId,
                            action: 'Mass Translation Created',
                            performedBy: userId,
                            outcome: 'Success',
                            accuracy: null,
                            details: `Mass translation generated via batch run (Row ${rowIndex}) - Target: ${formattedLang}`,
                            createdBy: userId,
                            createdAt: now,
                            modifiedBy: userId,
                            modifiedAt: now
                        });
                        successfulTranslations++;
                    } else {
                        const errorMessage = result.error || 'Translation failed - Unknown error';
                        dbRecords.push({
                            ID: recordId,
                            outcome: 'Failure',
                            accuracy: null,
                            observation: `Mass translation FAILED - Row ${rowIndex} - Error: ${errorMessage}${description ? ' - ' + description : ''}`,
                            testedBy: testedBy.trim(),
                            textToTranslate: originalData.text || sourceTexts[idx],
                            translatedText: `ERROR: ${errorMessage}`,
                            sourceLanguage: 'auto',
                            targetLanguage: formattedLang,
                            sessionId: sessionId,
                            createdBy: userId,
                            createdAt: now,
                            modifiedBy: userId,
                            modifiedAt: now
                        });
                        txRecords.push({
                            ID: uuidv4(),
                            result_ID: recordId,
                            action: 'Mass Translation Created',
                            performedBy: userId,
                            outcome: 'Failure',
                            accuracy: null,
                            details: `Mass translation failed (Row ${rowIndex}) - Error: ${errorMessage}`,
                            createdBy: userId,
                            createdAt: now,
                            modifiedBy: userId,
                            modifiedAt: now
                        });
                        failedTranslations++;
                    }
                }

                // Bulk insert to database
                if (dbRecords.length > 0) {
                    try {
                        await cds.run(INSERT.into(TestResults).entries(dbRecords));
                        if (txRecords.length > 0) {
                            await cds.run(INSERT.into(TestResultTransactions).entries(txRecords));
                        }
                    } catch (dbError) {
                        console.error('[MassTranslate] Bulk insert failed, trying individual:', dbError.message);
                        for (let i = 0; i < dbRecords.length; i++) {
                            try {
                                await cds.run(INSERT.into(TestResults).entries([dbRecords[i]]));
                                if (txRecords[i]) {
                                    await cds.run(INSERT.into(TestResultTransactions).entries([txRecords[i]]));
                                }
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
                    testedBy: testedBy.trim(),
                    createdBy: userId,
                    createdAt: now,
                    modifiedBy: userId,
                    modifiedAt: now
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
                    isAdmin: req.user ? (req.user.is('TranslatorAdmin') || req.user.is('admin')) : false,
                    isUser: req.user ? (req.user.is('TranslatorUser') || req.user.is('authenticated-user')) : false
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

            if (!data.ID) {
                data.ID = uuidv4();
            }

            // Only enforce mandatory fields on active entities or when activating, not during draft initialization
            if (data.IsActiveEntity !== false && !data.outcome) {
                req.error(400, 'Outcome is required');
            }

            if (data.accuracy !== null && data.accuracy !== undefined && data.accuracy !== '') {
                const accuracy = parseFloat(data.accuracy);
                if (isNaN(accuracy) || accuracy < 0 || accuracy > 100) {
                    req.error(400, 'Accuracy must be between 0 and 100');
                } else {
                    data.accuracy = accuracy;
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
        // BEFORE handler: TestResults on SAVE (draft activation)
        // Checks for existing record to determine field changes
        // ─────────────────────────────────────────────
        this.before('SAVE', 'TestResults', async (req) => {
            const data = req.data;
            if (!data || !data.ID) return;

            try {
                const existing = await cds.run(
                    SELECT.one.from('plm.translator.TestResults').where({ ID: data.ID })
                );
                if (existing) {
                    req._existingRecord = existing;
                }
            } catch (err) {
                // Ignore if lookup fails
            }
        });

        // ─────────────────────────────────────────────
        // AFTER handler: TestResults on SAVE (draft activation)
        // Records audit transaction on Object Page save
        // ─────────────────────────────────────────────
        this.after('SAVE', 'TestResults', async (data, req) => {
            if (!data || !data.ID) return;
            const userId = req.user?.id || 'Business User';
            const now = new Date().toISOString();
            const existing = req._existingRecord;

            if (existing) {
                // Modification of an existing record
                const changes = [];
                if (data.outcome && data.outcome !== existing.outcome) {
                    changes.push(`Outcome changed from '${existing.outcome}' to '${data.outcome}'`);
                }
                if (data.accuracy !== undefined && data.accuracy !== null && data.accuracy !== existing.accuracy) {
                    changes.push(`Accuracy updated from ${existing.accuracy !== null ? existing.accuracy + '%' : 'unrated'} to ${data.accuracy}%`);
                }
                if (data.observation !== undefined && data.observation !== existing.observation) {
                    changes.push('Observations updated');
                }
                const details = changes.length > 0 ? changes.join('; ') : 'Evaluation details updated';

                try {
                    await cds.run(INSERT.into(TestResultTransactions).entries({
                        ID: uuidv4(),
                        result_ID: data.ID,
                        action: 'Evaluation Updated',
                        performedBy: userId,
                        outcome: data.outcome || existing.outcome,
                        accuracy: data.accuracy !== undefined ? data.accuracy : existing.accuracy,
                        details: details,
                        createdBy: userId,
                        createdAt: now,
                        modifiedBy: userId,
                        modifiedAt: now
                    }));
                } catch (txErr) {
                    console.warn('[Audit] Could not log SAVE update transaction:', txErr.message);
                }
            } else {
                // Creation of a new record via draft flow
                try {
                    await cds.run(INSERT.into(TestResultTransactions).entries({
                        ID: uuidv4(),
                        result_ID: data.ID,
                        action: 'Single Translation Created',
                        performedBy: userId,
                        outcome: data.outcome || 'Success',
                        accuracy: data.accuracy !== undefined ? data.accuracy : null,
                        details: `Translation recorded for target language: ${data.targetLanguage || 'Unknown'}`,
                        createdBy: userId,
                        createdAt: now,
                        modifiedBy: userId,
                        modifiedAt: now
                    }));
                } catch (txErr) {
                    console.warn('[Audit] Could not log SAVE create transaction:', txErr.message);
                }
            }
        });

        // ─────────────────────────────────────────────
        // AFTER handler: Direct CREATE on TestResults (e.g. from Single Translation dialog)
        // ─────────────────────────────────────────────
        this.after('CREATE', 'TestResults', async (data, req) => {
            const records = Array.isArray(data) ? data : [data];
            const userId = req.user?.id || 'Business User';
            const now = new Date().toISOString();
            const txRecords = [];

            for (const record of records) {
                if (!record || !record.ID) continue;
                // If draft record (IsActiveEntity === false), don't log until activated/saved
                if (record.IsActiveEntity === false) continue;

                txRecords.push({
                    ID: uuidv4(),
                    result_ID: record.ID,
                    action: 'Single Translation Created',
                    performedBy: userId,
                    outcome: record.outcome || 'Success',
                    accuracy: record.accuracy !== undefined ? record.accuracy : null,
                    details: `Single translation recorded for target language: ${record.targetLanguage || 'Unknown'}`,
                    createdBy: userId,
                    createdAt: now,
                    modifiedBy: userId,
                    modifiedAt: now
                });
            }

            if (txRecords.length > 0) {
                try {
                    await cds.run(INSERT.into(TestResultTransactions).entries(txRecords));
                } catch (txErr) {
                    console.warn('[Audit] Could not log CREATE transaction:', txErr.message);
                }
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

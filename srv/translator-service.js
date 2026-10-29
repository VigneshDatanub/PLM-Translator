// =============================================================
// PLM Translator - Service Handler (Node.js)
// =============================================================
// This is the CAP equivalent of Python's routes/api.py
// It implements the actual logic for every CDS action/function.
//
// CAP Pattern:
//   .cds file  = declares WHAT endpoints exist (the contract)
//   .js file   = implements HOW they work (the logic)
//
// Key differences from Python Flask:
//   - Flask uses @app.route decorators → CAP uses srv.on() handlers
//   - Flask has request.get_json() → CAP passes params directly
//   - SQLAlchemy db.session → CAP uses cds.run(INSERT/SELECT/DELETE)
//   - Flask's send_file() → Express res.send() for downloads
// =============================================================

const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');
const googleTranslate = require('./lib/google-translate');
const excelHandler = require('./lib/excel-handler');

module.exports = class TranslatorService extends cds.ApplicationService {

    async init() {
        const { TestResults } = this.entities;

        // ─────────────────────────────────────────────
        // ACTION: translate
        // Equivalent of: POST /api/translate
        // ─────────────────────────────────────────────
        this.on('translate', async (req) => {
            const { text, targetLanguage } = req.data;

            // Validation (same checks as Python)
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

            // Process each target language (same loop as Python's _process_batch_translation)
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

                // Bulk insert to database (equivalent of Python's db.session.bulk_insert_mappings)
                if (dbRecords.length > 0) {
                    try {
                        await cds.run(INSERT.into(TestResults).entries(dbRecords));
                    } catch (dbError) {
                        console.error('[MassTranslate] Bulk insert failed, trying individual:', dbError.message);
                        // Fallback to individual inserts
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
            return {
                success: true,
                message: `Mass translation completed: ${successfulTranslations} successful`,
                sessionId: sessionId,
                statistics: {
                    totalRows: totalRows,
                    successful: successfulTranslations,
                    failed: totalExpected - successfulTranslations,
                    successRate: totalRows > 0 ? Math.round((successfulTranslations / totalExpected) * 10000) / 100 : 0,
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
        // Equivalent of: GET /api/azure-user
        // ─────────────────────────────────────────────
        this.on('getUserInfo', async (req) => {
            // In BTP, user info comes from the request context
            const user = req.user?.id || 'anonymous';
            return {
                success: true,
                user: user,
                timestamp: new Date().toISOString()
            };
        });

        // ─────────────────────────────────────────────
        // FUNCTION: exportResults (placeholder — real logic via Express)
        // ─────────────────────────────────────────────
        this.on('exportResults', async () => {
            return 'Use GET /api/export-results-excel endpoint for file download';
        });

        // ─────────────────────────────────────────────
        // FUNCTION: downloadTemplate (placeholder — real logic via Express)
        // ─────────────────────────────────────────────
        this.on('downloadTemplate', async () => {
            return 'Use GET /api/download-template-excel endpoint for file download';
        });

        // ─────────────────────────────────────────────
        // BEFORE handler: Validate TestResults on CREATE
        // Equivalent of: save_test_results() validation in Python
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

            // Normalize 'Failed' to 'Failure' (same as Python)
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
        // Custom Express middleware for file upload/download
        // These can't be expressed as pure OData operations
        // ─────────────────────────────────────────────
        this.on('bootstrap', async (srv) => {
            // This doesn't exist in CAP — we use .prepend instead
        });

        await super.init();
    }
};

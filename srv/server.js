// =============================================================
// Custom Express Server for File Upload/Download Endpoints
// =============================================================
// CAP's OData protocol handles JSON data perfectly, but file
// uploads (multipart/form-data) and binary file downloads need
// custom Express routes.
//
// This file adds these routes BEFORE CAP's own middleware loads:
//   POST /api/upload-and-translate  → Upload Excel + translate
//   GET  /api/export-results-excel  → Download test results as Excel
//   GET  /api/download-template-excel → Download blank template
//   POST /api/download-translation-results → Download session results
// =============================================================

const cds = require('@sap/cds');
const express = require('express');
const multer = require('multer');
const excelHandler = require('./lib/excel-handler');
const googleTranslate = require('./lib/google-translate');

// Configure multer for in-memory file storage (like Python's tempfile)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        // Only allow Excel files (same validation as Python)
        if (file.originalname.match(/\.(xlsx|xls)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Please upload an Excel file (.xlsx or .xls)'));
        }
    }
});

// Hook into CAP's bootstrap to add custom Express routes
cds.on('bootstrap', (app) => {

    // ─────────────────────────────────────────────
    // POST /api/upload-and-translate
    // Equivalent of: POST /api/mass-translate (Python)
    // Handles multipart file upload + translation
    // ─────────────────────────────────────────────
    app.post('/api/upload-and-translate', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const targetLanguagesJson = req.body.target_languages;
            const testedBy = req.body.tested_by;

            if (!testedBy || !testedBy.trim()) {
                return res.status(400).json({ success: false, error: 'Tested by field is required' });
            }

            if (!targetLanguagesJson) {
                return res.status(400).json({ success: false, error: 'Target languages are required' });
            }

            let targetLanguages;
            try {
                targetLanguages = JSON.parse(targetLanguagesJson);
                if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
                    throw new Error('Invalid format');
                }
            } catch (e) {
                return res.status(400).json({ success: false, error: `Invalid target languages: ${e.message}` });
            }

            // Parse Excel file
            const parseResult = excelHandler.parseExcelFile(req.file.buffer);
            if (!parseResult.success) {
                return res.status(400).json({ success: false, error: parseResult.error });
            }

            const { texts, totalRows } = parseResult;
            const sessionId = `mass_translation_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}`;

            // Connect to database
            const db = await cds.connect.to('db');
            const TestResults = db.entities['plm.translator.TestResults'] || 'plm.translator.TestResults';
            const { v4: uuidv4 } = require('uuid');

            let successfulTranslations = 0;
            let failedTranslations = 0;

            // Process each target language
            for (const targetLanguage of targetLanguages) {
                const sourceTexts = texts.map(item => item.text);
                const batchResults = await googleTranslate.translateBatch(sourceTexts, targetLanguage, 25);
                const formattedLang = await googleTranslate.formatTargetLanguage(targetLanguage);

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
                            textToTranslate: originalData.text,
                            translatedText: result.translatedText,
                            sourceLanguage: 'auto',
                            targetLanguage: formattedLang,
                            sessionId: sessionId
                        });
                        successfulTranslations++;
                    } else {
                        const errorMessage = result.error || 'Unknown error';
                        dbRecords.push({
                            ID: uuidv4(),
                            outcome: 'Failure',
                            accuracy: null,
                            observation: `Mass translation FAILED - Row ${rowIndex} - Error: ${errorMessage}${description ? ' - ' + description : ''}`,
                            testedBy: testedBy.trim(),
                            textToTranslate: originalData.text,
                            translatedText: `ERROR: ${errorMessage}`,
                            sourceLanguage: 'auto',
                            targetLanguage: formattedLang,
                            sessionId: sessionId
                        });
                        failedTranslations++;
                    }
                }

                // Save to database
                if (dbRecords.length > 0) {
                    try {
                        await db.run(INSERT.into(TestResults).entries(dbRecords));
                    } catch (err) {
                        console.error('[Upload] Bulk insert failed:', err.message);
                        for (const record of dbRecords) {
                            try { await db.run(INSERT.into(TestResults).entries([record])); } catch (e) { /* skip */ }
                        }
                    }
                }
            }

            const totalExpected = totalRows * targetLanguages.length;
            res.json({
                success: true,
                message: `Mass translation completed: ${successfulTranslations} successful`,
                sessionId: sessionId,
                statistics: {
                    totalRows,
                    successful: successfulTranslations,
                    failed: totalExpected - successfulTranslations,
                    successRate: totalExpected > 0 ? Math.round((successfulTranslations / totalExpected) * 10000) / 100 : 0,
                    languagesCount: targetLanguages.length,
                    targetLanguages
                }
            });

        } catch (error) {
            console.error('[Upload] Error:', error);
            res.status(500).json({ success: false, error: `Server error: ${error.message}` });
        }
    });

    // ─────────────────────────────────────────────
    // GET /api/export-results-excel
    // Equivalent of: GET /api/export-test-results (Python)
    // ─────────────────────────────────────────────
    app.get('/api/export-results-excel', async (req, res) => {
        try {
            const db = await cds.connect.to('db');
            const TestResults = db.entities['plm.translator.TestResults'] || 'plm.translator.TestResults';

            // Build query with optional filters (same as Python)
            let query = SELECT.from(TestResults).orderBy({ createdAt: 'desc' });

            // Apply filters from query params
            const conditions = [];
            if (req.query.outcome) {
                const oc = req.query.outcome.trim().toLowerCase();
                if (oc.includes('fail')) {
                    conditions.push({ outcome: { in: ['Failed', 'Failure'] } });
                } else {
                    conditions.push({ outcome: req.query.outcome.trim() });
                }
            }
            if (req.query.language) {
                conditions.push({ targetLanguage: { like: `%${req.query.language}%` } });
            }
            if (req.query.q) {
                const searchTerm = `%${req.query.q}%`;
                // CDS doesn't have OR in conditions easily, so we filter in JS
            }

            if (conditions.length > 0) {
                query = SELECT.from(TestResults).where(conditions[0]).orderBy({ createdAt: 'desc' });
            }

            const results = await db.run(query);

            if (!results || results.length === 0) {
                return res.status(404).json({ error: 'No test results to export' });
            }

            // Generate Excel file
            const excelBuffer = excelHandler.createResultsExcel(results);

            const filename = `test_results_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(excelBuffer));

        } catch (error) {
            console.error('[Export] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ─────────────────────────────────────────────
    // GET /api/languages
    // Direct REST endpoint returning all Google supported languages
    // ─────────────────────────────────────────────
    app.get('/api/languages', async (req, res) => {
        try {
            const languages = await googleTranslate.getSupportedLanguages();
            res.json({ value: languages });
        } catch (error) {
            console.error('[Languages] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ─────────────────────────────────────────────
    // GET /api/download-template-excel
    // Equivalent of: GET /api/download-template (Python)
    // ─────────────────────────────────────────────
    app.get('/api/download-template-excel', (req, res) => {
        try {
            const templateBuffer = excelHandler.createTemplateExcel();

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="mass_translation_template.xlsx"');
            res.send(Buffer.from(templateBuffer));

        } catch (error) {
            console.error('[Template] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ─────────────────────────────────────────────
    // POST & GET /api/download-translation-results
    // Equivalent of: POST /api/download-translation-results (Python)
    // ─────────────────────────────────────────────
    const handleDownloadResults = async (req, res) => {
        try {
            const session_id = req.body?.session_id || req.query?.session_id;
            const providedResults = req.body?.results;

            let results;

            if (session_id) {
                // Fetch from database by session ID (same as Python)
                const db = await cds.connect.to('db');
                const TestResults = db.entities['plm.translator.TestResults'] || 'plm.translator.TestResults';

                const dbResults = await db.run(
                    SELECT.from(TestResults)
                        .where({ sessionId: session_id })
                        .orderBy('createdAt asc')
                );

                if (!dbResults || dbResults.length === 0) {
                    return res.status(400).json({ error: 'No results found for this session' });
                }

                // Group by source row and source text so multiple languages for the same row are combined
                const rowMap = new Map();

                for (let idx = 0; idx < dbResults.length; idx++) {
                    const r = dbResults[idx];
                    let rowNum = idx + 1;
                    let desc = '';
                    if (r.observation && r.observation.includes('Row ')) {
                        const m = r.observation.match(/Row\s+(\d+)/i);
                        if (m) {
                            rowNum = parseInt(m[1], 10);
                        }
                        const descMatch = r.observation.match(/Row\s+\d+\s*-\s*(.*)/i);
                        if (descMatch) {
                            desc = descMatch[1].trim();
                        }
                    }

                    const key = `${rowNum}_${r.textToTranslate || ''}`;
                    if (!rowMap.has(key)) {
                        rowMap.set(key, {
                            row: rowNum,
                            sourceText: r.textToTranslate || '',
                            success: true,
                            translations: {},
                            description: desc,
                            errors: []
                        });
                    }

                    const entry = rowMap.get(key);
                    const langCode = (r.targetLanguage ? r.targetLanguage.split('-')[0] : 'unknown').trim();

                    if (r.outcome === 'Success') {
                        entry.translations[langCode] = r.translatedText || '';
                    } else {
                        entry.success = false;
                        entry.errors.push(`${r.targetLanguage || langCode}: ${r.observation || 'Translation failed'}`);
                    }
                }

                results = Array.from(rowMap.values()).sort((a, b) => a.row - b.row);
            } else if (providedResults && Array.isArray(providedResults) && providedResults.length > 0) {
                results = providedResults;
            } else {
                return res.status(400).json({ error: 'No translation results or session_id provided' });
            }

            // Build language map
            const languages = await googleTranslate.getSupportedLanguages();
            const languageMap = {};
            for (const lang of languages) {
                if (lang.key) languageMap[lang.key] = lang.text;
            }

            const excelBuffer = excelHandler.createTranslationResultsExcel(results, languageMap);

            const filename = `translation_results_${session_id || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(excelBuffer));

        } catch (error) {
            console.error('[DownloadResults] Error:', error);
            res.status(500).json({ error: error.message });
        }
    };

    app.post('/api/download-translation-results', express.json(), handleDownloadResults);
    app.get('/api/download-translation-results', handleDownloadResults);

    // Serve static frontend files
    const path = require('path');
    app.use('/app', require('express').static(path.join(__dirname, '..', 'app', 'translator', 'webapp')));

    // Redirect root to the UI5 app
    app.get('/', (req, res) => {
        res.redirect('/app/');
    });
});

module.exports = cds.server;


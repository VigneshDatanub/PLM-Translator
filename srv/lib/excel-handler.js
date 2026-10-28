// =============================================================
// Excel File Handler
// =============================================================
// Replaces Python's Pandas + openpyxl Excel processing.
// Uses the 'xlsx' (SheetJS) npm library instead.
//
// Handles:
//   1. parseExcelFile()       → Read uploaded Excel, extract texts
//   2. createResultsExcel()   → Export test results to Excel download
//   3. createTemplateExcel()  → Generate blank template for mass translation
// =============================================================

const XLSX = require('xlsx');

/**
 * Parse an uploaded Excel file and extract text data.
 * Equivalent of Python's pd.read_excel() + text column detection logic
 * from routes/api.py _process_batch_translation()
 *
 * @param {Buffer} fileBuffer - Raw file buffer from upload
 * @returns {Object} { success, texts, totalRows, textColumn, error }
 */
function parseExcelFile(fileBuffer) {
    try {
        // Read the workbook from buffer
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return { success: false, error: 'Excel file has no sheets' };
        }

        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON array of objects (like pd.read_excel())
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!data || data.length === 0) {
            return { success: false, error: 'Excel file is empty' };
        }

        const columns = Object.keys(data[0]);

        // Find text column - same priority order as Python
        const possibleTextColumns = [
            'Phrase Text', 'phrase text', 'PHRASE TEXT',
            'text', 'Text', 'TEXT',
            'content', 'Content', 'CONTENT',
            'message', 'Message', 'MESSAGE'
        ];

        let textColumn = null;
        for (const col of possibleTextColumns) {
            if (columns.includes(col)) {
                textColumn = col;
                break;
            }
        }

        // Fallback to first column (same as Python)
        if (!textColumn) {
            textColumn = columns[0];
        }

        // Find description column
        const possibleDescColumns = [
            'description', 'Description', 'DESCRIPTION',
            'desc', 'Desc', 'notes', 'Notes'
        ];

        let descriptionColumn = null;
        for (const col of possibleDescColumns) {
            if (columns.includes(col) && col !== textColumn) {
                descriptionColumn = col;
                break;
            }
        }

        // Collect valid texts (same filtering as Python)
        const texts = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            let sourceText = String(row[textColumn] || '').trim();
            let description = '';

            if (descriptionColumn && row[descriptionColumn]) {
                description = String(row[descriptionColumn]).trim();
                if (['nan', 'none', ''].includes(description.toLowerCase())) {
                    description = '';
                }
            }

            // Skip empty / nan / none values (same as Python)
            if (sourceText && !['nan', 'none', ''].includes(sourceText.toLowerCase())) {
                texts.push({
                    index: i,
                    text: sourceText,
                    description: description
                });
            }
        }

        return {
            success: true,
            texts: texts,
            totalRows: data.length,
            textColumn: textColumn,
            columns: columns
        };

    } catch (error) {
        return {
            success: false,
            error: `Error reading Excel file: ${error.message}`
        };
    }
}

/**
 * Create an Excel file with test results for download.
 * Equivalent of Python's export_test_results() route in api.py
 *
 * @param {Array} results - Array of test result objects from database
 * @returns {Buffer} Excel file as buffer
 */
function createResultsExcel(results) {
    // Convert results to flat data array (same format as Python)
    const data = results.map(result => {
        // Normalize outcome display (same as Python)
        let outcomeDisplay = result.outcome;
        if (outcomeDisplay && ['failed', 'failure'].includes(outcomeDisplay.toLowerCase())) {
            outcomeDisplay = 'Failed';
        }

        return {
            'ID': result.ID || result.id,
            'Text to Translate': result.textToTranslate || result.text_to_translate || '',
            'Translated Text': result.translatedText || result.translated_text || '',
            'Source Language': result.sourceLanguage || result.source_language || '',
            'Target Language': result.targetLanguage || result.target_language || '',
            'Outcome': outcomeDisplay,
            'Observation': result.observation || '',
            'Accuracy (%)': result.accuracy,
            'Tested By': result.testedBy || result.tested_by || '',
            'Date Created': result.createdAt || result.created_at || '',
            'Session ID': result.sessionId || result.session_id || ''
        };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths (equivalent of Python's auto-adjust)
    const colWidths = Object.keys(data[0] || {}).map(key => {
        const maxLen = Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Results');

    // Write to buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Create the mass translation template Excel file.
 * Equivalent of Python's download_template() route in api.py
 *
 * @returns {Buffer} Excel template file as buffer
 */
function createTemplateExcel() {
    const workbook = XLSX.utils.book_new();

    // Data sheet with sample rows (same as Python)
    const sampleData = [
        { 'Phrase Text': 'Hello, how are you?' },
        { 'Phrase Text': 'Thank you for your help.' },
        { 'Phrase Text': 'Please review this document.' }
    ];

    const dataSheet = XLSX.utils.json_to_sheet(sampleData);
    dataSheet['!cols'] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Translation Data');

    // Instructions sheet (same content as Python)
    const instructions = [
        ['Mass Translation Template Instructions'],
        [''],
        ['How to use this template:'],
        ['1. Replace the sample data with your own text to translate'],
        ['2. Keep the column headers as they are'],
        ['3. Supported column names: text, content, message, description'],
        ['4. You can use either "text" or "description" column (or both)'],
        ['5. Maximum 5000 characters per text entry'],
        ['6. Save the file as .xlsx or .xls format'],
        ['7. Upload the file to the PLM Translator mass translation page'],
        [''],
        ['Column Descriptions:'],
        ['- Phrase Text: The main text content to be translated (required)'],
        ['- Description: Optional description or context for the text'],
        [''],
        ['Notes:'],
        ['- Empty rows will be skipped'],
        ['- Processing time depends on the number of rows'],
        ['- Results will include source text, translated text, and status'],
        ['- You can download the translation results after processing']
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Write to buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Create translation results Excel from mass translation output.
 * Equivalent of Python's download_translation_results() in api.py
 *
 * @param {Array} results - Array of translation result records
 * @param {Object} languageMap - Map of language code → display name
 * @returns {Buffer} Excel file as buffer
 */
function createTranslationResultsExcel(results, languageMap) {
    const data = results.map(result => {
        const row = {
            'Row': result.row || '',
            'Source Text': result.sourceText || result.source_text || '',
            'Status': result.success ? 'Success' : 'Failed'
        };

        if (result.description) {
            row['Description'] = result.description;
        }

        if (result.translations && Object.keys(result.translations).length > 0) {
            for (const [langCode, translation] of Object.entries(result.translations)) {
                const langName = languageMap[langCode] || langCode.toUpperCase();
                row[`${langName} (${langCode.toUpperCase()})`] = translation;
            }
            row['Errors'] = result.error || (Array.isArray(result.errors) ? result.errors.join('; ') : '');
        } else if (result.success && (result.translatedText || result.translated_text)) {
            row['Translation'] = result.translatedText || result.translated_text;
            row['Errors'] = '';
        } else {
            row['Translation'] = '';
            row['Errors'] = result.error || (Array.isArray(result.errors) ? result.errors.join('; ') : '');
        }

        return row;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-adjust column widths
    const cols = Object.keys(data[0] || {});
    worksheet['!cols'] = cols.map(key => {
        const maxLen = Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 50) };
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Translation Results');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
    parseExcelFile,
    createResultsExcel,
    createTemplateExcel,
    createTranslationResultsExcel
};

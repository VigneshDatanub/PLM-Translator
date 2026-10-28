// =============================================================
// PLM Translator - Service Definition (CDS)
// =============================================================
// This is the CAP equivalent of Python's routes/__init__.py
// It declares WHAT endpoints exist (the contract).
// The actual logic is in translator-service.js (the handler).
//
// Route Mapping from Python Flask → CAP:
//   /api/languages           → getLanguages() function
//   /api/translate            → translate() action
//   /api/mass-translate       → massTranslate() action
//   /api/save-test-results    → POST /TestResults (built-in OData)
//   /api/test-results         → GET /TestResults (built-in OData)
//   /api/test-results/:id     → DELETE /TestResults(ID) (built-in OData)
//   /api/export-test-results  → exportResults() function
//   /api/download-template    → downloadTemplate() function
//   /api/azure-user           → getUserInfo() function
// =============================================================

using { plm.translator as db } from '../db/schema';

service TranslatorService @(path: '/api') {

    // ─── TestResults Entity (OData CRUD) ───
    // Replaces: /api/save-test-results (POST), /api/test-results (GET), /api/test-results/:id (DELETE)
    // CAP auto-generates full OData CRUD endpoints for this entity
    entity TestResults as projection on db.TestResults;

    // ─── Translation Actions ───
    // Replaces: /api/translate (POST)
    // Action = POST-like operation with a request body
    action translate(
        text           : String,
        targetLanguage : String
    ) returns {
        success        : Boolean;
        translatedText : String;
        sourceLanguage : String;
        targetLanguage : String;
        error          : String;
    };

    // Replaces: /api/mass-translate (POST)
    // This is triggered from the UI after file upload
    action massTranslate(
        textsJson       : LargeString,   // JSON array of source texts
        targetLanguages : LargeString,   // JSON array of target language codes
        testedBy        : String
    ) returns {
        success    : Boolean;
        message    : String;
        sessionId  : String;
        statistics : {
            totalRows      : Integer;
            successful     : Integer;
            failed         : Integer;
            successRate    : Double;
            languagesCount : Integer;
        };
        error      : String;
    };

    // ─── Utility Functions ───
    // Replaces: /api/languages (GET)
    // Function = GET-like operation (read-only, no side effects)
    function getLanguages() returns array of {
        ![key] : String;
        code   : String;
        name   : String;
        text   : String;
    };

    // Replaces: /api/azure-user (GET)
    function getUserInfo() returns {
        success   : Boolean;
        user      : String;
        timestamp : String;
    };

    // Replaces: /api/export-test-results (GET)
    // Returns file download — handled via custom express middleware
    function exportResults() returns LargeString;

    // Replaces: /api/download-template (GET)
    function downloadTemplate() returns LargeString;
}

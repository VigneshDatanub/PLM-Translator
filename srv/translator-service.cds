// =============================================================
// PLM Translator - Service Definition (CDS)
// =============================================================
// 100% Strict SAP CAPM Service Architecture
//   - Standard OData V4 Service Contract
//   - Declarative Role-Based Authorization (@restrict)
//   - Draft enablement on TestResults for Fiori Elements
//   - Clean service entities, actions, and functions
// =============================================================

using { plm.translator as db } from '../db/schema';

@path: '/api'
service TranslatorService @(requires: ['authenticated-user', 'any']) {

    // ─── TestResults Entity (OData V4 CRUD + Draft Enabled) ───
    @odata.draft.enabled
    entity TestResults as projection on db.TestResults;

    // Declarative Security: TranslatorUser can Read & Create, TranslatorAdmin has full control
    annotate TestResults with @(restrict: [
        { grant: ['READ', 'CREATE'], to: ['TranslatorUser', 'authenticated-user', 'any'] },
        { grant: '*', to: ['TranslatorAdmin', 'admin'] }
    ]);

    // ─── Translation Sessions (Header for Batch Runs) ───
    @readonly
    entity TranslationSessions as projection on db.TranslationSessions;

    annotate TranslationSessions with @(restrict: [
        { grant: ['READ'], to: ['TranslatorUser', 'authenticated-user', 'any'] },
        { grant: '*', to: ['TranslatorAdmin', 'admin'] }
    ]);

    // ─── Languages CodeList (for Fiori Elements Value Helps) ───
    @readonly
    entity Languages as projection on db.Languages;

    annotate Languages with @(restrict: [
        { grant: 'READ', to: ['authenticated-user', 'any'] }
    ]);

    // ─── Native CAP Media Entity for Excel Batch Processing ───
    entity ExcelUploads as projection on db.ExcelUploads;

    annotate ExcelUploads with @(restrict: [
        { grant: ['READ', 'CREATE'], to: ['TranslatorUser', 'authenticated-user', 'any'] },
        { grant: '*', to: ['TranslatorAdmin', 'admin'] }
    ]);

    // ─── Translation Actions ───
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

    action massTranslate(
        textsJson       : LargeString,
        targetLanguages : LargeString,
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
    function getLanguages() returns array of {
        ![key] : String;
        code   : String;
        name   : String;
        text   : String;
    };

    function getUserInfo() returns {
        success   : Boolean;
        user      : String;
        email     : String;
        id        : String;
        roles     : {
            isAdmin : Boolean;
            isUser  : Boolean;
        };
        timestamp : String;
    };

    function exportResults() returns LargeString;

    function downloadTemplate() returns LargeString;
}

// Include SAP Fiori Elements UI Annotations
using from './annotations';

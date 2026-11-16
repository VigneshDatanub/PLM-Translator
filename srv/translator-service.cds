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
service TranslatorService @(requires: 'authenticated-user') {

    // ─── TestResults Entity (OData V4 CRUD + Draft Enabled) ───
    @odata.draft.enabled
    entity TestResults as projection on db.TestResults;

    // Declarative Security:
    // - User: Only see & edit their own created records; no delete.
    // - Admin: See & edit all records; no delete.
    annotate TestResults with @(restrict: [
        { grant: ['READ', 'UPDATE'], to: 'TranslatorUser', where: 'createdBy = $user' },
        { grant: 'CREATE', to: 'TranslatorUser' },
        { grant: ['READ', 'UPDATE', 'CREATE'], to: 'TranslatorAdmin' }
    ]);

    // ─── Transaction History (Read-only Audit Trail) ───
    @readonly
    entity TestResultTransactions as projection on db.TestResultTransactions;

    annotate TestResultTransactions with @(restrict: [
        { grant: 'READ', to: 'TranslatorUser', where: 'createdBy = $user' },
        { grant: 'READ', to: 'TranslatorAdmin' }
    ]);

    // ─── Translation Sessions (Header for Batch Runs) ───
    @readonly
    entity TranslationSessions as projection on db.TranslationSessions;

    annotate TranslationSessions with @(restrict: [
        { grant: 'READ', to: ['TranslatorUser', 'TranslatorAdmin'] }
    ]);

    // ─── Languages CodeList (for Fiori Elements Value Helps) ───
    @readonly
    entity Languages as projection on db.Languages;

    annotate Languages with @(restrict: [
        { grant: 'READ', to: 'authenticated-user' }
    ]);

    // ─── Translation Actions ───
    action singleTranslate(
        @title: 'Source Text to Translate'
        @mandatory
        @UI.MultiLineText: true
        sourceText     : LargeString,

        @title: 'Target Language'
        @mandatory
        @Common.ValueList: {
            CollectionPath: 'Languages',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: 'targetLanguage', ValueListProperty: 'code' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
            ]
        }
        targetLanguage : String,

        @title: 'Source Language'
        sourceLanguage : String,

        @title: 'Translated Text'
        @UI.MultiLineText: true
        translatedText : LargeString,

        @title: 'Quality Assessment (Outcome)'
        outcome        : db.OutcomeType,

        @title: 'Accuracy Rating (0 - 100%)'
        accuracy       : Double,

        @title: 'Observations & Notes'
        @UI.MultiLineText: true
        observation    : String,

        @title: 'Session Identifier'
        sessionId      : String
    ) returns TestResults;

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
        targetLanguages : LargeString
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

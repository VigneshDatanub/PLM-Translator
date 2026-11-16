// =============================================================
// PLM Translator - Database Schema (CDS Data Model)
// =============================================================
// 100% Strict SAP CAPM Data Model
// Adheres strictly to SAP Cloud Application Programming standards:
//   - cuid, managed aspects from @sap/cds/common
//   - Standard CodeList for Languages
//   - Strict Enum type for Outcome with Fiori Criticality
//   - TranslationSessions header with Composition of TestResults
//   - Native CAP Media entity for Excel streaming
// =============================================================

namespace plm.translator;

using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';

/**
 * Outcome enum type with strict business domain values
 */
type OutcomeType : String(10) enum {
    Success = 'Success';
    Failure = 'Failure';
    Partial = 'Partial';
};

/**
 * Standard Languages CodeList for Fiori Elements Value Helps
 */
entity Languages : CodeList {
    key code : String(10);
}

/**
 * Header entity for Mass Translation Batch Sessions
 */
entity TranslationSessions : cuid, managed {
    sessionName     : String(50) @title: 'Session Name';
    sessionId       : String(40) @title: 'Session Identifier';
    totalRows       : Integer     @title: 'Total Rows';
    successful      : Integer     @title: 'Successful Translations';
    failed          : Integer     @title: 'Failed Translations';
    successRate     : Double      @title: 'Success Rate (%)';
    
    // Header-Item Composition
    results         : Composition of many TestResults on results.session = $self;
}

/**
 * TestResults entity - stores all translation test outcomes
 */
entity TestResults : cuid, managed {
    session         : Association to TranslationSessions;
    outcome         : OutcomeType  @mandatory @title: 'Outcome';
    accuracy        : Double       @assert.range: [0, 100] @title: 'Accuracy (%)';
    observation     : String(500) @title: 'Observations';
    textToTranslate : LargeString  @title: 'Source Text';
    translatedText  : LargeString  @title: 'Translated Text';
    sourceLanguage  : String(20)   @title: 'Source Language';
    targetLanguage  : String(20)  @title: 'Target Language';
    sessionId       : String(40)  @title: 'Session Identifier';

    // Virtual criticality calculated on read for Fiori status colors (1=Red, 2=Orange, 3=Green)
    virtual criticality : Integer  @title: 'Criticality';

    // Composition of transaction audit trail
    transactions    : Composition of many TestResultTransactions on transactions.result = $self;
}

/**
 * Transaction history / Audit log for TestResults
 */
entity TestResultTransactions : cuid, managed {
    result          : Association to TestResults;
    action          : String(40)   @title: 'Action';
    performedBy     : String(10)  @title: 'Performed By';
    outcome         : String(10)   @title: 'Outcome';
    accuracy        : Double       @title: 'Accuracy (%)';
    details         : String(500) @title: 'Transaction Details';
}

// =============================================================
// PLM Translator - SAP Fiori Elements Annotations (CDS)
// =============================================================
// 100% Strict Fiori Elements OData V4 Metadata Annotations
// Defines:
//   - HeaderInfo, Title & Description
//   - SmartFilterBar Selection Fields
//   - SmartTable LineItem Columns with Criticality status colors
//   - Object Page Header KPI Facets & Sections (General, Translation, Evaluation)
//   - Value Helps for Languages and Outcomes
// =============================================================

using { TranslatorService as srv } from './translator-service';

// ─── TestResults Annotations ───
annotate srv.TestResults with @(

    // Suppress standard manual create and delete buttons (neither User nor Admin can delete)
    UI.CreateHidden: true,
    UI.DeleteHidden: true,

    // Header Info
    UI.HeaderInfo: {
        TypeName: 'Translation Evaluation',
        TypeNamePlural: 'Translation Evaluations',
        Title: { Value: sessionId }
    },

    // Filter Bar Search Fields
    UI.SelectionFields: [
        outcome,
        targetLanguage,
        createdBy,
        createdAt
    ],

    // List Report Table Columns & Actions
    UI.LineItem: [
        {
            $Type: 'UI.DataField',
            Value: outcome,
            Criticality: criticality,
            CriticalityRepresentation: #WithIcon,
            Label: 'Outcome',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '10rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: accuracy,
            Label: 'Accuracy (%)',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '8rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: targetLanguage,
            Label: 'Target Language',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '12rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: textToTranslate,
            Label: 'Source Text',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '22rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: translatedText,
            Label: 'Translated Text',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '22rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: createdBy,
            Label: 'Created By',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '12rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: createdAt,
            Label: 'Tested On',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '12rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: observation,
            Label: 'Observations',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '20rem' }
        }
    ],

    // Object Page Header KPI DataPoints
    UI.HeaderFacets: [
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Outcome'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Accuracy'
        }
    ],

    UI.DataPoint #Outcome: {
        Value: outcome,
        Title: 'Evaluation Outcome',
        Criticality: criticality
    },

    UI.DataPoint #Accuracy: {
        Value: accuracy,
        Title: 'Accuracy Rating (%)'
    },

    // Object Page Layout Sections
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'TranslationFacet',
            Label: 'Translation Content',
            Target: '@UI.FieldGroup#Translation'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'EvaluationFacet',
            Label: 'Evaluation & Quality Assessment',
            Target: '@UI.FieldGroup#Evaluation'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'GeneralInfoFacet',
            Label: 'Audit & Session Information',
            Target: '@UI.FieldGroup#GeneralInfo'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'TransactionsFacet',
            Label: 'Transaction History',
            Target: 'transactions/@UI.LineItem'
        }
    ],

    UI.FieldGroup #Translation: {
        Data: [
            { Value: sourceLanguage, Label: 'Source Language' },
            { Value: targetLanguage, Label: 'Target Language' },
            { Value: textToTranslate, Label: 'Original Source Text' },
            { Value: translatedText, Label: 'Google Translated Text' }
        ]
    },

    UI.FieldGroup #Evaluation: {
        Data: [
            { Value: outcome, Label: 'Outcome', Criticality: criticality },
            { Value: accuracy, Label: 'Accuracy Score (0 - 100%)' },
            { Value: observation, Label: 'Evaluation Notes / Observations' }
        ]
    },

    UI.FieldGroup #GeneralInfo: {
        Data: [
            { Value: sessionId, Label: 'Session Identifier' },
            { Value: createdBy, Label: 'Created By User' },
            { Value: createdAt, Label: 'Record Created' },
            { Value: modifiedAt, Label: 'Last Modified' },
            { Value: modifiedBy, Label: 'Last Modified By' }
        ]
    }
);

annotate srv.TestResults with {
    sourceLanguage  @readonly  @Common.FieldControl: #ReadOnly;
    textToTranslate @readonly  @Common.FieldControl: #ReadOnly;
    translatedText  @readonly  @Common.FieldControl: #ReadOnly;
    sessionId       @readonly  @Common.FieldControl: #ReadOnly;
    createdAt       @readonly  @Common.FieldControl: #ReadOnly  @(UI.HiddenFilter: false, Common.Label: 'Tested On');
    createdBy       @readonly  @Common.FieldControl: #ReadOnly;
    modifiedAt      @readonly  @Common.FieldControl: #ReadOnly;
    modifiedBy      @readonly  @Common.FieldControl: #ReadOnly;
    criticality     @(UI.HiddenFilter: true);
    ID              @(UI.HiddenFilter: true);
    session         @(UI.HiddenFilter: true);
    targetLanguage  @readonly  @Common.FieldControl: #ReadOnly  @(
        Common.ValueList: {
            CollectionPath: 'Languages',
            Label: 'Target Languages',
            Parameters: [
                {
                    $Type: 'Common.ValueListParameterInOut',
                    LocalDataProperty: targetLanguage,
                    ValueListProperty: 'code'
                },
                {
                    $Type: 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );
};

// ─── TestResultTransactions Annotations ───
annotate srv.TestResultTransactions with @(
    UI.CreateHidden: true,
    UI.DeleteHidden: true,
    UI.LineItem: [
        {
            $Type: 'UI.DataField',
            Value: createdAt,
            Label: 'Transaction Date & Time',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '13rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: action,
            Label: 'Action',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '13rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: performedBy,
            Label: 'Performed By',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '11rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: outcome,
            Label: 'Outcome',
            ![@UI.Importance]: #Medium,
            ![@HTML5.CssDefaults]: { width: '8rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: accuracy,
            Label: 'Accuracy (%)',
            ![@UI.Importance]: #Medium,
            ![@HTML5.CssDefaults]: { width: '8rem' }
        },
        {
            $Type: 'UI.DataField',
            Value: details,
            Label: 'Transaction Details / Changes',
            ![@UI.Importance]: #High,
            ![@HTML5.CssDefaults]: { width: '22rem' }
        }
    ]
);

// ─── Value Help for Languages ───
annotate srv.Languages with @(
    UI.Identification: [
        { Value: name }
    ]
);

annotate srv.Languages with {
    code @(
        title: 'Language Code',
        Common.Text: name,
        Common.TextArrangement: #TextFirst
    );
    name @(title: 'Language Name');
};

// ─── Translation Sessions Annotations ───
annotate srv.TranslationSessions with @(
    UI.HeaderInfo: {
        TypeName: 'Mass Translation Session',
        TypeNamePlural: 'Mass Translation Sessions',
        Title: { Value: sessionName },
        Description: { Value: createdBy }
    },
    UI.LineItem: [
        { $Type: 'UI.DataField', Value: sessionName, Label: 'Session Name' },
        { $Type: 'UI.DataField', Value: totalRows, Label: 'Total Rows' },
        { $Type: 'UI.DataField', Value: successful, Label: 'Successful' },
        { $Type: 'UI.DataField', Value: failed, Label: 'Failed' },
        { $Type: 'UI.DataField', Value: successRate, Label: 'Success Rate (%)' },
        { $Type: 'UI.DataField', Value: createdBy, Label: 'Created By' },
        { $Type: 'UI.DataField', Value: createdAt, Label: 'Created On' }
    ]
);

// ─── Action Side Effects & Visibility for Single Translation ───
annotate srv.singleTranslate with @(
    UI.Hidden: true,
    Common.SideEffects: {
        TargetEntities: [ '/TranslatorService.EntityContainer/TestResults' ]
    }
);



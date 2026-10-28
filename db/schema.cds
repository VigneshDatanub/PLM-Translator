// =============================================================
// PLM Translator - Database Schema (CDS Data Model)
// =============================================================
// Equivalent of Python's models.py (SQLAlchemy TestResult model)
// This defines the database table structure using CDS notation.
// CAP will auto-generate the SQLite/HANA tables from this.
// =============================================================

namespace plm.translator;

using { cuid, managed } from '@sap/cds/common';

/**
 * TestResults entity - stores all translation test outcomes
 * Maps to Python's TestResult SQLAlchemy model:
 *   - id          → key ID (auto-generated UUID via cuid)
 *   - outcome     → Success / Failure / Partial
 *   - accuracy    → 0-100 percentage
 *   - observation → free-text notes (was NVARCHAR(MAX) in Azure SQL)
 *   - tested_by   → who performed the test
 *   - text fields → source & translated text (Unicode-safe by default in CDS)
 *   - language fields → source & target language codes
 *   - session_id  → groups results from a single mass translation run
 *   - createdAt   → auto-managed timestamp (from 'managed' aspect)
 */
entity TestResults : cuid, managed {
    outcome         : String(50)   @mandatory;  // Success, Failure, Partial
    accuracy        : Double;                    // 0-100 percentage
    observation     : String(5000);              // User observations / notes
    testedBy        : String(100);               // Who tested it
    textToTranslate : LargeString;               // Original source text (Unicode)
    translatedText  : LargeString;               // Translated output text (Unicode)
    sourceLanguage  : String(50);                // Source language code (e.g., 'en', 'auto')
    targetLanguage  : String(100);               // Target language code+name (e.g., 'de-German')
    sessionId       : String(100);               // Mass translation session identifier
}

// =============================================================
// Google Cloud Translation API v2 Wrapper
// =============================================================
// Replaces Python's services/translator.py (Azure Translator)
// Uses native Node.js 'https' module for reliable, zero-timeout
// communication with Google Cloud Translation API v2.
// =============================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

// Google Translate API v2 base URLs
const GOOGLE_TRANSLATE_BASE_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_LANGUAGES_URL = 'https://translation.googleapis.com/language/translate/v2/languages';

/**
 * Robust API key loader: Checks process.env, cds.env, and .env file directly.
 */
function getApiKey() {
    if (process.env.GOOGLE_TRANSLATE_API_KEY && process.env.GOOGLE_TRANSLATE_API_KEY !== 'YOUR_GOOGLE_API_KEY_HERE') {
        return process.env.GOOGLE_TRANSLATE_API_KEY;
    }

    try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/GOOGLE_TRANSLATE_API_KEY\s*=\s*([^\r\n]+)/);
            if (match && match[1]) {
                const key = match[1].trim().replace(/^["']|["']$/g, '');
                if (key && key !== 'YOUR_GOOGLE_API_KEY_HERE') {
                    process.env.GOOGLE_TRANSLATE_API_KEY = key;
                    return key;
                }
            }
        }
    } catch (e) {
        // Fall through
    }

    return process.env.GOOGLE_TRANSLATE_API_KEY;
}

/**
 * Check if the Google Translate API is configured.
 */
function isConfigured() {
    const key = getApiKey();
    return !!(key && key !== 'YOUR_GOOGLE_API_KEY_HERE');
}

/**
 * Reliable HTTPS request helper using Node's standard library.
 * Uses family: 4 to force IPv4 and prevent Windows IPv6 resolution hang.
 */
function httpsRequest(url, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        let isSettled = false;
        const parsedUrl = new URL(url);
        const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

        const reqHeaders = Object.assign({}, options.headers || {});
        if (postData) {
            reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json; charset=utf-8';
            reqHeaders['Content-Length'] = Buffer.byteLength(postData);
        }

        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: reqHeaders,
            family: 4 // Force IPv4 to prevent Windows IPv6 socket timeout
        };

        const timeoutMs = options.timeout || 35000;
        let timer = null;

        const req = https.request(reqOptions, (res) => {
            if (timer) clearTimeout(timer);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (isSettled) return;
                isSettled = true;
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Google API error (${res.statusCode}): ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            if (timer) clearTimeout(timer);
            if (!isSettled) {
                isSettled = true;
                reject(err);
            }
        });

        timer = setTimeout(() => {
            if (!isSettled) {
                isSettled = true;
                req.destroy();
                reject(new Error(`Google API request timed out after ${timeoutMs}ms`));
            }
        }, timeoutMs);

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// In-memory language cache
let cachedLanguages = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get supported languages dynamically from Google Cloud Translation API v2.
 * Includes both the language code and human-readable English name: "Name (code)".
 * Uses in-memory caching with fallback to local CSV for instantaneous lookup.
 */
async function getSupportedLanguages() {
    if (cachedLanguages && cachedLanguages.length > 0 && (Date.now() - lastCacheTime < CACHE_DURATION)) {
        return cachedLanguages;
    }

    const apiKey = getApiKey();
    if (apiKey && apiKey !== 'YOUR_GOOGLE_API_KEY_HERE') {
        try {
            const url = `${GOOGLE_LANGUAGES_URL}?key=${apiKey}&target=en`;
            const data = await httpsRequest(url, { method: 'GET', timeout: 15000 });

            if (data && data.data && Array.isArray(data.data.languages)) {
                cachedLanguages = data.data.languages
                    .filter(lang => lang && lang.language)
                    .map(lang => {
                        const code = lang.language;
                        const name = lang.name || lang.language;
                        return {
                            key: code,
                            code: code,
                            name: name,
                            text: `${name} (${code})`
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));

                lastCacheTime = Date.now();
                return cachedLanguages;
            }
        } catch (apiErr) {
            console.warn('[GoogleTranslate] Failed to fetch languages live, falling back to local dataset:', apiErr.message);
        }
    }

    // Local CSV fallback (195 languages)
    try {
        const csvPath = path.resolve(__dirname, '../../db/data/plm.translator-Languages.csv');
        if (fs.existsSync(csvPath)) {
            const content = fs.readFileSync(csvPath, 'utf8');
            const lines = content.split('\n').filter(l => l.trim().length > 0).slice(1);
            cachedLanguages = lines.map(line => {
                const parts = line.includes(';') ? line.split(';') : line.split(',');
                const code = parts[0]?.trim();
                const name = parts[1]?.trim() || code;
                const descr = parts[2]?.trim() || `${name} (${code})`;
                return { key: code, code: code, name: name, text: descr };
            }).sort((a, b) => a.name.localeCompare(b.name));
            lastCacheTime = Date.now();
            return cachedLanguages;
        }
    } catch (csvErr) {
        console.error('[GoogleTranslate] CSV fallback error:', csvErr.message);
    }

    return [];
}

/**
 * Translate a single text using Google Cloud Translation API v2.
 */
async function translateText(text, targetLanguage) {
    if (!isConfigured()) {
        return {
            success: false,
            error: 'Google Translate API is not configured. Please set GOOGLE_TRANSLATE_API_KEY in .env file.'
        };
    }

    try {
        const apiKey = getApiKey();
        const url = `${GOOGLE_TRANSLATE_BASE_URL}?key=${apiKey}`;
        const payload = {
            q: text,
            target: targetLanguage,
            format: 'text'
        };

        const result = await httpsRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        }, payload);

        if (result && result.data && result.data.translations && result.data.translations.length > 0) {
            const translation = result.data.translations[0];
            return {
                success: true,
                translatedText: translation.translatedText,
                sourceLanguage: translation.detectedSourceLanguage || 'auto',
                targetLanguage: targetLanguage
            };
        } else {
            throw new Error('Invalid translation response');
        }

    } catch (error) {
        console.error('[GoogleTranslate] translateText error:', error.message);
        return {
            success: false,
            error: `Translation failed: ${error.message}`
        };
    }
}

/**
 * Translate multiple texts in batches with exponential backoff retry.
 */
async function translateBatch(texts, targetLanguage, maxBatchSize = 50) {
    if (!isConfigured()) {
        return texts.map(text => ({
            success: false,
            error: 'Google Translate API is not configured.',
            translatedText: '',
            originalText: text
        }));
    }

    if (!texts || texts.length === 0) {
        return [];
    }

    const allResults = [];
    const apiKey = getApiKey();

    const REQUEST_DELAY = 500;
    const MAX_RETRIES = 5;

    const totalBatches = Math.ceil(texts.length / maxBatchSize);
    console.log(`[GoogleTranslate] Processing ${texts.length} texts in ${totalBatches} batches of up to ${maxBatchSize}`);

    for (let i = 0; i < texts.length; i += maxBatchSize) {
        const batch = texts.slice(i, i + maxBatchSize);
        const batchNum = Math.floor(i / maxBatchSize) + 1;
        console.log(`[GoogleTranslate] Batch ${batchNum}/${totalBatches}: ${batch.length} texts`);

        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        }

        let retryCount = 0;
        let batchSuccess = false;

        while (retryCount < MAX_RETRIES && !batchSuccess) {
            try {
                const url = `${GOOGLE_TRANSLATE_BASE_URL}?key=${apiKey}`;
                const payload = {
                    q: batch,
                    target: targetLanguage,
                    format: 'text'
                };

                const result = await httpsRequest(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                }, payload);

                if (result && result.data && result.data.translations) {
                    for (let idx = 0; idx < result.data.translations.length; idx++) {
                        const translation = result.data.translations[idx];
                        allResults.push({
                            success: true,
                            translatedText: translation.translatedText,
                            sourceLanguage: translation.detectedSourceLanguage || 'auto',
                            targetLanguage: targetLanguage,
                            originalText: batch[idx]
                        });
                    }
                }

                console.log(`[GoogleTranslate] Batch ${batchNum}/${totalBatches} completed successfully`);
                batchSuccess = true;

            } catch (error) {
                if (error.message.includes('429')) {
                    retryCount++;
                    if (retryCount < MAX_RETRIES) {
                        const waitTime = 5000 * Math.pow(2, retryCount - 1);
                        console.log(`[GoogleTranslate] Rate limit! Retry ${retryCount}/${MAX_RETRIES} after ${waitTime}ms`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }

                for (const text of batch) {
                    allResults.push({
                        success: false,
                        error: `Translation error: ${error.message}`,
                        translatedText: '',
                        originalText: text
                    });
                }
                break;
            }
        }
    }

    return allResults;
}

/**
 * Detect language of a text using Google Cloud Translation API v2.
 */
async function detectLanguage(text) {
    if (!text || !text.trim()) return 'en';
    if (!isConfigured()) return 'en';

    try {
        const apiKey = getApiKey();
        const url = `${GOOGLE_TRANSLATE_BASE_URL}/detect?key=${apiKey}`;
        const payload = { q: text.trim() };

        const result = await httpsRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        }, payload);

        if (result && result.data && result.data.detections && result.data.detections[0] && result.data.detections[0][0]) {
            const detected = result.data.detections[0][0].language;
            if (detected) return detected;
        }
        return 'en';
    } catch (e) {
        console.warn('[GoogleTranslate] detectLanguage error:', e.message);
        return 'en';
    }
}

/**
 * Standard language formatter: Resolves code or mixed string to "Name (code)" format.
 * Examples:
 *   "en"         -> "English (en)"
 *   "de"         -> "German (de)"
 *   "en-English" -> "English (en)"
 *   "German (de)"-> "German (de)"
 */
async function formatLanguage(codeOrDisplay) {
    if (!codeOrDisplay || codeOrDisplay === 'auto') return 'English (en)';

    // If already in "Name (code)" format, return as-is
    if (typeof codeOrDisplay === 'string' && codeOrDisplay.includes('(') && codeOrDisplay.includes(')')) {
        return codeOrDisplay;
    }

    // If in "code-Name" format, e.g. "de-German" -> "German (de)"
    if (typeof codeOrDisplay === 'string' && codeOrDisplay.includes('-')) {
        const parts = codeOrDisplay.split('-');
        if (parts.length === 2 && parts[0].length <= 5) {
            return `${parts[1]} (${parts[0]})`;
        }
    }

    const cleanCode = typeof codeOrDisplay === 'string' ? codeOrDisplay.trim().toLowerCase() : String(codeOrDisplay);

    try {
        const languages = await getSupportedLanguages();
        for (const lang of languages) {
            if (
                lang.code.toLowerCase() === cleanCode ||
                lang.key.toLowerCase() === cleanCode ||
                lang.name.toLowerCase() === cleanCode
            ) {
                return `${lang.name} (${lang.code})`;
            }
        }
    } catch (error) {
        // Fallback to static dictionary
    }

    const common = {
        'en': 'English (en)',
        'de': 'German (de)',
        'fr': 'French (fr)',
        'es': 'Spanish (es)',
        'it': 'Italian (it)',
        'ta': 'Tamil (ta)',
        'ja': 'Japanese (ja)',
        'zh': 'Chinese (zh)',
        'hi': 'Hindi (hi)',
        'pt': 'Portuguese (pt)',
        'ru': 'Russian (ru)',
        'nl': 'Dutch (nl)',
        'ar': 'Arabic (ar)',
        'ko': 'Korean (ko)'
    };

    return common[cleanCode] || codeOrDisplay;
}

/**
 * Resolve language code to standardized "Name (code)" format.
 */
async function formatTargetLanguage(codeOrDisplay) {
    return formatLanguage(codeOrDisplay);
}

module.exports = {
    isConfigured,
    getSupportedLanguages,
    translateText,
    translateBatch,
    detectLanguage,
    formatLanguage,
    formatTargetLanguage
};

// =============================================================
// Build script to generate CSP-compliant Component-preload.js
// =============================================================
const fs = require('fs');
const path = require('path');

const webappDir = path.join(__dirname, 'webapp');
const namespace = 'plm/translator/app';

function getFiles(dir, base = '') {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const relPath = base ? `${base}/${file}` : file;
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath, relPath));
        } else {
            // Exclude index.html, xs-app.json, style.css, and Component-preload.js itself
            if (
                !relPath.endsWith('index.html') &&
                !relPath.endsWith('xs-app.json') &&
                !relPath.endsWith('style.css') &&
                !relPath.endsWith('Component-preload.js')
            ) {
                results.push(relPath);
            }
        }
    });
    return results;
}

const files = getFiles(webappDir);
const preloadEntries = [];

files.forEach(file => {
    const filePath = path.join(webappDir, file);
    const moduleKey = `${namespace}/${file}`;
    const ext = path.extname(file);

    if (ext === '.js') {
        let code = fs.readFileSync(filePath, 'utf8');
        const moduleName = moduleKey.replace(/\.js$/, '');
        // Ensure sap.ui.define has the explicit module name for the preload bundle
        code = code.replace(/sap\.ui\.define\(\s*\[/, `sap.ui.define("${moduleName}", [`);
        // Wrap JS code inside a factory function
        preloadEntries.push(`    ${JSON.stringify(moduleKey)}: function () {\n${code}\n    }`);
    } else {
        // String literal for XML, JSON, properties
        const raw = fs.readFileSync(filePath, 'utf8');
        preloadEntries.push(`    ${JSON.stringify(moduleKey)}: ${JSON.stringify(raw)}`);
    }
});

const preloadContent = `/* ui5plugin-linter-disable */
/* eslint-disable */
//@ui5-bundle ${namespace}/Component-preload.js
sap.ui.require.preload({
${preloadEntries.join(',\n')}
});
`;

fs.writeFileSync(path.join(webappDir, 'Component-preload.js'), preloadContent, 'utf8');
console.log(`Generated Component-preload.js with ${files.length} modules.`);


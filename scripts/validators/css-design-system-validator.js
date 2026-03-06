#!/usr/bin/env node
/**
 * @file /scripts/validators/css-design-system-validator.js
 * @description Valide le Design System φ (Fibonacci) de SHIELD
 *
 * Regles:
 * - Spacing uniquement Fibonacci: 1,2,4,8,13,21,34,55,89,144px
 * - Utiliser var(--spacing-X) au lieu de px hardcodes
 * - Pas de styles inline
 * - Pas de <style> blocks
 *
 * @version 1.0.0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Couleurs
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

const argv = process.argv.slice(2);
const stagedOnly = argv.includes('--staged');
const strict = argv.includes('--strict');

// Fibonacci spacing values
const FIBONACCI = [1, 2, 4, 8, 13, 21, 34, 55, 89, 144];

// Ignore patterns
const IGNORE_PATTERNS = [
    'node_modules',
    'vendor',
    '.git',
    'tests/',
];

function getFilesToCheck() {
    if (stagedOnly) {
        try {
            const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8'
            });
            return output.trim().split('\n').filter(f =>
                f && /\.(css|phtml|html)$/i.test(f) &&
                !IGNORE_PATTERNS.some(p => f.includes(p))
            );
        } catch {
            return [];
        }
    }

    // Scan CSS files
    const files = [];
    function scanDir(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(PROJECT_ROOT, fullPath);

                if (IGNORE_PATTERNS.some(p => relativePath.includes(p))) {
                    continue;
                }

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (/\.(css|phtml|html)$/i.test(entry.name)) {
                    files.push(relativePath);
                }
            }
        } catch {
            // Ignore permission errors
        }
    }

    scanDir(PROJECT_ROOT);
    return files;
}

function checkCSSFile(filePath) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
        return { warnings: [], errors: [] };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const warnings = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        if (/^\s*(\/\*|\*)/.test(line)) {
            continue;
        }

        // Check for non-Fibonacci px values in spacing properties
        const spacingProps = /(margin|padding|gap|top|right|bottom|left|width|height):\s*(\d+)px/gi;
        let match;
        while ((match = spacingProps.exec(line)) !== null) {
            const value = parseInt(match[2]);
            if (!FIBONACCI.includes(value) && value !== 0 && value !== 100) {
                warnings.push({
                    file: filePath,
                    line: i + 1,
                    value: value,
                    property: match[1],
                    message: `Non-Fibonacci value: ${value}px`
                });
            }
        }
    }

    return { warnings, errors };
}

function checkHTMLFile(filePath) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
        return { warnings: [], errors: [] };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const warnings = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for inline styles
        if (/style\s*=\s*['"][^'"]*['"]/.test(line)) {
            // Allow Alpine.js dynamic styles
            if (!/:style|x-bind:style|v-bind:style/.test(line)) {
                warnings.push({
                    file: filePath,
                    line: i + 1,
                    message: 'Inline style detected - use CSS classes instead'
                });
            }
        }

        // Check for <style> blocks in templates (not in layout)
        if (/<style\b/.test(line) && !/layout|base\.phtml/i.test(filePath)) {
            warnings.push({
                file: filePath,
                line: i + 1,
                message: '<style> block detected - use external CSS files'
            });
        }
    }

    return { warnings, errors };
}

function main() {
    console.log('\n🎨 SHIELD Design System φ Validator\n');
    console.log('-'.repeat(50));
    console.log(`${colors.cyan}Fibonacci spacing: ${FIBONACCI.join(', ')}px${colors.reset}`);

    const files = getFilesToCheck();
    console.log(`\nFichiers a analyser: ${files.length}`);

    const allWarnings = [];
    const allErrors = [];

    for (const file of files) {
        let result;
        if (/\.css$/i.test(file)) {
            result = checkCSSFile(file);
        } else {
            result = checkHTMLFile(file);
        }
        allWarnings.push(...result.warnings);
        allErrors.push(...result.errors);
    }

    // Display results
    if (allWarnings.length > 0) {
        console.log(`\n${colors.yellow}⚠️  ${allWarnings.length} AVERTISSEMENT(S)${colors.reset}\n`);

        const byFile = {};
        for (const w of allWarnings) {
            if (!byFile[w.file]) byFile[w.file] = [];
            byFile[w.file].push(w);
        }

        for (const [file, warnings] of Object.entries(byFile)) {
            console.log(`${colors.yellow}${file}:${colors.reset}`);
            for (const w of warnings.slice(0, 3)) {
                console.log(`  ⚠️  Line ${w.line}: ${w.message}`);
            }
            if (warnings.length > 3) {
                console.log(`  ... et ${warnings.length - 3} autre(s)`);
            }
        }
    }

    if (allErrors.length > 0) {
        console.log(`\n${colors.red}❌ ${allErrors.length} ERREUR(S)${colors.reset}\n`);
        for (const e of allErrors.slice(0, 5)) {
            console.log(`${colors.red}❌ ${e.file}:${e.line} - ${e.message}${colors.reset}`);
        }
        process.exit(1);
    }

    if (allWarnings.length > 0 && strict) {
        console.log(`\n${colors.yellow}Mode strict: avertissements traites comme erreurs${colors.reset}`);
        process.exit(1);
    }

    if (allWarnings.length === 0 && allErrors.length === 0) {
        console.log(`\n${colors.green}✅ Design System φ respecte${colors.reset}\n`);
    } else {
        console.log(`\n${colors.green}✅ Validation OK (avec avertissements)${colors.reset}\n`);
    }

    console.log(`${colors.cyan}Rappel - Variables CSS φ:${colors.reset}`);
    console.log('  --spacing-1, --spacing-2, --spacing-4, --spacing-8');
    console.log('  --spacing-13, --spacing-21, --spacing-34, --spacing-55');
    console.log('  --spacing-89, --spacing-144\n');

    process.exit(0);
}

main();

#!/usr/bin/env node
/**
 * @file /scripts/validators/path-validator.js
 * @description Detecte les chemins hardcodes dans le code SHIELD
 *
 * BLOQUANT: Chemins absolus hardcodes
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
};

const argv = process.argv.slice(2);
const stagedOnly = argv.includes('--staged');

// Patterns de chemins hardcodes
const PATH_PATTERNS = [
    /['"]\/var\/www\//g,
    /['"]\/home\/[^'"]+/g,
    /['"](C|D|E):\\[^'"]+/gi,
    /['"]\/Users\/[^'"]+/g,
    /href\s*=\s*['"]\/(?!#|\/)[a-z]/gi,  // href="/page" instead of href="<?= base_url() ?>"
    /src\s*=\s*['"]\/(?!\/)[a-z]/gi,      // src="/assets" instead of src="<?= asset_url() ?>"
];

// Fichiers/dossiers a ignorer
const IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'vendor/',
    'tests/',
    'config/',
    'docker/',
    '.env',
    'scripts/validators',
    'scripts/setup',
];

function getFilesToCheck() {
    if (stagedOnly) {
        try {
            const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8'
            });
            return output.trim().split('\n').filter(f =>
                f && /\.(php|phtml|js|ts|html)$/i.test(f) &&
                !IGNORE_PATTERNS.some(p => f.includes(p))
            );
        } catch {
            return [];
        }
    }

    // Scan all relevant files
    const files = [];
    function scanDir(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(PROJECT_ROOT, fullPath);

                // Normalize path for cross-platform comparison
                const normalizedPath = relativePath.replace(/\\/g, '/');
                if (IGNORE_PATTERNS.some(p => normalizedPath.includes(p))) {
                    continue;
                }

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (/\.(php|phtml|js|ts|html)$/i.test(entry.name)) {
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

function checkFile(filePath) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
        return [];
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        if (/^\s*(#|\/\/|\/\*|\*)/.test(line)) {
            continue;
        }

        // Skip config definitions
        if (/define\s*\(|const\s+[A-Z_]+\s*=|\.env/.test(line)) {
            continue;
        }

        for (const pattern of PATH_PATTERNS) {
            pattern.lastIndex = 0;
            const match = line.match(pattern);
            if (match) {
                violations.push({
                    file: filePath,
                    line: i + 1,
                    content: line.trim().substring(0, 80),
                    match: match[0]
                });
                break;
            }
        }
    }

    return violations;
}

function main() {
    console.log('\n📁 SHIELD Path Validator\n');
    console.log('-'.repeat(50));

    const files = getFilesToCheck();
    console.log(`Fichiers a analyser: ${files.length}`);

    const allViolations = [];

    for (const file of files) {
        const violations = checkFile(file);
        allViolations.push(...violations);
    }

    if (allViolations.length === 0) {
        console.log(`\n${colors.green}✅ Aucun chemin hardcode detecte${colors.reset}\n`);
        process.exit(0);
    }

    console.log(`\n${colors.red}❌ ${allViolations.length} CHEMIN(S) HARDCODE(S)${colors.reset}\n`);

    for (const v of allViolations.slice(0, 10)) {
        console.log(`${colors.red}❌ ${v.file}:${v.line}${colors.reset}`);
        console.log(`   ${v.content}`);
        console.log(`   ${colors.yellow}Match: ${v.match}${colors.reset}`);
    }

    if (allViolations.length > 10) {
        console.log(`\n... et ${allViolations.length - 10} autre(s)`);
    }

    console.log(`\n${colors.yellow}Utiliser les helpers:${colors.reset}`);
    console.log('  PHP: base_url(), asset_url(), PathHelper::getXxxPath()');
    console.log('  JS:  AppConfig.baseUrl, AppConfig.apiUrl()\n');

    process.exit(1);
}

main();

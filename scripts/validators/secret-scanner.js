#!/usr/bin/env node
/**
 * @file /scripts/validators/secret-scanner.js
 * @description Detecte les secrets hardcodes dans le code SHIELD
 *
 * BLOQUANT: Detecte passwords, API keys, tokens, credentials hardcodes
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

// Patterns de secrets a detecter
const SECRET_PATTERNS = [
    /password\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    /api[_-]?key\s*[=:]\s*['"][^'"]{16,}['"]/gi,
    /secret\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    /token\s*[=:]\s*['"][^'"]{20,}['"]/gi,
    /private[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi,
    /twilio[_-]?(sid|token|auth)\s*[=:]\s*['"][^'"]+['"]/gi,
    /stripe[_-]?(key|secret)\s*[=:]\s*['"][^'"]+['"]/gi,
    /aws[_-]?(access|secret)[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi,
    /firebase[_-]?(key|secret|token)\s*[=:]\s*['"][^'"]+['"]/gi,
];

// Fichiers/dossiers a ignorer
const IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    '.env.example',
    '.env.sample',
    'package-lock.json',
    'composer.lock',
    'tests/',
    'vendor/',
    '.spec.ts',
    '.spec.js',
    '.test.ts',
    '.test.js',
];

function getFilesToCheck() {
    if (stagedOnly) {
        try {
            const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8'
            });
            return output.trim().split('\n').filter(f => f && /\.(php|phtml|js|ts|json|yml|yaml|env)$/i.test(f));
        } catch {
            return [];
        }
    }

    // Scan all files
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
                } else if (/\.(php|phtml|js|ts|json|yml|yaml)$/i.test(entry.name)) {
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

        // Skip env variable references
        if (/\$_ENV|\$ENV|process\.env|getenv\(/.test(line)) {
            continue;
        }

        for (const pattern of SECRET_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(line)) {
                violations.push({
                    file: filePath,
                    line: i + 1,
                    content: line.trim().substring(0, 80)
                });
            }
        }
    }

    return violations;
}

function main() {
    console.log('\n🔐 SHIELD Secret Scanner\n');
    console.log('-'.repeat(50));

    const files = getFilesToCheck();
    console.log(`Fichiers a analyser: ${files.length}`);

    const allViolations = [];

    for (const file of files) {
        const violations = checkFile(file);
        allViolations.push(...violations);
    }

    if (allViolations.length === 0) {
        console.log(`\n${colors.green}✅ Aucun secret hardcode detecte${colors.reset}\n`);
        process.exit(0);
    }

    console.log(`\n${colors.red}❌ ${allViolations.length} SECRET(S) DETECTE(S)${colors.reset}\n`);

    for (const v of allViolations) {
        console.log(`${colors.red}❌ ${v.file}:${v.line}${colors.reset}`);
        console.log(`   ${v.content}`);
    }

    console.log(`\n${colors.yellow}Utiliser .env pour stocker les credentials${colors.reset}\n`);

    process.exit(1);
}

main();

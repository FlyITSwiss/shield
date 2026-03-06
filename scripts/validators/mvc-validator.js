#!/usr/bin/env node
/**
 * @file /scripts/validators/mvc-validator.js
 * @description Valide l'architecture MVC de SHIELD
 *
 * BLOQUANT:
 * - SQL dans Controllers = ERREUR
 * - SQL dans Views = ERREUR
 * - HTML dans Models = ERREUR
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

// SQL patterns - more specific to avoid false positives
const SQL_PATTERNS = [
    /\$[a-z_]+->query\s*\(/i,          // $db->query(
    /\$[a-z_]+->prepare\s*\(/i,        // $pdo->prepare(
    /\$stmt->execute\s*\(/i,           // $stmt->execute(
    /\bSELECT\s+\*?\s+FROM\s+/i,       // SELECT ... FROM
    /\bINSERT\s+INTO\s+/i,             // INSERT INTO
    /\bUPDATE\s+\w+\s+SET\s+/i,        // UPDATE table SET
    /\bDELETE\s+FROM\s+/i,             // DELETE FROM
];

// HTML patterns
const HTML_PATTERNS = [
    /<(div|span|p|h[1-6]|table|form|input|button|a|ul|li|img)\b/i,
    /echo\s+['"]<[a-z]/i,
];

function getFilesToCheck() {
    if (stagedOnly) {
        try {
            const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8'
            });
            return output.trim().split('\n').filter(f => f && /\.(php|phtml)$/i.test(f));
        } catch {
            return [];
        }
    }

    // Scan Controllers, Models, Views
    const files = [];
    const dirs = ['backend/php/Controllers', 'backend/php/Models', 'backend/php/Views'];

    for (const dir of dirs) {
        const fullDir = path.join(PROJECT_ROOT, dir);
        if (!fs.existsSync(fullDir)) continue;

        function scanDir(d) {
            const entries = fs.readdirSync(d, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(d, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (/\.(php|phtml)$/i.test(entry.name)) {
                    files.push(path.relative(PROJECT_ROOT, fullPath));
                }
            }
        }
        scanDir(fullDir);
    }

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

    const isController = /Controllers?\//i.test(filePath);
    const isView = /Views?\//i.test(filePath) || /\.phtml$/i.test(filePath);
    const isModel = /Models?\//i.test(filePath);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        if (/^\s*(#|\/\/|\/\*|\*)/.test(line)) {
            continue;
        }

        // Check SQL in Controllers
        if (isController) {
            for (const pattern of SQL_PATTERNS) {
                if (pattern.test(line)) {
                    violations.push({
                        type: 'SQL in Controller',
                        file: filePath,
                        line: i + 1,
                        content: line.trim().substring(0, 60)
                    });
                    break;
                }
            }
        }

        // Check SQL in Views
        if (isView) {
            for (const pattern of SQL_PATTERNS) {
                if (pattern.test(line)) {
                    violations.push({
                        type: 'SQL in View',
                        file: filePath,
                        line: i + 1,
                        content: line.trim().substring(0, 60)
                    });
                    break;
                }
            }
        }

        // Check HTML in Models
        if (isModel) {
            for (const pattern of HTML_PATTERNS) {
                if (pattern.test(line)) {
                    violations.push({
                        type: 'HTML in Model',
                        file: filePath,
                        line: i + 1,
                        content: line.trim().substring(0, 60)
                    });
                    break;
                }
            }
        }
    }

    return violations;
}

function main() {
    console.log('\n🏗️  SHIELD MVC Validator\n');
    console.log('-'.repeat(50));

    const files = getFilesToCheck();
    console.log(`Fichiers a analyser: ${files.length}`);

    const allViolations = [];

    for (const file of files) {
        const violations = checkFile(file);
        allViolations.push(...violations);
    }

    if (allViolations.length === 0) {
        console.log(`\n${colors.green}✅ Architecture MVC respectee${colors.reset}\n`);
        process.exit(0);
    }

    console.log(`\n${colors.red}❌ ${allViolations.length} VIOLATION(S) MVC${colors.reset}\n`);

    // Group by type
    const byType = {};
    for (const v of allViolations) {
        if (!byType[v.type]) byType[v.type] = [];
        byType[v.type].push(v);
    }

    for (const [type, violations] of Object.entries(byType)) {
        console.log(`\n${colors.red}${type}:${colors.reset}`);
        for (const v of violations.slice(0, 5)) {
            console.log(`  ❌ ${v.file}:${v.line}`);
            console.log(`     ${v.content}`);
        }
        if (violations.length > 5) {
            console.log(`  ... et ${violations.length - 5} autre(s)`);
        }
    }

    console.log(`\n${colors.yellow}Regles MVC:${colors.reset}`);
    console.log('  - SQL: Models uniquement');
    console.log('  - HTML: Views uniquement');
    console.log('  - Controllers: logique + delegation\n');

    process.exit(1);
}

main();

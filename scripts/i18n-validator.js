#!/usr/bin/env node
/**
 * SHIELD - i18n Validator
 * Validates synchronization between French and English translation files
 *
 * Usage: node scripts/i18n-validator.js [--strict]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LANG_PATH = path.join(__dirname, '..', 'backend', 'php', 'lang');
const FR_FILE = path.join(LANG_PATH, 'fr.php');
const EN_FILE = path.join(LANG_PATH, 'en.php');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

/**
 * Extract keys from a PHP translation file
 * @param {string} filePath - Path to the PHP file
 * @returns {Set<string>} - Set of translation keys
 */
function extractKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const keys = new Set();

    // Match patterns like 'key.name' => 'value'
    const regex = /'([a-z0-9_.]+)'\s*=>/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
        keys.add(match[1]);
    }

    return keys;
}

/**
 * Check for missing French accents in values
 * @param {string} filePath - Path to the French PHP file
 * @returns {Array<{key: string, value: string, suggestion: string}>} - List of potential issues
 */
function checkFrenchAccents(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    // Common French words that should have accents
    const accentRules = [
        { pattern: /\bcree\b/gi, correct: 'créé' },
        { pattern: /\bcreee\b/gi, correct: 'créée' },
        { pattern: /\bmise a jour\b/gi, correct: 'mise à jour' },
        { pattern: /\breussi\b/gi, correct: 'réussi' },
        { pattern: /\bechoue\b/gi, correct: 'échoué' },
        { pattern: /\btermine\b/gi, correct: 'terminé' },
        { pattern: /\bselectionnez\b/gi, correct: 'sélectionnez' },
        { pattern: /\bsupprime\b/gi, correct: 'supprimé' },
        { pattern: /\bactivee\b/gi, correct: 'activée' },
        { pattern: /\bdesactivee\b/gi, correct: 'désactivée' },
        { pattern: /\bpartagee\b/gi, correct: 'partagée' },
        { pattern: /\benregistree\b/gi, correct: 'enregistrée' },
        { pattern: /\bdeconnexion\b/gi, correct: 'déconnexion' },
        { pattern: /\bsecurite\b/gi, correct: 'sécurité' },
        { pattern: /\bparametres\b/gi, correct: 'paramètres' },
        { pattern: /\bpreferences\b/gi, correct: 'préférences' },
        { pattern: /\btelephone\b/gi, correct: 'téléphone' },
        { pattern: /\bgeneral\b/gi, correct: 'général' },
    ];

    // Match patterns like 'key' => 'value'
    const lineRegex = /'([a-z0-9_.]+)'\s*=>\s*'([^']+)'/gi;
    let match;

    while ((match = lineRegex.exec(content)) !== null) {
        const key = match[1];
        const value = match[2];

        for (const rule of accentRules) {
            if (rule.pattern.test(value)) {
                issues.push({
                    key,
                    value,
                    suggestion: `Should contain "${rule.correct}"`
                });
                break;
            }
        }
    }

    return issues;
}

/**
 * Main validation function
 */
function validate() {
    const isStrict = process.argv.includes('--strict');
    let hasErrors = false;
    let hasWarnings = false;

    console.log(`${colors.cyan}=== SHIELD i18n Validator ===${colors.reset}\n`);

    // Check if files exist
    if (!fs.existsSync(FR_FILE)) {
        console.error(`${colors.red}ERROR: French translation file not found: ${FR_FILE}${colors.reset}`);
        process.exit(1);
    }

    if (!fs.existsSync(EN_FILE)) {
        console.error(`${colors.red}ERROR: English translation file not found: ${EN_FILE}${colors.reset}`);
        process.exit(1);
    }

    // Extract keys
    const frKeys = extractKeys(FR_FILE);
    const enKeys = extractKeys(EN_FILE);

    console.log(`${colors.blue}French keys: ${frKeys.size}${colors.reset}`);
    console.log(`${colors.blue}English keys: ${enKeys.size}${colors.reset}\n`);

    // Find missing keys in English
    const missingInEn = [...frKeys].filter(key => !enKeys.has(key));
    if (missingInEn.length > 0) {
        hasErrors = true;
        console.log(`${colors.red}ERROR: Keys missing in en.php (${missingInEn.length}):${colors.reset}`);
        missingInEn.forEach(key => console.log(`  - ${key}`));
        console.log();
    }

    // Find missing keys in French
    const missingInFr = [...enKeys].filter(key => !frKeys.has(key));
    if (missingInFr.length > 0) {
        hasErrors = true;
        console.log(`${colors.red}ERROR: Keys missing in fr.php (${missingInFr.length}):${colors.reset}`);
        missingInFr.forEach(key => console.log(`  - ${key}`));
        console.log();
    }

    // Check French accents
    const accentIssues = checkFrenchAccents(FR_FILE);
    if (accentIssues.length > 0) {
        hasWarnings = true;
        console.log(`${colors.yellow}WARNING: Potential missing accents in fr.php (${accentIssues.length}):${colors.reset}`);
        accentIssues.forEach(issue => {
            console.log(`  - ${issue.key}: "${issue.value}"`);
            console.log(`    ${colors.cyan}${issue.suggestion}${colors.reset}`);
        });
        console.log();
    }

    // Summary
    if (!hasErrors && !hasWarnings) {
        console.log(`${colors.green}✓ All translations are synchronized!${colors.reset}`);
        process.exit(0);
    } else if (!hasErrors) {
        console.log(`${colors.yellow}⚠ Validation passed with warnings${colors.reset}`);
        process.exit(isStrict ? 1 : 0);
    } else {
        console.log(`${colors.red}✗ Validation failed with errors${colors.reset}`);
        process.exit(1);
    }
}

// Run validation
validate();

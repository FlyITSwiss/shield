#!/usr/bin/env node
/**
 * @file /scripts/validators/run-all.js
 * @description Orchestrateur des validateurs SHIELD v1.0
 *
 * Usage:
 *   node scripts/validators/run-all.js [options]
 *
 * Options:
 *   --pre-commit   Mode pre-commit (rapide, erreurs bloquantes uniquement)
 *   --pre-push     Mode pre-push (complet)
 *   --staged       Analyser uniquement les fichiers git staged
 *   --json         Sortie JSON
 *   --strict       Bloquer meme sur les warnings
 *
 * @version 1.0.0
 * @date 2026-03-05
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VALIDATORS_DIR = __dirname;

// Couleurs console
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

// Options CLI
const argv = process.argv.slice(2);
const options = {
    preCommit: argv.includes('--pre-commit'),
    prePush: argv.includes('--pre-push'),
    staged: argv.includes('--staged'),
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
};

if (!options.preCommit && !options.prePush) {
    options.preCommit = true;
}

/**
 * Log avec couleurs
 */
function log(message, color = 'reset') {
    if (!options.json) {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }
}

/**
 * Execute un validateur et retourne le resultat
 */
async function runValidator(name, script, args = [], timeout = 60000) {
    return new Promise((resolve) => {
        if (!fs.existsSync(script)) {
            resolve({
                name,
                success: true,
                code: 0,
                stdout: '',
                stderr: '',
                duration: 0,
                skipped: true,
            });
            return;
        }

        const startTime = Date.now();

        const child = spawn('node', [script, ...args], {
            cwd: PROJECT_ROOT,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            resolve({ name, success: code === 0, code, stdout, stderr, duration });
        });

        child.on('error', (err) => {
            resolve({
                name,
                success: false,
                code: 1,
                stdout: '',
                stderr: err.message,
                duration: Date.now() - startTime
            });
        });

        setTimeout(() => {
            child.kill();
            resolve({
                name,
                success: false,
                code: 1,
                stdout,
                stderr: `Timeout (${timeout/1000}s)`,
                duration: timeout
            });
        }, timeout);
    });
}

/**
 * Execute plusieurs validateurs en parallele
 */
async function runParallel(validators) {
    return Promise.all(validators.map(v =>
        runValidator(v.name, v.script, v.args || [], v.timeout || 60000)
    ));
}

/**
 * Fonction principale
 */
async function main() {
    const startTime = Date.now();

    if (!options.json) {
        log('', 'reset');
        log('='.repeat(70), 'cyan');
        log('  SHIELD VALIDATORS v1.0', 'cyan');
        log('='.repeat(70), 'cyan');
        log('', 'reset');
    }

    const results = [];
    const stagedArg = options.staged ? ['--staged'] : [];

    // =============================================================
    // BATCH 1: Security & Architecture (parallel)
    // =============================================================

    if (options.preCommit) {
        log(`\n${colors.cyan}[BATCH 1] Securite & Architecture${colors.reset}`, 'reset');
        log('-'.repeat(50), 'dim');

        const batch1 = await runParallel([
            {
                name: 'Secret Scanner',
                script: path.join(VALIDATORS_DIR, 'secret-scanner.js'),
                args: [...stagedArg]
            },
            {
                name: 'MVC Validator',
                script: path.join(VALIDATORS_DIR, 'mvc-validator.js'),
                args: [...stagedArg]
            },
            {
                name: 'Path Validator',
                script: path.join(VALIDATORS_DIR, 'path-validator.js'),
                args: [...stagedArg]
            },
        ]);

        for (const r of batch1) {
            results.push(r);
        }

        log('', 'reset');
        for (const r of batch1) {
            if (r.skipped) {
                log(`   ⚠️  ${r.name} non trouve`, 'yellow');
            } else if (r.success) {
                log(`   ✅ ${r.name} (${r.duration}ms)`, 'green');
            } else {
                log(`   ❌ ${r.name} ECHOUE`, 'red');
                const errorLines = r.stdout.split('\n').filter(l => l.includes('❌')).slice(0, 3);
                errorLines.forEach(l => log(`      ${l}`, 'red'));
            }
        }

        // =============================================================
        // BATCH 2: Code Quality (parallel)
        // =============================================================

        log(`\n${colors.cyan}[BATCH 2] Qualite Code${colors.reset}`, 'reset');
        log('-'.repeat(50), 'dim');

        const batch2 = await runParallel([
            {
                name: 'CSS Design System φ',
                script: path.join(VALIDATORS_DIR, 'css-design-system-validator.js'),
                args: [...stagedArg]
            },
            {
                name: 'i18n Validator',
                script: path.join(PROJECT_ROOT, 'scripts', 'i18n-validator.js'),
                args: options.strict ? ['--strict'] : []
            },
        ]);

        for (const r of batch2) {
            results.push(r);
        }

        log('', 'reset');
        for (const r of batch2) {
            if (r.skipped) {
                log(`   ⚠️  ${r.name} non trouve`, 'yellow');
            } else if (r.success) {
                log(`   ✅ ${r.name} (${r.duration}ms)`, 'green');
            } else {
                log(`   ❌ ${r.name} ECHOUE`, 'red');
                const errorLines = r.stdout.split('\n').filter(l => l.includes('❌') || l.includes('missing')).slice(0, 3);
                errorLines.forEach(l => log(`      ${l}`, 'red'));
            }
        }
    }

    // =============================================================
    // RESUME FINAL
    // =============================================================

    const totalDuration = Date.now() - startTime;

    // Blocker validators
    const BLOCKER_NAMES = ['Secret', 'MVC', 'Path'];

    const errors = results.filter(r => !r.success && !r.skipped && BLOCKER_NAMES.some(n => r.name.includes(n)));
    const warnings = results.filter(r => !r.success && !r.skipped && !errors.includes(r));
    const passed = results.filter(r => r.success);
    const skipped = results.filter(r => r.skipped);

    if (options.json) {
        const output = {
            status: errors.length === 0 ? (warnings.length === 0 ? 'ok' : 'warning') : 'error',
            duration_ms: totalDuration,
            summary: {
                passed: passed.length,
                warnings: warnings.length,
                errors: errors.length,
                skipped: skipped.length,
                total: results.length
            },
            results: results.map(r => ({
                name: r.name,
                success: r.success,
                skipped: r.skipped || false,
                duration_ms: r.duration
            }))
        };
        console.log(JSON.stringify(output, null, 2));
        process.exit(errors.length > 0 ? 1 : 0);
    }

    log('', 'reset');
    log('='.repeat(70), 'cyan');
    log('  RESUME DES VALIDATIONS', 'cyan');
    log('='.repeat(70), 'cyan');
    log('', 'reset');

    results.filter(r => !r.skipped).forEach(r => {
        const icon = r.success ? '✅' : (errors.includes(r) ? '❌' : '⚠️');
        const color = r.success ? 'green' : (errors.includes(r) ? 'red' : 'yellow');
        log(`  ${icon} ${r.name.padEnd(30)} ${(r.duration + 'ms').padStart(8)}`, color);
    });

    if (skipped.length > 0) {
        log(`  ${colors.dim}(${skipped.length} validateur(s) non trouve(s))${colors.reset}`, 'dim');
    }

    log('', 'reset');
    log(`  Temps total: ${totalDuration}ms`, 'blue');
    log('', 'reset');

    if (errors.length > 0) {
        log('='.repeat(70), 'red');
        log(`  ❌ ${errors.length} ERREUR(S) BLOQUANTE(S)`, 'red');
        log('='.repeat(70), 'red');
        log('', 'reset');
        log('Corrigez les erreurs ci-dessus avant de committer.', 'yellow');
        log('', 'reset');
        log('Bypass temporaire (deconseille): git commit --no-verify', 'dim');
        log('', 'reset');
        process.exit(1);
    }

    if (warnings.length > 0 && options.strict) {
        log('='.repeat(70), 'yellow');
        log(`  ⚠️  ${warnings.length} AVERTISSEMENT(S) (mode strict)`, 'yellow');
        log('='.repeat(70), 'yellow');
        process.exit(1);
    }

    if (warnings.length > 0) {
        log('='.repeat(70), 'green');
        log(`  ✅ VALIDATION OK (avec ${warnings.length} avertissement(s))`, 'green');
        log('='.repeat(70), 'green');
    } else {
        log('='.repeat(70), 'green');
        log('  ✅ TOUTES LES VALIDATIONS PASSENT', 'green');
        log('='.repeat(70), 'green');
    }

    log('', 'reset');
    process.exit(0);
}

// Execution
main().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});

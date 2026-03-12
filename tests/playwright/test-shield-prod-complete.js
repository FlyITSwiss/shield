/**
 * SHIELD - Test PRODUCTION Complet
 *
 * Teste:
 * - Back Tap Feature (fichiers JS accessibles)
 * - Remember Me functionality
 * - Login/Register flow
 * - Settings page
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration PRODUCTION
const CONFIG = {
    baseUrl: 'https://stabilis-it.ch/internal/shield',
    screenshotsDir: path.join(__dirname, 'screenshots', 'prod-complete'),
    timeout: 30000,
    credentials: {
        email: 'test-prod@shield-app.ch',
        password: 'ShieldTest2026!',
        firstName: 'Test',
        lastName: 'PROD',
        phone: '+33612345678'
    }
};

// Resultats
const results = {
    tests: [],
    screenshots: [],
    startTime: null,
    endTime: null
};

let testsPassed = 0;
let testsFailed = 0;

// Utilitaires
function log(message, type = 'info') {
    const icons = {
        info: '\x1b[36mINFO\x1b[0m',
        success: '\x1b[32mPASS\x1b[0m',
        error: '\x1b[31mFAIL\x1b[0m',
        warning: '\x1b[33mWARN\x1b[0m'
    };
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}] [${icons[type]}] ${message}`);
}

function logSection(title) {
    console.log('\n\x1b[35m' + '='.repeat(70) + '\x1b[0m');
    console.log('\x1b[35m  ' + title + '\x1b[0m');
    console.log('\x1b[35m' + '='.repeat(70) + '\x1b[0m\n');
}

async function screenshot(page, name) {
    const filename = `${Date.now()}-${name}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push(filename);
    log(`Screenshot: ${filename}`, 'info');
    return filepath;
}

function recordResult(name, passed, details = '') {
    results.tests.push({ name, passed, details });
    if (passed) {
        testsPassed++;
        log(`${name}: ${details || 'OK'}`, 'success');
    } else {
        testsFailed++;
        log(`${name}: ${details}`, 'error');
    }
}

// ============================================
// TEST 1: Back Tap Feature - Fichiers JS
// ============================================
async function testBackTapFeatureJS(page) {
    logSection('TEST 1: Back Tap Feature - Fichiers JS');

    const jsFiles = [
        { path: 'assets/js/core/alarm-service.js', name: 'AlarmService', checks: ['playPanicAlarm', 'makeDistortionCurve', 'startVibration'] },
        { path: 'assets/js/core/back-tap-detector.js', name: 'BackTapDetector', checks: ['tapThreshold', 'doubleTapWindow', 'onDoubleTap', 'Capacitor'] },
        { path: 'assets/js/app/alarm-trigger.js', name: 'AlarmTrigger', checks: ['backTapEnabled', 'initBackTapDetection', 'back_tap'] },
        { path: 'assets/js/app/sos-screen.js', name: 'SOSScreen', checks: ['AlarmService', 'playPanicAlarm'] },
        { path: 'assets/js/app/settings.js', name: 'Settings', checks: ['backTapTrigger', 'backTapSensitivity', 'toggleBackTapSensitivity'] }
    ];

    let allPassed = true;

    for (const file of jsFiles) {
        const response = await page.goto(`${CONFIG.baseUrl}/${file.path}`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        const status = response?.status() || 0;

        if (status === 200) {
            const content = await response.text();
            let fileOk = true;

            for (const check of file.checks) {
                if (!content.includes(check)) {
                    log(`  [MISSING] ${file.name}: ${check}`, 'warning');
                    fileOk = false;
                }
            }

            if (fileOk) {
                log(`  ${file.name}: Tous les checks OK (${file.checks.length} patterns)`, 'success');
            } else {
                allPassed = false;
            }
        } else {
            log(`  ${file.name}: HTTP ${status}`, 'error');
            allPassed = false;
        }
    }

    recordResult('Back Tap Feature JS Files', allPassed, allPassed ? 'Tous les fichiers accessibles' : 'Certains fichiers manquants');
    return allPassed;
}

// ============================================
// TEST 2: Page de Login
// ============================================
async function testLoginPage(page) {
    logSection('TEST 2: Page de Login');

    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
    await screenshot(page, '01-login-page');

    // Verifier les elements
    const emailField = await page.locator('#email, input[type="email"], input[name="email"]').first().isVisible().catch(() => false);
    const passwordField = await page.locator('#password, input[type="password"]').first().isVisible().catch(() => false);
    const submitBtn = await page.locator('button[type="submit"], .btn-primary, .btn-login').first().isVisible().catch(() => false);
    const rememberMe = await page.locator('#remember-me, input[name="remember"], .remember-me input').first().isVisible().catch(() => false);

    recordResult('Champ email visible', emailField);
    recordResult('Champ password visible', passwordField);
    recordResult('Bouton submit visible', submitBtn);
    recordResult('Checkbox Remember Me visible', rememberMe);

    return emailField && passwordField && submitBtn;
}

// ============================================
// TEST 3: Page d'inscription
// ============================================
async function testRegisterPage(page) {
    logSection('TEST 3: Page d\'inscription');

    await page.goto(`${CONFIG.baseUrl}/auth/register`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
    await screenshot(page, '02-register-page');

    const firstNameField = await page.locator('#first-name, input[name="first_name"], #firstName').first().isVisible().catch(() => false);
    const lastNameField = await page.locator('#last-name, input[name="last_name"], #lastName').first().isVisible().catch(() => false);
    const emailField = await page.locator('#email, input[type="email"]').first().isVisible().catch(() => false);
    const phoneField = await page.locator('#phone, input[type="tel"], input[name="phone"]').first().isVisible().catch(() => false);
    const passwordField = await page.locator('#password, input[type="password"]').first().isVisible().catch(() => false);

    recordResult('Formulaire inscription: Prenom', firstNameField);
    recordResult('Formulaire inscription: Nom', lastNameField);
    recordResult('Formulaire inscription: Email', emailField);
    recordResult('Formulaire inscription: Telephone', phoneField);
    recordResult('Formulaire inscription: Password', passwordField);

    return firstNameField && emailField && passwordField;
}

// ============================================
// TEST 4: Inscription d'un nouvel utilisateur
// ============================================
async function testRegistration(page) {
    logSection('TEST 4: Inscription nouvel utilisateur');

    await page.goto(`${CONFIG.baseUrl}/auth/register`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });

    // Generer email unique
    const uniqueEmail = `test-${Date.now()}@shield-app.ch`;

    try {
        // Remplir le formulaire
        await page.fill('#first-name, input[name="first_name"], #firstName', CONFIG.credentials.firstName).catch(() => {});
        await page.fill('#last-name, input[name="last_name"], #lastName', CONFIG.credentials.lastName).catch(() => {});
        await page.fill('#email, input[type="email"]', uniqueEmail).catch(() => {});
        await page.fill('#phone, input[type="tel"]', CONFIG.credentials.phone).catch(() => {});
        await page.fill('#password, input[type="password"]', CONFIG.credentials.password).catch(() => {});

        // Accepter les conditions si present
        await page.locator('#terms, input[name="terms"], .terms-checkbox input').first().check().catch(() => {});

        await screenshot(page, '03-register-filled');

        // Soumettre
        await page.locator('button[type="submit"], .btn-register, .btn-primary').first().click();
        await page.waitForTimeout(3000);

        await screenshot(page, '04-register-submitted');

        const currentUrl = page.url();
        const success = !currentUrl.includes('/register') || currentUrl.includes('/verify') || currentUrl.includes('/home') || currentUrl.includes('/login');

        if (success) {
            recordResult('Inscription reussie', true, `Email: ${uniqueEmail}`);
            // Sauvegarder le credential pour les tests suivants
            CONFIG.credentials.email = uniqueEmail;
            return { success: true, email: uniqueEmail };
        } else {
            recordResult('Inscription', false, 'Reste sur la page register');
            return { success: false };
        }
    } catch (error) {
        recordResult('Inscription', false, error.message);
        return { success: false };
    }
}

// ============================================
// TEST 5: Login avec Remember Me
// ============================================
async function testLoginWithRememberMe(page, email) {
    logSection('TEST 5: Login avec Remember Me');

    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });

    try {
        // Remplir login
        await page.fill('#email, input[type="email"]', email || CONFIG.credentials.email);
        await page.fill('#password, input[type="password"]', CONFIG.credentials.password);

        // Cocher Remember Me
        const rememberMeSelector = '#remember-me, input[name="remember"], .remember-me input[type="checkbox"]';
        const rememberMe = await page.locator(rememberMeSelector).first();

        if (await rememberMe.isVisible()) {
            await rememberMe.check();
            log('Remember Me coche', 'success');
        }

        await screenshot(page, '05-login-with-remember-me');

        // Soumettre
        await page.locator('button[type="submit"], .btn-login, .btn-primary').first().click();
        await page.waitForTimeout(3000);

        await screenshot(page, '06-after-login');

        const currentUrl = page.url();
        const loggedIn = currentUrl.includes('/app/') || currentUrl.includes('/home') || currentUrl.includes('/sos') || currentUrl.includes('/dashboard');

        if (loggedIn) {
            // Verifier le token Remember Me
            const cookies = await page.context().cookies();
            const rememberToken = cookies.find(c => c.name.includes('remember') || c.name.includes('token'));

            recordResult('Login reussi', true);
            recordResult('Remember Me active', !!rememberToken, rememberToken ? `Token: ${rememberToken.name}` : 'Pas de token trouve');

            return true;
        } else {
            recordResult('Login', false, 'Non redirige vers app');
            return false;
        }
    } catch (error) {
        recordResult('Login', false, error.message);
        return false;
    }
}

// ============================================
// TEST 6: Page Settings - Back Tap UI
// ============================================
async function testSettingsBackTap(page) {
    logSection('TEST 6: Settings - Back Tap UI');

    await page.goto(`${CONFIG.baseUrl}/app/settings`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });

    // Verifier si on est redirige vers login
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
        recordResult('Settings page', false, 'Redirection vers login (pas connecte)');
        return false;
    }

    await screenshot(page, '07-settings-page');

    // Verifier les elements Back Tap
    const backTapToggle = await page.locator('#back-tap-trigger, input[name="back_tap_enabled"]').first().isVisible().catch(() => false);
    const backTapSensitivity = await page.locator('#back-tap-sensitivity, select[name="back_tap_sensitivity"]').first().isVisible().catch(() => false);

    recordResult('Toggle Back Tap visible', backTapToggle);
    recordResult('Select Sensibilite visible', backTapSensitivity);

    // Tester l'interaction
    if (backTapToggle) {
        try {
            const toggle = await page.locator('#back-tap-trigger, input[name="back_tap_enabled"]').first();
            const isChecked = await toggle.isChecked();

            // Toggle le switch
            await toggle.click();
            await page.waitForTimeout(500);

            const newState = await toggle.isChecked();
            recordResult('Toggle Back Tap fonctionne', isChecked !== newState, `Etat: ${isChecked} -> ${newState}`);

            await screenshot(page, '08-settings-back-tap-toggled');
        } catch (error) {
            recordResult('Interaction Back Tap', false, error.message);
        }
    }

    return backTapToggle;
}

// ============================================
// TEST 7: Page SOS
// ============================================
async function testSOSPage(page) {
    logSection('TEST 7: Page SOS');

    await page.goto(`${CONFIG.baseUrl}/app/sos`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });

    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
        recordResult('Page SOS', false, 'Redirection vers login');
        return false;
    }

    await screenshot(page, '09-sos-page');

    // Verifier les elements SOS
    const sosButton = await page.locator('.sos-button, .panic-button, #sos-btn, button.btn-sos').first().isVisible().catch(() => false);

    recordResult('Bouton SOS visible', sosButton);

    // Verifier que AlarmService est charge
    const alarmServiceLoaded = await page.evaluate(() => {
        return typeof window.AlarmService !== 'undefined';
    }).catch(() => false);

    recordResult('AlarmService charge', alarmServiceLoaded);

    // Verifier que BackTapDetector est charge
    const backTapLoaded = await page.evaluate(() => {
        return typeof window.BackTapDetector !== 'undefined';
    }).catch(() => false);

    recordResult('BackTapDetector charge', backTapLoaded);

    return sosButton;
}

// ============================================
// TEST 8: Pages Legales (touch targets 44px)
// ============================================
async function testLegalPages(page) {
    logSection('TEST 8: Pages Legales - Touch Targets');

    const legalPages = [
        { path: '/legal/privacy', name: 'Politique de confidentialite' },
        { path: '/legal/terms', name: 'Conditions generales' },
        { path: '/legal/help', name: 'Aide' }
    ];

    let allOk = true;

    for (const legalPage of legalPages) {
        await page.goto(`${CONFIG.baseUrl}${legalPage.path}`, { waitUntil: 'networkidle', timeout: CONFIG.timeout }).catch(() => {});

        const exists = !page.url().includes('/404') && !page.url().includes('/login');

        if (exists) {
            // Verifier la taille des boutons/liens
            const touchTargets = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button, a, .btn');
                let minSize = 1000;
                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    const size = Math.min(rect.width, rect.height);
                    if (size > 0 && size < minSize) minSize = size;
                });
                return minSize;
            }).catch(() => 0);

            const ok = touchTargets >= 44;
            recordResult(`${legalPage.name}`, ok, ok ? `Touch targets >= 44px (min: ${touchTargets}px)` : `Touch target trop petit: ${touchTargets}px`);
            if (!ok) allOk = false;
        } else {
            log(`${legalPage.name}: Page non trouvee`, 'warning');
        }
    }

    return allOk;
}

// ============================================
// RAPPORT FINAL
// ============================================
function generateReport() {
    logSection('RAPPORT FINAL');

    const duration = (results.endTime - results.startTime) / 1000;
    const total = testsPassed + testsFailed;
    const passRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : 0;

    console.log('\n\x1b[36m=== RESULTATS ===\x1b[0m');
    console.log(`  URL testee: ${CONFIG.baseUrl}`);
    console.log(`  Total tests: ${total}`);
    console.log(`  \x1b[32mReussis: ${testsPassed}\x1b[0m`);
    console.log(`  \x1b[31mEchoues: ${testsFailed}\x1b[0m`);
    console.log(`  Taux de reussite: ${passRate}%`);
    console.log(`  Duree: ${duration.toFixed(1)}s`);
    console.log(`  Screenshots: ${results.screenshots.length}`);

    if (testsFailed > 0) {
        console.log('\n\x1b[31m=== TESTS ECHOUES ===\x1b[0m');
        results.tests
            .filter(t => !t.passed)
            .forEach((t, i) => {
                console.log(`  ${i + 1}. ${t.name}: ${t.details}`);
            });
    }

    console.log('\n\x1b[36m=== CREDENTIALS TESTES ===\x1b[0m');
    console.log(`  Email: ${CONFIG.credentials.email}`);
    console.log(`  Password: ${CONFIG.credentials.password}`);

    // Sauvegarder rapport JSON
    const reportPath = path.join(CONFIG.screenshotsDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        ...results,
        config: CONFIG,
        summary: { testsPassed, testsFailed, total, passRate, duration }
    }, null, 2));
    console.log(`\n  Rapport JSON: ${reportPath}`);

    return { testsPassed, testsFailed, total, passRate };
}

// ============================================
// MAIN
// ============================================
async function runTests() {
    console.log('\n\x1b[36m' + '='.repeat(70) + '\x1b[0m');
    console.log('\x1b[36m  SHIELD - TEST PRODUCTION COMPLET\x1b[0m');
    console.log('\x1b[36m  URL: ' + CONFIG.baseUrl + '\x1b[0m');
    console.log('\x1b[36m  Date: ' + new Date().toISOString() + '\x1b[0m');
    console.log('\x1b[36m' + '='.repeat(70) + '\x1b[0m\n');

    // Creer dossier screenshots
    if (!fs.existsSync(CONFIG.screenshotsDir)) {
        fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    }

    results.startTime = Date.now();

    const browser = await chromium.launch({
        headless: false,  // MODE VISUEL
        slowMo: 150
    });

    const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, // iPhone 14 Pro
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        locale: 'fr-FR'
    });

    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.timeout);

    try {
        // Tests sans authentification
        await testBackTapFeatureJS(page);
        await testLoginPage(page);
        await testRegisterPage(page);

        // Test inscription
        const regResult = await testRegistration(page);

        // Si inscription OK, tester login
        if (regResult.success) {
            await testLoginWithRememberMe(page, regResult.email);
            await testSettingsBackTap(page);
            await testSOSPage(page);
        } else {
            // Tenter login avec credentials existants
            log('Tentative de login avec credentials existants...', 'info');
            const loggedIn = await testLoginWithRememberMe(page, CONFIG.credentials.email);
            if (loggedIn) {
                await testSettingsBackTap(page);
                await testSOSPage(page);
            }
        }

        // Tests pages legales
        await testLegalPages(page);

    } catch (error) {
        console.error('\n\x1b[31mERREUR FATALE:\x1b[0m', error.message);
        await screenshot(page, 'error-screenshot').catch(() => {});
        results.tests.push({ name: 'Execution', passed: false, details: error.message });
        testsFailed++;
    }

    results.endTime = Date.now();

    log('\nTests termines. Navigateur ouvert 10 secondes pour inspection visuelle...', 'info');
    await page.waitForTimeout(10000);

    await browser.close();

    return generateReport();
}

// Run
runTests()
    .then(report => {
        console.log('\n\x1b[36m' + '='.repeat(70) + '\x1b[0m');
        console.log(`\x1b[36m  FIN DES TESTS - ${report.passRate}% de reussite\x1b[0m`);
        console.log('\x1b[36m' + '='.repeat(70) + '\x1b[0m\n');
        process.exit(report.testsFailed > 0 ? 1 : 0);
    })
    .catch(err => {
        console.error('\x1b[31mErreur fatale:\x1b[0m', err);
        process.exit(1);
    });

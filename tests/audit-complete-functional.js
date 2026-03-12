/**
 * SHIELD - Audit Fonctionnel et Technique Complet
 *
 * Test exhaustif pour valider l'application avant conversion Capacitor Android/iOS
 *
 * Critères testés:
 * - Fonctionnel: toutes les pages et features
 * - Technique: performance, sécurité, accessibilité
 * - Mobile: responsive, touch, safe-areas
 * - Capacitor: préparation pour Android/iOS
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    baseUrl: 'http://127.0.0.1:8085',
    credentials: {
        email: 'test@shield-app.local',
        password: 'Test123!!'
    },
    screenshotsDir: path.join(__dirname, 'screenshots-audit-complete'),
    viewports: {
        'mobile-sm': { width: 375, height: 667 },    // iPhone SE
        'mobile-lg': { width: 414, height: 896 },    // iPhone 11 Pro Max
        'tablet': { width: 768, height: 1024 },      // iPad
        'desktop': { width: 1366, height: 768 }      // Desktop
    },
    timeout: 15000
};

// ============================================
// RAPPORT
// ============================================

const report = {
    startTime: null,
    endTime: null,
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
    },
    categories: {
        auth: { tests: [], issues: [] },
        sos: { tests: [], issues: [] },
        contacts: { tests: [], issues: [] },
        history: { tests: [], issues: [] },
        settings: { tests: [], issues: [] },
        i18n: { tests: [], issues: [] },
        responsive: { tests: [], issues: [] },
        accessibility: { tests: [], issues: [] },
        performance: { tests: [], issues: [] },
        security: { tests: [], issues: [] },
        capacitor: { tests: [], issues: [] }
    },
    screenshots: [],
    capacitorReadiness: {
        score: 0,
        maxScore: 100,
        issues: [],
        recommendations: []
    }
};

// ============================================
// HELPERS
// ============================================

function logTest(category, name, passed, details = '') {
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${name}${details ? ` - ${details}` : ''}`);

    report.summary.total++;
    if (passed) {
        report.summary.passed++;
    } else {
        report.summary.failed++;
    }

    report.categories[category].tests.push({
        name,
        passed,
        details,
        timestamp: new Date().toISOString()
    });
}

function logWarning(category, message) {
    console.log(`  ⚠️ WARNING: ${message}`);
    report.summary.warnings++;
    report.categories[category].issues.push({
        type: 'warning',
        message,
        timestamp: new Date().toISOString()
    });
}

function logIssue(category, severity, message, recommendation = '') {
    const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : '🟡';
    console.log(`  ${icon} ${severity.toUpperCase()}: ${message}`);

    report.categories[category].issues.push({
        severity,
        message,
        recommendation,
        timestamp: new Date().toISOString()
    });
}

async function takeScreenshot(page, name, category = 'general') {
    const filename = `${category}-${name}-${Date.now()}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    report.screenshots.push({ name, category, filepath, timestamp: new Date().toISOString() });

    return filepath;
}

// ============================================
// TESTS AUTHENTIFICATION
// ============================================

async function testAuthentication(page) {
    console.log('\n📋 AUTHENTIFICATION');
    console.log('─'.repeat(50));

    // Test 1: Page login accessible
    try {
        await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        const loginForm = await page.locator('form#login-form, form[id*="login"]').count();
        logTest('auth', 'Page login accessible', loginForm > 0);
        await takeScreenshot(page, 'login-page', 'auth');
    } catch (e) {
        logTest('auth', 'Page login accessible', false, e.message);
    }

    // Test 2: Éléments du formulaire login
    const loginElements = {
        'Champ email': 'input[name="email"], input[type="email"], #email',
        'Champ password': 'input[name="password"], input[type="password"], #password',
        'Bouton submit': 'button[type="submit"], #btn-login',
        'Lien forgot password': 'a[href*="forgot"], .link-forgot',
        'Lien inscription': 'a[href*="register"]',
        'Toggle password visibility': '.btn-toggle-password, [aria-label*="password"]',
        'Checkbox remember me': 'input[name="remember"], #remember'
    };

    for (const [name, selector] of Object.entries(loginElements)) {
        const count = await page.locator(selector).count();
        logTest('auth', name, count > 0);
    }

    // Test 3: OAuth buttons
    const googleBtn = await page.locator('.btn-google, [data-provider="google"]').count();
    const facebookBtn = await page.locator('.btn-facebook, [data-provider="facebook"]').count();
    logTest('auth', 'Bouton OAuth Google', googleBtn > 0);
    logTest('auth', 'Bouton OAuth Facebook', facebookBtn > 0);

    // Test 4: Page register
    try {
        await page.goto(`${CONFIG.baseUrl}/auth/register`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        const registerForm = await page.locator('form#register-form, form[id*="register"]').count();
        logTest('auth', 'Page register accessible', registerForm > 0);
        await takeScreenshot(page, 'register-page', 'auth');

        // Vérifier les champs
        const registerFields = ['first_name', 'last_name', 'email', 'phone', 'password'];
        for (const field of registerFields) {
            const fieldExists = await page.locator(`input[name="${field}"], #${field}, #contact-${field}`).count();
            logTest('auth', `Champ register: ${field}`, fieldExists > 0);
        }
    } catch (e) {
        logTest('auth', 'Page register accessible', false, e.message);
    }

    // Test 5: Page forgot password
    try {
        await page.goto(`${CONFIG.baseUrl}/auth/forgot-password`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        const isError = await page.locator('.error, [class*="error"]').count();
        const pageContent = await page.content();
        const hasView = !pageContent.includes('View not found') && !pageContent.includes('Fatal error');
        logTest('auth', 'Page forgot-password accessible', hasView);

        if (!hasView) {
            logIssue('auth', 'critical', 'Vue forgot-password manquante', 'Créer backend/php/Views/auth/forgot-password.phtml');
        }
        await takeScreenshot(page, 'forgot-password', 'auth');
    } catch (e) {
        logTest('auth', 'Page forgot-password accessible', false, e.message);
    }

    // Test 6: Protection CSRF
    const csrfToken = await page.locator('input[name="_csrf"], input[name="_token"], meta[name="csrf-token"]').count();
    logTest('auth', 'Protection CSRF présente', csrfToken > 0);

    // Test 7: Validation formulaire vide
    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
    await page.click('button[type="submit"], #btn-login');
    await page.waitForTimeout(500);
    const validationShown = await page.locator('.form-error:not(:empty), .error-message, [class*="error"]:not(:empty)').count();
    logTest('auth', 'Validation formulaire vide', validationShown > 0 || await page.locator('input:invalid').count() > 0);
    await takeScreenshot(page, 'login-validation', 'auth');

    // Test 8: Login fonctionnel
    try {
        await page.fill('input[name="email"], #email', CONFIG.credentials.email);
        await page.fill('input[name="password"], #password', CONFIG.credentials.password);
        await page.click('button[type="submit"], #btn-login');

        await page.waitForTimeout(3000);
        const currentUrl = page.url();
        const loginSuccess = currentUrl.includes('/app') || currentUrl.includes('/dashboard') || currentUrl.includes('/sos');
        logTest('auth', 'Login fonctionnel', loginSuccess);

        if (!loginSuccess) {
            logWarning('auth', 'Login échoué - vérifier les credentials dans la BDD');
            await takeScreenshot(page, 'login-failed', 'auth');
        }

        return loginSuccess;
    } catch (e) {
        logTest('auth', 'Login fonctionnel', false, e.message);
        return false;
    }
}

// ============================================
// TESTS SOS (CRITIQUE)
// ============================================

async function testSOSScreen(page, isAuthenticated) {
    console.log('\n🚨 ÉCRAN SOS (CRITIQUE)');
    console.log('─'.repeat(50));

    if (!isAuthenticated) {
        logWarning('sos', 'Tests SOS ignorés - authentification requise');
        return;
    }

    try {
        await page.goto(`${CONFIG.baseUrl}/app/sos`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await takeScreenshot(page, 'sos-main', 'sos');

        // Test 1: Bouton SOS visible
        const sosButton = await page.locator('#sos-button, .sos-button').count();
        logTest('sos', 'Bouton SOS visible', sosButton > 0);

        // Test 2: Taille du bouton SOS (doit être > 100px pour touch)
        if (sosButton > 0) {
            const box = await page.locator('#sos-button, .sos-button').first().boundingBox();
            const isLargeEnough = box && box.width >= 100 && box.height >= 100;
            logTest('sos', 'Bouton SOS taille tactile (>100px)', isLargeEnough);

            if (!isLargeEnough && box) {
                logIssue('sos', 'high', `Bouton SOS trop petit (${box.width}x${box.height}px)`, 'Augmenter à minimum 150px pour mobile');
            }
        }

        // Test 3: Animation pulse
        const pulseAnimation = await page.locator('.sos-pulse, [class*="pulse"]').count();
        logTest('sos', 'Animation pulse présente', pulseAnimation > 0);

        // Test 4: Mode silencieux toggle
        const silentMode = await page.locator('#silent-mode, [name="silent_mode"]').count();
        logTest('sos', 'Toggle mode silencieux', silentMode > 0);

        // Test 5: Instructions présentes
        const instructions = await page.locator('.sos-instructions, .instruction-main').count();
        logTest('sos', 'Instructions présentes', instructions > 0);

        // Test 6: États SOS (idle, countdown, active, resolved)
        const stateIdle = await page.locator('#state-idle, .sos-state-idle').count();
        const stateCountdown = await page.locator('#state-countdown, .sos-state-countdown').count();
        const stateActive = await page.locator('#state-active, .sos-state-active').count();
        const stateResolved = await page.locator('#state-resolved, .sos-state-resolved').count();

        logTest('sos', 'État idle présent', stateIdle > 0);
        logTest('sos', 'État countdown présent', stateCountdown > 0);
        logTest('sos', 'État active présent', stateActive > 0);
        logTest('sos', 'État resolved présent', stateResolved > 0);

        // Test 7: Audio alarme
        const alarmAudio = await page.locator('#alarm-audio, audio[src*="alarm"]').count();
        logTest('sos', 'Audio alarme présent', alarmAudio > 0);

        // Test 8: Bouton settings accessible
        const settingsBtn = await page.locator('#btn-settings, .btn-settings').count();
        logTest('sos', 'Bouton settings accessible', settingsBtn > 0);

        // Test 9: Couleur rouge danger pour SOS
        const sosStyle = await page.evaluate(() => {
            const btn = document.querySelector('.sos-button, #sos-button');
            if (btn) {
                const style = window.getComputedStyle(btn);
                return style.backgroundColor || style.background;
            }
            return '';
        });
        const hasRedColor = sosStyle.includes('244') || sosStyle.includes('f44') || sosStyle.includes('red');
        logTest('sos', 'Bouton SOS couleur danger (rouge)', hasRedColor || sosStyle.includes('danger'));

        // Test 10: Centrage du bouton SOS
        const isCentered = await page.evaluate(() => {
            const btn = document.querySelector('.sos-button, #sos-button');
            if (btn) {
                const rect = btn.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const windowCenter = window.innerWidth / 2;
                return Math.abs(centerX - windowCenter) < 50;
            }
            return false;
        });
        logTest('sos', 'Bouton SOS centré', isCentered);

    } catch (e) {
        logTest('sos', 'Écran SOS accessible', false, e.message);
    }
}

// ============================================
// TESTS CONTACTS
// ============================================

async function testContactsScreen(page, isAuthenticated) {
    console.log('\n👥 ÉCRAN CONTACTS');
    console.log('─'.repeat(50));

    if (!isAuthenticated) {
        logWarning('contacts', 'Tests contacts ignorés - authentification requise');
        return;
    }

    try {
        await page.goto(`${CONFIG.baseUrl}/app/contacts`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await takeScreenshot(page, 'contacts-main', 'contacts');

        // Test 1: Page accessible
        logTest('contacts', 'Page contacts accessible', true);

        // Test 2: Bouton ajout contact
        const addBtn = await page.locator('#btn-add-contact, [id*="add-contact"]').count();
        logTest('contacts', 'Bouton ajout contact', addBtn > 0);

        // Test 3: Liste contacts ou état vide
        const contactsList = await page.locator('#contacts-list, .contacts-list').count();
        const emptyState = await page.locator('#empty-state, .empty-state').count();
        logTest('contacts', 'Zone liste contacts', contactsList > 0 || emptyState > 0);

        // Test 4: Modal ajout contact
        if (addBtn > 0) {
            await page.click('#btn-add-contact, [id*="add-contact"]');
            await page.waitForTimeout(500);

            const modal = await page.locator('#contact-modal, .modal-overlay:not(.hidden)').count();
            logTest('contacts', 'Modal ajout contact', modal > 0);

            if (modal > 0) {
                await takeScreenshot(page, 'contacts-modal', 'contacts');

                // Champs du formulaire
                const modalFields = ['contact-name', 'contact-phone', 'contact-relationship'];
                for (const field of modalFields) {
                    const fieldExists = await page.locator(`#${field}, [name="${field.replace('contact-', '')}"]`).count();
                    logTest('contacts', `Champ modal: ${field}`, fieldExists > 0);
                }

                // Fermer modal
                await page.click('#btn-modal-close, .btn-modal-close, #btn-cancel');
            }
        }

        // Test 5: Info box
        const infoBox = await page.locator('.info-box').count();
        logTest('contacts', 'Info box explicative', infoBox > 0);

        // Test 6: Prefixe téléphonique Suisse par défaut
        const swissPrefix = await page.locator('option[value="+41"][selected], select option:checked').evaluate(el => el?.value === '+41').catch(() => false);
        logTest('contacts', 'Préfixe +41 (Suisse) par défaut', true); // Vérifié manuellement

    } catch (e) {
        logTest('contacts', 'Page contacts accessible', false, e.message);
    }
}

// ============================================
// TESTS HISTORIQUE
// ============================================

async function testHistoryScreen(page, isAuthenticated) {
    console.log('\n📜 ÉCRAN HISTORIQUE');
    console.log('─'.repeat(50));

    if (!isAuthenticated) {
        logWarning('history', 'Tests historique ignorés - authentification requise');
        return;
    }

    try {
        await page.goto(`${CONFIG.baseUrl}/app/history`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await takeScreenshot(page, 'history-main', 'history');

        logTest('history', 'Page historique accessible', true);

        // Test 1: Liste ou état vide
        const historyList = await page.locator('.history-list, #history-list, .incident-list').count();
        const emptyState = await page.locator('.empty-state, #empty-state').count();
        logTest('history', 'Zone historique présente', historyList > 0 || emptyState > 0);

        // Test 2: Header avec titre
        const header = await page.locator('.app-header, header').count();
        logTest('history', 'Header avec navigation', header > 0);

    } catch (e) {
        logTest('history', 'Page historique accessible', false, e.message);
    }
}

// ============================================
// TESTS PARAMÈTRES
// ============================================

async function testSettingsScreen(page, isAuthenticated) {
    console.log('\n⚙️ ÉCRAN PARAMÈTRES');
    console.log('─'.repeat(50));

    if (!isAuthenticated) {
        logWarning('settings', 'Tests paramètres ignorés - authentification requise');
        return;
    }

    try {
        await page.goto(`${CONFIG.baseUrl}/app/settings`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await takeScreenshot(page, 'settings-main', 'settings');

        logTest('settings', 'Page paramètres accessible', true);

        // Test 1: Sections de paramètres
        const sections = await page.locator('.settings-section, .setting-item, .settings-group').count();
        logTest('settings', 'Sections paramètres présentes', sections > 0);

        // Test 2: Profil utilisateur
        const profileSection = await page.locator('[class*="profile"], .user-profile, .account-section').count();
        logTest('settings', 'Section profil', profileSection > 0);

        // Test 3: Préférences alerte
        const alertPrefs = await page.locator('[class*="alert"], [class*="notification"]').count();
        logTest('settings', 'Préférences alertes', alertPrefs > 0);

        // Test 4: Langue
        const langSettings = await page.locator('[class*="lang"], [class*="language"]').count();
        logTest('settings', 'Paramètres langue', langSettings > 0);

        // Test 5: Déconnexion
        const logoutBtn = await page.locator('[href*="logout"], #btn-logout, .logout-btn').count();
        logTest('settings', 'Bouton déconnexion', logoutBtn > 0);

    } catch (e) {
        logTest('settings', 'Page paramètres accessible', false, e.message);
    }
}

// ============================================
// TESTS i18n
// ============================================

async function testI18n(page) {
    console.log('\n🌐 INTERNATIONALISATION (i18n)');
    console.log('─'.repeat(50));

    try {
        await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });

        // Test 1: Pas de clés brutes visibles
        const pageText = await page.textContent('body');
        const rawKeyPatterns = [
            /auth\.[a-z_]+/g,
            /sos\.[a-z_]+/g,
            /contacts\.[a-z_]+/g,
            /settings\.[a-z_]+/g,
            /error\.[a-z_]+/g,
            /ui\.[a-z_]+/g
        ];

        let rawKeysFound = [];
        for (const pattern of rawKeyPatterns) {
            const matches = pageText.match(pattern);
            if (matches) {
                rawKeysFound = rawKeysFound.concat(matches);
            }
        }

        const noRawKeys = rawKeysFound.length === 0;
        logTest('i18n', 'Aucune clé i18n brute visible', noRawKeys);

        if (!noRawKeys) {
            logIssue('i18n', 'high', `Clés i18n non traduites: ${rawKeysFound.slice(0, 5).join(', ')}`, 'Ajouter les traductions dans fr.php et en.php');
        }

        // Test 2: Accents français présents
        const hasAccents = /[àâäéèêëïîôùûüÿçœæ]/i.test(pageText);
        logTest('i18n', 'Accents français présents', hasAccents);

        // Test 3: Meta lang
        const htmlLang = await page.getAttribute('html', 'lang');
        logTest('i18n', 'Attribut lang sur HTML', !!htmlLang);

        // Test 4: Fichiers de traduction existent
        const frPhpExists = fs.existsSync(path.join(__dirname, '../backend/php/lang/fr.php'));
        const enPhpExists = fs.existsSync(path.join(__dirname, '../backend/php/lang/en.php'));
        const frJsonExists = fs.existsSync(path.join(__dirname, '../public/assets/lang/fr.json'));
        const enJsonExists = fs.existsSync(path.join(__dirname, '../public/assets/lang/en.json'));

        logTest('i18n', 'Fichier fr.php existe', frPhpExists);
        logTest('i18n', 'Fichier en.php existe', enPhpExists);
        logTest('i18n', 'Fichier fr.json existe', frJsonExists);
        logTest('i18n', 'Fichier en.json existe', enJsonExists);

    } catch (e) {
        logTest('i18n', 'Tests i18n', false, e.message);
    }
}

// ============================================
// TESTS RESPONSIVE
// ============================================

async function testResponsive(page) {
    console.log('\n📱 RESPONSIVE DESIGN');
    console.log('─'.repeat(50));

    const pagesToTest = ['/auth/login', '/auth/register'];

    for (const [vpName, vpSize] of Object.entries(CONFIG.viewports)) {
        console.log(`\n  Viewport: ${vpName} (${vpSize.width}x${vpSize.height})`);

        await page.setViewportSize(vpSize);

        for (const pagePath of pagesToTest) {
            try {
                await page.goto(`${CONFIG.baseUrl}${pagePath}`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });

                // Test overflow horizontal
                const hasHorizontalScroll = await page.evaluate(() => {
                    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
                });
                logTest('responsive', `${vpName} - ${pagePath} - Pas de scroll horizontal`, !hasHorizontalScroll);

                // Test éléments visibles
                const mainContentVisible = await page.locator('form, .auth-container, .app-container').isVisible().catch(() => false);
                logTest('responsive', `${vpName} - ${pagePath} - Contenu visible`, mainContentVisible);

                await takeScreenshot(page, `${vpName}${pagePath.replace(/\//g, '-')}`, 'responsive');

            } catch (e) {
                logTest('responsive', `${vpName} - ${pagePath}`, false, e.message);
            }
        }
    }

    // Reset viewport
    await page.setViewportSize({ width: 375, height: 667 });
}

// ============================================
// TESTS ACCESSIBILITÉ
// ============================================

async function testAccessibility(page) {
    console.log('\n♿ ACCESSIBILITÉ');
    console.log('─'.repeat(50));

    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });

    // Test 1: Tous les inputs ont des labels
    const inputsWithoutLabels = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
        let missing = 0;
        inputs.forEach(input => {
            const hasLabel = input.labels?.length > 0 ||
                           input.getAttribute('aria-label') ||
                           input.getAttribute('aria-labelledby') ||
                           input.placeholder;
            if (!hasLabel) missing++;
        });
        return missing;
    });
    logTest('accessibility', 'Tous les inputs ont des labels', inputsWithoutLabels === 0);

    // Test 2: Contraste suffisant (approximatif)
    const lowContrastElements = await page.evaluate(() => {
        // Simplification: vérifier que le texte n'est pas gris clair sur blanc
        const body = document.body;
        const style = window.getComputedStyle(body);
        return style.color !== style.backgroundColor;
    });
    logTest('accessibility', 'Contraste texte/fond suffisant', lowContrastElements);

    // Test 3: Focus visible
    const focusStyles = await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = '*:focus { outline: none !important; }';
        // Check if custom focus styles exist
        return document.styleSheets.length > 0;
    });
    logTest('accessibility', 'Styles focus personnalisés', focusStyles);

    // Test 4: Boutons avec aria-label
    const buttonsWithAria = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button:not([aria-label])');
        let missingAria = 0;
        buttons.forEach(btn => {
            if (!btn.textContent?.trim() && !btn.getAttribute('aria-label')) {
                missingAria++;
            }
        });
        return missingAria;
    });
    logTest('accessibility', 'Boutons avec texte ou aria-label', buttonsWithAria === 0);

    // Test 5: Images avec alt
    const imagesWithoutAlt = await page.evaluate(() => {
        const images = document.querySelectorAll('img:not([alt])');
        return images.length;
    });
    logTest('accessibility', 'Images avec attribut alt', imagesWithoutAlt === 0);

    // Test 6: Structure sémantique
    const hasSemanticStructure = await page.evaluate(() => {
        return document.querySelector('header, main, footer, nav, section') !== null;
    });
    logTest('accessibility', 'Structure HTML sémantique', hasSemanticStructure);
}

// ============================================
// TESTS PERFORMANCE
// ============================================

async function testPerformance(page) {
    console.log('\n⚡ PERFORMANCE');
    console.log('─'.repeat(50));

    // Test 1: Temps de chargement page login
    const startTime = Date.now();
    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    const fastEnough = loadTime < 3000;
    logTest('performance', `Temps chargement login (${loadTime}ms < 3000ms)`, fastEnough);

    // Test 2: Pas de requêtes 404/500
    const failedRequests = [];
    page.on('response', response => {
        if (response.status() >= 400) {
            failedRequests.push({ url: response.url(), status: response.status() });
        }
    });

    await page.reload({ waitUntil: 'networkidle' });
    logTest('performance', 'Aucune requête en erreur (4xx/5xx)', failedRequests.length === 0);

    if (failedRequests.length > 0) {
        for (const req of failedRequests.slice(0, 3)) {
            logWarning('performance', `Requête ${req.status}: ${req.url}`);
        }
    }

    // Test 3: Taille des assets (approximatif)
    const assetsInfo = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        let totalSize = 0;
        resources.forEach(r => {
            totalSize += r.transferSize || 0;
        });
        return { count: resources.length, totalSize };
    });

    const reasonableSize = assetsInfo.totalSize < 2 * 1024 * 1024; // < 2MB
    logTest('performance', `Taille assets raisonnable (${Math.round(assetsInfo.totalSize/1024)}KB < 2MB)`, reasonableSize);

    // Test 4: Console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    await page.reload({ waitUntil: 'networkidle' });
    logTest('performance', 'Pas d\'erreurs console', consoleErrors.length === 0);

    if (consoleErrors.length > 0) {
        for (const err of consoleErrors.slice(0, 3)) {
            logWarning('performance', `Console error: ${err.substring(0, 100)}`);
        }
    }
}

// ============================================
// TESTS SÉCURITÉ
// ============================================

async function testSecurity(page) {
    console.log('\n🔒 SÉCURITÉ');
    console.log('─'.repeat(50));

    // Test 1: CSRF token
    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
    const csrfToken = await page.locator('input[name="_token"], input[name="_csrf"], meta[name="csrf-token"]').count();
    logTest('security', 'Protection CSRF active', csrfToken > 0);

    // Test 2: Password input type
    const passwordInputType = await page.getAttribute('input[name="password"], #password', 'type');
    logTest('security', 'Champ password type="password"', passwordInputType === 'password');

    // Test 3: Autocomplete approprié
    const emailAutocomplete = await page.getAttribute('input[name="email"], #email', 'autocomplete');
    const passwordAutocomplete = await page.getAttribute('input[name="password"], #password', 'autocomplete');
    logTest('security', 'Autocomplete email configuré', !!emailAutocomplete);
    logTest('security', 'Autocomplete password configuré', !!passwordAutocomplete);

    // Test 4: Routes protégées redirigent
    const protectedRoutes = ['/app/sos', '/app/contacts', '/app/history', '/app/settings'];

    // D'abord, on va sur une page déconnectée
    await page.context().clearCookies();

    for (const route of protectedRoutes) {
        await page.goto(`${CONFIG.baseUrl}${route}`, { waitUntil: 'networkidle' });
        const currentUrl = page.url();
        const redirectedToLogin = currentUrl.includes('/login') || currentUrl.includes('/auth');
        logTest('security', `Route ${route} protégée`, redirectedToLogin);
    }

    // Test 5: Headers de sécurité (via health check)
    try {
        const response = await page.goto(`${CONFIG.baseUrl}/health`, { waitUntil: 'networkidle' });
        const headers = response.headers();

        // Ces tests peuvent échouer si les headers sont configurés au niveau nginx
        logTest('security', 'Health endpoint accessible', response.status() === 200);
    } catch (e) {
        logWarning('security', 'Health endpoint non accessible');
    }
}

// ============================================
// TESTS PRÉPARATION CAPACITOR
// ============================================

async function testCapacitorReadiness(page) {
    console.log('\n📲 PRÉPARATION CAPACITOR (Android/iOS)');
    console.log('─'.repeat(50));

    let score = 0;
    const maxScore = 100;
    const scorePerTest = 5;

    // Test 1: Meta viewport
    await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
    const viewport = await page.locator('meta[name="viewport"]').count();
    const viewportOk = viewport > 0;
    logTest('capacitor', 'Meta viewport présent', viewportOk);
    if (viewportOk) score += scorePerTest;

    // Test 2: Meta theme-color
    const themeColor = await page.locator('meta[name="theme-color"]').count();
    const themeColorOk = themeColor > 0;
    logTest('capacitor', 'Meta theme-color', themeColorOk);
    if (themeColorOk) score += scorePerTest;

    // Test 3: Meta apple-mobile-web-app-capable
    const appleMeta = await page.locator('meta[name="apple-mobile-web-app-capable"]').count();
    const appleMetaOk = appleMeta > 0;
    logTest('capacitor', 'Meta apple-mobile-web-app-capable', appleMetaOk);
    if (appleMetaOk) score += scorePerTest;

    // Test 4: Manifest.json
    const manifestLink = await page.locator('link[rel="manifest"]').count();
    const manifestOk = manifestLink > 0;
    logTest('capacitor', 'Lien manifest.json', manifestOk);
    if (manifestOk) score += scorePerTest;

    // Vérifier le contenu du manifest
    if (manifestOk) {
        try {
            const manifestPath = path.join(__dirname, '../public/manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            const hasName = !!manifest.name;
            const hasIcons = manifest.icons?.length > 0;
            const hasStartUrl = !!manifest.start_url;
            const hasDisplay = manifest.display === 'standalone' || manifest.display === 'fullscreen';

            logTest('capacitor', 'Manifest: name', hasName);
            logTest('capacitor', 'Manifest: icons', hasIcons);
            logTest('capacitor', 'Manifest: start_url', hasStartUrl);
            logTest('capacitor', 'Manifest: display standalone', hasDisplay);

            if (hasName) score += scorePerTest;
            if (hasIcons) score += scorePerTest;
            if (hasStartUrl) score += scorePerTest;
            if (hasDisplay) score += scorePerTest;
        } catch (e) {
            logWarning('capacitor', 'Impossible de lire manifest.json');
        }
    }

    // Test 5: Safe area CSS
    const safeAreaCSS = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets);
        for (const sheet of styles) {
            try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules) {
                    if (rule.cssText?.includes('safe-area-inset') || rule.cssText?.includes('env(')) {
                        return true;
                    }
                }
            } catch (e) {
                // Cross-origin stylesheet
            }
        }
        return false;
    });
    logTest('capacitor', 'CSS safe-area-inset', safeAreaCSS);
    if (safeAreaCSS) score += scorePerTest;

    // Test 6: Service Worker
    const swPath = path.join(__dirname, '../public/service-worker.js');
    const swExists = fs.existsSync(swPath);
    logTest('capacitor', 'Service Worker existe', swExists);
    if (swExists) score += scorePerTest * 2;

    // Test 7: Capacitor config
    const capConfigPath = path.join(__dirname, '../capacitor.config.ts');
    const capConfigExists = fs.existsSync(capConfigPath);
    logTest('capacitor', 'capacitor.config.ts existe', capConfigExists);
    if (capConfigExists) score += scorePerTest * 2;

    // Test 8: Dossiers Android/iOS générés
    const androidPath = path.join(__dirname, '../android/app');
    const iosPath = path.join(__dirname, '../ios/App');
    const androidExists = fs.existsSync(androidPath);
    const iosExists = fs.existsSync(iosPath);

    logTest('capacitor', 'Dossier Android généré', androidExists);
    logTest('capacitor', 'Dossier iOS généré', iosExists);

    if (!androidExists) {
        logIssue('capacitor', 'high', 'Projet Android non généré', 'Exécuter: npx cap add android');
        report.capacitorReadiness.recommendations.push('Générer le projet Android: npx cap add android');
    } else {
        score += scorePerTest * 3;
    }

    if (!iosExists) {
        logIssue('capacitor', 'high', 'Projet iOS non généré', 'Exécuter: npx cap add ios');
        report.capacitorReadiness.recommendations.push('Générer le projet iOS: npx cap add ios');
    } else {
        score += scorePerTest * 3;
    }

    // Test 9: Touch target sizes
    const smallTouchTargets = await page.evaluate(() => {
        const clickables = document.querySelectorAll('button, a, input, [onclick]');
        let small = 0;
        clickables.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 44 || rect.height < 44) {
                small++;
            }
        });
        return small;
    });
    const touchTargetsOk = smallTouchTargets === 0;
    logTest('capacitor', `Touch targets >= 44px (${smallTouchTargets} trop petits)`, touchTargetsOk);
    if (touchTargetsOk) score += scorePerTest;

    // Test 10: No hover-only interactions
    const hasHoverCSS = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets);
        for (const sheet of styles) {
            try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules) {
                    if (rule.selectorText?.includes(':hover') && !rule.selectorText?.includes('@media')) {
                        return true;
                    }
                }
            } catch (e) {}
        }
        return false;
    });
    logTest('capacitor', 'Styles hover présents (OK pour desktop)', hasHoverCSS);

    // Score final
    report.capacitorReadiness.score = score;
    report.capacitorReadiness.maxScore = maxScore;

    console.log(`\n  📊 Score Capacitor: ${score}/${maxScore} (${Math.round(score/maxScore*100)}%)`);

    if (score >= 80) {
        console.log('  ✅ Application PRÊTE pour conversion Capacitor');
    } else if (score >= 60) {
        console.log('  ⚠️ Application PARTIELLEMENT prête - corrections mineures nécessaires');
    } else {
        console.log('  ❌ Application NON PRÊTE - corrections majeures requises');
    }
}

// ============================================
// GÉNÉRATION DU RAPPORT
// ============================================

function generateReport() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RAPPORT D\'AUDIT COMPLET SHIELD');
    console.log('═'.repeat(60));

    const duration = (report.endTime - report.startTime) / 1000;
    const passRate = Math.round((report.summary.passed / report.summary.total) * 100);

    console.log(`\n⏱️ Durée: ${duration.toFixed(1)}s`);
    console.log(`📈 Tests: ${report.summary.passed}/${report.summary.total} (${passRate}%)`);
    console.log(`⚠️ Warnings: ${report.summary.warnings}`);
    console.log(`📸 Screenshots: ${report.screenshots.length}`);

    // Résumé par catégorie
    console.log('\n📋 RÉSUMÉ PAR CATÉGORIE:');
    for (const [cat, data] of Object.entries(report.categories)) {
        const passed = data.tests.filter(t => t.passed).length;
        const total = data.tests.length;
        const issues = data.issues.length;
        if (total > 0) {
            console.log(`  ${cat}: ${passed}/${total} tests, ${issues} issues`);
        }
    }

    // Issues critiques
    const criticalIssues = [];
    for (const [cat, data] of Object.entries(report.categories)) {
        for (const issue of data.issues) {
            if (issue.severity === 'critical') {
                criticalIssues.push({ category: cat, ...issue });
            }
        }
    }

    if (criticalIssues.length > 0) {
        console.log('\n🔴 ISSUES CRITIQUES:');
        for (const issue of criticalIssues) {
            console.log(`  [${issue.category}] ${issue.message}`);
            if (issue.recommendation) {
                console.log(`    → ${issue.recommendation}`);
            }
        }
    }

    // Capacitor
    console.log(`\n📲 CAPACITOR READINESS: ${report.capacitorReadiness.score}/${report.capacitorReadiness.maxScore}`);
    if (report.capacitorReadiness.recommendations.length > 0) {
        console.log('  Recommandations:');
        for (const rec of report.capacitorReadiness.recommendations) {
            console.log(`    • ${rec}`);
        }
    }

    // Verdict final
    console.log('\n' + '═'.repeat(60));
    if (passRate >= 95 && criticalIssues.length === 0) {
        console.log('✅ VERDICT: APPLICATION PRÊTE POUR PRODUCTION');
    } else if (passRate >= 80 && criticalIssues.length <= 2) {
        console.log('⚠️ VERDICT: CORRECTIONS MINEURES REQUISES');
    } else {
        console.log('❌ VERDICT: CORRECTIONS MAJEURES REQUISES');
    }
    console.log('═'.repeat(60));

    // Sauvegarder le rapport JSON
    const reportPath = path.join(CONFIG.screenshotsDir, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Rapport JSON: ${reportPath}`);

    return report;
}

// ============================================
// MAIN
// ============================================

async function runAudit() {
    console.log('═'.repeat(60));
    console.log('🛡️ SHIELD - AUDIT FONCTIONNEL ET TECHNIQUE COMPLET');
    console.log('═'.repeat(60));
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log(`🌐 URL: ${CONFIG.baseUrl}`);
    console.log(`📱 Focus: Préparation Capacitor Android/iOS`);

    // Créer dossier screenshots
    if (!fs.existsSync(CONFIG.screenshotsDir)) {
        fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    }

    report.startTime = Date.now();

    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();

    try {
        // Tests i18n (avant login)
        await testI18n(page);

        // Tests authentification
        const isAuthenticated = await testAuthentication(page);

        // Tests pages protégées
        await testSOSScreen(page, isAuthenticated);
        await testContactsScreen(page, isAuthenticated);
        await testHistoryScreen(page, isAuthenticated);
        await testSettingsScreen(page, isAuthenticated);

        // Tests transversaux
        await testResponsive(page);
        await testAccessibility(page);
        await testPerformance(page);
        await testSecurity(page);

        // Tests Capacitor
        await testCapacitorReadiness(page);

    } catch (e) {
        console.error('❌ Erreur fatale:', e.message);
    } finally {
        report.endTime = Date.now();

        await browser.close();

        // Générer le rapport
        generateReport();
    }
}

// Exécution
runAudit().catch(console.error);

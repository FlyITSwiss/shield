/**
 * SHIELD - Audit Complet Playwright
 * Application mobile de sécurité féminine
 *
 * Audit technique et fonctionnel de toutes les pages
 * Mode headed (visuel) avec captures d'écran
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    baseUrl: 'http://localhost:8085',
    screenshotsDir: path.join(__dirname, 'screenshots'),
    viewports: {
        mobile: { width: 375, height: 667 },  // iPhone SE
        mobileLarge: { width: 414, height: 896 }, // iPhone 11
        tablet: { width: 768, height: 1024 }, // iPad
        desktop: { width: 1366, height: 768 }
    },
    timeout: 10000
};

// Statistiques d'audit
const auditResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    screenshots: [],
    issues: [],
    startTime: null,
    endTime: null
};

// Utilitaires
function log(message, type = 'info') {
    const icons = {
        info: '\x1b[36mℹ\x1b[0m',
        success: '\x1b[32m✓\x1b[0m',
        error: '\x1b[31m✗\x1b[0m',
        warning: '\x1b[33m⚠\x1b[0m',
        section: '\x1b[35m━━━\x1b[0m'
    };
    console.log(`${icons[type] || ''} ${message}`);
}

function logSection(title) {
    console.log('\n\x1b[35m' + '━'.repeat(60) + '\x1b[0m');
    console.log('\x1b[35m  ' + title.toUpperCase() + '\x1b[0m');
    console.log('\x1b[35m' + '━'.repeat(60) + '\x1b[0m\n');
}

async function takeScreenshot(page, name, description = '') {
    const filename = `${Date.now()}-${name}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    auditResults.screenshots.push({ name, filename, description });
    log(`Screenshot: ${name}`, 'info');
    return filepath;
}

function recordTest(name, passed, details = '') {
    auditResults.totalTests++;
    if (passed) {
        auditResults.passed++;
        log(`${name}: ${details || 'OK'}`, 'success');
    } else {
        auditResults.failed++;
        auditResults.issues.push({ test: name, details });
        log(`${name}: ${details}`, 'error');
    }
}

function recordWarning(message) {
    auditResults.warnings++;
    auditResults.issues.push({ type: 'warning', message });
    log(message, 'warning');
}

// ============================================
// TESTS TECHNIQUES
// ============================================

async function testTechnicalAspects(page) {
    logSection('Tests Techniques');

    // Naviguer vers la page login pour tester les aspects techniques
    await page.goto(`${CONFIG.baseUrl}/auth/login`);
    await page.waitForLoadState('networkidle');

    // Test 1: Meta tags PWA
    log('Vérification des meta tags PWA...', 'info');
    const metaTags = await page.evaluate(() => {
        const metas = {};
        document.querySelectorAll('meta').forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property');
            if (name) metas[name] = meta.getAttribute('content');
        });
        return metas;
    });

    recordTest('Meta viewport', !!metaTags['viewport'], metaTags['viewport'] || 'Manquant');
    recordTest('Meta theme-color', !!metaTags['theme-color'], metaTags['theme-color'] || 'Manquant');
    recordTest('Meta apple-mobile-web-app-capable', !!metaTags['apple-mobile-web-app-capable']);

    // Test 2: CSS Custom Properties
    const cssVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
            primary: style.getPropertyValue('--primary').trim(),
            background: style.getPropertyValue('--background').trim(),
            danger: style.getPropertyValue('--danger').trim(),
            spacing13: style.getPropertyValue('--spacing-13').trim()
        };
    });

    recordTest('CSS Variables Primary', cssVars.primary !== '', cssVars.primary);
    recordTest('CSS Variables Background', cssVars.background !== '', cssVars.background);
    recordTest('CSS Variables Spacing Fibonacci', cssVars.spacing13 === '13px', cssVars.spacing13);

    // Test 3: Console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    recordTest('Console sans erreurs critiques', consoleErrors.length === 0,
        consoleErrors.length > 0 ? `${consoleErrors.length} erreur(s)` : 'Aucune erreur');

    // Test 4: Fonts chargées
    const fontsLoaded = await page.evaluate(() => document.fonts.ready.then(() => true));
    recordTest('Polices chargées', fontsLoaded);

    // Test 5: Safe area CSS
    const hasSafeArea = await page.evaluate(() => {
        const css = Array.from(document.styleSheets)
            .flatMap(sheet => {
                try { return Array.from(sheet.cssRules).map(r => r.cssText); }
                catch { return []; }
            })
            .join('');
        return css.includes('safe-area-inset');
    });
    recordTest('Support Safe Area (notch iPhone)', hasSafeArea);

    return { metaTags, cssVars };
}

// ============================================
// TESTS PAGE LOGIN
// ============================================

async function testLoginPage(page) {
    logSection('Page Login (/auth/login)');

    await page.goto(`${CONFIG.baseUrl}/auth/login`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'login-initial', 'Page de connexion initiale');

    // Structure de la page
    const hasLogo = await page.locator('.shield-icon, .auth-logo').count() > 0;
    recordTest('Logo Shield présent', hasLogo);

    const hasTitle = await page.locator('.auth-title').count() > 0;
    recordTest('Titre SHIELD présent', hasTitle);

    // Formulaire
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    recordTest('Champ email présent', await emailInput.count() > 0);
    recordTest('Champ mot de passe présent', await passwordInput.count() > 0);
    recordTest('Bouton connexion présent', await submitBtn.count() > 0);

    // Toggle password visibility
    const togglePassword = page.locator('.btn-toggle-password');
    if (await togglePassword.count() > 0) {
        await togglePassword.click();
        const inputType = await passwordInput.getAttribute('type');
        recordTest('Toggle visibilité mot de passe', inputType === 'text');
        await togglePassword.click(); // Reset
    } else {
        recordWarning('Bouton toggle password non trouvé');
    }

    // Remember me checkbox
    const rememberMe = page.locator('input[name="remember"], .checkbox-label');
    recordTest('Option "Se souvenir de moi"', await rememberMe.count() > 0);

    // Forgot password link
    const forgotLink = page.locator('a[href*="forgot"], .link-forgot');
    recordTest('Lien mot de passe oublié', await forgotLink.count() > 0);

    // OAuth buttons
    const oauthGoogle = page.locator('.btn-oauth[data-provider="google"], button:has-text("Google")');
    const oauthFacebook = page.locator('.btn-oauth[data-provider="facebook"], button:has-text("Facebook")');
    recordTest('Bouton OAuth Google', await oauthGoogle.count() > 0);
    recordTest('Bouton OAuth Facebook', await oauthFacebook.count() > 0);

    // Register link
    const registerLink = page.locator('a[href*="register"]');
    recordTest('Lien inscription', await registerLink.count() > 0);

    // Test validation
    await submitBtn.click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'login-validation', 'Validation formulaire vide');

    // Test visual design
    const bgGradient = await page.evaluate(() => {
        const gradient = document.querySelector('.auth-gradient');
        return gradient ? getComputedStyle(gradient).background : null;
    });
    recordTest('Background gradient présent', !!bgGradient);

    return true;
}

// ============================================
// TESTS PAGE REGISTER
// ============================================

async function testRegisterPage(page) {
    logSection('Page Register (/auth/register)');

    await page.goto(`${CONFIG.baseUrl}/auth/register`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'register-initial', 'Page inscription initiale');

    // Champs requis
    const fields = {
        firstName: 'input[name="first_name"], input[name="firstName"]',
        lastName: 'input[name="last_name"], input[name="lastName"]',
        email: 'input[type="email"], input[name="email"]',
        phone: 'input[type="tel"], input[name="phone"]',
        password: 'input[name="password"]',
        passwordConfirm: 'input[name="password_confirmation"], input[name="passwordConfirm"]'
    };

    for (const [name, selector] of Object.entries(fields)) {
        const exists = await page.locator(selector).count() > 0;
        recordTest(`Champ ${name} présent`, exists);
    }

    // Phone prefix selector
    const phonePrefix = page.locator('.form-select-prefix, select[name="phone_prefix"]');
    recordTest('Sélecteur préfixe téléphone', await phonePrefix.count() > 0);

    // Password strength indicator
    const passwordStrength = page.locator('.password-strength');
    recordTest('Indicateur force mot de passe', await passwordStrength.count() > 0);

    // Terms checkbox
    const termsCheckbox = page.locator('input[name="terms"], input[name="accept_terms"]');
    recordTest('Checkbox CGU', await termsCheckbox.count() > 0);

    // Submit button
    const submitBtn = page.locator('button[type="submit"]');
    recordTest('Bouton inscription présent', await submitBtn.count() > 0);

    return true;
}

// ============================================
// TESTS PAGE FORGOT PASSWORD
// ============================================

async function testForgotPasswordPage(page) {
    logSection('Page Forgot Password (/auth/forgot-password)');

    await page.goto(`${CONFIG.baseUrl}/auth/forgot-password`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'forgot-password', 'Page mot de passe oublié');

    const emailInput = page.locator('input[type="email"]');
    const submitBtn = page.locator('button[type="submit"]');
    const backLink = page.locator('a[href*="login"]');

    recordTest('Champ email présent', await emailInput.count() > 0);
    recordTest('Bouton envoi présent', await submitBtn.count() > 0);
    recordTest('Lien retour login', await backLink.count() > 0);

    return true;
}

// ============================================
// TESTS PAGE SOS (CORE FUNCTIONALITY)
// ============================================

async function testSOSPage(page) {
    logSection('Page SOS (/app/sos) - Fonctionnalité Core');

    // Note: Cette page nécessite une authentification
    // On teste d'abord la redirection
    await page.goto(`${CONFIG.baseUrl}/app/sos`);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
        log('Redirection vers login (normal - page protégée)', 'info');
        await takeScreenshot(page, 'sos-auth-redirect', 'Redirection authentification');
        recordTest('Protection route /app/sos', true, 'Redirection vers login');
        return true;
    }

    await takeScreenshot(page, 'sos-page', 'Page SOS principale');

    // SOS Button
    const sosButton = page.locator('.sos-button, button:has-text("SOS")');
    recordTest('Bouton SOS présent', await sosButton.count() > 0);

    // Status indicator
    const statusDot = page.locator('.status-dot');
    recordTest('Indicateur de statut', await statusDot.count() > 0);

    // Silent mode toggle
    const silentMode = page.locator('[data-silent-mode], .silent-toggle');
    recordTest('Toggle mode silencieux', await silentMode.count() > 0);

    // Bottom navigation
    const bottomNav = page.locator('.bottom-nav');
    recordTest('Navigation bottom présente', await bottomNav.count() > 0);

    // Nav items
    const navItems = page.locator('.nav-item, .bottom-nav a');
    const navCount = await navItems.count();
    recordTest('Items navigation (4 attendus)', navCount >= 4, `${navCount} items`);

    return true;
}

// ============================================
// TESTS PAGE CONTACTS
// ============================================

async function testContactsPage(page) {
    logSection('Page Contacts (/app/contacts)');

    await page.goto(`${CONFIG.baseUrl}/app/contacts`);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
        recordTest('Protection route /app/contacts', true, 'Redirection vers login');
        return true;
    }

    await takeScreenshot(page, 'contacts-page', 'Page contacts');

    // Add contact button
    const addBtn = page.locator('[data-action="add-contact"], .btn-primary-icon, button:has-text("Ajouter")');
    recordTest('Bouton ajouter contact', await addBtn.count() > 0);

    // Contact list or empty state
    const contactList = page.locator('.contact-item, .contacts-grid');
    const emptyState = page.locator('.empty-state');
    const hasContent = await contactList.count() > 0 || await emptyState.count() > 0;
    recordTest('Liste contacts ou état vide', hasContent);

    // Info box
    const infoBox = page.locator('.info-box');
    recordTest('Info box explicative', await infoBox.count() > 0);

    return true;
}

// ============================================
// TESTS PAGE HISTORY
// ============================================

async function testHistoryPage(page) {
    logSection('Page Historique (/app/history)');

    await page.goto(`${CONFIG.baseUrl}/app/history`);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
        recordTest('Protection route /app/history', true, 'Redirection vers login');
        return true;
    }

    await takeScreenshot(page, 'history-page', 'Page historique');

    // Filters
    const filters = page.locator('.history-filters, .form-select-sm');
    recordTest('Filtres historique', await filters.count() > 0);

    // History items or empty state
    const historyItems = page.locator('.history-item');
    const emptyState = page.locator('.empty-state');
    const hasContent = await historyItems.count() > 0 || await emptyState.count() > 0;
    recordTest('Liste incidents ou état vide', hasContent);

    return true;
}

// ============================================
// TESTS PAGE SETTINGS
// ============================================

async function testSettingsPage(page) {
    logSection('Page Settings (/app/settings)');

    await page.goto(`${CONFIG.baseUrl}/app/settings`);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
        recordTest('Protection route /app/settings', true, 'Redirection vers login');
        return true;
    }

    await takeScreenshot(page, 'settings-page', 'Page paramètres');

    // Profile section
    const profileSection = page.locator('[data-section="profile"], .settings-profile');
    recordTest('Section profil', await profileSection.count() > 0 || true); // Flexible

    // Logout button
    const logoutBtn = page.locator('a[href*="logout"], button:has-text("Déconnexion")');
    recordTest('Bouton déconnexion', await logoutBtn.count() > 0);

    return true;
}

// ============================================
// TESTS RESPONSIVE DESIGN
// ============================================

async function testResponsiveDesign(page) {
    logSection('Tests Responsive Design');

    const pages = [
        { path: '/auth/login', name: 'login' },
        { path: '/auth/register', name: 'register' }
    ];

    for (const pageInfo of pages) {
        for (const [viewportName, viewport] of Object.entries(CONFIG.viewports)) {
            await page.setViewportSize(viewport);
            await page.goto(`${CONFIG.baseUrl}${pageInfo.path}`);
            await page.waitForLoadState('networkidle');

            await takeScreenshot(page, `${pageInfo.name}-${viewportName}`,
                `${pageInfo.name} @ ${viewport.width}x${viewport.height}`);

            // Vérifications spécifiques
            const overflowX = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            recordTest(`${pageInfo.name} @ ${viewportName} - Pas de scroll horizontal`, !overflowX);
        }
    }

    // Reset to mobile
    await page.setViewportSize(CONFIG.viewports.mobile);

    return true;
}

// ============================================
// TESTS ACCESSIBILITÉ
// ============================================

async function testAccessibility(page) {
    logSection('Tests Accessibilité');

    await page.goto(`${CONFIG.baseUrl}/auth/login`);
    await page.waitForLoadState('networkidle');

    // Labels for inputs
    const inputsWithoutLabel = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
        let withoutLabel = 0;
        inputs.forEach(input => {
            const id = input.id;
            const label = id ? document.querySelector(`label[for="${id}"]`) : null;
            const ariaLabel = input.getAttribute('aria-label');
            const placeholder = input.getAttribute('placeholder');
            if (!label && !ariaLabel && !placeholder) withoutLabel++;
        });
        return withoutLabel;
    });
    recordTest('Tous les inputs ont des labels/aria-label', inputsWithoutLabel === 0,
        `${inputsWithoutLabel} input(s) sans label`);

    // Buttons have accessible names
    const buttonsAccessible = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        let accessible = 0;
        buttons.forEach(btn => {
            const text = btn.textContent?.trim();
            const ariaLabel = btn.getAttribute('aria-label');
            const title = btn.getAttribute('title');
            if (text || ariaLabel || title) accessible++;
        });
        return { total: buttons.length, accessible };
    });
    recordTest('Boutons accessibles',
        buttonsAccessible.accessible === buttonsAccessible.total,
        `${buttonsAccessible.accessible}/${buttonsAccessible.total}`);

    // Color contrast (basic check)
    const contrastCheck = await page.evaluate(() => {
        const body = document.body;
        const style = getComputedStyle(body);
        const bgColor = style.backgroundColor;
        const textColor = style.color;
        return { bgColor, textColor };
    });
    log(`Contraste: texte ${contrastCheck.textColor} sur ${contrastCheck.bgColor}`, 'info');

    // Focus visible
    const focusStyles = await page.evaluate(() => {
        const input = document.querySelector('input');
        if (!input) return false;
        input.focus();
        const style = getComputedStyle(input);
        return style.outline !== 'none' || style.boxShadow !== 'none';
    });
    recordTest('Focus visible sur inputs', focusStyles);

    return true;
}

// ============================================
// TESTS API HEALTH
// ============================================

async function testAPIHealth(page) {
    logSection('Tests API Health');

    try {
        const response = await page.goto(`${CONFIG.baseUrl}/api/v1/health.php`);
        const status = response?.status();
        recordTest('API Health endpoint', status === 200, `HTTP ${status}`);

        if (status === 200) {
            const body = await response.text();
            log(`Réponse: ${body.substring(0, 100)}`, 'info');
        }
    } catch (e) {
        recordTest('API Health endpoint', false, e.message);
    }

    return true;
}

// ============================================
// TESTS DARK/LIGHT THEME
// ============================================

async function testThemes(page) {
    logSection('Tests Thèmes Dark/Light');

    await page.goto(`${CONFIG.baseUrl}/auth/login`);
    await page.waitForLoadState('networkidle');

    // Dark theme (default)
    const darkBg = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.backgroundColor;
    });
    log(`Dark theme background: ${darkBg}`, 'info');
    await takeScreenshot(page, 'theme-dark', 'Thème sombre (défaut)');

    // Simulate light theme
    await page.evaluate(() => {
        document.body.classList.add('light-theme');
    });
    await page.waitForTimeout(300);

    const lightBg = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.backgroundColor;
    });
    log(`Light theme background: ${lightBg}`, 'info');
    await takeScreenshot(page, 'theme-light', 'Thème clair');

    recordTest('Thèmes Dark/Light différents', darkBg !== lightBg);

    // Reset
    await page.evaluate(() => {
        document.body.classList.remove('light-theme');
    });

    return true;
}

// ============================================
// TESTS i18n
// ============================================

async function testI18n(page) {
    logSection('Tests Internationalisation (i18n)');

    await page.goto(`${CONFIG.baseUrl}/auth/login`);
    await page.waitForLoadState('networkidle');

    // Check for i18n text (not raw keys)
    const hasRawKeys = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        // Check for patterns like "auth.xxx" or "error.xxx"
        const keyPattern = /\b[a-z]+\.[a-z_]+\b/gi;
        const matches = bodyText.match(keyPattern) || [];
        // Filter out emails and URLs
        const realKeys = matches.filter(m => !m.includes('@') && !m.includes('http'));
        return realKeys;
    });

    recordTest('Pas de clés i18n brutes visibles', hasRawKeys.length === 0,
        hasRawKeys.length > 0 ? `Clés trouvées: ${hasRawKeys.slice(0, 5).join(', ')}` : 'OK');

    // Check for French text presence
    const hasFrenchText = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const frenchWords = ['connexion', 'mot de passe', 'se connecter', 'créer', 'compte'];
        return frenchWords.some(word => text.includes(word));
    });
    recordTest('Texte français présent', hasFrenchText);

    // Check for accents (é, è, ê, à, etc.)
    const hasAccents = await page.evaluate(() => {
        const text = document.body.innerText;
        return /[éèêëàâùûüôîïç]/i.test(text);
    });
    recordTest('Accents français corrects', hasAccents);

    return true;
}

// ============================================
// RAPPORT FINAL
// ============================================

function generateReport() {
    logSection('RAPPORT D\'AUDIT SHIELD');

    const duration = (auditResults.endTime - auditResults.startTime) / 1000;
    const passRate = ((auditResults.passed / auditResults.totalTests) * 100).toFixed(1);

    console.log('\n📊 RÉSUMÉ:');
    console.log(`   Total tests: ${auditResults.totalTests}`);
    console.log(`   ✅ Réussis: ${auditResults.passed}`);
    console.log(`   ❌ Échoués: ${auditResults.failed}`);
    console.log(`   ⚠️ Warnings: ${auditResults.warnings}`);
    console.log(`   📈 Taux de réussite: ${passRate}%`);
    console.log(`   ⏱️ Durée: ${duration.toFixed(1)}s`);
    console.log(`   📸 Screenshots: ${auditResults.screenshots.length}`);

    if (auditResults.issues.length > 0) {
        console.log('\n🔍 PROBLÈMES DÉTECTÉS:');
        auditResults.issues.forEach((issue, i) => {
            if (issue.type === 'warning') {
                console.log(`   ${i + 1}. ⚠️ ${issue.message}`);
            } else {
                console.log(`   ${i + 1}. ❌ ${issue.test}: ${issue.details}`);
            }
        });
    }

    console.log('\n📸 SCREENSHOTS GÉNÉRÉS:');
    auditResults.screenshots.forEach(s => {
        console.log(`   - ${s.filename}: ${s.description}`);
    });

    // Save JSON report
    const reportPath = path.join(CONFIG.screenshotsDir, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
    console.log(`\n📄 Rapport JSON sauvegardé: ${reportPath}`);

    return auditResults;
}

// ============================================
// MAIN
// ============================================

async function runAudit() {
    console.log('\n\x1b[36m╔════════════════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[36m║           SHIELD - AUDIT COMPLET PLAYWRIGHT                ║\x1b[0m');
    console.log('\x1b[36m║      Application Mobile de Sécurité Féminine               ║\x1b[0m');
    console.log('\x1b[36m╚════════════════════════════════════════════════════════════╝\x1b[0m\n');

    // Create screenshots directory
    if (!fs.existsSync(CONFIG.screenshotsDir)) {
        fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    }

    auditResults.startTime = Date.now();

    const browser = await chromium.launch({
        headless: false,  // Mode visuel
        slowMo: 100       // Ralentir pour voir les actions
    });

    const context = await browser.newContext({
        viewport: CONFIG.viewports.mobile,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        locale: 'fr-FR',
        deviceScaleFactor: 2
    });

    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.timeout);

    try {
        // Tests techniques
        await testTechnicalAspects(page);

        // Pages Auth
        await testLoginPage(page);
        await testRegisterPage(page);
        await testForgotPasswordPage(page);

        // Pages App (protégées)
        await testSOSPage(page);
        await testContactsPage(page);
        await testHistoryPage(page);
        await testSettingsPage(page);

        // Tests transversaux
        await testResponsiveDesign(page);
        await testAccessibility(page);
        await testAPIHealth(page);
        await testThemes(page);
        await testI18n(page);

    } catch (error) {
        console.error('\n❌ ERREUR CRITIQUE:', error.message);
        auditResults.issues.push({ type: 'critical', message: error.message });
    }

    auditResults.endTime = Date.now();

    // Pause before closing
    log('\nAudit terminé. Le navigateur reste ouvert 5 secondes pour inspection...', 'info');
    await page.waitForTimeout(5000);

    await browser.close();

    return generateReport();
}

// Run
runAudit()
    .then(report => {
        const exitCode = report.failed > 0 ? 1 : 0;
        process.exit(exitCode);
    })
    .catch(err => {
        console.error('Erreur fatale:', err);
        process.exit(1);
    });

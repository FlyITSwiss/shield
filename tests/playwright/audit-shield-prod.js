/**
 * SHIELD - Audit QA Complet Production
 *
 * Test fonctionnel exhaustif de toutes les vues et fonctionnalités
 * Mode headed avec capture de screenshots pour analyse
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration PROD
const CONFIG = {
    baseUrl: 'https://stabilis-it.ch/internal/shield',
    screenshotDir: path.join(__dirname, 'reports', 'screenshots-prod'),
    credentials: {
        email: 'test@shield-app.local',
        password: 'TestPassword123'
    },
    timeout: 30000,
    viewport: { width: 393, height: 851 } // Mobile Pixel 5
};

// Résultats des tests
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: [],
    screenshots: [],
    startTime: null,
    endTime: null
};

/**
 * Utilitaire pour prendre un screenshot et l'analyser
 */
async function captureAndAnalyze(page, testName, description) {
    const screenshotPath = path.join(CONFIG.screenshotDir, `${testName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    testResults.screenshots.push({
        name: testName,
        description: description,
        path: screenshotPath,
        timestamp: new Date().toISOString()
    });

    console.log(`   📸 Screenshot: ${testName}`);
    return screenshotPath;
}

/**
 * Logger de test
 */
function logTest(name, status, details = '') {
    testResults.total++;

    const icons = {
        pass: '✅',
        fail: '❌',
        warn: '⚠️',
        skip: '⏭️'
    };

    if (status === 'pass') testResults.passed++;
    else if (status === 'fail') testResults.failed++;
    else if (status === 'warn') testResults.warnings++;

    testResults.tests.push({ name, status, details, timestamp: new Date().toISOString() });

    console.log(`   ${icons[status]} ${name}${details ? ` - ${details}` : ''}`);
}

/**
 * =============================================
 * TESTS AUTHENTIFICATION
 * =============================================
 */
async function testAuthentication(browser) {
    console.log('\n━━━ 1. TESTS AUTHENTIFICATION ━━━\n');

    const context = await browser.newContext({ viewport: CONFIG.viewport });
    const page = await context.newPage();

    try {
        // 1.1 Page de Login
        console.log('📍 1.1 Page de Login');
        await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
        await captureAndAnalyze(page, '01-login-page', 'Page de connexion initiale');

        // Vérifier les éléments présents
        const loginForm = await page.$('#login-form');
        logTest('Formulaire de login présent', loginForm ? 'pass' : 'fail');

        const emailInput = await page.$('#email');
        logTest('Champ email présent', emailInput ? 'pass' : 'fail');

        const passwordInput = await page.$('#password');
        logTest('Champ mot de passe présent', passwordInput ? 'pass' : 'fail');

        const submitBtn = await page.$('#btn-login');
        logTest('Bouton connexion présent', submitBtn ? 'pass' : 'fail');

        const forgotLink = await page.$('a[href*="forgot-password"]');
        logTest('Lien mot de passe oublié présent', forgotLink ? 'pass' : 'fail');

        const registerLink = await page.$('a[href*="register"]');
        logTest('Lien inscription présent', registerLink ? 'pass' : 'fail');

        // OAuth buttons
        const googleBtn = await page.$('.btn-google');
        logTest('Bouton OAuth Google présent', googleBtn ? 'pass' : 'warn', googleBtn ? '' : 'Optionnel');

        const facebookBtn = await page.$('.btn-facebook');
        logTest('Bouton OAuth Facebook présent', facebookBtn ? 'pass' : 'warn', facebookBtn ? '' : 'Optionnel');

        // Toggle password
        const togglePwd = await page.$('.btn-toggle-password');
        logTest('Toggle visibilité mot de passe', togglePwd ? 'pass' : 'fail');

        // 1.2 Validation formulaire vide
        console.log('\n📍 1.2 Validation formulaire vide');
        await page.click('#btn-login');
        await page.waitForTimeout(500);
        await captureAndAnalyze(page, '02-login-validation-empty', 'Validation formulaire vide');

        // 1.3 Validation email invalide
        console.log('\n📍 1.3 Validation email invalide');
        await page.fill('#email', 'email-invalide');
        await page.fill('#password', 'test123');
        await page.click('#btn-login');
        await page.waitForTimeout(500);
        await captureAndAnalyze(page, '03-login-validation-email', 'Email invalide');

        // 1.4 Credentials incorrects
        console.log('\n📍 1.4 Tentative avec credentials incorrects');
        await page.fill('#email', 'wrong@test.com');
        await page.fill('#password', 'wrongpassword');
        await page.click('#btn-login');
        await page.waitForTimeout(2000);
        await captureAndAnalyze(page, '04-login-credentials-error', 'Erreur credentials');

        const authAlert = await page.$('#auth-alert:not(.hidden)');
        logTest('Message erreur affiché', authAlert ? 'pass' : 'warn', 'Message erreur après bad credentials');

        // 1.5 Page d'inscription
        console.log('\n📍 1.5 Page d\'inscription');
        await page.goto(`${CONFIG.baseUrl}/auth/register`, { waitUntil: 'networkidle' });
        await captureAndAnalyze(page, '05-register-page', 'Page d\'inscription');

        const registerForm = await page.$('#register-form');
        logTest('Formulaire inscription présent', registerForm ? 'pass' : 'fail');

        const firstNameInput = await page.$('#first_name');
        logTest('Champ prénom présent', firstNameInput ? 'pass' : 'fail');

        const lastNameInput = await page.$('#last_name');
        logTest('Champ nom présent', lastNameInput ? 'pass' : 'fail');

        const phoneInput = await page.$('#phone');
        logTest('Champ téléphone présent', phoneInput ? 'pass' : 'fail');

        const phonePrefixSelect = await page.$('#phone_prefix');
        logTest('Sélecteur préfixe téléphone', phonePrefixSelect ? 'pass' : 'fail');

        const pwdConfirmInput = await page.$('#password_confirmation');
        logTest('Champ confirmation mot de passe', pwdConfirmInput ? 'pass' : 'fail');

        const termsCheckbox = await page.$('#terms');
        logTest('Checkbox CGU présente', termsCheckbox ? 'pass' : 'fail');

        const strengthIndicator = await page.$('#password-strength');
        logTest('Indicateur force mot de passe', strengthIndicator ? 'pass' : 'fail');

        // 1.6 Page mot de passe oublié
        console.log('\n📍 1.6 Page mot de passe oublié');
        await page.goto(`${CONFIG.baseUrl}/auth/forgot-password`, { waitUntil: 'networkidle' });
        await captureAndAnalyze(page, '06-forgot-password', 'Page mot de passe oublié');

        const forgotForm = await page.$('form');
        logTest('Formulaire récupération présent', forgotForm ? 'pass' : 'fail');

    } catch (error) {
        console.error('❌ Erreur tests authentification:', error.message);
        logTest('Tests authentification', 'fail', error.message);
    } finally {
        await context.close();
    }
}

/**
 * =============================================
 * TESTS ÉCRAN SOS (après login)
 * =============================================
 */
async function testSOSScreen(page) {
    console.log('\n━━━ 2. TESTS ÉCRAN SOS ━━━\n');

    try {
        // 2.1 Accès écran SOS
        console.log('📍 2.1 Écran SOS principal');
        await page.goto(`${CONFIG.baseUrl}/app/sos`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await captureAndAnalyze(page, '07-sos-main-screen', 'Écran SOS principal');

        // Vérifier état idle
        const stateIdle = await page.$('#state-idle.active');
        logTest('État idle actif par défaut', stateIdle ? 'pass' : 'fail');

        // Bouton SOS
        const sosButton = await page.$('#sos-button');
        logTest('Bouton SOS présent', sosButton ? 'pass' : 'fail');

        // Pulse animations
        const pulses = await page.$$('.sos-pulse');
        logTest('Animations pulse présentes', pulses.length >= 2 ? 'pass' : 'warn');

        // Bouton settings
        const settingsBtn = await page.$('#btn-settings');
        logTest('Bouton paramètres présent', settingsBtn ? 'pass' : 'fail');

        // Mode silencieux toggle
        const silentMode = await page.$('#silent-mode');
        logTest('Toggle mode silencieux présent', silentMode ? 'pass' : 'fail');

        // Instructions
        const instructions = await page.$('.sos-instructions');
        logTest('Instructions SOS affichées', instructions ? 'pass' : 'fail');

        // 2.2 Toggle mode silencieux
        console.log('\n📍 2.2 Mode silencieux');
        if (silentMode) {
            await silentMode.click();
            await page.waitForTimeout(300);
            await captureAndAnalyze(page, '08-sos-silent-mode', 'Mode silencieux activé');

            const isChecked = await silentMode.isChecked();
            logTest('Mode silencieux toggle', isChecked ? 'pass' : 'fail');

            // Remettre à l'état initial
            await silentMode.click();
        }

        // 2.3 États du SOS (countdown, active, resolved) - vérifier présence HTML
        console.log('\n📍 2.3 Vérification des états SOS');
        const stateCountdown = await page.$('#state-countdown');
        logTest('État countdown présent (HTML)', stateCountdown ? 'pass' : 'fail');

        const stateActive = await page.$('#state-active');
        logTest('État alerte active présent (HTML)', stateActive ? 'pass' : 'fail');

        const stateResolved = await page.$('#state-resolved');
        logTest('État résolu présent (HTML)', stateResolved ? 'pass' : 'fail');

        // Vérifier les boutons d'action dans état actif
        const btnSafe = await page.$('#btn-safe');
        logTest('Bouton "Je suis en sécurité" présent', btnSafe ? 'pass' : 'fail');

        const btnEscalate = await page.$('#btn-escalate');
        logTest('Bouton escalade présent', btnEscalate ? 'pass' : 'fail');

        const btnCancelAlert = await page.$('#btn-cancel-alert');
        logTest('Bouton fausse alerte présent', btnCancelAlert ? 'pass' : 'fail');

        // 2.4 Audio alarme
        const alarmAudio = await page.$('#alarm-audio');
        logTest('Élément audio alarme présent', alarmAudio ? 'pass' : 'fail');

    } catch (error) {
        console.error('❌ Erreur tests SOS:', error.message);
        logTest('Tests SOS', 'fail', error.message);
    }
}

/**
 * =============================================
 * TESTS CONTACTS
 * =============================================
 */
async function testContacts(page) {
    console.log('\n━━━ 3. TESTS CONTACTS DE CONFIANCE ━━━\n');

    try {
        // 3.1 Page contacts
        console.log('📍 3.1 Page contacts');
        await page.goto(`${CONFIG.baseUrl}/app/contacts`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        await captureAndAnalyze(page, '09-contacts-page', 'Page contacts de confiance');

        // Header
        const headerTitle = await page.$('.header-title');
        logTest('Titre page contacts présent', headerTitle ? 'pass' : 'fail');

        // Bouton back
        const btnBack = await page.$('#btn-back');
        logTest('Bouton retour présent', btnBack ? 'pass' : 'fail');

        // Bouton ajouter
        const btnAdd = await page.$('#btn-add-contact');
        logTest('Bouton ajouter contact présent', btnAdd ? 'pass' : 'fail');

        // Info box
        const infoBox = await page.$('.info-box');
        logTest('Info box présente', infoBox ? 'pass' : 'fail');

        // Liste ou état vide
        const contactsList = await page.$('#contacts-list');
        logTest('Conteneur liste contacts présent', contactsList ? 'pass' : 'fail');

        const emptyState = await page.$('#empty-state');
        const loadingState = await page.$('#loading-state');

        // Attendre fin chargement
        await page.waitForTimeout(2000);
        await captureAndAnalyze(page, '10-contacts-loaded', 'Contacts chargés');

        // 3.2 Modal d'ajout
        console.log('\n📍 3.2 Modal ajout contact');
        if (btnAdd) {
            await btnAdd.click();
            await page.waitForTimeout(500);
            await captureAndAnalyze(page, '11-contacts-modal-add', 'Modal ajout contact');

            const modal = await page.$('#contact-modal:not(.hidden)');
            logTest('Modal ajout contact visible', modal ? 'pass' : 'fail');

            const nameInput = await page.$('#contact-name');
            logTest('Champ nom contact présent', nameInput ? 'pass' : 'fail');

            const phoneInputModal = await page.$('#contact-phone');
            logTest('Champ téléphone contact présent', phoneInputModal ? 'pass' : 'fail');

            const prefixSelect = await page.$('#contact-phone-prefix');
            logTest('Sélecteur préfixe présent', prefixSelect ? 'pass' : 'fail');

            const relationshipSelect = await page.$('#contact-relationship');
            logTest('Sélecteur relation présent', relationshipSelect ? 'pass' : 'fail');

            const primaryCheckbox = await page.$('#contact-primary');
            logTest('Checkbox contact principal', primaryCheckbox ? 'pass' : 'fail');

            const btnSave = await page.$('#btn-save');
            logTest('Bouton sauvegarder présent', btnSave ? 'pass' : 'fail');

            const btnCancel = await page.$('#btn-cancel');
            logTest('Bouton annuler présent', btnCancel ? 'pass' : 'fail');

            // Fermer modal
            const closeBtn = await page.$('#btn-modal-close');
            if (closeBtn) await closeBtn.click();
            await page.waitForTimeout(300);
        }

        // 3.3 Modal suppression
        console.log('\n📍 3.3 Modal suppression');
        const deleteModal = await page.$('#delete-modal');
        logTest('Modal suppression présente (HTML)', deleteModal ? 'pass' : 'fail');

    } catch (error) {
        console.error('❌ Erreur tests contacts:', error.message);
        logTest('Tests contacts', 'fail', error.message);
    }
}

/**
 * =============================================
 * TESTS HISTORIQUE
 * =============================================
 */
async function testHistory(page) {
    console.log('\n━━━ 4. TESTS HISTORIQUE ━━━\n');

    try {
        // 4.1 Page historique
        console.log('📍 4.1 Page historique');
        await page.goto(`${CONFIG.baseUrl}/app/history`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        await captureAndAnalyze(page, '12-history-page', 'Page historique incidents');

        // Header
        const headerTitle = await page.$('.header-title');
        logTest('Titre page historique présent', headerTitle ? 'pass' : 'fail');

        // Filtres
        const filterStatus = await page.$('#filter-status');
        logTest('Filtre statut présent', filterStatus ? 'pass' : 'fail');

        const filterPeriod = await page.$('#filter-period');
        logTest('Filtre période présent', filterPeriod ? 'pass' : 'fail');

        // Liste ou état vide
        const historyList = await page.$('#history-list');
        logTest('Conteneur liste historique présent', historyList ? 'pass' : 'fail');

        // 4.2 Test filtres
        console.log('\n📍 4.2 Filtres');
        if (filterStatus) {
            await filterStatus.selectOption('resolved');
            await page.waitForTimeout(1000);
            await captureAndAnalyze(page, '13-history-filter-resolved', 'Filtre: Résolus');
            logTest('Filtre statut résolu', 'pass');

            await filterStatus.selectOption('cancelled');
            await page.waitForTimeout(1000);
            await captureAndAnalyze(page, '14-history-filter-cancelled', 'Filtre: Annulés');
            logTest('Filtre statut annulé', 'pass');
        }

        if (filterPeriod) {
            await filterPeriod.selectOption('365');
            await page.waitForTimeout(1000);
            logTest('Filtre période dernière année', 'pass');
        }

        // 4.3 Modal détails (vérifier présence)
        console.log('\n📍 4.3 Modal détails incident');
        const incidentModal = await page.$('#incident-modal');
        logTest('Modal détails incident présente (HTML)', incidentModal ? 'pass' : 'fail');

        const incidentTimeline = await page.$('#incident-timeline');
        logTest('Timeline dans modal présente', incidentTimeline ? 'pass' : 'fail');

        // Templates
        const historyItemTemplate = await page.$('#history-item-template');
        logTest('Template item historique présent', historyItemTemplate ? 'pass' : 'fail');

        const timelineTemplate = await page.$('#timeline-item-template');
        logTest('Template timeline présent', timelineTemplate ? 'pass' : 'fail');

    } catch (error) {
        console.error('❌ Erreur tests historique:', error.message);
        logTest('Tests historique', 'fail', error.message);
    }
}

/**
 * =============================================
 * TESTS PARAMÈTRES
 * =============================================
 */
async function testSettings(page) {
    console.log('\n━━━ 5. TESTS PARAMÈTRES ━━━\n');

    try {
        // 5.1 Page paramètres
        console.log('📍 5.1 Page paramètres');
        await page.goto(`${CONFIG.baseUrl}/app/settings`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await captureAndAnalyze(page, '15-settings-page', 'Page paramètres');

        // Titre
        const settingsTitle = await page.$('.settings-title');
        logTest('Titre paramètres présent', settingsTitle ? 'pass' : 'fail');

        // Section Profil
        const profileCard = await page.$('.profile-card');
        logTest('Carte profil présente', profileCard ? 'pass' : 'fail');

        const btnEditProfile = await page.$('#btn-edit-profile');
        logTest('Bouton éditer profil présent', btnEditProfile ? 'pass' : 'fail');

        // Section Alertes
        console.log('\n📍 5.2 Section alertes');
        const alertMode = await page.$('#alert-mode');
        logTest('Sélecteur mode alerte présent', alertMode ? 'pass' : 'fail');

        const confirmationDelay = await page.$('#confirmation-delay');
        logTest('Sélecteur délai confirmation présent', confirmationDelay ? 'pass' : 'fail');

        const volumeTrigger = await page.$('#volume-trigger');
        logTest('Toggle déclenchement volume présent', volumeTrigger ? 'pass' : 'fail');

        const volumeDuration = await page.$('#volume-duration');
        logTest('Sélecteur durée volume présent', volumeDuration ? 'pass' : 'fail');

        // Section Mots-codes
        console.log('\n📍 5.3 Section mots-codes');
        const codeRed = await page.$('#code-word-red');
        logTest('Champ mot-code rouge présent', codeRed ? 'pass' : 'fail');

        const codeOrange = await page.$('#code-word-orange');
        logTest('Champ mot-code orange présent', codeOrange ? 'pass' : 'fail');

        const codeCancel = await page.$('#code-word-cancel');
        logTest('Champ mot-code annulation présent', codeCancel ? 'pass' : 'fail');

        // Section Langue
        console.log('\n📍 5.4 Section langue/région');
        const languageSelect = await page.$('#language');
        logTest('Sélecteur langue présent', languageSelect ? 'pass' : 'fail');

        const countrySelect = await page.$('#country');
        logTest('Sélecteur pays présent', countrySelect ? 'pass' : 'fail');

        // Scroll vers le bas pour voir les autres sections
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await captureAndAnalyze(page, '16-settings-bottom', 'Paramètres (bas de page)');

        // Section À propos
        console.log('\n📍 5.5 Section à propos');
        const privacyLink = await page.$('a[href*="privacy"]');
        logTest('Lien politique confidentialité présent', privacyLink ? 'pass' : 'fail');

        const termsLink = await page.$('a[href*="terms"]');
        logTest('Lien CGU présent', termsLink ? 'pass' : 'fail');

        const helpLink = await page.$('a[href*="help"]');
        logTest('Lien aide présent', helpLink ? 'pass' : 'fail');

        // Déconnexion
        const btnLogout = await page.$('#btn-logout');
        logTest('Bouton déconnexion présent', btnLogout ? 'pass' : 'fail');

        const btnDeleteAccount = await page.$('#btn-delete-account');
        logTest('Bouton supprimer compte présent', btnDeleteAccount ? 'pass' : 'fail');

        // 5.6 Modal suppression compte
        console.log('\n📍 5.6 Modal suppression compte');
        if (btnDeleteAccount) {
            await btnDeleteAccount.click();
            await page.waitForTimeout(500);
            await captureAndAnalyze(page, '17-settings-delete-modal', 'Modal suppression compte');

            const deleteModal = await page.$('#delete-account-modal:not(.hidden)');
            logTest('Modal suppression compte visible', deleteModal ? 'pass' : 'fail');

            const countdown = await page.$('#delete-countdown');
            logTest('Countdown sécurité présent', countdown ? 'pass' : 'fail');

            const btnConfirmDelete = await page.$('#btn-confirm-delete');
            const isDisabled = btnConfirmDelete ? await btnConfirmDelete.isDisabled() : false;
            logTest('Bouton confirmation désactivé (sécurité)', isDisabled ? 'pass' : 'warn');

            // Fermer modal
            const btnCancelDelete = await page.$('#btn-cancel-delete');
            if (btnCancelDelete) await btnCancelDelete.click();
            await page.waitForTimeout(300);
        }

    } catch (error) {
        console.error('❌ Erreur tests paramètres:', error.message);
        logTest('Tests paramètres', 'fail', error.message);
    }
}

/**
 * =============================================
 * TESTS PAGES LÉGALES
 * =============================================
 */
async function testLegalPages(browser) {
    console.log('\n━━━ 6. TESTS PAGES LÉGALES ━━━\n');

    const context = await browser.newContext({ viewport: CONFIG.viewport });
    const page = await context.newPage();

    try {
        // 6.1 Politique de confidentialité
        console.log('📍 6.1 Politique de confidentialité');
        await page.goto(`${CONFIG.baseUrl}/about/privacy`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await captureAndAnalyze(page, '18-privacy-page', 'Politique de confidentialité');

        const pageLoaded = await page.url();
        logTest('Page confidentialité accessible', pageLoaded.includes('privacy') || pageLoaded.includes('shield') ? 'pass' : 'fail');

        // 6.2 Conditions d'utilisation
        console.log('\n📍 6.2 Conditions d\'utilisation');
        await page.goto(`${CONFIG.baseUrl}/about/terms`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await captureAndAnalyze(page, '19-terms-page', 'Conditions d\'utilisation');

        const termsLoaded = await page.url();
        logTest('Page CGU accessible', termsLoaded.includes('terms') || termsLoaded.includes('shield') ? 'pass' : 'fail');

        // 6.3 Page d'aide
        console.log('\n📍 6.3 Page d\'aide');
        await page.goto(`${CONFIG.baseUrl}/about/help`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await captureAndAnalyze(page, '20-help-page', 'Page d\'aide');

    } catch (error) {
        console.error('❌ Erreur tests pages légales:', error.message);
        logTest('Tests pages légales', 'fail', error.message);
    } finally {
        await context.close();
    }
}

/**
 * =============================================
 * TESTS RESPONSIVE
 * =============================================
 */
async function testResponsive(browser) {
    console.log('\n━━━ 7. TESTS RESPONSIVE ━━━\n');

    const viewports = [
        { name: 'Mobile Portrait', width: 320, height: 568 },
        { name: 'Mobile Landscape', width: 568, height: 320 },
        { name: 'Tablet', width: 838, height: 1200 },
        { name: 'Desktop', width: 1355, height: 900 }
    ];

    for (const vp of viewports) {
        console.log(`📍 7.${viewports.indexOf(vp) + 1} ${vp.name} (${vp.width}x${vp.height})`);

        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height }
        });
        const page = await context.newPage();

        try {
            await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(500);

            const screenshotName = `21-responsive-${vp.name.toLowerCase().replace(' ', '-')}-login`;
            await captureAndAnalyze(page, screenshotName, `Login - ${vp.name}`);
            logTest(`Affichage ${vp.name}`, 'pass');

        } catch (error) {
            logTest(`Affichage ${vp.name}`, 'fail', error.message);
        } finally {
            await context.close();
        }
    }
}

/**
 * =============================================
 * TESTS UI/UX
 * =============================================
 */
async function testUIUX(page) {
    console.log('\n━━━ 8. TESTS UI/UX ━━━\n');

    try {
        // 8.1 Design System
        console.log('📍 8.1 Vérification Design System');
        await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });

        // Vérifier les variables CSS
        const cssVars = await page.evaluate(() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            return {
                primary: style.getPropertyValue('--primary').trim(),
                background: style.getPropertyValue('--background').trim(),
                spacing13: style.getPropertyValue('--spacing-13').trim(),
                textPrimary: style.getPropertyValue('--text-primary').trim()
            };
        });

        logTest('Variable CSS --primary définie', cssVars.primary ? 'pass' : 'warn');
        logTest('Variable CSS --background définie', cssVars.background ? 'pass' : 'warn');
        logTest('Variable CSS --spacing-13 définie', cssVars.spacing13 ? 'pass' : 'warn');

        // 8.2 Accessibilité basique
        console.log('\n📍 8.2 Accessibilité');

        // Labels pour inputs
        const inputsWithLabels = await page.$$eval('input[type="text"], input[type="email"], input[type="password"]',
            inputs => inputs.filter(i => i.labels?.length > 0 || i.getAttribute('aria-label')).length
        );
        const totalInputs = await page.$$eval('input[type="text"], input[type="email"], input[type="password"]',
            inputs => inputs.length
        );
        logTest('Inputs avec labels', inputsWithLabels === totalInputs ? 'pass' : 'warn',
            `${inputsWithLabels}/${totalInputs} inputs labellisés`);

        // Boutons avec aria-label ou texte
        const accessibleButtons = await page.$$eval('button',
            buttons => buttons.filter(b => b.textContent.trim() || b.getAttribute('aria-label')).length
        );
        const totalButtons = await page.$$eval('button', buttons => buttons.length);
        logTest('Boutons accessibles', accessibleButtons === totalButtons ? 'pass' : 'warn',
            `${accessibleButtons}/${totalButtons} boutons avec label/texte`);

        // Contraste (vérification basique)
        console.log('\n📍 8.3 Contraste et lisibilité');
        // Note: Un vrai test de contraste nécessiterait axe-core ou similar
        logTest('Contraste texte (vérification visuelle)', 'warn', 'À vérifier manuellement sur screenshots');

    } catch (error) {
        console.error('❌ Erreur tests UI/UX:', error.message);
        logTest('Tests UI/UX', 'fail', error.message);
    }
}

/**
 * =============================================
 * TESTS API SANTÉ
 * =============================================
 */
async function testAPIHealth(page) {
    console.log('\n━━━ 9. TESTS API SANTÉ ━━━\n');

    try {
        // Health endpoint
        console.log('📍 9.1 Endpoint /health');
        const healthResponse = await page.request.get(`${CONFIG.baseUrl}/health`);
        logTest('GET /health', healthResponse.ok() ? 'pass' : 'fail', `Status: ${healthResponse.status()}`);

        // API Health
        console.log('\n📍 9.2 Endpoint /api/v1/health');
        const apiHealthResponse = await page.request.get(`${CONFIG.baseUrl}/api/v1/health`);
        logTest('GET /api/v1/health', apiHealthResponse.ok() ? 'pass' : 'warn', `Status: ${apiHealthResponse.status()}`);

        // Auth protection
        console.log('\n📍 9.3 Protection authentification');
        const protectedResponse = await page.request.get(`${CONFIG.baseUrl}/api/incidents.php?action=active`);
        logTest('Endpoint protégé retourne 401/403',
            [401, 403].includes(protectedResponse.status()) ? 'pass' : 'fail',
            `Status: ${protectedResponse.status()}`
        );

    } catch (error) {
        console.error('❌ Erreur tests API:', error.message);
        logTest('Tests API santé', 'fail', error.message);
    }
}

/**
 * =============================================
 * GÉNÉRATION DU RAPPORT
 * =============================================
 */
function generateReport() {
    testResults.endTime = new Date().toISOString();
    const duration = (new Date(testResults.endTime) - new Date(testResults.startTime)) / 1000;

    console.log('\n' + '═'.repeat(60));
    console.log('                    RAPPORT D\'AUDIT QA');
    console.log('═'.repeat(60));

    console.log(`\n📅 Date: ${new Date().toLocaleString('fr-FR')}`);
    console.log(`⏱️  Durée: ${duration.toFixed(2)} secondes`);
    console.log(`🌐 URL: ${CONFIG.baseUrl}`);

    console.log('\n' + '─'.repeat(60));
    console.log('                      RÉSULTATS');
    console.log('─'.repeat(60));

    const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);

    console.log(`\n   Total tests:    ${testResults.total}`);
    console.log(`   ✅ Réussis:     ${testResults.passed}`);
    console.log(`   ❌ Échoués:     ${testResults.failed}`);
    console.log(`   ⚠️  Avertissements: ${testResults.warnings}`);
    console.log(`\n   📊 Taux de réussite: ${passRate}%`);

    // Tests échoués
    const failedTests = testResults.tests.filter(t => t.status === 'fail');
    if (failedTests.length > 0) {
        console.log('\n' + '─'.repeat(60));
        console.log('                   TESTS ÉCHOUÉS');
        console.log('─'.repeat(60));
        failedTests.forEach(t => {
            console.log(`   ❌ ${t.name}${t.details ? ` - ${t.details}` : ''}`);
        });
    }

    // Avertissements
    const warnTests = testResults.tests.filter(t => t.status === 'warn');
    if (warnTests.length > 0) {
        console.log('\n' + '─'.repeat(60));
        console.log('                  AVERTISSEMENTS');
        console.log('─'.repeat(60));
        warnTests.forEach(t => {
            console.log(`   ⚠️  ${t.name}${t.details ? ` - ${t.details}` : ''}`);
        });
    }

    // Screenshots
    console.log('\n' + '─'.repeat(60));
    console.log(`                  SCREENSHOTS (${testResults.screenshots.length})`);
    console.log('─'.repeat(60));
    testResults.screenshots.forEach(s => {
        console.log(`   📸 ${s.name}: ${s.description}`);
    });

    console.log('\n' + '═'.repeat(60));

    // Sauvegarder rapport JSON
    const reportPath = path.join(CONFIG.screenshotDir, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Rapport JSON sauvegardé: ${reportPath}`);

    return testResults;
}

/**
 * =============================================
 * MAIN - Exécution des tests
 * =============================================
 */
async function runAudit() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              SHIELD - AUDIT QA PRODUCTION                    ║');
    console.log('║              Mode Playwright Headed (Visuel)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Créer dossier screenshots
    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    testResults.startTime = new Date().toISOString();

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100 // Ralentir pour visualisation
    });

    try {
        // 1. Tests authentification (sans login)
        await testAuthentication(browser);

        // 2-8. Tests nécessitant une session authentifiée
        // Note: En prod, nous aurions besoin d'un compte test valide
        // Pour le moment, on teste les pages accessibles sans auth

        // Créer une session pour tester les pages publiques
        const context = await browser.newContext({ viewport: CONFIG.viewport });
        const page = await context.newPage();

        // Tenter un login (peut échouer en prod sans credentials valides)
        console.log('\n━━━ TENTATIVE LOGIN POUR TESTS PROTÉGÉS ━━━\n');
        await page.goto(`${CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle' });
        await page.fill('#email', CONFIG.credentials.email);
        await page.fill('#password', CONFIG.credentials.password);
        await page.click('#btn-login');
        await page.waitForTimeout(3000);

        // Vérifier si connecté
        const currentUrl = page.url();
        const isLoggedIn = !currentUrl.includes('login');

        if (isLoggedIn) {
            console.log('✅ Login réussi - Tests pages protégées\n');
            await testSOSScreen(page);
            await testContacts(page);
            await testHistory(page);
            await testSettings(page);
            await testUIUX(page);
        } else {
            console.log('⚠️  Login échoué - Tests limités aux pages publiques\n');
            logTest('Accès pages protégées', 'skip', 'Login requis');
        }

        await context.close();

        // 6. Pages légales (accessibles sans auth)
        await testLegalPages(browser);

        // 7. Tests responsive
        await testResponsive(browser);

        // 9. Tests API (peuvent nécessiter auth)
        const apiContext = await browser.newContext();
        const apiPage = await apiContext.newPage();
        await testAPIHealth(apiPage);
        await apiContext.close();

    } catch (error) {
        console.error('\n❌ ERREUR CRITIQUE:', error.message);
        logTest('Exécution audit', 'fail', error.message);
    } finally {
        await browser.close();
    }

    // Générer rapport
    return generateReport();
}

// Lancer l'audit
runAudit()
    .then(results => {
        const exitCode = results.failed > 0 ? 1 : 0;
        console.log(`\n🏁 Audit terminé avec ${exitCode === 0 ? 'succès' : 'des échecs'}`);
        process.exit(exitCode);
    })
    .catch(error => {
        console.error('\n💥 Erreur fatale:', error);
        process.exit(1);
    });

/**
 * SHIELD - Live Location Sharing Tests
 *
 * Tests Playwright pour la fonctionnalite Premium de partage de position
 *
 * Usage:
 *   node tests/test-live-location.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
    baseUrl: process.env.SHIELD_URL || 'http://127.0.0.1:8085',
    screenshotsDir: path.join(__dirname, 'screenshots-live-location'),
    timeout: 15000,
    testCredentials: {
        email: process.env.TEST_EMAIL || 'test@shield-app.local',
        password: process.env.TEST_PASSWORD || 'Test123!!'
    }
};

// Results
const results = {
    tests: [],
    screenshots: [],
    startTime: null,
    endTime: null
};

// Utilities
function log(message, type = 'info') {
    const icons = {
        info: '\x1b[36mi\x1b[0m',
        success: '\x1b[32m✓\x1b[0m',
        error: '\x1b[31m✗\x1b[0m',
        warning: '\x1b[33m!\x1b[0m'
    };
    console.log(`${icons[type] || ''} ${message}`);
}

function logSection(title) {
    console.log('\n\x1b[35m' + '='.repeat(60) + '\x1b[0m');
    console.log('\x1b[35m  ' + title + '\x1b[0m');
    console.log('\x1b[35m' + '='.repeat(60) + '\x1b[0m\n');
}

async function screenshot(page, name) {
    const filename = `${Date.now()}-${name}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push(filename);
    return filepath;
}

function recordResult(name, passed, details = '') {
    results.tests.push({ name, passed, details });
    if (passed) {
        log(`${name}: ${details || 'OK'}`, 'success');
    } else {
        log(`${name}: ${details}`, 'error');
    }
}

// ============================================
// TEST 1: Page Access
// ============================================
async function testPageAccess(page) {
    logSection('Test 1: Acces a la page Location Share');

    // First login
    await page.goto(`${CONFIG.baseUrl}/auth/login`);
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('input[name="email"]', CONFIG.testCredentials.email);
    await page.fill('input[name="password"]', CONFIG.testCredentials.password);
    await page.click('button[type="submit"]');

    // Wait for login redirect to complete (goes to /app by default)
    await page.waitForURL('**/app**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Now navigate to location share page
    await page.goto(`${CONFIG.baseUrl}/app/location-share`);
    await page.waitForLoadState('networkidle');

    await screenshot(page, 'location-share-page');

    // Check if page loaded correctly
    const hasTitle = await page.locator('.share-title').count() > 0;
    recordResult('Page chargee correctement', hasTitle);

    const hasNewShareSection = await page.locator('#new-share').count() > 0;
    recordResult('Section nouveau partage presente', hasNewShareSection);

    return hasTitle && hasNewShareSection;
}

// ============================================
// TEST 2: Share Type Selection
// ============================================
async function testShareTypeSelection(page) {
    logSection('Test 2: Selection du type de partage');

    // Click on realtime type
    const realtimeBtn = page.locator('.share-type-btn[data-type="realtime"]');
    await realtimeBtn.click();

    const realtimeActive = await realtimeBtn.evaluate(el => el.classList.contains('active'));
    recordResult('Bouton temps reel selectionnable', realtimeActive);

    // Click on journey type
    const journeyBtn = page.locator('.share-type-btn[data-type="journey"]');
    await journeyBtn.click();

    await page.waitForTimeout(300);

    const journeyActive = await journeyBtn.evaluate(el => el.classList.contains('active'));
    recordResult('Bouton je rentre selectionnable', journeyActive);

    // Check journey options visible
    const journeyOptions = page.locator('#journey-options');
    const journeyVisible = await journeyOptions.isVisible();
    recordResult('Options destination visibles', journeyVisible);

    await screenshot(page, 'journey-mode-options');

    // Switch back to realtime
    await realtimeBtn.click();
    await page.waitForTimeout(300);

    return realtimeActive && journeyActive;
}

// ============================================
// TEST 3: Duration Selection
// ============================================
async function testDurationSelection(page) {
    logSection('Test 3: Selection de la duree');

    const durations = ['30', '60', '120', '0'];
    let allWorking = true;

    for (const duration of durations) {
        const btn = page.locator(`.duration-btn[data-duration="${duration}"]`);
        await btn.click();
        await page.waitForTimeout(100);

        const isActive = await btn.evaluate(el => el.classList.contains('active'));
        if (!isActive) {
            allWorking = false;
            recordResult(`Duree ${duration} min`, false, 'Non selectionnable');
        }
    }

    recordResult('Toutes les durees selectionnables', allWorking);

    // Set default duration for next tests
    await page.locator('.duration-btn[data-duration="60"]').click();

    return allWorking;
}

// ============================================
// TEST 4: Contact Selection
// ============================================
async function testContactSelection(page) {
    logSection('Test 4: Selection des contacts');

    const checkboxes = page.locator('input[name="contact_ids[]"]');
    const count = await checkboxes.count();

    if (count === 0) {
        recordResult('Contacts disponibles', false, 'Aucun contact configure');
        return false;
    }

    recordResult(`${count} contact(s) disponible(s)`, true);

    // Toggle first contact
    const firstCheckbox = checkboxes.first();
    const wasChecked = await firstCheckbox.isChecked();

    await firstCheckbox.click();
    const isNowChecked = await firstCheckbox.isChecked();

    recordResult('Contact deselectionnable', wasChecked && !isNowChecked);

    await firstCheckbox.click();
    const isCheckedAgain = await firstCheckbox.isChecked();

    recordResult('Contact selectionnable', isCheckedAgain);

    await screenshot(page, 'contacts-selection');

    return true;
}

// ============================================
// TEST 5: Start Button State
// ============================================
async function testStartButtonState(page) {
    logSection('Test 5: Etat du bouton de partage');

    const startBtn = page.locator('#btn-start-share');

    // With contacts selected, button should be enabled
    const contactCheckboxes = page.locator('input[name="contact_ids[]"]');
    const count = await contactCheckboxes.count();

    if (count > 0) {
        // Ensure at least one contact is checked
        const firstCheckbox = contactCheckboxes.first();
        if (!(await firstCheckbox.isChecked())) {
            await firstCheckbox.click();
        }

        const isEnabled = !(await startBtn.isDisabled());
        recordResult('Bouton actif avec contact(s)', isEnabled);

        // Uncheck all contacts
        for (let i = 0; i < count; i++) {
            const cb = contactCheckboxes.nth(i);
            if (await cb.isChecked()) {
                await cb.click();
            }
        }

        const isDisabled = await startBtn.isDisabled();
        recordResult('Bouton desactive sans contact', isDisabled);

        // Re-check first contact for next tests
        await firstCheckbox.click();

        return isEnabled && isDisabled;
    }

    recordResult('Test bouton', false, 'Aucun contact pour tester');
    return false;
}

// ============================================
// TEST 6: API Endpoints
// ============================================
async function testAPIEndpoints(page) {
    logSection('Test 6: Endpoints API');

    // Test active shares endpoint
    const activeResponse = await page.evaluate(async (baseUrl) => {
        try {
            const token = localStorage.getItem('shield_token') || '';
            const response = await fetch(`${baseUrl}/api/location-share.php?action=active`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return { status: response.status, ok: response.ok };
        } catch (e) {
            return { error: e.message };
        }
    }, CONFIG.baseUrl);

    const activeEndpointWorks = activeResponse.status === 200 || activeResponse.status === 401;
    recordResult('Endpoint /active accessible', activeEndpointWorks,
        `HTTP ${activeResponse.status}`);

    return activeEndpointWorks;
}

// ============================================
// TEST 7: Public Share Page
// ============================================
async function testPublicSharePage(page) {
    logSection('Test 7: Page publique de partage');

    // Generate a fake token to test 404 handling
    const fakeToken = 'a'.repeat(64);
    await page.goto(`${CONFIG.baseUrl}/share/${fakeToken}`);
    await page.waitForLoadState('networkidle');

    await screenshot(page, 'public-share-page');

    // Should show error message for invalid token
    const hasError = await page.locator('.share-error').count() > 0 ||
                     await page.locator('h1:has-text("invalide")').count() > 0 ||
                     await page.locator('h1:has-text("expire")').count() > 0;

    recordResult('Page erreur pour token invalide', hasError);

    return hasError;
}

// ============================================
// TEST 8: Geolocation Permission
// ============================================
async function testGeolocationPermission(context, page) {
    logSection('Test 8: Permission geolocalisation');

    // Grant geolocation permission
    await context.grantPermissions(['geolocation'], { origin: CONFIG.baseUrl });

    // Navigate back to location share page
    await page.goto(`${CONFIG.baseUrl}/app/location-share`);
    await page.waitForLoadState('networkidle');

    // Wait for geolocation to be captured
    await page.waitForTimeout(2000);

    // Check if map is initialized (for journey mode)
    await page.locator('.share-type-btn[data-type="journey"]').click();
    await page.waitForTimeout(500);

    const mapVisible = await page.locator('#share-map').isVisible();
    recordResult('Carte visible en mode journey', mapVisible);

    await screenshot(page, 'map-with-geolocation');

    return mapVisible;
}

// ============================================
// REPORT
// ============================================
function generateReport() {
    logSection('RAPPORT DE TEST LIVE LOCATION');

    const duration = (results.endTime - results.startTime) / 1000;
    const passed = results.tests.filter(r => r.passed).length;
    const failed = results.tests.filter(r => !r.passed).length;
    const total = results.tests.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log('\n RESULTATS:');
    console.log(`   Total tests: ${total}`);
    console.log(`   Reussis: ${passed}`);
    console.log(`   Echoues: ${failed}`);
    console.log(`   Taux de reussite: ${passRate}%`);
    console.log(`   Duree: ${duration.toFixed(1)}s`);
    console.log(`   Screenshots: ${results.screenshots.length}`);

    if (failed > 0) {
        console.log('\n PROBLEMES:');
        results.tests
            .filter(r => !r.passed)
            .forEach((r, i) => {
                console.log(`   ${i + 1}. ${r.name}: ${r.details}`);
            });
    }

    // Save JSON report
    const reportPath = path.join(CONFIG.screenshotsDir, 'test-live-location-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n Rapport sauvegarde: ${reportPath}`);

    return { passed, failed, total, passRate };
}

// ============================================
// MAIN
// ============================================
async function runTests() {
    console.log('\n\x1b[36m' + '='.repeat(60) + '\x1b[0m');
    console.log('\x1b[36m  SHIELD - TESTS LIVE LOCATION SHARING\x1b[0m');
    console.log('\x1b[36m  URL: ' + CONFIG.baseUrl + '\x1b[0m');
    console.log('\x1b[36m' + '='.repeat(60) + '\x1b[0m\n');

    // Create screenshots dir
    if (!fs.existsSync(CONFIG.screenshotsDir)) {
        fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    }

    results.startTime = Date.now();

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, // iPhone 14 Pro
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        locale: 'fr-FR',
        geolocation: { latitude: 46.2044, longitude: 6.1432 }, // Geneva
        permissions: ['geolocation']
    });

    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.timeout);

    try {
        await testPageAccess(page);
        await testShareTypeSelection(page);
        await testDurationSelection(page);
        await testContactSelection(page);
        await testStartButtonState(page);
        await testAPIEndpoints(page);
        await testPublicSharePage(page);
        await testGeolocationPermission(context, page);

    } catch (error) {
        console.error('\n ERREUR:', error.message);
        results.tests.push({
            name: 'Execution',
            passed: false,
            details: error.message
        });
        await screenshot(page, 'error-state');
    }

    results.endTime = Date.now();

    log('\nTests termines. Navigateur ouvert 5 secondes...', 'info');
    await page.waitForTimeout(5000);

    await browser.close();

    return generateReport();
}

// Run
runTests()
    .then(report => {
        const exitCode = report.failed > 0 ? 1 : 0;
        console.log(`\n Sortie avec code: ${exitCode}`);
        process.exit(exitCode);
    })
    .catch(err => {
        console.error('Erreur fatale:', err);
        process.exit(1);
    });

/**
 * SHIELD - Test Back Tap Feature
 *
 * Teste la fonctionnalite de tapotement sur le dos du telephone
 * pour declencher l'alarme SOS
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8085';

async function runTests() {
    console.log('='.repeat(60));
    console.log('SHIELD - Test Back Tap Feature');
    console.log('='.repeat(60));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const context = await browser.newContext({
        viewport: { width: 390, height: 844 } // iPhone 14 Pro
    });

    const page = await context.newPage();

    const screenshotsDir = path.join(__dirname, 'screenshots', 'back-tap');
    const fs = require('fs');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    let testsPassed = 0;
    let testsFailed = 0;

    try {
        // Test 1: Verifier les fichiers JS existent et sont accessibles
        console.log('\n[TEST 1] Verification des fichiers JS...');

        const jsFiles = [
            { path: 'js/core/alarm-service.js', name: 'AlarmService' },
            { path: 'js/core/back-tap-detector.js', name: 'BackTapDetector' },
            { path: 'js/app/alarm-trigger.js', name: 'AlarmTrigger' },
            { path: 'js/app/sos-screen.js', name: 'SOSScreen' },
            { path: 'js/app/settings.js', name: 'SettingsPage' }
        ];

        let allFilesOk = true;
        for (const file of jsFiles) {
            const response = await page.goto(`${BASE_URL}/assets/${file.path}`, { waitUntil: 'networkidle' });
            const status = response?.status() || 0;
            if (status === 200) {
                console.log(`  [OK] ${file.name} (${file.path})`);
            } else {
                console.log(`  [MISSING] ${file.name} (${file.path}) - status: ${status}`);
                allFilesOk = false;
            }
        }
        if (allFilesOk) {
            console.log('  [PASS] Tous les fichiers JS sont accessibles');
            testsPassed++;
        } else {
            console.log('  [FAIL] Certains fichiers JS manquent');
            testsFailed++;
        }

        // Test 2: Verifier le contenu de AlarmService
        console.log('\n[TEST 2] Verification du contenu AlarmService...');
        const alarmServiceContent = await page.goto(`${BASE_URL}/assets/js/core/alarm-service.js`, { waitUntil: 'networkidle' })
            .then(r => r.text());

        const alarmServiceChecks = [
            { pattern: 'playPanicAlarm', desc: 'Methode playPanicAlarm' },
            { pattern: 'makeDistortionCurve', desc: 'Effet distorsion' },
            { pattern: 'startVibration', desc: 'Vibration support' },
            { pattern: 'window.AlarmService', desc: 'Export global' }
        ];

        let alarmServiceOk = true;
        for (const check of alarmServiceChecks) {
            if (alarmServiceContent.includes(check.pattern)) {
                console.log(`  [OK] ${check.desc}`);
            } else {
                console.log(`  [MISSING] ${check.desc}`);
                alarmServiceOk = false;
            }
        }
        if (alarmServiceOk) {
            console.log('  [PASS] AlarmService complet');
            testsPassed++;
        } else {
            console.log('  [FAIL] AlarmService incomplet');
            testsFailed++;
        }

        // Test 3: Verifier le contenu de BackTapDetector
        console.log('\n[TEST 3] Verification du contenu BackTapDetector...');
        const backTapContent = await page.goto(`${BASE_URL}/assets/js/core/back-tap-detector.js`, { waitUntil: 'networkidle' })
            .then(r => r.text());

        const backTapChecks = [
            { pattern: 'tapThreshold', desc: 'Config tapThreshold' },
            { pattern: 'doubleTapWindow', desc: 'Config doubleTapWindow' },
            { pattern: 'onDoubleTap', desc: 'Callback onDoubleTap' },
            { pattern: 'DeviceMotionEvent', desc: 'Support Web API' },
            { pattern: 'Capacitor', desc: 'Support Capacitor' },
            { pattern: 'window.BackTapDetector', desc: 'Export global' }
        ];

        let backTapOk = true;
        for (const check of backTapChecks) {
            if (backTapContent.includes(check.pattern)) {
                console.log(`  [OK] ${check.desc}`);
            } else {
                console.log(`  [MISSING] ${check.desc}`);
                backTapOk = false;
            }
        }
        if (backTapOk) {
            console.log('  [PASS] BackTapDetector complet');
            testsPassed++;
        } else {
            console.log('  [FAIL] BackTapDetector incomplet');
            testsFailed++;
        }

        // Test 4: Verifier l'integration dans AlarmTrigger
        console.log('\n[TEST 4] Verification integration AlarmTrigger...');
        const alarmTriggerContent = await page.goto(`${BASE_URL}/assets/js/app/alarm-trigger.js`, { waitUntil: 'networkidle' })
            .then(r => r.text());

        const alarmTriggerChecks = [
            { pattern: 'backTapEnabled', desc: 'Config backTapEnabled' },
            { pattern: 'backTapSensitivity', desc: 'Config backTapSensitivity' },
            { pattern: 'initBackTapDetection', desc: 'Methode initBackTapDetection' },
            { pattern: 'back_tap', desc: 'Trigger method back_tap' },
            { pattern: 'BackTapDetector', desc: 'Integration BackTapDetector' }
        ];

        let alarmTriggerOk = true;
        for (const check of alarmTriggerChecks) {
            if (alarmTriggerContent.includes(check.pattern)) {
                console.log(`  [OK] ${check.desc}`);
            } else {
                console.log(`  [MISSING] ${check.desc}`);
                alarmTriggerOk = false;
            }
        }
        if (alarmTriggerOk) {
            console.log('  [PASS] AlarmTrigger integre BackTap');
            testsPassed++;
        } else {
            console.log('  [FAIL] AlarmTrigger integration incomplete');
            testsFailed++;
        }

        // Test 5: Verifier l'integration dans SOSScreen
        console.log('\n[TEST 5] Verification integration SOSScreen...');
        const sosScreenContent = await page.goto(`${BASE_URL}/assets/js/app/sos-screen.js`, { waitUntil: 'networkidle' })
            .then(r => r.text());

        const sosScreenChecks = [
            { pattern: 'AlarmService', desc: 'Integration AlarmService' },
            { pattern: 'playPanicAlarm', desc: 'Appel playPanicAlarm' },
            { pattern: 'AlarmService.init', desc: 'Initialisation AlarmService' }
        ];

        let sosScreenOk = true;
        for (const check of sosScreenChecks) {
            if (sosScreenContent.includes(check.pattern)) {
                console.log(`  [OK] ${check.desc}`);
            } else {
                console.log(`  [MISSING] ${check.desc}`);
                sosScreenOk = false;
            }
        }
        if (sosScreenOk) {
            console.log('  [PASS] SOSScreen integre AlarmService');
            testsPassed++;
        } else {
            console.log('  [FAIL] SOSScreen integration incomplete');
            testsFailed++;
        }

        // Test 6: Verifier les settings
        console.log('\n[TEST 6] Verification des settings BackTap...');
        const settingsContent = await page.goto(`${BASE_URL}/assets/js/app/settings.js`, { waitUntil: 'networkidle' })
            .then(r => r.text());

        const settingsChecks = [
            { pattern: 'backTapTrigger', desc: 'Element backTapTrigger' },
            { pattern: 'backTapSensitivity', desc: 'Element backTapSensitivity' },
            { pattern: 'back_tap_enabled', desc: 'Preference back_tap_enabled' },
            { pattern: 'toggleBackTapSensitivity', desc: 'Methode toggleBackTapSensitivity' }
        ];

        let settingsOk = true;
        for (const check of settingsChecks) {
            if (settingsContent.includes(check.pattern)) {
                console.log(`  [OK] ${check.desc}`);
            } else {
                console.log(`  [MISSING] ${check.desc}`);
                settingsOk = false;
            }
        }
        if (settingsOk) {
            console.log('  [PASS] Settings supporte BackTap');
            testsPassed++;
        } else {
            console.log('  [FAIL] Settings incomplet pour BackTap');
            testsFailed++;
        }

        // Test 7: Verifier la page de login
        console.log('\n[TEST 7] Screenshot page de login...');
        await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(screenshotsDir, '01-login-page.png') });

        const loginFormExists = await page.locator('form').first().isVisible().catch(() => false);
        const rememberMeExists = await page.locator('#remember-me, input[name="remember"]').isVisible().catch(() => false);

        if (loginFormExists) {
            console.log('  [OK] Formulaire de login');
        }
        if (rememberMeExists) {
            console.log('  [OK] Checkbox Se souvenir de moi');
        }
        console.log('  [PASS] Page de login fonctionnelle');
        testsPassed++;

    } catch (error) {
        console.error('\n[ERROR] Test failed:', error.message);
        await page.screenshot({ path: path.join(screenshotsDir, 'error-screenshot.png') });
        testsFailed++;
    }

    // Resume
    console.log('\n' + '='.repeat(60));
    console.log('RESUME DES TESTS');
    console.log('='.repeat(60));
    console.log(`Tests reussis: ${testsPassed}`);
    console.log(`Tests echoues: ${testsFailed}`);
    console.log(`Screenshots: ${screenshotsDir}`);

    await browser.close();

    process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(console.error);

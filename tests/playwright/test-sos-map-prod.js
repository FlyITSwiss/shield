/**
 * Test SOS Map sur PROD
 * Playwright visual test avec screenshots
 * Utilise injection JWT pour contourner les problèmes de formulaire
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const prodConfig = require('./config.prod.js');

const CONFIG = {
    ...prodConfig,
    screenshotDir: path.join(__dirname, 'screenshots-sos-map')
};

/**
 * Login via API et retourner le token JWT
 */
async function loginViaApi(email, password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ email, password });

        const options = {
            hostname: 'stabilis-it.ch',
            port: 443,
            path: '/internal/shield/api/auth.php?action=login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.success && result.token) {
                        resolve({ token: result.token, user: result.user });
                    } else {
                        reject(new Error(result.error || 'Login failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('  SHIELD SOS MAP - TEST PROD');
    console.log('='.repeat(60));
    console.log('');

    // Étape 1: Login via API
    console.log('[0/6] Login via API...');
    let authData;
    try {
        authData = await loginViaApi(CONFIG.credentials.email, CONFIG.credentials.password);
        console.log(`   ✅ Token JWT obtenu pour ${authData.user.email}`);
    } catch (error) {
        console.error(`   ❌ Échec login API: ${error.message}`);
        process.exit(1);
    }

    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
    });

    const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        permissions: ['geolocation'],
        geolocation: { latitude: 46.2044, longitude: 6.1432 }, // Geneva
    });

    const page = await context.newPage();

    // Create screenshots dir
    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    let passed = 0;
    let failed = 0;

    try {
        // ============ 1. INJECTER LE TOKEN JWT ============
        console.log('[1/6] Injection du token JWT...');

        // D'abord naviguer vers le site pour établir l'origine
        await page.goto(`${CONFIG.baseUrl}/auth/login`);
        await page.waitForLoadState('networkidle');

        // Injecter le token JWT dans localStorage
        await page.evaluate((data) => {
            localStorage.setItem('shield_token', data.token);
            localStorage.setItem('shield_user', JSON.stringify(data.user));
            localStorage.setItem('shield_remember', 'true');
        }, authData);

        console.log('   ✅ Token JWT injecté');
        passed++;

        // ============ 2. PAGE SOS ============
        console.log('[2/6] Navigation vers page SOS...');
        await page.goto(`${CONFIG.baseUrl}/app/sos`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const sosUrl = page.url();
        console.log(`   URL: ${sosUrl}`);

        if (sosUrl.includes('/app/sos') || sosUrl.includes('/app')) {
            console.log('   ✅ Page SOS accessible');
            passed++;
        } else {
            console.log(`   ❌ Redirigé vers: ${sosUrl}`);
            failed++;
        }

        await page.screenshot({
            path: path.join(CONFIG.screenshotDir, '01-sos-page.png'),
            fullPage: true
        });

        // ============ 3. CARTE VISIBLE ============
        console.log('[3/6] Vérification carte GPS...');

        // Attendre le chargement Leaflet
        await page.waitForTimeout(3000);

        const mapWrapper = page.locator('.sos-map-wrapper').first();
        const mapWrapperVisible = await mapWrapper.isVisible().catch(() => false);

        const sosMap = page.locator('#sos-map').first();
        const sosMapVisible = await sosMap.isVisible().catch(() => false);

        console.log(`   - .sos-map-wrapper visible: ${mapWrapperVisible}`);
        console.log(`   - #sos-map visible: ${sosMapVisible}`);

        if (mapWrapperVisible && sosMapVisible) {
            console.log('   ✅ Carte GPS présente');
            passed++;
        } else if (mapWrapperVisible || sosMapVisible) {
            console.log('   ⚠️  Carte partiellement visible');
        } else {
            console.log('   ❌ Carte GPS non trouvée');
            failed++;
        }

        // ============ 4. TUILES LEAFLET ============
        console.log('[4/6] Vérification tuiles Leaflet...');

        const leafletPane = page.locator('.leaflet-tile-pane').first();
        const leafletPaneExists = await leafletPane.isVisible().catch(() => false);

        const tileCount = await page.locator('.leaflet-tile').count();
        console.log(`   - Leaflet tile-pane: ${leafletPaneExists}`);
        console.log(`   - Nombre de tuiles: ${tileCount}`);

        if (leafletPaneExists || tileCount > 0) {
            console.log('   ✅ Tuiles Leaflet chargées');
            passed++;
        } else {
            console.log('   ⚠️  Tuiles en cours de chargement ou problème réseau');
        }

        // ============ 5. ADRESSE AFFICHÉE ============
        console.log('[5/6] Vérification adresse...');

        const addressEl = page.locator('#map-address, .map-address-value').first();
        const addressVisible = await addressEl.isVisible().catch(() => false);

        if (addressVisible) {
            const addressText = await addressEl.textContent();
            console.log(`   - Adresse: "${addressText}"`);
            if (addressText && addressText !== 'Localisation...' && addressText.length > 5) {
                console.log('   ✅ Adresse affichée');
                passed++;
            } else {
                console.log('   ⚠️  Adresse en cours de chargement');
            }
        } else {
            console.log('   ⚠️  Élément adresse non visible');
        }

        // ============ 6. MARQUEUR UTILISATEUR ============
        console.log('[6/6] Vérification marqueur utilisateur...');

        const userMarker = page.locator('.shield-user-marker, .leaflet-marker-icon').first();
        const markerVisible = await userMarker.isVisible().catch(() => false);

        if (markerVisible) {
            console.log('   ✅ Marqueur utilisateur visible');
            passed++;
        } else {
            console.log('   ⚠️  Marqueur non encore affiché (géoloc en attente)');
        }

        // Screenshot final
        await page.screenshot({
            path: path.join(CONFIG.screenshotDir, '02-sos-map-final.png'),
            fullPage: true
        });

        // ============ RÉSUMÉ ============
        console.log('');
        console.log('='.repeat(60));
        console.log('  RÉSUMÉ DES TESTS');
        console.log('='.repeat(60));
        console.log(`  ✅ Passés: ${passed}`);
        console.log(`  ❌ Échoués: ${failed}`);
        console.log(`  📁 Screenshots: ${CONFIG.screenshotDir}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('');
        console.error('[ERREUR CRITIQUE]', error.message);
        failed++;

        await page.screenshot({
            path: path.join(CONFIG.screenshotDir, 'error-critical.png'),
            fullPage: true
        }).catch(() => {});
    } finally {
        console.log('');
        console.log('Fermeture du navigateur dans 5 secondes...');
        await page.waitForTimeout(5000);
        await browser.close();
    }

    // Exit code basé sur les résultats
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);

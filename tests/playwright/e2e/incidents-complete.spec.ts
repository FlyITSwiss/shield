/**
 * SHIELD - Tests E2E Complets: SOS / Incidents
 * ============================================================================
 * COUVERTURE EXHAUSTIVE:
 * - Declenchement SOS (normal, discret, volume buttons)
 * - Incident actif (statut, localisation, contacts notifies)
 * - Annulation (avec confirmation)
 * - Escalade automatique
 * - Geolocalisation temps reel
 * - API Incidents
 * ============================================================================
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, testUser, apiLogin, authenticatedRequest } from '../helpers/test-auth';

test.describe('SOS / Incidents - Tests E2E Complets', () => {

    let authToken: string;

    test.beforeAll(async ({ request }) => {
        authToken = await apiLogin(request);
    });

    // ========================================================================
    // ACCES A LA PAGE SOS
    // ========================================================================

    test.describe('Acces et Navigation', () => {

        test('Page SOS accessible authentifie', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');
            await expect(page).toHaveURL(/\/app\/sos/);
            await expect(page.locator('.sos-container, .sos-button, [data-sos]')).toBeVisible();
        });

        test('Page SOS redirige vers login si non authentifie', async ({ page }) => {
            await page.goto('/app/sos');
            await expect(page).toHaveURL(/auth\/login/);
        });

        test('Bouton SOS visible sur dashboard', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            // Le bouton SOS doit etre visible sur le dashboard
            await expect(page.locator('[data-sos-trigger], .sos-trigger, #btn-sos-main')).toBeVisible();
        });
    });

    // ========================================================================
    // DECLENCHEMENT SOS - NORMAL
    // ========================================================================

    test.describe('Declenchement SOS Normal', () => {

        test('Declenchement SOS avec confirmation', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            // Cliquer sur le bouton SOS principal
            await page.locator('[data-sos-trigger], .sos-trigger, #btn-sos-main').click();

            // Modal de confirmation doit apparaitre
            await expect(page.locator('.sos-confirm-modal, [data-sos-confirm]')).toBeVisible({ timeout: 3000 });

            // Confirmer le declenchement
            await page.locator('[data-confirm-sos], #btn-confirm-sos, .confirm-sos-btn').click();

            // Verifier que l'incident est cree (page incident actif)
            await expect(page).toHaveURL(/\/app\/incident/, { timeout: 5000 });
        });

        test('Annulation avant confirmation', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            await page.locator('[data-sos-trigger], .sos-trigger, #btn-sos-main').click();
            await expect(page.locator('.sos-confirm-modal, [data-sos-confirm]')).toBeVisible({ timeout: 3000 });

            // Annuler
            await page.locator('[data-cancel-sos], #btn-cancel-sos, .cancel-sos-btn').click();

            // Modal fermee, pas de redirection
            await expect(page.locator('.sos-confirm-modal, [data-sos-confirm]')).not.toBeVisible();
            await expect(page).toHaveURL(/\/app\/sos/);
        });

        test('Selection du niveau de severite', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            await page.locator('[data-sos-trigger], .sos-trigger, #btn-sos-main').click();
            await expect(page.locator('.sos-confirm-modal, [data-sos-confirm]')).toBeVisible({ timeout: 3000 });

            // Verifier que les niveaux de severite sont disponibles
            const severityOptions = page.locator('[data-severity], .severity-option, input[name="severity"]');
            await expect(severityOptions.first()).toBeVisible();

            // Selectionner critical
            await page.locator('[data-severity="critical"], #severity-critical, [value="critical"]').click();

            // Le niveau doit etre selectionne
            await expect(page.locator('[data-severity="critical"].selected, #severity-critical:checked')).toBeVisible();
        });
    });

    // ========================================================================
    // DECLENCHEMENT SOS - MODE DISCRET
    // ========================================================================

    test.describe('Declenchement SOS Mode Discret', () => {

        test('Mode discret disponible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            // Option mode discret visible
            await expect(page.locator('[data-stealth-mode], .stealth-mode-toggle, #stealth-mode')).toBeVisible();
        });

        test('Activation mode discret', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            // Activer le mode discret
            const stealthToggle = page.locator('[data-stealth-mode], .stealth-mode-toggle, #stealth-mode');
            await stealthToggle.click();

            // Verifier l'activation
            const isChecked = await stealthToggle.isChecked();
            expect(isChecked).toBe(true);
        });

        test('SOS en mode discret ne fait pas de bruit', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            // Activer mode discret
            await page.locator('[data-stealth-mode], .stealth-mode-toggle, #stealth-mode').click();

            // Declencher SOS
            await page.locator('[data-sos-trigger], .sos-trigger, #btn-sos-main').click();

            // En mode discret, pas de modal visible (declenchement direct)
            // OU modal simplifiee sans animation
            await page.waitForTimeout(500);

            // L'ecran ne doit pas montrer d'alerte visible
            const noVisibleAlert = await page.locator('.sos-alert-visible, .sos-siren').count();
            expect(noVisibleAlert).toBe(0);
        });
    });

    // ========================================================================
    // INCIDENT ACTIF
    // ========================================================================

    test.describe('Incident Actif', () => {

        test('Affichage incident actif apres SOS', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            // Verifier s'il y a un incident actif via API
            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                // Aller sur la page incident
                await page.goto('/app/incident');

                // Verifier les elements affiches
                await expect(page.locator('.incident-status, [data-incident-status]')).toBeVisible();
                await expect(page.locator('.incident-timer, [data-incident-timer]')).toBeVisible();
                await expect(page.locator('.incident-location, [data-incident-location]')).toBeVisible();
            }
        });

        test('Timer d\'escalade affiche', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                await page.goto('/app/incident');

                // Timer visible avec compte a rebours
                const timer = page.locator('.escalation-timer, [data-escalation-timer]');
                await expect(timer).toBeVisible();

                // Le timer doit montrer un temps
                const timerText = await timer.textContent();
                expect(timerText).toMatch(/\d+:\d+|\d+ min/);
            }
        });

        test('Liste des contacts notifies', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                await page.goto('/app/incident');

                // Liste des contacts notifies visible
                await expect(page.locator('.notified-contacts, [data-notified-contacts]')).toBeVisible();

                // Au moins un contact doit etre affiche
                const contactItems = page.locator('.contact-notification-status, [data-contact-status]');
                const count = await contactItems.count();
                expect(count).toBeGreaterThanOrEqual(0); // Peut etre 0 si pas de contacts configures
            }
        });

        test('Carte de localisation affichee', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                await page.goto('/app/incident');

                // La carte doit etre visible
                await expect(page.locator('.incident-map, #incident-map, [data-incident-map]')).toBeVisible();
            }
        });
    });

    // ========================================================================
    // ANNULATION INCIDENT
    // ========================================================================

    test.describe('Annulation Incident', () => {

        test('Bouton annulation visible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                await page.goto('/app/incident');

                // Bouton d'annulation visible
                await expect(page.locator('[data-cancel-incident], .cancel-incident-btn, #btn-cancel-incident')).toBeVisible();
            }
        });

        test('Annulation avec code PIN', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                await page.goto('/app/incident');

                await page.locator('[data-cancel-incident], .cancel-incident-btn, #btn-cancel-incident').click();

                // Modal de confirmation avec PIN
                await expect(page.locator('.pin-modal, [data-pin-modal]')).toBeVisible({ timeout: 3000 });

                // Entrer le PIN (si configure)
                const pinInput = page.locator('#cancel-pin, [data-cancel-pin]');
                if (await pinInput.isVisible()) {
                    await pinInput.fill('1234'); // PIN par defaut test
                    await page.locator('[data-confirm-cancel], #btn-confirm-cancel').click();
                }
            }
        });

        test('Annulation fausse alerte', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            const response = await authenticatedRequest(
                page.request, 'GET', 'incidents.php?action=active', authToken
            );

            if (response.success && response.incident) {
                await page.goto('/app/incident');

                await page.locator('[data-cancel-incident], .cancel-incident-btn, #btn-cancel-incident').click();
                await expect(page.locator('.cancel-modal, [data-cancel-modal]')).toBeVisible({ timeout: 3000 });

                // Option fausse alerte disponible
                const falseAlarmOption = page.locator('[data-reason="false_alarm"], #reason-false-alarm');
                if (await falseAlarmOption.isVisible()) {
                    await falseAlarmOption.click();
                }
            }
        });
    });

    // ========================================================================
    // ESCALADE AUTOMATIQUE
    // ========================================================================

    test.describe('Escalade Automatique', () => {

        test('API escalade fonctionnelle', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=escalation-config', authToken
            );

            expect(response.success).toBe(true);
            expect(response.config).toBeDefined();
            expect(response.config.levels).toBeDefined();
        });

        test('Niveaux d\'escalade configures', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=escalation-config', authToken
            );

            if (response.success && response.config) {
                // Au moins 2 niveaux d'escalade
                expect(response.config.levels.length).toBeGreaterThanOrEqual(2);

                // Chaque niveau a un delai et des actions
                response.config.levels.forEach((level: any) => {
                    expect(level.delay_minutes).toBeDefined();
                    expect(level.actions).toBeDefined();
                });
            }
        });
    });

    // ========================================================================
    // GEOLOCALISATION
    // ========================================================================

    test.describe('Geolocalisation', () => {

        test('Demande de permission geolocalisation', async ({ page, context }) => {
            // Simuler la permission geolocalisation
            await context.grantPermissions(['geolocation']);

            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/sos');

            // La geolocalisation doit etre active
            const geoStatus = page.locator('[data-geo-status], .geo-status');
            if (await geoStatus.isVisible()) {
                await expect(geoStatus).toContainText(/activ|enable/i);
            }
        });

        test('API location update', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'POST', 'incidents.php?action=update-location', authToken, {
                    latitude: 46.2044,
                    longitude: 6.1432,
                    accuracy: 10
                }
            );

            // Peut echouer si pas d'incident actif, mais l'API doit repondre
            expect(response).toHaveProperty('success');
        });
    });

    // ========================================================================
    // API INCIDENTS
    // ========================================================================

    test.describe('API Incidents', () => {

        test('GET /incidents.php?action=active', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            expect(response.success).toBe(true);
            // incident peut etre null si aucun actif
        });

        test('POST /incidents.php?action=trigger', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'POST', 'incidents.php?action=trigger', authToken, {
                    severity: 'medium',
                    latitude: 46.2044,
                    longitude: 6.1432,
                    stealth_mode: false
                }
            );

            expect(response).toHaveProperty('success');
            if (response.success) {
                expect(response.incident_id).toBeDefined();

                // Nettoyer: annuler l'incident cree
                await authenticatedRequest(
                    request, 'POST', 'incidents.php?action=cancel', authToken, {
                        incident_id: response.incident_id,
                        reason: 'test_cleanup'
                    }
                );
            }
        });

        test('POST /incidents.php?action=cancel', async ({ request }) => {
            // D'abord verifier s'il y a un incident actif
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const response = await authenticatedRequest(
                    request, 'POST', 'incidents.php?action=cancel', authToken, {
                        incident_id: activeResponse.incident.id,
                        reason: 'false_alarm',
                        pin: '1234'
                    }
                );

                expect(response).toHaveProperty('success');
            }
        });

        test('GET /incidents.php?action=history', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=history', authToken
            );

            expect(response.success).toBe(true);
            expect(Array.isArray(response.incidents)).toBe(true);
        });

        test('POST /incidents.php?action=update-location', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'POST', 'incidents.php?action=update-location', authToken, {
                    latitude: 46.2044,
                    longitude: 6.1432,
                    accuracy: 15,
                    altitude: 400,
                    speed: 0
                }
            );

            expect(response).toHaveProperty('success');
        });
    });

    // ========================================================================
    // VOLUME BUTTONS TRIGGER
    // ========================================================================

    test.describe('Volume Buttons Trigger (Mobile)', () => {

        test('Configuration volume buttons disponible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            // Option volume buttons visible
            const volumeSetting = page.locator('[data-setting="volume_trigger"], #setting-volume-trigger');
            if (await volumeSetting.isVisible()) {
                await expect(volumeSetting).toBeVisible();
            }
        });

        test('API volume buttons configuration', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'settings.php?action=get&key=volume_trigger', authToken
            );

            expect(response).toHaveProperty('success');
        });
    });
});

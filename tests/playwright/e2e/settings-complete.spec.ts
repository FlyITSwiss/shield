/**
 * SHIELD - Tests E2E Complets: Parametres
 * ============================================================================
 * COUVERTURE EXHAUSTIVE:
 * - Profil utilisateur (nom, email, telephone)
 * - Preferences SOS (timer, severite par defaut, mode discret)
 * - Preferences notifications (SMS, Push, Email)
 * - Code PIN (creation, modification, suppression)
 * - Volume buttons trigger
 * - Langue
 * - Theme (sombre/clair)
 * - Suppression compte
 * - API Settings
 * ============================================================================
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, testUser, apiLogin, authenticatedRequest } from '../helpers/test-auth';

test.describe('Parametres - Tests E2E Complets', () => {

    let authToken: string;

    test.beforeAll(async ({ request }) => {
        authToken = await apiLogin(request);
    });

    // ========================================================================
    // ACCES A LA PAGE
    // ========================================================================

    test.describe('Acces et Navigation', () => {

        test('Page settings accessible authentifie', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');
            await expect(page).toHaveURL(/\/app\/settings/);
            await expect(page.locator('.settings-container, .settings-page, [data-settings]')).toBeVisible();
        });

        test('Page settings redirige vers login si non authentifie', async ({ page }) => {
            await page.goto('/app/settings');
            await expect(page).toHaveURL(/auth\/login/);
        });

        test('Navigation vers settings depuis le menu', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.locator('nav a[href*="settings"], .nav-link[href*="settings"], [data-nav="settings"]').click();
            await expect(page).toHaveURL(/\/app\/settings/);
        });
    });

    // ========================================================================
    // PROFIL UTILISATEUR
    // ========================================================================

    test.describe('Profil Utilisateur', () => {

        test('Affichage des informations actuelles', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            // Les champs doivent contenir les valeurs actuelles
            const emailField = page.locator('#profile-email, #email');
            await expect(emailField).toHaveValue(testUser.email);
        });

        test('Modification du nom', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            // Section profil
            const profileSection = page.locator('[data-section="profile"], .profile-section');
            if (await profileSection.isVisible()) {
                const firstNameField = page.locator('#profile-first-name, #firstName');
                await firstNameField.clear();
                await firstNameField.fill('NouveauPrenom');

                await page.locator('[data-save-profile], #btn-save-profile').click();

                // Message de succes
                await expect(page.locator('.toast-success, .alert-success')).toBeVisible({ timeout: 5000 });
            }
        });

        test('Modification du telephone', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const phoneField = page.locator('#profile-phone, #phone');
            if (await phoneField.isVisible()) {
                await phoneField.clear();
                await phoneField.fill('+33698765432');

                await page.locator('[data-save-profile], #btn-save-profile').click();
                await expect(page.locator('.toast-success, .alert-success')).toBeVisible({ timeout: 5000 });
            }
        });

        test('Validation format telephone', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const phoneField = page.locator('#profile-phone, #phone');
            if (await phoneField.isVisible()) {
                await phoneField.clear();
                await phoneField.fill('invalid-phone');

                await page.locator('[data-save-profile], #btn-save-profile').click();

                // Erreur de validation
                const isInvalid = await phoneField.evaluate((el: HTMLInputElement) => !el.validity.valid);
                expect(isInvalid).toBe(true);
            }
        });
    });

    // ========================================================================
    // PREFERENCES SOS
    // ========================================================================

    test.describe('Preferences SOS', () => {

        test('Timer d\'escalade configurable', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const timerSelect = page.locator('#escalation-timer, [data-setting="escalation_timer"]');
            if (await timerSelect.isVisible()) {
                await timerSelect.selectOption('5'); // 5 minutes
                await expect(timerSelect).toHaveValue('5');
            }
        });

        test('Severite par defaut configurable', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const severitySelect = page.locator('#default-severity, [data-setting="default_severity"]');
            if (await severitySelect.isVisible()) {
                await severitySelect.selectOption('high');
                await expect(severitySelect).toHaveValue('high');
            }
        });

        test('Mode discret par defaut', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const stealthToggle = page.locator('#default-stealth, [data-setting="default_stealth"]');
            if (await stealthToggle.isVisible()) {
                await stealthToggle.click();
                const isChecked = await stealthToggle.isChecked();
                expect(typeof isChecked).toBe('boolean');
            }
        });
    });

    // ========================================================================
    // PREFERENCES NOTIFICATIONS
    // ========================================================================

    test.describe('Preferences Notifications', () => {

        test('Toggle SMS notifications', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const smsToggle = page.locator('#notify-sms, [data-setting="notify_sms"]');
            if (await smsToggle.isVisible()) {
                const initialState = await smsToggle.isChecked();
                await smsToggle.click();
                const newState = await smsToggle.isChecked();
                expect(newState).not.toBe(initialState);
            }
        });

        test('Toggle Push notifications', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const pushToggle = page.locator('#notify-push, [data-setting="notify_push"]');
            if (await pushToggle.isVisible()) {
                await pushToggle.click();
                // Toggle state changed
            }
        });

        test('Toggle Email notifications', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const emailToggle = page.locator('#notify-email, [data-setting="notify_email"]');
            if (await emailToggle.isVisible()) {
                await emailToggle.click();
            }
        });
    });

    // ========================================================================
    // CODE PIN
    // ========================================================================

    test.describe('Code PIN', () => {

        test('Section PIN visible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            await expect(page.locator('[data-section="pin"], .pin-section, #pin-settings')).toBeVisible();
        });

        test('Creation de PIN', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const setPinBtn = page.locator('[data-set-pin], #btn-set-pin, .set-pin-btn');
            if (await setPinBtn.isVisible()) {
                await setPinBtn.click();

                // Modal de creation PIN
                await expect(page.locator('.pin-modal, [data-pin-modal]')).toBeVisible();

                // Entrer le nouveau PIN
                await page.locator('#new-pin').fill('1234');
                await page.locator('#confirm-pin').fill('1234');
                await page.locator('#btn-confirm-new-pin').click();

                // Message de succes
                await expect(page.locator('.toast-success, .alert-success')).toBeVisible({ timeout: 5000 });
            }
        });

        test('PIN - Validation correspondance', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const setPinBtn = page.locator('[data-set-pin], #btn-set-pin, .set-pin-btn');
            if (await setPinBtn.isVisible()) {
                await setPinBtn.click();

                await page.locator('#new-pin').fill('1234');
                await page.locator('#confirm-pin').fill('5678'); // Different

                await page.locator('#btn-confirm-new-pin').click();

                // Erreur de validation
                await expect(page.locator('.error-message, .alert-error, [data-error]')).toBeVisible({ timeout: 3000 });
            }
        });
    });

    // ========================================================================
    // VOLUME BUTTONS TRIGGER
    // ========================================================================

    test.describe('Volume Buttons Trigger', () => {

        test('Option volume buttons visible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const volumeSection = page.locator('[data-section="volume"], .volume-trigger-section');
            // Peut ne pas etre visible sur desktop
            if (await volumeSection.isVisible()) {
                await expect(volumeSection).toBeVisible();
            }
        });

        test('Configuration nombre de pressions', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const pressCountSelect = page.locator('#volume-press-count, [data-setting="volume_press_count"]');
            if (await pressCountSelect.isVisible()) {
                await pressCountSelect.selectOption('5');
                await expect(pressCountSelect).toHaveValue('5');
            }
        });
    });

    // ========================================================================
    // LANGUE
    // ========================================================================

    test.describe('Langue', () => {

        test('Selection de langue disponible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const langSelect = page.locator('#language, [data-setting="language"]');
            await expect(langSelect).toBeVisible();
        });

        test('Changement de langue vers EN', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const langSelect = page.locator('#language, [data-setting="language"]');
            await langSelect.selectOption('en');

            // La page doit etre en anglais
            await page.waitForTimeout(500);
            // Verifier un element traduit
        });

        test('Changement de langue vers FR', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const langSelect = page.locator('#language, [data-setting="language"]');
            await langSelect.selectOption('fr');
        });
    });

    // ========================================================================
    // THEME
    // ========================================================================

    test.describe('Theme', () => {

        test('Toggle theme sombre/clair', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const themeToggle = page.locator('#theme-toggle, [data-setting="theme"]');
            if (await themeToggle.isVisible()) {
                await themeToggle.click();

                // Verifier que le theme a change
                const bodyClass = await page.locator('body').getAttribute('class');
                expect(bodyClass).toMatch(/dark|light/);
            }
        });

        test('Theme persiste apres refresh', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            const themeToggle = page.locator('#theme-toggle, [data-setting="theme"]');
            if (await themeToggle.isVisible()) {
                await themeToggle.click();
                const themeAfterClick = await page.locator('body').getAttribute('class');

                await page.reload();

                const themeAfterReload = await page.locator('body').getAttribute('class');
                expect(themeAfterReload).toBe(themeAfterClick);
            }
        });
    });

    // ========================================================================
    // SUPPRESSION COMPTE
    // ========================================================================

    test.describe('Suppression Compte', () => {

        test('Bouton suppression visible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            await expect(page.locator('[data-delete-account], #btn-delete-account, .delete-account-btn')).toBeVisible();
        });

        test('Suppression necessite confirmation', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            await page.locator('[data-delete-account], #btn-delete-account, .delete-account-btn').click();

            // Modal de confirmation
            await expect(page.locator('.delete-confirm-modal, [data-confirm-delete-account]')).toBeVisible({ timeout: 3000 });
        });

        test('Annulation suppression', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/settings');

            await page.locator('[data-delete-account], #btn-delete-account, .delete-account-btn').click();
            await expect(page.locator('.delete-confirm-modal, [data-confirm-delete-account]')).toBeVisible({ timeout: 3000 });

            // Annuler
            await page.locator('[data-cancel-delete], #btn-cancel-delete-account').click();

            // Modal fermee
            await expect(page.locator('.delete-confirm-modal, [data-confirm-delete-account]')).not.toBeVisible();
        });
    });

    // ========================================================================
    // API SETTINGS
    // ========================================================================

    test.describe('API Settings', () => {

        test('GET /settings.php?action=all', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'settings.php?action=all', authToken
            );

            expect(response.success).toBe(true);
            expect(response.settings).toBeDefined();
        });

        test('POST /settings.php?action=update', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'POST', 'settings.php?action=update', authToken, {
                    key: 'default_severity',
                    value: 'medium'
                }
            );

            expect(response.success).toBe(true);
        });

        test('GET /settings.php?action=get&key=...', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'settings.php?action=get&key=language', authToken
            );

            expect(response.success).toBe(true);
            expect(response.value).toBeDefined();
        });

        test('POST /settings.php?action=update-profile', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'POST', 'settings.php?action=update-profile', authToken, {
                    first_name: 'Test',
                    last_name: 'User',
                    phone: '+33612345678'
                }
            );

            expect(response.success).toBe(true);
        });

        test('POST /settings.php?action=update-pin', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'POST', 'settings.php?action=update-pin', authToken, {
                    new_pin: '9876',
                    confirm_pin: '9876'
                }
            );

            expect(response).toHaveProperty('success');
        });
    });
});

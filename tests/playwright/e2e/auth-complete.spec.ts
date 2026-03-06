/**
 * SHIELD - Tests E2E Complets: Authentification
 * ============================================================================
 * Tests fonctionnels pour l'authentification SHIELD
 * ============================================================================
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, testUser } from '../helpers/test-auth';

test.describe('Authentification - Tests E2E Complets', () => {

    // ========================================================================
    // LOGIN - Tests principaux
    // ========================================================================

    test.describe('Login Flow', () => {

        test('Login reussi avec email et mot de passe valides', async ({ page }) => {
            await page.goto('/auth/login');

            // Attendre que le JS soit charge
            await page.waitForSelector('#login-form', { timeout: 10000 });

            // Remplir le formulaire
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);

            // Soumettre
            await page.locator('#btn-login').click();

            // Attendre la redirection vers /app
            await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
        });

        test('Login echoue avec mot de passe incorrect', async ({ page }) => {
            await page.goto('/auth/login');
            await page.waitForSelector('#login-form', { timeout: 10000 });

            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill('wrongpassword123');
            await page.locator('#btn-login').click();

            // Attendre le message d'erreur (alert visible)
            await expect(page.locator('#auth-alert')).toBeVisible({ timeout: 10000 });

            // Rester sur la page login
            await expect(page).toHaveURL(/auth\/login/);
        });

        test('Login echoue avec champs vides', async ({ page }) => {
            await page.goto('/auth/login');
            await page.waitForSelector('#login-form', { timeout: 10000 });

            // Cliquer sans remplir - le HTML5 validation devrait bloquer
            await page.locator('#btn-login').click();

            // Verifier que le champ email est invalide (HTML5 validation)
            const emailInvalid = await page.locator('#email').evaluate((el: HTMLInputElement) => !el.validity.valid);
            expect(emailInvalid).toBe(true);

            // On reste sur la page login
            await expect(page).toHaveURL(/auth\/login/);
        });

        test('Login - Affichage/masquage du mot de passe', async ({ page }) => {
            await page.goto('/auth/login');
            await page.waitForSelector('#login-form', { timeout: 10000 });

            const passwordField = page.locator('#password');
            const toggleButton = page.locator('.btn-toggle-password');

            // Initialement masque
            await expect(passwordField).toHaveAttribute('type', 'password');

            // Cliquer pour afficher
            await toggleButton.click();
            await expect(passwordField).toHaveAttribute('type', 'text');

            // Cliquer pour masquer
            await toggleButton.click();
            await expect(passwordField).toHaveAttribute('type', 'password');
        });

        test('Login - Remember me checkbox', async ({ page }) => {
            await page.goto('/auth/login');
            await page.waitForSelector('#login-form', { timeout: 10000 });

            const rememberCheckbox = page.locator('#remember');

            // Verifier que la checkbox existe (peut etre cachee visuellement mais dans le DOM)
            await expect(rememberCheckbox).toBeAttached();

            // Cocher via le label (car le checkbox est style custom)
            await page.locator('label:has(#remember)').click();
            await expect(rememberCheckbox).toBeChecked();
        });
    });

    // ========================================================================
    // SESSION - Persistance
    // ========================================================================

    test.describe('Session Management', () => {

        test('Session persiste apres refresh de page', async ({ page }) => {
            // Se connecter
            await page.goto('/auth/login');
            await page.waitForSelector('#login-form', { timeout: 10000 });
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 15000 });

            // Refresh
            await page.reload();

            // Toujours sur /app (pas redirige vers login)
            await expect(page).toHaveURL(/\/app/);
        });
    });

    // ========================================================================
    // API AUTH - Tests directs
    // ========================================================================

    test.describe('API Auth Endpoints', () => {

        test('POST /api/auth.php?action=login - Succes', async ({ request }) => {
            const response = await request.post(`${TEST_CONFIG.apiUrl}/auth.php?action=login`, {
                data: {
                    email: testUser.email,
                    password: testUser.password
                }
            });

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.token).toBeDefined();
            expect(data.user).toBeDefined();
            expect(data.user.email).toBe(testUser.email);
        });

        test('POST /api/auth.php?action=login - Echec credentials', async ({ request }) => {
            const response = await request.post(`${TEST_CONFIG.apiUrl}/auth.php?action=login`, {
                data: {
                    email: testUser.email,
                    password: 'wrongpassword'
                }
            });

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();
        });

        test('GET /api/auth.php?action=me - Avec token valide', async ({ request }) => {
            // D'abord obtenir un token
            const loginResponse = await request.post(`${TEST_CONFIG.apiUrl}/auth.php?action=login`, {
                data: {
                    email: testUser.email,
                    password: testUser.password
                }
            });
            const loginData = await loginResponse.json();
            const token = loginData.token;

            // Puis verifier le profil
            const response = await request.get(`${TEST_CONFIG.apiUrl}/auth.php?action=me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.user).toBeDefined();
        });

        test('GET /api/auth.php?action=me - Sans token', async ({ request }) => {
            const response = await request.get(`${TEST_CONFIG.apiUrl}/auth.php?action=me`);
            expect(response.status()).toBe(401);
        });
    });

    // ========================================================================
    // REGISTER - Tests (si la page existe)
    // ========================================================================

    test.describe('Register Flow', () => {

        test('Page register accessible', async ({ page }) => {
            await page.goto('/auth/register');
            await expect(page.locator('#register-form, form')).toBeVisible({ timeout: 10000 });
        });

        test('Lien vers login depuis register', async ({ page }) => {
            await page.goto('/auth/register');
            await page.waitForSelector('a[href*="login"]', { timeout: 10000 });
            await page.locator('a[href*="login"]').click();
            await expect(page).toHaveURL(/auth\/login/);
        });
    });
});

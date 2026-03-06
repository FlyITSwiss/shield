import { test, expect } from '@playwright/test';

/**
 * SHIELD - Tests Smoke Authentification
 * Vérifie que les pages auth se chargent correctement
 */

test.describe('Auth Pages - Smoke Tests', () => {
    test('Login page loads correctly', async ({ page }) => {
        // Naviguer vers la page login
        await page.goto('/auth/login');

        // Vérifier le titre de la page (FR: Connexion, EN: Login)
        await expect(page).toHaveTitle(/(Connexion|Login).*SHIELD/);

        // Vérifier les éléments principaux
        await expect(page.locator('.auth-container')).toBeVisible();
        await expect(page.locator('.auth-logo')).toBeVisible();
        await expect(page.locator('#login-form')).toBeVisible();

        // Vérifier les champs du formulaire
        await expect(page.locator('#email')).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.locator('#btn-login')).toBeVisible();

        // Vérifier les boutons OAuth
        await expect(page.locator('.btn-google')).toBeVisible();
        await expect(page.locator('.btn-facebook')).toBeVisible();

        // Vérifier le lien d'inscription
        await expect(page.locator('a[href*="register"]')).toBeVisible();
    });

    test('Register page loads correctly', async ({ page }) => {
        // Naviguer vers la page inscription
        await page.goto('/auth/register');

        // Vérifier le titre de la page
        await expect(page).toHaveTitle(/SHIELD/);

        // Vérifier les éléments principaux
        await expect(page.locator('.auth-container')).toBeVisible();

        // Vérifier le formulaire d'inscription
        await expect(page.locator('#register-form')).toBeVisible();
    });

    test('Health check endpoint works', async ({ request }) => {
        // Vérifier l'endpoint health
        const response = await request.get('/health');
        expect(response.ok()).toBeTruthy();
        expect(await response.text()).toBe('SHIELD OK');
    });

    test('Root redirects to login', async ({ page }) => {
        // Naviguer vers la racine
        await page.goto('/');

        // Vérifier la redirection vers login
        await expect(page).toHaveURL(/auth\/login/);
    });

    test('Login form shows validation errors', async ({ page }) => {
        await page.goto('/auth/login');

        // Cliquer sur le bouton de connexion sans remplir les champs
        await page.locator('#btn-login').click();

        // Attendre un peu pour la validation
        await page.waitForTimeout(500);

        // Vérifier que les champs sont marqués comme invalides
        const emailField = page.locator('#email');
        const isEmailInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid);
        expect(isEmailInvalid).toBeTruthy();
    });

    test('Visual appearance - Login page has gradient background', async ({ page }) => {
        await page.goto('/auth/login');

        // Vérifier que le fond gradient est présent
        await expect(page.locator('.auth-background')).toBeVisible();
        await expect(page.locator('.auth-gradient')).toBeVisible();
    });

    test('CSS loads correctly - Shield icon visible', async ({ page }) => {
        await page.goto('/auth/login');

        // Vérifier que l'icône SHIELD est visible
        const shieldIcon = page.locator('.shield-icon svg');
        await expect(shieldIcon).toBeVisible();

        // Vérifier que le CSS est chargé (via une vérification de couleur)
        const shieldPath = page.locator('.shield-icon svg path').first();
        await expect(shieldPath).toHaveAttribute('fill', 'var(--primary)');
    });
});

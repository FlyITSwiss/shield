import { test, expect } from '@playwright/test';

/**
 * SHIELD - Tests Smoke Application (pages protégées)
 * Ces tests vérifient que les pages de l'application nécessitent une authentification
 */

test.describe('App Pages - Authentication Required', () => {
    test('SOS page redirects to login when not authenticated', async ({ page }) => {
        // Naviguer vers la page SOS sans être connecté
        await page.goto('/app/sos');

        // Doit rediriger vers login
        await expect(page).toHaveURL(/auth\/login/);
    });

    test('Contacts page redirects to login when not authenticated', async ({ page }) => {
        // Naviguer vers la page contacts sans être connecté
        await page.goto('/app/contacts');

        // Doit rediriger vers login
        await expect(page).toHaveURL(/auth\/login/);
    });

    test('History page redirects to login when not authenticated', async ({ page }) => {
        // Naviguer vers la page historique sans être connecté
        await page.goto('/app/history');

        // Doit rediriger vers login
        await expect(page).toHaveURL(/auth\/login/);
    });

    test('Settings page redirects to login when not authenticated', async ({ page }) => {
        // Naviguer vers la page paramètres sans être connecté
        await page.goto('/app/settings');

        // Doit rediriger vers login
        await expect(page).toHaveURL(/auth\/login/);
    });

    test('Legacy routes redirect correctly', async ({ page }) => {
        // Test des anciennes routes
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/auth\/login/);

        await page.goto('/sos');
        await expect(page).toHaveURL(/auth\/login/);

        await page.goto('/contacts');
        await expect(page).toHaveURL(/auth\/login/);
    });
});

test.describe('Error Pages', () => {
    test('404 page displays correctly', async ({ page }) => {
        // Naviguer vers une page inexistante
        const response = await page.goto('/this-page-does-not-exist');

        // Vérifier le code 404
        expect(response?.status()).toBe(404);

        // Vérifier que le contenu d'erreur est présent
        await expect(page.locator('body')).toContainText(/404|not found/i);
    });
});

test.describe('Logout', () => {
    test('Logout endpoint redirects to login', async ({ page }) => {
        // Naviguer vers logout
        await page.goto('/logout');

        // Doit rediriger vers login
        await expect(page).toHaveURL(/auth\/login/);
    });

    test('Auth logout endpoint redirects to login', async ({ page }) => {
        // Naviguer vers auth/logout
        await page.goto('/auth/logout');

        // Doit rediriger vers login
        await expect(page).toHaveURL(/auth\/login/);
    });
});

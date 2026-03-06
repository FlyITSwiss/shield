/**
 * SHIELD - Test Authentication Helper
 * ============================================================================
 * Helper pour l'authentification dans les tests E2E
 *
 * USAGE:
 * import { authenticatedTest, testUser } from './helpers/test-auth';
 *
 * authenticatedTest('mon test', async ({ page }) => {
 *   // L'utilisateur est déjà connecté
 * });
 * ============================================================================
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// Configuration de test
export const TEST_CONFIG = {
    baseUrl: process.env.TEST_URL || 'http://127.0.0.1:8085',
    apiUrl: process.env.TEST_URL ? `${process.env.TEST_URL}/api` : 'http://127.0.0.1:8085/api',

    // Utilisateur de test (doit exister dans la BDD de test)
    testUser: {
        email: process.env.TEST_USER_EMAIL || 'test@shield-app.local',
        password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
        firstName: 'Test',
        lastName: 'User',
        phone: '+33612345678'
    },

    // Timeouts
    defaultTimeout: 10000,
    apiTimeout: 5000,
};

export const testUser = TEST_CONFIG.testUser;

// Type pour le contexte authentifié
interface AuthenticatedFixtures {
    authToken: string;
    authenticatedPage: Page;
    authenticatedContext: BrowserContext;
}

/**
 * Test avec authentification automatique
 */
export const authenticatedTest = base.extend<AuthenticatedFixtures>({
    authToken: async ({ request }, use) => {
        // Obtenir un token JWT
        const response = await request.post(`${TEST_CONFIG.apiUrl}/auth.php?action=login`, {
            data: {
                email: testUser.email,
                password: testUser.password
            }
        });

        const data = await response.json();

        if (!data.success || !data.token) {
            throw new Error(`Authentication failed: ${data.error || 'Unknown error'}`);
        }

        await use(data.token);
    },

    authenticatedPage: async ({ page, authToken }, use) => {
        // Injecter le token dans le localStorage
        await page.goto(TEST_CONFIG.baseUrl);

        await page.evaluate((token) => {
            localStorage.setItem('shield_token', token);
            localStorage.setItem('shield_user', JSON.stringify({
                email: 'test@shield-app.local',
                firstName: 'Test',
                lastName: 'User'
            }));
        }, authToken);

        await use(page);
    },

    authenticatedContext: async ({ context, authToken }, use) => {
        // Ajouter le header Authorization à toutes les requêtes
        await context.route('**/*', (route) => {
            const headers = {
                ...route.request().headers(),
                'Authorization': `Bearer ${authToken}`
            };
            route.continue({ headers });
        });

        await use(context);
    }
});

/**
 * Helper pour créer un utilisateur de test temporaire
 */
export async function createTestUser(request: any): Promise<{ email: string; password: string; token: string }> {
    const randomId = Math.random().toString(36).substring(7);
    const email = `test-${randomId}@shield-test.local`;
    const password = 'TestPassword123!';

    const response = await request.post(`${TEST_CONFIG.apiUrl}/auth.php?action=register`, {
        data: {
            email,
            password,
            password_confirm: password,
            first_name: 'Test',
            last_name: 'User',
            phone: '+33600000000'
        }
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(`Failed to create test user: ${data.error}`);
    }

    return { email, password, token: data.token };
}

/**
 * Helper pour login via API
 */
export async function apiLogin(request: any, email?: string, password?: string): Promise<string> {
    const response = await request.post(`${TEST_CONFIG.apiUrl}/auth.php?action=login`, {
        data: {
            email: email || testUser.email,
            password: password || testUser.password
        }
    });

    const data = await response.json();

    if (!data.success || !data.token) {
        throw new Error(`Login failed: ${data.error || 'Unknown error'}`);
    }

    return data.token;
}

/**
 * Helper pour faire des requêtes API authentifiées
 */
export async function authenticatedRequest(
    request: any,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    token: string,
    data?: any
): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${TEST_CONFIG.apiUrl}/${endpoint}`;

    const options: any = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (data) {
        options.data = data;
    }

    let response;
    switch (method) {
        case 'GET':
            response = await request.get(url, options);
            break;
        case 'POST':
            response = await request.post(url, options);
            break;
        case 'PUT':
            response = await request.put(url, options);
            break;
        case 'DELETE':
            response = await request.delete(url, options);
            break;
    }

    return response.json();
}

/**
 * Helper pour vérifier qu'une page est accessible uniquement authentifié
 */
export async function expectAuthRequired(page: Page, url: string): Promise<void> {
    await page.goto(url);
    await expect(page).toHaveURL(/auth\/login/);
}

/**
 * Helper pour attendre qu'un toast/notification apparaisse
 */
export async function waitForToast(page: Page, type: 'success' | 'error' | 'warning' | 'info' = 'success'): Promise<string> {
    const toast = page.locator(`.toast-${type}, .notification-${type}, [data-toast="${type}"]`);
    await expect(toast).toBeVisible({ timeout: 5000 });
    return await toast.textContent() || '';
}

/**
 * Helper pour vérifier les erreurs de validation de formulaire
 */
export async function checkFormValidation(page: Page, fieldId: string, expectedError?: string): Promise<boolean> {
    const field = page.locator(`#${fieldId}`);
    const isInvalid = await field.evaluate((el: HTMLInputElement) => !el.validity.valid);

    if (expectedError) {
        const errorMessage = page.locator(`#${fieldId}-error, [data-error-for="${fieldId}"]`);
        await expect(errorMessage).toContainText(expectedError);
    }

    return isInvalid;
}

export { expect };

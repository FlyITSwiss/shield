import { test, expect } from '@playwright/test';

/**
 * SHIELD - Tests API Endpoints
 * Vérifie que les endpoints API répondent correctement
 */

test.describe('API Endpoints - Public', () => {
    test('API auth endpoint exists and returns JSON', async ({ request }) => {
        const response = await request.get('/api/auth.php');
        // L'endpoint retourne toujours du JSON même en cas d'erreur
        const body = await response.json();
        expect(body).toHaveProperty('success');
        // Sans action spécifiée, l'API retourne une erreur
        expect(body.success).toBe(false);
    });

    test('API contacts endpoint requires authentication', async ({ request }) => {
        const response = await request.get('/api/contacts.php');
        // Devrait retourner 401 ou une erreur d'authentification
        const body = await response.json();
        expect(body.success).toBe(false);
    });

    test('API emergency endpoint exists', async ({ request }) => {
        const response = await request.get('/api/emergency.php');
        const body = await response.json();
        expect(body).toHaveProperty('success');
    });

    test('API incidents endpoint requires authentication', async ({ request }) => {
        const response = await request.get('/api/incidents.php');
        const body = await response.json();
        expect(body.success).toBe(false);
    });
});

test.describe('API Endpoints - Auth Flow', () => {
    test('Login with invalid credentials returns error', async ({ request }) => {
        const response = await request.post('/api/auth.php', {
            data: {
                action: 'login',
                email: 'invalid@test.com',
                password: 'wrongpassword'
            }
        });

        const body = await response.json();
        expect(body.success).toBe(false);
    });

    test('Register with missing fields returns error', async ({ request }) => {
        const response = await request.post('/api/auth.php', {
            data: {
                action: 'register',
                email: 'test@test.com'
                // Missing password and other fields
            }
        });

        const body = await response.json();
        expect(body.success).toBe(false);
    });
});

test.describe('API Endpoints - CORS', () => {
    test('API allows CORS preflight requests', async ({ request }) => {
        const response = await request.fetch('/api/auth.php', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        // OPTIONS should return 200 or 204
        expect([200, 204]).toContain(response.status());
    });
});

test.describe('API Endpoints - AI Agent', () => {
    test('AI Agent status endpoint returns service info', async ({ request }) => {
        const response = await request.get('/api/ai-agent.php?action=status');
        const body = await response.json();

        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('enabled');
        expect(body).toHaveProperty('features');
    });

    test('AI Agent intro endpoint returns message', async ({ request }) => {
        const response = await request.get('/api/ai-agent.php?action=intro&language=fr');
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body).toHaveProperty('message');
        expect(body.language).toBe('fr');
    });

    test('AI Agent session creation requires auth', async ({ request }) => {
        const response = await request.post('/api/ai-agent.php?action=create-session', {
            data: { incident_id: 'test-123' }
        });
        const body = await response.json();

        expect(body.success).toBe(false);
    });
});

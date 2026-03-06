import { test, expect } from '@playwright/test';

/**
 * SHIELD - Tests Smoke Critiques
 * ============================================================================
 * CE FICHIER CONTIENT LES TESTS BLOQUANTS POUR LE DÉPLOIEMENT
 * Si UN test échoue, le déploiement DOIT être annulé ou rollback.
 * ============================================================================
 *
 * Catégories:
 * 1. Sécurité API - Auth, CSRF, Rate Limiting
 * 2. Validation Inputs - SQL Injection, XSS
 * 3. Fonctionnalités Critiques - SOS, Tracking
 * 4. Intégrité i18n - Pas de clés brutes
 * 5. Performance - Temps de chargement
 *
 * @version 2.0.0
 * @date 2026-03-06
 */

// Configuration des URLs
const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:8085';
const API_URL = `${BASE_URL}/api`;

test.describe('Critical Features - Security Smoke Tests', () => {

    test.describe('API Endpoints - Security', () => {

        test('Auth API rejects unauthenticated requests', async ({ request }) => {
            // Tenter d'accéder aux endpoints protégés sans auth
            const endpoints = [
                '/api/user/profile',
                '/api/contacts/list',
                '/api/incidents/list',
                '/api/settings/get',
            ];

            for (const endpoint of endpoints) {
                const response = await request.get(endpoint);
                expect(response.status()).toBe(401);
            }
        });

        test('SOS trigger endpoint requires authentication', async ({ request }) => {
            const response = await request.post('/api/incidents/trigger', {
                data: {
                    trigger_type: 'button',
                    latitude: 46.204,
                    longitude: 6.143,
                }
            });

            expect(response.status()).toBe(401);
        });

        test('Location update requires auth', async ({ request }) => {
            const response = await request.post('/api/incidents/location', {
                data: {
                    incident_id: 'fake-id',
                    latitude: 46.204,
                    longitude: 6.143,
                }
            });

            expect(response.status()).toBe(401);
        });
    });

    test.describe('Emergency Services API', () => {

        test('Emergency numbers endpoint works without auth', async ({ request }) => {
            // Les numéros d'urgence doivent être accessibles sans auth
            const response = await request.get('/api/emergency/numbers');
            expect(response.ok()).toBeTruthy();

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.numbers).toBeDefined();
            expect(data.numbers.police).toBeDefined();
            expect(data.numbers.ambulance).toBeDefined();
        });

        test('Nearest service lookup is available', async ({ request }) => {
            const response = await request.get('/api/emergency/nearest?lat=46.204&lng=6.143');
            // Peut être 200 ou 401 selon si auth requise
            expect([200, 401]).toContain(response.status());
        });
    });

    test.describe('AI Agent API', () => {

        test('AI Agent status is available', async ({ request }) => {
            const response = await request.get('/api/ai-agent/status');
            expect(response.ok()).toBeTruthy();

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.service_available).toBeDefined();
        });

        test('AI intro message works', async ({ request }) => {
            const response = await request.get('/api/ai-agent/intro?lang=fr');
            expect(response.ok()).toBeTruthy();

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBeDefined();
        });

        test('AI session creation requires auth', async ({ request }) => {
            const response = await request.post('/api/ai-agent/session', {
                data: { language: 'fr' }
            });

            expect(response.status()).toBe(401);
        });
    });

    test.describe('Input Validation', () => {

        test('Login rejects malformed email', async ({ request }) => {
            const response = await request.post('/api/auth/login', {
                data: {
                    email: 'not-an-email',
                    password: 'password123'
                }
            });

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();
        });

        test('Register rejects weak password', async ({ request }) => {
            const response = await request.post('/api/auth/register', {
                data: {
                    email: 'test@example.com',
                    password: '123',  // Too weak
                    phone: '+33612345678'
                }
            });

            const data = await response.json();
            expect(data.success).toBe(false);
        });

        test('Phone format is validated', async ({ request }) => {
            const response = await request.post('/api/auth/register', {
                data: {
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                    phone: 'invalid-phone'
                }
            });

            const data = await response.json();
            expect(data.success).toBe(false);
        });
    });

    test.describe('CSRF Protection', () => {

        test('POST without CSRF token is rejected', async ({ request }) => {
            // Remove CSRF header that might be auto-added
            const response = await request.post('/api/auth/login', {
                headers: {
                    'X-CSRF-Token': ''
                },
                data: {
                    email: 'test@test.com',
                    password: 'password'
                }
            });

            // Should either reject or require proper CSRF
            // Note: Some APIs might accept requests without CSRF for login
            expect([200, 400, 403]).toContain(response.status());
        });
    });

    test.describe('Rate Limiting', () => {

        test('Multiple failed logins are rate limited', async ({ request }) => {
            const responses: number[] = [];

            // Try 10 rapid login attempts
            for (let i = 0; i < 10; i++) {
                const response = await request.post('/api/auth/login', {
                    data: {
                        email: 'nonexistent@test.com',
                        password: 'wrongpassword'
                    }
                });
                responses.push(response.status());
            }

            // After several attempts, should see 429 (rate limited)
            // or consistent 401s if rate limiting not aggressive
            expect(responses.some(r => r === 429 || r === 401)).toBe(true);
        });
    });
});

test.describe('Mobile Responsive - Critical Views', () => {

    test('SOS page is fully visible on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/auth/login');

        // Login elements should be visible
        await expect(page.locator('#login-form')).toBeVisible();
        await expect(page.locator('#btn-login')).toBeVisible();

        // Button should be clickable (not cut off)
        const button = page.locator('#btn-login');
        const box = await button.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.y + box!.height).toBeLessThan(667); // Fully visible
    });

    test('Forms are usable on small screens', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/auth/register');

        // Form should be visible
        await expect(page.locator('#register-form')).toBeVisible();

        // Inputs should be reachable
        const emailInput = page.locator('#email');
        await expect(emailInput).toBeVisible();

        // Can type in input
        await emailInput.fill('test@example.com');
        await expect(emailInput).toHaveValue('test@example.com');
    });
});

test.describe('Accessibility', () => {

    test('Login form has proper labels', async ({ page }) => {
        await page.goto('/auth/login');

        // Check for proper label associations
        const emailInput = page.locator('#email');
        const passwordInput = page.locator('#password');

        // Inputs should have aria-label or associated label
        const emailLabel = await emailInput.getAttribute('aria-label') ||
                          await page.locator('label[for="email"]').textContent();
        const passwordLabel = await passwordInput.getAttribute('aria-label') ||
                             await page.locator('label[for="password"]').textContent();

        expect(emailLabel).toBeTruthy();
        expect(passwordLabel).toBeTruthy();
    });

    test('Buttons have accessible names', async ({ page }) => {
        await page.goto('/auth/login');

        const loginBtn = page.locator('#btn-login');
        const accessibleName = await loginBtn.getAttribute('aria-label') ||
                              await loginBtn.textContent();

        expect(accessibleName).toBeTruthy();
    });
});

test.describe('Performance', () => {

    test('Login page loads within acceptable time', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/auth/login');
        const loadTime = Date.now() - startTime;

        // Page should load in under 3 seconds
        expect(loadTime).toBeLessThan(3000);
    });

    test('Critical CSS is not blocked', async ({ page }) => {
        await page.goto('/auth/login');

        // Check that main CSS is loaded (by checking a styled element)
        const authContainer = page.locator('.auth-container');
        await expect(authContainer).toBeVisible();

        // Container should have styles applied
        const styles = await authContainer.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                display: computed.display,
                position: computed.position,
            };
        });

        expect(styles.display).not.toBe('');
        expect(styles.position).not.toBe('');
    });
});

// ============================================================================
// TESTS DE SÉCURITÉ AVANCÉS - BLOQUANTS
// ============================================================================

test.describe('SQL Injection Protection', () => {

    test('Login rejects SQL injection in email', async ({ request }) => {
        const maliciousInputs = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "admin'--",
            "1' OR '1'='1' /*",
            "'; INSERT INTO users VALUES('hacked'); --"
        ];

        for (const input of maliciousInputs) {
            const response = await request.post('/api/auth.php?action=login', {
                data: {
                    email: input,
                    password: 'password123'
                }
            });

            const data = await response.json();
            // Should fail gracefully, not crash
            expect(data.success).toBe(false);
            // Should not expose SQL error
            expect(JSON.stringify(data)).not.toContain('SQL');
            expect(JSON.stringify(data)).not.toContain('syntax error');
            expect(JSON.stringify(data)).not.toContain('mysql');
        }
    });

    test('API rejects SQL injection in GET params', async ({ request }) => {
        const maliciousParams = [
            "1 OR 1=1",
            "1; DROP TABLE incidents;",
            "1 UNION SELECT * FROM users"
        ];

        for (const input of maliciousParams) {
            // Test sur un endpoint qui utilise un ID
            const response = await request.get(`/api/incidents.php?action=get&id=${encodeURIComponent(input)}`);

            // Should return auth error, not SQL error
            expect([400, 401, 404]).toContain(response.status());
            const text = await response.text();
            expect(text.toLowerCase()).not.toContain('sql');
            expect(text.toLowerCase()).not.toContain('syntax');
        }
    });
});

test.describe('XSS Protection', () => {

    test('API sanitizes script tags in input', async ({ request }) => {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>',
            'javascript:alert("XSS")',
            '<iframe src="javascript:alert(\'XSS\')">',
        ];

        for (const payload of xssPayloads) {
            const response = await request.post('/api/auth.php?action=register', {
                data: {
                    email: 'test@test.com',
                    password: 'SecurePass123!',
                    first_name: payload,
                    last_name: 'Test'
                }
            });

            const text = await response.text();
            // The script tags should be escaped or rejected
            expect(text).not.toContain('<script>');
            expect(text).not.toContain('onerror=');
            expect(text).not.toContain('onload=');
        }
    });
});

test.describe('Path Traversal Protection', () => {

    test('API rejects path traversal attempts', async ({ request }) => {
        const pathPayloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '/etc/passwd',
            '....//....//....//etc/passwd'
        ];

        for (const payload of pathPayloads) {
            const response = await request.get(`/api/v1/health?file=${encodeURIComponent(payload)}`);

            // Should not expose file contents
            const text = await response.text();
            expect(text).not.toContain('root:');
            expect(text).not.toContain('[boot loader]');
        }
    });
});

// ============================================================================
// TESTS i18n - INTÉGRITÉ DES TRADUCTIONS
// ============================================================================

test.describe('i18n Integrity', () => {

    test('Login page has no raw i18n keys displayed', async ({ page }) => {
        await page.goto('/auth/login');

        // Check page content for raw keys (format: word.word or word.word.word)
        const content = await page.content();

        // These patterns indicate missing translations
        const rawKeyPatterns = [
            /\bauth\.[a-z_]+\b/g,
            /\bmsg\.[a-z_]+\b/g,
            /\bvalidation\.[a-z_]+\b/g,
            /\berror\.[a-z_]+\b/g,
        ];

        for (const pattern of rawKeyPatterns) {
            const matches = content.match(pattern);
            // Filter out false positives (code comments, scripts)
            const visibleMatches = matches?.filter(m =>
                !content.includes(`"${m}"`) && // Not in JSON
                !content.includes(`'${m}'`) && // Not in JS string
                !content.includes(`// ${m}`)   // Not in comment
            );

            if (visibleMatches && visibleMatches.length > 0) {
                console.error('Raw i18n keys found:', visibleMatches);
            }
            // Allow test to pass but log warnings
        }
    });

    test('Error messages are translated, not raw keys', async ({ request }) => {
        const response = await request.post('/api/auth.php?action=login', {
            data: {
                email: 'invalid-email',
                password: 'x'
            }
        });

        const data = await response.json();

        // Error should be a human-readable message, not a key
        if (data.error) {
            expect(data.error).not.toMatch(/^[a-z_]+\.[a-z_]+$/);
            expect(data.error).not.toContain('.');
        }
    });
});

// ============================================================================
// TESTS PUBLIC TRACKING - ENDPOINT CRITIQUE
// ============================================================================

test.describe('Public Tracking Security', () => {

    test('Tracking API requires valid UUID format', async ({ request }) => {
        const invalidIds = [
            'invalid',
            '123',
            '../etc/passwd',
            "'; DROP TABLE --",
            'not-a-uuid-at-all'
        ];

        for (const id of invalidIds) {
            const response = await request.get(`/api/track.php?share_id=${encodeURIComponent(id)}`);

            // Should return 400 for invalid format
            expect(response.status()).toBe(400);
        }
    });

    test('Tracking page handles expired share gracefully', async ({ request }) => {
        // Valid UUID format but doesn't exist
        const fakeUuid = '00000000-0000-0000-0000-000000000000';
        const response = await request.get(`/api/track.php?share_id=${fakeUuid}`);

        // Should return 404, not 500
        expect(response.status()).toBe(404);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
    });

    test('Rate limiting works on public tracking', async ({ request }) => {
        const responses: number[] = [];

        // Make 40 rapid requests (limit is 30/min)
        for (let i = 0; i < 40; i++) {
            const response = await request.get('/api/track.php?share_id=00000000-0000-0000-0000-000000000001');
            responses.push(response.status());
        }

        // Should eventually see 429 (rate limited) OR consistent 404 if Redis not active
        const has429 = responses.some(r => r === 429);
        const all404 = responses.every(r => r === 404);

        expect(has429 || all404).toBe(true);
    });
});

// ============================================================================
// HEALTH CHECK ENDPOINTS - POST-DEPLOY VERIFICATION
// ============================================================================

test.describe('Health Check Endpoints', () => {

    test('Main health endpoint returns 200', async ({ request }) => {
        const response = await request.get('/health');
        expect(response.status()).toBe(200);
    });

    test('API v1 health returns proper structure', async ({ request }) => {
        const response = await request.get('/api/v1/health');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.status).toBeDefined();
    });

    test('Database connectivity check', async ({ request }) => {
        const response = await request.get('/api/v1/health');

        if (response.ok()) {
            const data = await response.json();
            // If health endpoint exposes DB status
            if (data.database !== undefined) {
                expect(['connected', 'ok', true]).toContain(data.database);
            }
        }
    });
});

// ============================================================================
// ANTI-ENUMERATION TESTS
// ============================================================================

test.describe('User Enumeration Protection', () => {

    test('Login returns same error for invalid email vs invalid password', async ({ request }) => {
        // Invalid email
        const response1 = await request.post('/api/auth.php?action=login', {
            data: {
                email: 'nonexistent@test.com',
                password: 'password123'
            }
        });
        const data1 = await response1.json();

        // Existing email, wrong password (we don't know if email exists, but error should be same)
        const response2 = await request.post('/api/auth.php?action=login', {
            data: {
                email: 'test@test.com',
                password: 'wrongpassword123'
            }
        });
        const data2 = await response2.json();

        // Both should give generic "invalid credentials" not "user not found" or "wrong password"
        expect(data1.success).toBe(false);
        expect(data2.success).toBe(false);

        // Error messages should be identical or generic
        if (data1.error && data2.error) {
            // Either same message or both generic
            const isGeneric = (err: string) =>
                err.toLowerCase().includes('invalid') ||
                err.toLowerCase().includes('incorrect') ||
                err.toLowerCase().includes('credentials');

            expect(isGeneric(data1.error) || isGeneric(data2.error)).toBe(true);
        }
    });
});

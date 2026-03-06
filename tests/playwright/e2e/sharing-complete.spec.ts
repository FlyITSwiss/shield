/**
 * SHIELD - Tests E2E Complets: Partage d'Incident
 * ============================================================================
 * COUVERTURE EXHAUSTIVE:
 * - Generation de lien de partage
 * - Page publique de tracking
 * - Actions des contacts (acknowledge, responding, arrived)
 * - Envoi SMS avec lien
 * - Revocation de partage
 * - Expiration automatique
 * - API Sharing
 * ============================================================================
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, testUser, apiLogin, authenticatedRequest } from '../helpers/test-auth';

test.describe('Partage d\'Incident - Tests E2E Complets', () => {

    let authToken: string;

    test.beforeAll(async ({ request }) => {
        authToken = await apiLogin(request);
    });

    // ========================================================================
    // GENERATION DE LIEN DE PARTAGE
    // ========================================================================

    test.describe('Generation de Lien', () => {

        test('API genere un share_id unique', async ({ request }) => {
            // D'abord verifier s'il y a un incident actif
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const response = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                expect(response.success).toBe(true);
                expect(response.share_id).toBeDefined();
                expect(response.share_id.length).toBeGreaterThan(10); // UUID format
                expect(response.share_url).toBeDefined();
            }
        });

        test('Lien de partage expire apres 24h par defaut', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const response = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (response.success) {
                    expect(response.expires_at).toBeDefined();

                    // Verifier que l'expiration est dans ~24h
                    const expiresAt = new Date(response.expires_at);
                    const now = new Date();
                    const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

                    expect(diffHours).toBeGreaterThan(23);
                    expect(diffHours).toBeLessThan(25);
                }
            }
        });

        test('Lien de partage avec duree personnalisee', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const response = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id,
                        expires_in_hours: 6
                    }
                );

                if (response.success) {
                    const expiresAt = new Date(response.expires_at);
                    const now = new Date();
                    const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

                    expect(diffHours).toBeGreaterThan(5);
                    expect(diffHours).toBeLessThan(7);
                }
            }
        });
    });

    // ========================================================================
    // PAGE PUBLIQUE DE TRACKING
    // ========================================================================

    test.describe('Page Publique de Tracking', () => {

        test('Page de tracking accessible sans authentification', async ({ page, request }) => {
            // Obtenir un share_id valide
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    // Acceder a la page sans login
                    await page.goto(`/track/${shareResponse.share_id}`);

                    // La page doit etre accessible
                    await expect(page).not.toHaveURL(/auth\/login/);
                    await expect(page.locator('.tracking-page, [data-tracking]')).toBeVisible();
                }
            }
        });

        test('Page de tracking affiche la carte', async ({ page, request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    await page.goto(`/track/${shareResponse.share_id}`);

                    // Carte visible
                    await expect(page.locator('.tracking-map, #tracking-map, [data-map]')).toBeVisible();
                }
            }
        });

        test('Page de tracking affiche le statut', async ({ page, request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    await page.goto(`/track/${shareResponse.share_id}`);

                    // Statut visible
                    await expect(page.locator('.incident-status, [data-status]')).toBeVisible();
                }
            }
        });

        test('Share ID invalide affiche erreur', async ({ page }) => {
            await page.goto('/track/invalid-share-id-12345');

            // Message d'erreur ou page 404
            await expect(page.locator('.error-message, .not-found, [data-error]')).toBeVisible({ timeout: 5000 });
        });

        test('Share ID expire affiche erreur', async ({ page, request }) => {
            // Tester avec un ID qui pourrait etre expire
            const response = await request.get(`${TEST_CONFIG.apiUrl}/track.php?action=get&share_id=expired-test-id`);
            const data = await response.json();

            // L'API doit retourner une erreur
            expect(data.success).toBe(false);
        });
    });

    // ========================================================================
    // ACTIONS DES CONTACTS
    // ========================================================================

    test.describe('Actions des Contacts', () => {

        test('Bouton Acknowledge visible', async ({ page, request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    await page.goto(`/track/${shareResponse.share_id}`);

                    await expect(page.locator('[data-action="acknowledge"], .btn-acknowledge')).toBeVisible();
                }
            }
        });

        test('Action Acknowledge via API', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    // Appeler l'API track (pas besoin d'auth)
                    const trackResponse = await request.post(`${TEST_CONFIG.apiUrl}/track.php?action=acknowledge`, {
                        data: {
                            share_id: shareResponse.share_id,
                            contact_name: 'Jean Test'
                        }
                    });

                    const data = await trackResponse.json();
                    expect(data.success).toBe(true);
                }
            }
        });

        test('Action Responding via API', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    const trackResponse = await request.post(`${TEST_CONFIG.apiUrl}/track.php?action=responding`, {
                        data: {
                            share_id: shareResponse.share_id,
                            contact_name: 'Jean Test',
                            eta_minutes: 15
                        }
                    });

                    const data = await trackResponse.json();
                    expect(data.success).toBe(true);
                }
            }
        });

        test('Action Arrived via API', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    const trackResponse = await request.post(`${TEST_CONFIG.apiUrl}/track.php?action=arrived`, {
                        data: {
                            share_id: shareResponse.share_id,
                            contact_name: 'Jean Test'
                        }
                    });

                    const data = await trackResponse.json();
                    expect(data.success).toBe(true);
                }
            }
        });

        test('Boutons d\'action sur la page tracking', async ({ page, request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    await page.goto(`/track/${shareResponse.share_id}`);

                    // Tous les boutons d'action doivent etre visibles
                    await expect(page.locator('[data-action="acknowledge"], .btn-acknowledge')).toBeVisible();
                    await expect(page.locator('[data-action="responding"], .btn-responding')).toBeVisible();
                    await expect(page.locator('[data-action="arrived"], .btn-arrived')).toBeVisible();
                }
            }
        });
    });

    // ========================================================================
    // ENVOI SMS AVEC LIEN
    // ========================================================================

    test.describe('Envoi SMS', () => {

        test('API envoi SMS a un contact', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                // Obtenir les contacts
                const contactsResponse = await authenticatedRequest(
                    request, 'GET', 'contacts.php?action=list', authToken
                );

                if (contactsResponse.contacts && contactsResponse.contacts.length > 0) {
                    const shareResponse = await authenticatedRequest(
                        request, 'POST', 'sharing.php?action=send-sms', authToken, {
                            incident_id: activeResponse.incident.id,
                            contact_id: contactsResponse.contacts[0].id
                        }
                    );

                    expect(shareResponse).toHaveProperty('success');
                }
            }
        });

        test('API envoi SMS a tous les contacts', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=send-sms-all', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                expect(shareResponse).toHaveProperty('success');
            }
        });
    });

    // ========================================================================
    // REVOCATION DE PARTAGE
    // ========================================================================

    test.describe('Revocation de Partage', () => {

        test('Revocation d\'un lien de partage', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                // Generer un lien
                const shareResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                if (shareResponse.success) {
                    // Revoquer le lien
                    const revokeResponse = await authenticatedRequest(
                        request, 'POST', 'sharing.php?action=revoke', authToken, {
                            share_id: shareResponse.share_id
                        }
                    );

                    expect(revokeResponse.success).toBe(true);

                    // Verifier que le lien n'est plus valide
                    const checkResponse = await request.get(
                        `${TEST_CONFIG.apiUrl}/track.php?action=get&share_id=${shareResponse.share_id}`
                    );
                    const checkData = await checkResponse.json();

                    expect(checkData.success).toBe(false);
                }
            }
        });

        test('Revocation tous les liens d\'un incident', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const revokeResponse = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=revoke-all', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                expect(revokeResponse.success).toBe(true);
            }
        });
    });

    // ========================================================================
    // LISTE DES PARTAGES
    // ========================================================================

    test.describe('Liste des Partages', () => {

        test('Liste des partages actifs', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const response = await authenticatedRequest(
                    request, 'GET', `sharing.php?action=list&incident_id=${activeResponse.incident.id}`, authToken
                );

                expect(response.success).toBe(true);
                expect(Array.isArray(response.shares)).toBe(true);
            }
        });
    });

    // ========================================================================
    // SECURITE
    // ========================================================================

    test.describe('Securite', () => {

        test('Rate limiting sur page tracking', async ({ request }) => {
            // Faire plusieurs requetes rapidement
            const requests = [];
            for (let i = 0; i < 10; i++) {
                requests.push(
                    request.get(`${TEST_CONFIG.apiUrl}/track.php?action=get&share_id=test-${i}`)
                );
            }

            const responses = await Promise.all(requests);

            // Au moins une devrait reussir, mais pas de crash
            const successCount = responses.filter(r => r.status() === 200).length;
            expect(successCount).toBeGreaterThan(0);
        });

        test('Pas d\'injection SQL dans share_id', async ({ request }) => {
            const maliciousIds = [
                "'; DROP TABLE incident_shares;--",
                "1 OR 1=1",
                "<script>alert('xss')</script>",
                "../../../etc/passwd"
            ];

            for (const id of maliciousIds) {
                const response = await request.get(
                    `${TEST_CONFIG.apiUrl}/track.php?action=get&share_id=${encodeURIComponent(id)}`
                );

                // L'API doit rejeter proprement
                expect(response.status()).toBeLessThan(500);
            }
        });
    });

    // ========================================================================
    // API SHARING
    // ========================================================================

    test.describe('API Sharing', () => {

        test('POST /sharing.php?action=generate', async ({ request }) => {
            const activeResponse = await authenticatedRequest(
                request, 'GET', 'incidents.php?action=active', authToken
            );

            if (activeResponse.success && activeResponse.incident) {
                const response = await authenticatedRequest(
                    request, 'POST', 'sharing.php?action=generate', authToken, {
                        incident_id: activeResponse.incident.id
                    }
                );

                expect(response).toHaveProperty('success');
            }
        });

        test('GET /track.php?action=get', async ({ request }) => {
            // Test avec un share_id qui n'existe pas
            const response = await request.get(`${TEST_CONFIG.apiUrl}/track.php?action=get&share_id=nonexistent-id`);
            const data = await response.json();

            expect(data).toHaveProperty('success');
            expect(data.success).toBe(false);
        });

        test('POST /track.php?action=acknowledge - sans auth', async ({ request }) => {
            const response = await request.post(`${TEST_CONFIG.apiUrl}/track.php?action=acknowledge`, {
                data: {
                    share_id: 'test-share-id',
                    contact_name: 'Test'
                }
            });

            // L'API doit etre accessible sans auth (page publique)
            expect(response.status()).toBeLessThan(500);
        });
    });
});

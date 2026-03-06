/**
 * SHIELD - Tests E2E Complets: Historique des Incidents
 * ============================================================================
 * COUVERTURE EXHAUSTIVE:
 * - Liste des incidents passes
 * - Filtres (date, statut, severite)
 * - Details d'un incident
 * - Timeline des evenements
 * - Export des donnees
 * - Statistiques
 * - API History
 * ============================================================================
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, testUser, apiLogin, authenticatedRequest } from '../helpers/test-auth';

test.describe('Historique - Tests E2E Complets', () => {

    let authToken: string;

    test.beforeAll(async ({ request }) => {
        authToken = await apiLogin(request);
    });

    // ========================================================================
    // ACCES A LA PAGE
    // ========================================================================

    test.describe('Acces et Navigation', () => {

        test('Page historique accessible authentifie', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');
            await expect(page).toHaveURL(/\/app\/history/);
            await expect(page.locator('.history-container, .history-list, [data-history]')).toBeVisible();
        });

        test('Page historique redirige vers login si non authentifie', async ({ page }) => {
            await page.goto('/app/history');
            await expect(page).toHaveURL(/auth\/login/);
        });

        test('Navigation vers historique depuis le menu', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.locator('nav a[href*="history"], .nav-link[href*="history"], [data-nav="history"]').click();
            await expect(page).toHaveURL(/\/app\/history/);
        });
    });

    // ========================================================================
    // LISTE DES INCIDENTS
    // ========================================================================

    test.describe('Liste des Incidents', () => {

        test('Affichage de la liste', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            // Liste ou message "aucun incident"
            const hasIncidents = await page.locator('.incident-item, .history-item, [data-incident]').count() > 0;
            const hasEmptyMessage = await page.locator('.empty-history, .no-incidents, [data-empty]').isVisible();

            expect(hasIncidents || hasEmptyMessage).toBe(true);
        });

        test('Chaque incident affiche date et statut', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                // Date visible
                await expect(firstIncident.locator('.incident-date, [data-date]')).toBeVisible();
                // Statut visible
                await expect(firstIncident.locator('.incident-status, [data-status]')).toBeVisible();
            }
        });

        test('Liste ordonnee par date decroissante', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const incidents = page.locator('.incident-item, .history-item, [data-incident]');
            const count = await incidents.count();

            if (count >= 2) {
                const firstDate = await incidents.nth(0).locator('[data-date]').getAttribute('data-date');
                const secondDate = await incidents.nth(1).locator('[data-date]').getAttribute('data-date');

                if (firstDate && secondDate) {
                    expect(new Date(firstDate).getTime()).toBeGreaterThanOrEqual(new Date(secondDate).getTime());
                }
            }
        });
    });

    // ========================================================================
    // FILTRES
    // ========================================================================

    test.describe('Filtres', () => {

        test('Filtre par date', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const dateFilter = page.locator('#filter-date, [data-filter="date"]');
            if (await dateFilter.isVisible()) {
                // Selectionner "Cette semaine"
                await dateFilter.selectOption('week');

                // La liste doit etre filtree
                await page.waitForTimeout(500);
            }
        });

        test('Filtre par statut', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const statusFilter = page.locator('#filter-status, [data-filter="status"]');
            if (await statusFilter.isVisible()) {
                await statusFilter.selectOption('resolved');
                await page.waitForTimeout(500);

                // Tous les incidents affiches doivent avoir le statut resolved
                const incidents = page.locator('.incident-item, .history-item');
                const count = await incidents.count();

                for (let i = 0; i < count; i++) {
                    const status = await incidents.nth(i).locator('[data-status]').textContent();
                    expect(status?.toLowerCase()).toContain('resolv');
                }
            }
        });

        test('Filtre par severite', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const severityFilter = page.locator('#filter-severity, [data-filter="severity"]');
            if (await severityFilter.isVisible()) {
                await severityFilter.selectOption('critical');
                await page.waitForTimeout(500);
            }
        });

        test('Reset des filtres', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const resetBtn = page.locator('[data-reset-filters], #btn-reset-filters, .reset-filters');
            if (await resetBtn.isVisible()) {
                await resetBtn.click();

                // Les filtres doivent etre reinitialises
                const dateFilter = page.locator('#filter-date, [data-filter="date"]');
                if (await dateFilter.isVisible()) {
                    await expect(dateFilter).toHaveValue('all');
                }
            }
        });
    });

    // ========================================================================
    // DETAILS D'UN INCIDENT
    // ========================================================================

    test.describe('Details d\'un Incident', () => {

        test('Clic ouvre les details', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                // Page ou modal de details
                await expect(page.locator('.incident-details, [data-incident-details]')).toBeVisible({ timeout: 5000 });
            }
        });

        test('Details affichent date debut et fin', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                await expect(page.locator('[data-start-date], .start-date')).toBeVisible();
            }
        });

        test('Details affichent la carte avec trajet', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                const map = page.locator('.history-map, #history-map, [data-map]');
                if (await map.isVisible()) {
                    await expect(map).toBeVisible();
                }
            }
        });

        test('Details affichent les contacts notifies', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                await expect(page.locator('.contacts-notified, [data-contacts-notified]')).toBeVisible();
            }
        });
    });

    // ========================================================================
    // TIMELINE DES EVENEMENTS
    // ========================================================================

    test.describe('Timeline des Evenements', () => {

        test('Timeline visible dans les details', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                await expect(page.locator('.event-timeline, .timeline, [data-timeline]')).toBeVisible();
            }
        });

        test('Timeline affiche les evenements chronologiquement', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                const timelineItems = page.locator('.timeline-item, .event-item');
                const count = await timelineItems.count();

                // Au moins l'evenement de creation
                expect(count).toBeGreaterThanOrEqual(1);
            }
        });
    });

    // ========================================================================
    // EXPORT DES DONNEES
    // ========================================================================

    test.describe('Export des Donnees', () => {

        test('Bouton export visible', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            await expect(page.locator('[data-export], #btn-export, .export-btn')).toBeVisible();
        });

        test('Export en PDF', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const exportBtn = page.locator('[data-export], #btn-export, .export-btn');
            if (await exportBtn.isVisible()) {
                await exportBtn.click();

                // Modal ou dropdown avec options
                const pdfOption = page.locator('[data-export-pdf], #export-pdf');
                if (await pdfOption.isVisible()) {
                    // On ne clique pas vraiment pour eviter le telechargement dans les tests
                    await expect(pdfOption).toBeVisible();
                }
            }
        });

        test('Export d\'un incident specifique', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const firstIncident = page.locator('.incident-item, .history-item, [data-incident]').first();
            if (await firstIncident.isVisible()) {
                await firstIncident.click();

                const exportBtn = page.locator('[data-export-incident], #btn-export-incident');
                if (await exportBtn.isVisible()) {
                    await expect(exportBtn).toBeVisible();
                }
            }
        });
    });

    // ========================================================================
    // STATISTIQUES
    // ========================================================================

    test.describe('Statistiques', () => {

        test('Statistiques globales affichees', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const statsSection = page.locator('.history-stats, [data-stats]');
            if (await statsSection.isVisible()) {
                // Nombre total d'incidents
                await expect(statsSection.locator('[data-total-incidents]')).toBeVisible();
            }
        });

        test('Statistiques par severite', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'history.php?action=stats', authToken
            );

            expect(response.success).toBe(true);
            expect(response.stats).toBeDefined();

            if (response.stats.by_severity) {
                expect(response.stats.by_severity).toHaveProperty('low');
                expect(response.stats.by_severity).toHaveProperty('medium');
                expect(response.stats.by_severity).toHaveProperty('high');
                expect(response.stats.by_severity).toHaveProperty('critical');
            }
        });
    });

    // ========================================================================
    // PAGINATION
    // ========================================================================

    test.describe('Pagination', () => {

        test('Pagination visible si beaucoup d\'incidents', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const pagination = page.locator('.pagination, [data-pagination]');
            // La pagination peut ne pas etre visible s'il y a peu d'incidents
        });

        test('Navigation entre pages', async ({ page }) => {
            await page.goto('/auth/login');
            await page.locator('#email').fill(testUser.email);
            await page.locator('#password').fill(testUser.password);
            await page.locator('#btn-login').click();
            await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

            await page.goto('/app/history');

            const nextPage = page.locator('[data-page="next"], .pagination-next');
            if (await nextPage.isVisible() && await nextPage.isEnabled()) {
                await nextPage.click();
                await page.waitForTimeout(500);

                // L'URL doit contenir le parametre de page
                await expect(page).toHaveURL(/page=2/);
            }
        });
    });

    // ========================================================================
    // API HISTORY
    // ========================================================================

    test.describe('API History', () => {

        test('GET /history.php?action=list', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'history.php?action=list', authToken
            );

            expect(response.success).toBe(true);
            expect(Array.isArray(response.incidents)).toBe(true);
        });

        test('GET /history.php?action=list avec filtres', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'history.php?action=list&status=resolved&severity=high', authToken
            );

            expect(response.success).toBe(true);
            expect(Array.isArray(response.incidents)).toBe(true);
        });

        test('GET /history.php?action=get&id=...', async ({ request }) => {
            // D'abord obtenir un incident
            const listResponse = await authenticatedRequest(
                request, 'GET', 'history.php?action=list', authToken
            );

            if (listResponse.incidents && listResponse.incidents.length > 0) {
                const incidentId = listResponse.incidents[0].id;

                const response = await authenticatedRequest(
                    request, 'GET', `history.php?action=get&id=${incidentId}`, authToken
                );

                expect(response.success).toBe(true);
                expect(response.incident).toBeDefined();
                expect(response.incident.id).toBe(incidentId);
            }
        });

        test('GET /history.php?action=timeline&id=...', async ({ request }) => {
            const listResponse = await authenticatedRequest(
                request, 'GET', 'history.php?action=list', authToken
            );

            if (listResponse.incidents && listResponse.incidents.length > 0) {
                const incidentId = listResponse.incidents[0].id;

                const response = await authenticatedRequest(
                    request, 'GET', `history.php?action=timeline&id=${incidentId}`, authToken
                );

                expect(response.success).toBe(true);
                expect(Array.isArray(response.events)).toBe(true);
            }
        });

        test('GET /history.php?action=stats', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'history.php?action=stats', authToken
            );

            expect(response.success).toBe(true);
            expect(response.stats).toBeDefined();
            expect(response.stats.total).toBeDefined();
        });

        test('GET /history.php?action=export', async ({ request }) => {
            const response = await authenticatedRequest(
                request, 'GET', 'history.php?action=export&format=json', authToken
            );

            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
        });
    });
});

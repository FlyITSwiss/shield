import { defineConfig, devices } from '@playwright/test';

/**
 * SHIELD - Configuration Playwright
 * Tests E2E mobile-first pour application de securite feminine
 */
export default defineConfig({
    testDir: './tests/playwright',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list']
    ],
    use: {
        // IMPORTANT: Toujours 127.0.0.1, jamais localhost
        baseURL: process.env.BASE_URL || 'http://127.0.0.1:8085',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // Timeouts adaptes mobile
        actionTimeout: 10000,
        navigationTimeout: 30000,
    },

    // Configuration des projets de test
    projects: [
        // Mobile - Priorite SHIELD
        {
            name: 'Mobile Chrome (Pixel 5)',
            use: {
                ...devices['Pixel 5'],
                // Mode visuel par defaut
                headless: false,
            },
        },
        {
            name: 'Mobile Safari (iPhone 13)',
            use: {
                ...devices['iPhone 13'],
                headless: false,
            },
        },
        {
            name: 'Mobile Safari (iPhone 13 Pro Max)',
            use: {
                ...devices['iPhone 13 Pro Max'],
                headless: false,
            },
        },

        // Tablets
        {
            name: 'Tablet (iPad)',
            use: {
                ...devices['iPad (gen 7)'],
                headless: false,
            },
        },

        // Desktop - Tests secondaires
        {
            name: 'Desktop Chrome',
            use: {
                ...devices['Desktop Chrome'],
                headless: false,
                viewport: { width: 1355, height: 800 },
            },
        },

        // CI - Headless
        {
            name: 'CI Mobile',
            use: {
                ...devices['Pixel 5'],
                headless: true,
            },
        },
    ],

    // Serveur de dev local
    webServer: process.env.CI ? undefined : {
        command: 'npm run docker:up',
        url: 'http://127.0.0.1:8085',
        reuseExistingServer: true,
        timeout: 120000,
    },

    // Timeouts globaux
    timeout: 60000,
    expect: {
        timeout: 10000,
    },

    // Output
    outputDir: 'test-results',
});

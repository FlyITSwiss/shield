/**
 * Configuration exemple pour tests PROD Shield
 * Copiez ce fichier vers config.prod.js et remplissez les credentials
 */

module.exports = {
    baseUrl: 'https://stabilis-it.ch/internal/shield',
    apiUrl: 'https://stabilis-it.ch/internal/shield/api',
    credentials: {
        email: process.env.SHIELD_TEST_EMAIL || 'your-test-email@example.com',
        password: process.env.SHIELD_TEST_PASSWORD || 'your-test-password'
    }
};

/**
 * SHIELD - Audit UI/UX Complet
 *
 * Parcours de toutes les pages avec analyse visuelle
 * Mode headed avec captures pour revue design
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    baseUrl: 'https://stabilis-it.ch/internal/shield',
    screenshotDir: path.join(__dirname, 'reports', 'ui-ux-audit'),
    viewports: [
        { name: 'mobile', width: 393, height: 851 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1440, height: 900 }
    ],
    timeout: 30000
};

// Résultats de l'audit
const auditResults = {
    pages: [],
    issues: [],
    improvements: [],
    screenshots: [],
    cssAnalysis: {},
    startTime: null,
    endTime: null
};

/**
 * Capture et analyse une page
 */
async function auditPage(page, pageName, url, viewport) {
    const pageAudit = {
        name: pageName,
        url: url,
        viewport: viewport.name,
        timestamp: new Date().toISOString(),
        elements: {},
        issues: [],
        suggestions: []
    };

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
        await page.waitForTimeout(1000);

        // Screenshot
        const screenshotName = `${pageName}-${viewport.name}`.replace(/\//g, '-');
        const screenshotPath = path.join(CONFIG.screenshotDir, `${screenshotName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        auditResults.screenshots.push({ name: screenshotName, path: screenshotPath });

        // Analyse CSS et accessibilité
        const analysis = await page.evaluate(() => {
            const results = {
                colors: new Set(),
                fonts: new Set(),
                fontSizes: new Set(),
                spacings: new Set(),
                issues: [],
                elements: {
                    buttons: 0,
                    inputs: 0,
                    links: 0,
                    images: 0,
                    headings: 0
                }
            };

            // Parcourir tous les éléments
            document.querySelectorAll('*').forEach(el => {
                const style = getComputedStyle(el);

                // Collecter couleurs
                if (style.color && style.color !== 'rgba(0, 0, 0, 0)') {
                    results.colors.add(style.color);
                }
                if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    results.colors.add(style.backgroundColor);
                }

                // Collecter fonts
                if (style.fontFamily) {
                    results.fonts.add(style.fontFamily.split(',')[0].trim().replace(/"/g, ''));
                }

                // Collecter font-sizes
                results.fontSizes.add(style.fontSize);

                // Collecter spacings (margin, padding)
                ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(prop => {
                    if (style[prop] && style[prop] !== '0px') {
                        results.spacings.add(style[prop]);
                    }
                });
            });

            // Compter éléments
            results.elements.buttons = document.querySelectorAll('button, [role="button"], .btn').length;
            results.elements.inputs = document.querySelectorAll('input, textarea, select').length;
            results.elements.links = document.querySelectorAll('a').length;
            results.elements.images = document.querySelectorAll('img, svg').length;
            results.elements.headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;

            // Vérifications UX critiques

            // 1. Touch targets < 44px
            document.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width < 44 || rect.height < 44) {
                    results.issues.push({
                        type: 'touch-target',
                        severity: 'high',
                        element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
                        message: `Touch target trop petit: ${Math.round(rect.width)}x${Math.round(rect.height)}px (min 44x44px)`
                    });
                }
            });

            // 2. Boutons sans cursor-pointer
            document.querySelectorAll('button, [role="button"], .btn').forEach(el => {
                const style = getComputedStyle(el);
                if (style.cursor !== 'pointer') {
                    results.issues.push({
                        type: 'cursor',
                        severity: 'medium',
                        element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
                        message: 'Bouton sans cursor: pointer'
                    });
                }
            });

            // 3. Images sans alt
            document.querySelectorAll('img').forEach(el => {
                if (!el.alt && !el.getAttribute('aria-label')) {
                    results.issues.push({
                        type: 'accessibility',
                        severity: 'high',
                        element: 'img',
                        message: 'Image sans attribut alt'
                    });
                }
            });

            // 4. Inputs sans label
            document.querySelectorAll('input, textarea, select').forEach(el => {
                const id = el.id;
                const hasLabel = id && document.querySelector(`label[for="${id}"]`);
                const hasAriaLabel = el.getAttribute('aria-label');
                const hasPlaceholder = el.placeholder;

                if (!hasLabel && !hasAriaLabel) {
                    results.issues.push({
                        type: 'accessibility',
                        severity: 'medium',
                        element: el.tagName + '#' + (id || 'no-id'),
                        message: 'Input sans label associé (utilise placeholder uniquement)'
                    });
                }
            });

            // 5. Contraste texte (estimation basique)
            document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label').forEach(el => {
                const style = getComputedStyle(el);
                const color = style.color;
                const bgColor = style.backgroundColor;

                // Vérifier si texte gris clair sur fond sombre
                if (color.includes('rgb') && bgColor.includes('rgb')) {
                    const colorMatch = color.match(/\d+/g);
                    const bgMatch = bgColor.match(/\d+/g);

                    if (colorMatch && bgMatch) {
                        const brightness = (parseInt(colorMatch[0]) + parseInt(colorMatch[1]) + parseInt(colorMatch[2])) / 3;
                        const bgBrightness = (parseInt(bgMatch[0]) + parseInt(bgMatch[1]) + parseInt(bgMatch[2])) / 3;

                        // Texte gris moyen sur fond sombre
                        if (brightness > 100 && brightness < 180 && bgBrightness < 50) {
                            results.issues.push({
                                type: 'contrast',
                                severity: 'medium',
                                element: el.tagName,
                                message: `Contraste potentiellement faible: texte gris sur fond sombre`
                            });
                        }
                    }
                }
            });

            // 6. Focus states
            const focusableElements = document.querySelectorAll('button, a, input, textarea, select, [tabindex]');
            // Note: on ne peut pas vraiment tester :focus en JS sans focus réel

            // 7. Z-index chaos
            const zIndexes = new Set();
            document.querySelectorAll('*').forEach(el => {
                const style = getComputedStyle(el);
                if (style.zIndex && style.zIndex !== 'auto') {
                    zIndexes.add(parseInt(style.zIndex));
                }
            });
            if (zIndexes.size > 10) {
                results.issues.push({
                    type: 'z-index',
                    severity: 'low',
                    element: 'global',
                    message: `${zIndexes.size} valeurs z-index différentes détectées (recommandé: échelle 10, 20, 30, 50)`
                });
            }

            // Convertir Sets en Arrays
            results.colors = [...results.colors].slice(0, 20);
            results.fonts = [...results.fonts];
            results.fontSizes = [...results.fontSizes].slice(0, 15);
            results.spacings = [...results.spacings].slice(0, 20);

            return results;
        });

        pageAudit.elements = analysis.elements;
        pageAudit.issues = analysis.issues;
        pageAudit.cssAnalysis = {
            colors: analysis.colors,
            fonts: analysis.fonts,
            fontSizes: analysis.fontSizes,
            spacings: analysis.spacings
        };

        // Suggestions basées sur l'analyse
        if (analysis.fonts.length > 3) {
            pageAudit.suggestions.push({
                category: 'typography',
                message: `${analysis.fonts.length} polices différentes détectées. Recommandation: max 2-3 polices.`,
                fonts: analysis.fonts
            });
        }

        if (analysis.fontSizes.length > 8) {
            pageAudit.suggestions.push({
                category: 'typography',
                message: `${analysis.fontSizes.length} tailles de police différentes. Recommandation: échelle typographique cohérente.`
            });
        }

        console.log(`   ✓ ${pageName} (${viewport.name}) - ${analysis.issues.length} problèmes détectés`);

    } catch (error) {
        console.error(`   ✗ ${pageName}: ${error.message}`);
        pageAudit.error = error.message;
    }

    return pageAudit;
}

/**
 * Audit des pages d'authentification
 */
async function auditAuthPages(browser) {
    console.log('\n━━━ AUDIT PAGES AUTHENTIFICATION ━━━\n');

    const pages = [
        { name: 'login', path: '/auth/login' },
        { name: 'register', path: '/auth/register' },
        { name: 'forgot-password', path: '/auth/forgot-password' }
    ];

    for (const viewport of CONFIG.viewports) {
        console.log(`\n📱 Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

        const context = await browser.newContext({ viewport });
        const page = await context.newPage();

        for (const p of pages) {
            const result = await auditPage(page, p.name, CONFIG.baseUrl + p.path, viewport);
            auditResults.pages.push(result);
        }

        await context.close();
    }
}

/**
 * Audit des pages légales
 */
async function auditLegalPages(browser) {
    console.log('\n━━━ AUDIT PAGES LÉGALES ━━━\n');

    const pages = [
        { name: 'privacy', path: '/legal/privacy' },
        { name: 'terms', path: '/legal/terms' },
        { name: 'help', path: '/legal/help' }
    ];

    // Mobile uniquement pour les pages légales
    const viewport = CONFIG.viewports[0];
    console.log(`📱 Viewport: ${viewport.name}`);

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const p of pages) {
        const result = await auditPage(page, p.name, CONFIG.baseUrl + p.path, viewport);
        auditResults.pages.push(result);
    }

    await context.close();
}

/**
 * Analyse globale du CSS
 */
async function analyzeGlobalCSS(browser) {
    console.log('\n━━━ ANALYSE CSS GLOBALE ━━━\n');

    const context = await browser.newContext({ viewport: CONFIG.viewports[0] });
    const page = await context.newPage();

    await page.goto(CONFIG.baseUrl + '/auth/login', { waitUntil: 'networkidle' });

    const cssAnalysis = await page.evaluate(() => {
        const analysis = {
            stylesheets: [],
            cssVariables: [],
            mediaQueries: [],
            animations: []
        };

        // Récupérer les feuilles de style
        for (const sheet of document.styleSheets) {
            try {
                analysis.stylesheets.push({
                    href: sheet.href || 'inline',
                    rules: sheet.cssRules ? sheet.cssRules.length : 0
                });
            } catch (e) {
                // CORS blocked
                analysis.stylesheets.push({
                    href: sheet.href || 'inline',
                    rules: 'CORS blocked'
                });
            }
        }

        // Récupérer les variables CSS du :root
        const rootStyles = getComputedStyle(document.documentElement);
        const cssVarNames = [
            '--primary', '--primary-light', '--primary-dark',
            '--secondary', '--accent', '--background', '--surface',
            '--text', '--text-secondary', '--text-muted',
            '--success', '--warning', '--error', '--info',
            '--border-color', '--shadow-color',
            '--spacing-8', '--spacing-13', '--spacing-21', '--spacing-34'
        ];

        cssVarNames.forEach(name => {
            const value = rootStyles.getPropertyValue(name).trim();
            if (value) {
                analysis.cssVariables.push({ name, value });
            }
        });

        return analysis;
    });

    auditResults.cssAnalysis = cssAnalysis;

    console.log(`   📋 ${cssAnalysis.stylesheets.length} feuilles de style`);
    console.log(`   🎨 ${cssAnalysis.cssVariables.length} variables CSS`);

    await context.close();
}

/**
 * Génération des recommandations UI/UX
 */
function generateRecommendations() {
    const recommendations = {
        critical: [],
        high: [],
        medium: [],
        low: [],
        suggestions: []
    };

    // Analyser tous les problèmes collectés
    for (const pageResult of auditResults.pages) {
        if (pageResult.issues) {
            for (const issue of pageResult.issues) {
                const rec = {
                    page: pageResult.name,
                    viewport: pageResult.viewport,
                    ...issue
                };

                if (issue.severity === 'critical') {
                    recommendations.critical.push(rec);
                } else if (issue.severity === 'high') {
                    recommendations.high.push(rec);
                } else if (issue.severity === 'medium') {
                    recommendations.medium.push(rec);
                } else {
                    recommendations.low.push(rec);
                }
            }
        }

        if (pageResult.suggestions) {
            recommendations.suggestions.push(...pageResult.suggestions.map(s => ({
                page: pageResult.name,
                ...s
            })));
        }
    }

    return recommendations;
}

/**
 * Génération du rapport
 */
function generateReport() {
    auditResults.endTime = new Date().toISOString();
    const duration = (new Date(auditResults.endTime) - new Date(auditResults.startTime)) / 1000;

    const recommendations = generateRecommendations();

    console.log('\n' + '═'.repeat(70));
    console.log('                    RAPPORT AUDIT UI/UX - SHIELD');
    console.log('═'.repeat(70));

    console.log(`\n📅 Date: ${new Date().toLocaleString('fr-FR')}`);
    console.log(`⏱️  Durée: ${duration.toFixed(2)} secondes`);
    console.log(`📸 Screenshots: ${auditResults.screenshots.length}`);
    console.log(`📄 Pages auditées: ${auditResults.pages.length}`);

    // Résumé des problèmes
    console.log('\n' + '─'.repeat(70));
    console.log('                      PROBLÈMES DÉTECTÉS');
    console.log('─'.repeat(70));

    const totalIssues = recommendations.critical.length +
                        recommendations.high.length +
                        recommendations.medium.length +
                        recommendations.low.length;

    console.log(`\n   🔴 Critiques:  ${recommendations.critical.length}`);
    console.log(`   🟠 Hauts:      ${recommendations.high.length}`);
    console.log(`   🟡 Moyens:     ${recommendations.medium.length}`);
    console.log(`   🟢 Bas:        ${recommendations.low.length}`);
    console.log(`   ━━━━━━━━━━━━━━━━`);
    console.log(`   📊 Total:      ${totalIssues}`);

    // Détails des problèmes critiques et hauts
    if (recommendations.critical.length > 0 || recommendations.high.length > 0) {
        console.log('\n' + '─'.repeat(70));
        console.log('                   PROBLÈMES PRIORITAIRES');
        console.log('─'.repeat(70));

        [...recommendations.critical, ...recommendations.high].forEach(issue => {
            const icon = issue.severity === 'critical' ? '🔴' : '🟠';
            console.log(`\n   ${icon} [${issue.page}/${issue.viewport}] ${issue.type.toUpperCase()}`);
            console.log(`      Element: ${issue.element}`);
            console.log(`      Message: ${issue.message}`);
        });
    }

    // CSS Variables
    if (auditResults.cssAnalysis.cssVariables) {
        console.log('\n' + '─'.repeat(70));
        console.log('                    VARIABLES CSS DÉTECTÉES');
        console.log('─'.repeat(70));
        auditResults.cssAnalysis.cssVariables.forEach(v => {
            console.log(`   ${v.name}: ${v.value}`);
        });
    }

    // Suggestions d'amélioration
    if (recommendations.suggestions.length > 0) {
        console.log('\n' + '─'.repeat(70));
        console.log('                    SUGGESTIONS AMÉLIORATION');
        console.log('─'.repeat(70));
        recommendations.suggestions.forEach(s => {
            console.log(`\n   💡 [${s.page}] ${s.category.toUpperCase()}`);
            console.log(`      ${s.message}`);
        });
    }

    console.log('\n' + '═'.repeat(70));

    // Sauvegarder rapport JSON
    const reportData = {
        ...auditResults,
        recommendations,
        summary: {
            totalPages: auditResults.pages.length,
            totalScreenshots: auditResults.screenshots.length,
            totalIssues,
            criticalIssues: recommendations.critical.length,
            highIssues: recommendations.high.length,
            mediumIssues: recommendations.medium.length,
            lowIssues: recommendations.low.length
        }
    };

    const reportPath = path.join(CONFIG.screenshotDir, 'ui-ux-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Rapport JSON: ${reportPath}`);

    return reportData;
}

/**
 * Main
 */
async function runUIUXAudit() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║           SHIELD - AUDIT UI/UX COMPLET                           ║');
    console.log('║           Front Designer | CSS Expert | UX/UI                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    // Créer dossier screenshots
    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    auditResults.startTime = new Date().toISOString();

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });

    try {
        // Audit par section
        await auditAuthPages(browser);
        await auditLegalPages(browser);
        await analyzeGlobalCSS(browser);

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
    } finally {
        await browser.close();
    }

    // Générer rapport
    return generateReport();
}

// Lancer l'audit
runUIUXAudit()
    .then(results => {
        console.log('\n🏁 Audit UI/UX terminé');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Erreur fatale:', error);
        process.exit(1);
    });

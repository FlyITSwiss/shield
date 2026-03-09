<?php
/**
 * SHIELD - Dynamic PWA Manifest
 *
 * Generates manifest.json with correct BASE_PATH URLs
 * for both local and production environments.
 */

require_once __DIR__ . '/../backend/php/bootstrap.php';

$basePath = BASE_PATH;

$manifest = [
    'name' => 'SHIELD',
    'short_name' => 'SHIELD',
    'description' => 'Application de sécurité personnelle féminine',
    'start_url' => $basePath . '/app',
    'scope' => $basePath . '/',
    'display' => 'standalone',
    'orientation' => 'portrait',
    'background_color' => '#1E1B2E',
    'theme_color' => '#9B6DA1',
    'categories' => ['security', 'health', 'lifestyle'],
    'lang' => 'fr',
    'dir' => 'ltr',
    'icons' => [
        [
            'src' => $basePath . '/assets/icons/icon-72x72.png',
            'sizes' => '72x72',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-96x96.png',
            'sizes' => '96x96',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-128x128.png',
            'sizes' => '128x128',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-144x144.png',
            'sizes' => '144x144',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-152x152.png',
            'sizes' => '152x152',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-192x192.png',
            'sizes' => '192x192',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-384x384.png',
            'sizes' => '384x384',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $basePath . '/assets/icons/icon-512x512.png',
            'sizes' => '512x512',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ]
    ],
    'shortcuts' => [
        [
            'name' => 'SOS',
            'short_name' => 'SOS',
            'description' => 'Déclencher une alerte d\'urgence',
            'url' => $basePath . '/app/sos',
            'icons' => [
                [
                    'src' => $basePath . '/assets/icons/shortcut-sos.png',
                    'sizes' => '192x192'
                ]
            ]
        ],
        [
            'name' => 'Contacts',
            'short_name' => 'Contacts',
            'description' => 'Gérer les contacts de confiance',
            'url' => $basePath . '/app/contacts',
            'icons' => [
                [
                    'src' => $basePath . '/assets/icons/shortcut-contacts.png',
                    'sizes' => '192x192'
                ]
            ]
        ]
    ],
    'prefer_related_applications' => false
];

// Set proper headers
header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: public, max-age=86400'); // 24h cache
header('Access-Control-Allow-Origin: *');

echo json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

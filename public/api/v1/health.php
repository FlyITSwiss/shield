<?php
/**
 * SHIELD - API Health Check
 *
 * Endpoint: GET /api/v1/health
 * Public endpoint pour verifier l'etat de l'API
 */

declare(strict_types=1);

require '_bootstrap.php';

// Pas d'auth requise pour health check
requireGet();

try {
    $health = [
        'status' => 'ok',
        'timestamp' => date('c'),
        'version' => '1.0.0',
        'checks' => []
    ];

    // Check database
    try {
        $db->query('SELECT 1');
        $health['checks']['database'] = 'ok';
    } catch (Exception $e) {
        $health['checks']['database'] = 'error';
        $health['status'] = 'degraded';
    }

    // Check uploads directory
    $uploadsPath = PUBLIC_PATH . '/uploads';
    if (is_dir($uploadsPath) && is_writable($uploadsPath)) {
        $health['checks']['uploads'] = 'ok';
    } else {
        $health['checks']['uploads'] = 'error';
        $health['status'] = 'degraded';
    }

    // Check storage directory
    $storagePath = STORAGE_PATH;
    if (is_dir($storagePath) && is_writable($storagePath)) {
        $health['checks']['storage'] = 'ok';
    } else {
        $health['checks']['storage'] = 'error';
        $health['status'] = 'degraded';
    }

    // Status code based on health
    $statusCode = $health['status'] === 'ok' ? 200 : 503;

    json_response($health, $statusCode);

} catch (Exception $e) {
    handleApiError($e);
}

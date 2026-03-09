<?php
declare(strict_types=1);

/**
 * API Location Share Endpoints
 *
 * PREMIUM FEATURE - Partage de position hors incidents
 *
 * AUTHENTICATED ENDPOINTS:
 * POST /api/location-share?action=create          - Creer un partage
 * POST /api/location-share?action=update-location - Mettre a jour la position
 * GET  /api/location-share?action=active          - Partages actifs
 * GET  /api/location-share?action=history         - Historique positions
 * POST /api/location-share?action=stop            - Arreter un partage
 * POST /api/location-share?action=pause           - Mettre en pause
 * POST /api/location-share?action=resume          - Reprendre
 * POST /api/location-share?action=extend          - Prolonger
 * POST /api/location-share?action=arrived         - Marquer arrive
 *
 * PUBLIC ENDPOINTS:
 * GET  /api/location-share?action=view&token=xxx  - Voir un partage (page publique)
 * POST /api/location-share?action=contact-view    - Enregistrer vue contact
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    require_once __DIR__ . '/../../backend/php/Controllers/LocationShareController.php';
    $controller = new \Shield\Controllers\LocationShareController($db);

    switch ($action) {
        // ========== AUTHENTICATED ENDPOINTS ==========

        case 'create':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();

            // Rate limit: 10 creations par heure
            if (!checkRateLimit("location_share:create:{$userId}", 10, 3600)) {
                jsonError('rate_limit_exceeded', 429);
            }

            $data = getJsonInput();
            logApiRequest('/api/location-share/create', 'POST', $userId);
            $result = $controller->create($userId, $data);
            jsonResponse($result, $result['success'] ? 201 : 400);
            break;

        case 'update-location':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();

            // Rate limit: 120 updates par minute (1 toutes les 0.5s max)
            if (!checkRateLimit("location_share:update:{$userId}", 120, 60)) {
                jsonError('rate_limit_exceeded', 429);
            }

            $data = getJsonInput();
            $result = $controller->updateLocation($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'active':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $result = $controller->getActive($userId);
            jsonResponse($result);
            break;

        case 'history':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $shareId = isset($_GET['share_id']) ? (int)$_GET['share_id'] : 0;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;

            if (!$shareId) {
                jsonError('share_id_required', 400);
            }

            $result = $controller->getHistory($userId, $shareId, $limit);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        case 'stop':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->stop($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'pause':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->pause($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'resume':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->resume($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'extend':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->extend($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'arrived':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->markArrived($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        // ========== PUBLIC ENDPOINTS ==========

        case 'view':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $token = $_GET['token'] ?? '';

            if (empty($token)) {
                jsonError('token_required', 400);
            }

            // Rate limit par IP pour eviter le scraping
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!checkRateLimit("location_share:view:{$ip}", 60, 60)) {
                jsonError('rate_limit_exceeded', 429);
            }

            $result = $controller->viewByToken($token);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        case 'contact-view':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->recordContactView($data);
            jsonResponse($result);
            break;

        default:
            jsonError('endpoint_not_found', 404);
    }
} catch (Exception $e) {
    error_log('Location Share API Error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}

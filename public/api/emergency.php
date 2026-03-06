<?php
declare(strict_types=1);

/**
 * API Emergency Services Endpoints
 *
 * GET  /api/emergency/countries
 * GET  /api/emergency/{country_code}
 * GET  /api/emergency/best
 * GET  /api/emergency/police/{country_code}
 * GET  /api/emergency/women-help/{country_code}
 * GET  /api/emergency/detect
 * GET  /api/emergency/stats (admin)
 * GET  /api/emergency/all (admin)
 * POST /api/emergency (admin)
 * PUT  /api/emergency/{id} (admin)
 * DELETE /api/emergency/{id} (admin)
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$countryCode = $_GET['country_code'] ?? null;
$serviceId = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    require_once __DIR__ . '/../../backend/php/Controllers/EmergencyController.php';
    $controller = new \Shield\Controllers\EmergencyController($db);

    switch ($action) {
        // ========== PUBLIC ENDPOINTS ==========

        case 'countries':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $result = $controller->getSupportedCountries();
            jsonResponse($result);
            break;

        case 'by-country':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$countryCode) {
                jsonError('missing_country_code', 400);
            }
            $result = $controller->getByCountry($countryCode);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'best':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $params = [
                'country_code' => $_GET['country_code'] ?? null,
                'context' => $_GET['context'] ?? 'default',
                'latitude' => $_GET['latitude'] ?? null,
                'longitude' => $_GET['longitude'] ?? null
            ];
            $result = $controller->getBestNumber($params);
            jsonResponse($result);
            break;

        case 'police':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$countryCode) {
                jsonError('missing_country_code', 400);
            }
            $result = $controller->getPolice($countryCode);
            jsonResponse($result);
            break;

        case 'women-help':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$countryCode) {
                jsonError('missing_country_code', 400);
            }
            $result = $controller->getWomenHelp($countryCode);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        case 'detect':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $params = [
                'latitude' => $_GET['latitude'] ?? null,
                'longitude' => $_GET['longitude'] ?? null
            ];
            $result = $controller->detectCountry($params);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        // ========== ADMIN ENDPOINTS ==========

        case 'stats':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            requireAdmin();
            $result = $controller->getStats();
            jsonResponse($result);
            break;

        case 'all':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            requireAdmin();
            $includeInactive = ($_GET['include_inactive'] ?? '0') === '1';
            $result = $controller->getAll($includeInactive);
            jsonResponse($result);
            break;

        case 'create':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            requireAdmin();
            requireCsrf();
            $data = getJsonInput();
            $result = $controller->create($data);
            jsonResponse($result, $result['success'] ? 201 : 400);
            break;

        case 'update':
            if ($method !== 'PUT') {
                jsonError('method_not_allowed', 405);
            }
            if (!$serviceId) {
                jsonError('missing_service_id', 400);
            }
            requireAdmin();
            requireCsrf();
            $data = getJsonInput();
            $result = $controller->update($serviceId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'deactivate':
            if ($method !== 'DELETE') {
                jsonError('method_not_allowed', 405);
            }
            if (!$serviceId) {
                jsonError('missing_service_id', 400);
            }
            requireAdmin();
            requireCsrf();
            $result = $controller->deactivate($serviceId);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        default:
            jsonError('endpoint_not_found', 404);
    }
} catch (Exception $e) {
    error_log('Emergency API Error: ' . $e->getMessage());
    jsonError('internal_error', 500);
}

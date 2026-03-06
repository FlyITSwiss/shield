<?php
declare(strict_types=1);

/**
 * API Contacts Endpoints
 *
 * GET    /api/contacts
 * GET    /api/contacts/{id}
 * POST   /api/contacts
 * PUT    /api/contacts/{id}
 * DELETE /api/contacts/{id}
 * PUT    /api/contacts/reorder
 * POST   /api/contacts/{id}/test
 * PUT    /api/contacts/{id}/notifications
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'index';
$contactId = isset($_GET['id']) ? (int) $_GET['id'] : null;

// Tous les endpoints contacts nécessitent une authentification
$userId = requireAuth();

try {
    require_once __DIR__ . '/../../backend/php/Controllers/ContactController.php';
    $controller = new \Shield\Controllers\ContactController($db);

    switch ($action) {
        // ========== CRUD ENDPOINTS ==========

        case 'index':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $result = $controller->index($userId);
            jsonResponse($result);
            break;

        case 'show':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$contactId) {
                jsonError('missing_contact_id', 400);
            }
            $result = $controller->show($userId, $contactId);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        case 'store':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            requireCsrf();
            $data = getJsonInput();
            $result = $controller->store($userId, $data);
            jsonResponse($result, $result['success'] ? 201 : 400);
            break;

        case 'update':
            if ($method !== 'PUT') {
                jsonError('method_not_allowed', 405);
            }
            if (!$contactId) {
                jsonError('missing_contact_id', 400);
            }
            requireCsrf();
            $data = getJsonInput();
            $result = $controller->update($userId, $contactId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'destroy':
            if ($method !== 'DELETE') {
                jsonError('method_not_allowed', 405);
            }
            if (!$contactId) {
                jsonError('missing_contact_id', 400);
            }
            requireCsrf();
            $result = $controller->destroy($userId, $contactId);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        // ========== SPECIAL ENDPOINTS ==========

        case 'reorder':
            if ($method !== 'PUT') {
                jsonError('method_not_allowed', 405);
            }
            requireCsrf();
            $data = getJsonInput();
            $result = $controller->reorder($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'test':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$contactId) {
                jsonError('missing_contact_id', 400);
            }
            requireCsrf();
            $result = $controller->sendTest($userId, $contactId);
            jsonResponse($result);
            break;

        case 'notifications':
            if ($method !== 'PUT') {
                jsonError('method_not_allowed', 405);
            }
            if (!$contactId) {
                jsonError('missing_contact_id', 400);
            }
            requireCsrf();
            $data = getJsonInput();
            $result = $controller->updateNotifications($userId, $contactId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        default:
            jsonError('endpoint_not_found', 404);
    }
} catch (Exception $e) {
    error_log('Contacts API Error: ' . $e->getMessage());
    jsonError('internal_error', 500);
}

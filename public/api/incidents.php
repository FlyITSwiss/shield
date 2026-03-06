<?php
declare(strict_types=1);

/**
 * API Incidents Endpoints
 *
 * CORE SOS:
 * POST /api/incidents/trigger
 * POST /api/incidents/{id}/cancel
 * POST /api/incidents/{id}/safe
 * POST /api/incidents/{id}/location
 * POST /api/incidents/{id}/escalate
 * GET  /api/incidents/active
 * GET  /api/incidents/{id}
 * GET  /api/incidents/history
 *
 * SHARING:
 * POST /api/incidents/generate-share
 * GET  /api/incidents/get-shares
 * POST /api/incidents/revoke-share
 * POST /api/incidents/send-share-sms
 * POST /api/incidents/update-shared-location
 *
 * CONTACT TRACKING:
 * GET  /api/incidents/contact-statuses
 * POST /api/incidents/acknowledge-contact
 * POST /api/incidents/contact-arrived
 * POST /api/incidents/contact-responding
 *
 * INTERNAL:
 * POST /api/incidents/{id}/ai-transcript
 * POST /api/incidents/{id}/risk-score
 *
 * ADMIN:
 * GET  /api/incidents/stats
 * GET  /api/incidents/monitoring
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$incidentId = $_GET['id'] ?? null;

try {
    require_once __DIR__ . '/../../backend/php/Controllers/IncidentController.php';
    $controller = new \Shield\Controllers\IncidentController($db);

    switch ($action) {
        // ========== CORE SOS ENDPOINTS ==========

        case 'trigger':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();

            // Log critique - déclenchement SOS
            logApiRequest('/api/incidents/trigger', 'POST', $userId);

            $result = $controller->trigger($userId, $data);
            jsonResponse($result, $result['success'] ? 201 : 400);
            break;

        case 'cancel':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->cancel($userId, $incidentId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'safe':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            $userId = requireAuth();
            $result = $controller->confirmSafe($userId, $incidentId);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'location':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            requireAuth(); // Authentification requise
            $data = getJsonInput();
            $result = $controller->updateLocation($incidentId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'escalate':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            $userId = requireAuth();

            // Log critique - escalade police
            logApiRequest('/api/incidents/escalate', 'POST', $userId);

            $result = $controller->escalate($userId, $incidentId);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        // ========== READ ENDPOINTS ==========

        case 'active':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $result = $controller->getActive($userId);
            jsonResponse($result);
            break;

        case 'get':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            $userId = requireAuth();
            $result = $controller->getById($userId, $incidentId);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        case 'history':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $params = [
                'limit' => (int) ($_GET['limit'] ?? 20),
                'offset' => (int) ($_GET['offset'] ?? 0)
            ];
            $result = $controller->getHistory($userId, $params);
            jsonResponse($result);
            break;

        // ========== INTERNAL WEBHOOKS (AI Agent) ==========

        case 'ai-transcript':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            // Vérifier le token interne
            $internalToken = $_SERVER['HTTP_X_INTERNAL_TOKEN'] ?? '';
            if ($internalToken !== ($_ENV['INTERNAL_API_TOKEN'] ?? '')) {
                jsonError('forbidden', 403);
            }
            $data = getJsonInput();
            $result = $controller->saveAITranscript($incidentId, $data);
            jsonResponse($result);
            break;

        case 'risk-score':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            // Vérifier le token interne
            $internalToken = $_SERVER['HTTP_X_INTERNAL_TOKEN'] ?? '';
            if ($internalToken !== ($_ENV['INTERNAL_API_TOKEN'] ?? '')) {
                jsonError('forbidden', 403);
            }
            $data = getJsonInput();
            $result = $controller->updateRiskScore($incidentId, $data);
            jsonResponse($result);
            break;

        // ========== SHARING ENDPOINTS ==========

        case 'generate-share':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->generateShare($userId, $data);
            jsonResponse($result, $result['success'] ? 201 : 400);
            break;

        case 'get-shares':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                $incidentId = $_GET['incident_id'] ?? null;
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            $userId = requireAuth();
            $result = $controller->getShares($userId, $incidentId);
            jsonResponse($result);
            break;

        case 'revoke-share':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->revokeShare($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'send-share-sms':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->sendShareSMS($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'update-shared-location':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->updateSharedLocation($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        // ========== CONTACT TRACKING ENDPOINTS ==========

        case 'contact-statuses':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            if (!$incidentId) {
                $incidentId = $_GET['incident_id'] ?? null;
            }
            if (!$incidentId) {
                jsonError('missing_incident_id', 400);
            }
            $userId = requireAuth();
            $result = $controller->getContactStatuses($userId, $incidentId);
            jsonResponse($result);
            break;

        case 'acknowledge-contact':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            // Peut être appelé par le contact via le lien de partage
            $data = getJsonInput();
            $result = $controller->acknowledgeContact($data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'contact-arrived':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->contactArrived($data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'contact-responding':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->contactResponding($data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        // ========== ADMIN ENDPOINTS ==========

        case 'stats':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            requireAdmin();
            $params = ['period' => $_GET['period'] ?? 'month'];
            $result = $controller->getStats($params);
            jsonResponse($result);
            break;

        case 'monitoring':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            requireAdmin();
            $params = ['limit' => (int) ($_GET['limit'] ?? 50)];
            $result = $controller->getActiveIncidents($params);
            jsonResponse($result);
            break;

        default:
            jsonError('endpoint_not_found', 404);
    }
} catch (Exception $e) {
    error_log('Incidents API Error: ' . $e->getMessage());
    jsonError('internal_error', 500);
}

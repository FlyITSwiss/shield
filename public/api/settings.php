<?php
declare(strict_types=1);

/**
 * SHIELD API - Settings Endpoint
 *
 * GET    /settings              - Récupérer tous les paramètres
 * PUT    /settings/profile      - Mettre à jour le profil
 * PUT    /settings/alert        - Mettre à jour les préférences d'alerte
 * PUT    /settings/password     - Changer le mot de passe
 * DELETE /settings/account      - Supprimer le compte
 */

require '_bootstrap.php';

// Authentification requise pour toutes les routes
$userId = requireAuth();

// Router
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    require_once __DIR__ . '/../../backend/php/Controllers/SettingsController.php';
    $controller = new \Shield\Controllers\SettingsController($db);

    switch ($method) {
        case 'GET':
            // GET /settings
            logApiRequest('settings', 'GET', $userId);
            $result = $controller->getAll($userId);
            jsonResponse($result);
            break;

        case 'PUT':
            requireCsrf();
            $data = getJsonInput();

            switch ($action) {
                case 'profile':
                    // PUT /settings?action=profile
                    logApiRequest('settings/profile', 'PUT', $userId);
                    $result = $controller->updateProfile($userId, $data);
                    jsonResponse($result);
                    break;

                case 'alert':
                    // PUT /settings?action=alert
                    logApiRequest('settings/alert', 'PUT', $userId);
                    $result = $controller->updateAlertPreferences($userId, $data);
                    jsonResponse($result);
                    break;

                case 'password':
                    // PUT /settings?action=password
                    logApiRequest('settings/password', 'PUT', $userId);
                    $result = $controller->changePassword($userId, $data);
                    jsonResponse($result);
                    break;

                default:
                    jsonError('invalid_action', 400);
            }
            break;

        case 'DELETE':
            requireCsrf();

            if ($action === 'account') {
                // DELETE /settings?action=account
                logApiRequest('settings/account', 'DELETE', $userId);
                $data = getJsonInput();
                $result = $controller->deleteAccount($userId, $data);
                jsonResponse($result);
            } else {
                jsonError('invalid_action', 400);
            }
            break;

        default:
            jsonError('method_not_allowed', 405);
    }
} catch (Exception $e) {
    error_log('[SHIELD API] Settings error: ' . $e->getMessage());
    jsonError('server_error', 500);
}

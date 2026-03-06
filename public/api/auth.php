<?php
declare(strict_types=1);

/**
 * API Auth Endpoints
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/oauth
 * POST /api/auth/verify-phone
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 * POST /api/auth/refresh-token
 * POST /api/auth/logout
 * GET  /api/auth/me
 * PUT  /api/auth/profile
 * PUT  /api/auth/password
 * GET  /api/auth/alert-preferences
 * PUT  /api/auth/alert-preferences
 * DELETE /api/auth/account
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    require_once __DIR__ . '/../../backend/php/Controllers/AuthController.php';
    $controller = new \Shield\Controllers\AuthController($db);

    switch ($action) {
        // ========== PUBLIC ENDPOINTS ==========

        case 'register':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->register($data);
            jsonResponse($result, $result['success'] ? 201 : 400);
            break;

        case 'login':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->login($data);

            // Si login réussi, créer aussi une session PHP pour la navigation web
            if ($result['success'] && isset($result['user']['id'])) {
                $_SESSION['user_id'] = (int)$result['user']['id'];
                $_SESSION['user_email'] = $result['user']['email'];
                session_write_close();
            }

            jsonResponse($result, $result['success'] ? 200 : 401);
            break;

        case 'oauth':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->oauthLogin($data);
            jsonResponse($result, $result['success'] ? 200 : 401);
            break;

        case 'forgot-password':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->forgotPassword($data);
            jsonResponse($result);
            break;

        case 'reset-password':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->resetPassword($data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'refresh-token':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $data = getJsonInput();
            $result = $controller->refreshToken($data);
            jsonResponse($result, $result['success'] ? 200 : 401);
            break;

        // ========== AUTHENTICATED ENDPOINTS ==========

        case 'verify-phone':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->verifyPhone($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'logout':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $result = $controller->logout($userId);
            jsonResponse($result);
            break;

        case 'me':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $result = $controller->getProfile($userId);
            jsonResponse($result, $result['success'] ? 200 : 404);
            break;

        case 'profile':
            if ($method !== 'PUT') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->updateProfile($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'password':
            if ($method !== 'PUT') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->changePassword($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'alert-preferences':
            $userId = requireAuth();
            if ($method === 'GET') {
                $result = $controller->getAlertPreferences($userId);
            } elseif ($method === 'PUT') {
                $data = getJsonInput();
                $result = $controller->updateAlertPreferences($userId, $data);
            } else {
                jsonError('method_not_allowed', 405);
            }
            jsonResponse($result);
            break;

        case 'account':
            if ($method !== 'DELETE') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();
            $result = $controller->deleteAccount($userId, $data);
            jsonResponse($result, $result['success'] ? 200 : 400);
            break;

        case 'resend-verification':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $result = $controller->resendVerification($userId);
            jsonResponse($result);
            break;

        default:
            jsonError('endpoint_not_found', 404);
    }
} catch (Exception $e) {
    error_log('Auth API Error: ' . $e->getMessage());
    jsonError('internal_error', 500);
}

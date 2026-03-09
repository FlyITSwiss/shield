<?php
/**
 * SHIELD - Front Controller / Router
 *
 * Point d'entree unique pour toutes les requetes web.
 * Route vers les vues appropriees avec layouts.
 */

declare(strict_types=1);

// Charger le bootstrap
require_once __DIR__ . '/../backend/php/bootstrap.php';

// ============================================
// ROUTING
// ============================================

// Obtenir l'URI demandee
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';

// Retirer le base path si present
$basePath = BASE_PATH;
if ($basePath !== '' && strpos($requestUri, $basePath) === 0) {
    $requestUri = substr($requestUri, strlen($basePath));
}

// Retirer les query strings
$requestUri = strtok($requestUri, '?') ?: '/';

// Normaliser
$path = $requestUri === '' ? '/' : rtrim($requestUri, '/');
if ($path === '') {
    $path = '/';
}

// Methode HTTP
$method = $_SERVER['REQUEST_METHOD'];

// ============================================
// ROUTES - Vue-based routing
// ============================================

$routes = [
    // Redirections
    '/' => ['redirect' => '/auth/login'],

    // Auth (public)
    '/auth/login' => ['view' => 'auth/login', 'layout' => 'auth'],
    '/auth/register' => ['view' => 'auth/register', 'layout' => 'auth'],
    '/auth/forgot-password' => ['view' => 'auth/forgot-password', 'layout' => 'auth'],
    '/auth/reset-password' => ['view' => 'auth/reset-password', 'layout' => 'auth'],
    '/login' => ['redirect' => '/auth/login'],
    '/register' => ['redirect' => '/auth/register'],

    // App (authentifie)
    '/app' => ['view' => 'app/sos', 'layout' => 'app', 'auth' => true],
    '/app/sos' => ['view' => 'app/sos', 'layout' => 'app', 'auth' => true],
    '/app/contacts' => ['view' => 'app/contacts', 'layout' => 'app', 'auth' => true],
    '/app/history' => ['view' => 'app/history', 'layout' => 'app', 'auth' => true],
    '/app/settings' => ['view' => 'app/settings', 'layout' => 'app', 'auth' => true],
    '/app/profile/edit' => ['view' => 'app/profile-edit', 'layout' => 'app', 'auth' => true],
    '/app/location-share' => ['view' => 'app/location-share', 'layout' => 'app', 'auth' => true],

    // Legacy routes (redirect)
    '/dashboard' => ['redirect' => '/app'],
    '/sos' => ['redirect' => '/app/sos'],
    '/contacts' => ['redirect' => '/app/contacts'],
    '/history' => ['redirect' => '/app/history'],
    '/settings' => ['redirect' => '/app/settings'],
    '/profile' => ['redirect' => '/app/settings'],

    // Logout action
    '/logout' => ['action' => 'logout'],
    '/auth/logout' => ['action' => 'logout'],

    // Legal (public)
    '/legal/terms' => ['view' => 'legal/terms', 'layout' => 'minimal'],
    '/legal/privacy' => ['view' => 'legal/privacy', 'layout' => 'minimal'],

    // Health check
    '/health' => ['action' => 'health'],
];

// ============================================
// ROUTE MATCHING
// ============================================

$route = $routes[$path] ?? null;

// ============================================
// DYNAMIC ROUTES (patterns)
// ============================================

// Share page - /share/{token} (64-char hex token for Live Location)
if ($route === null && preg_match('#^/share/([a-f0-9]{64})$#i', $path, $matches)) {
    $route = ['view' => 'public/share', 'layout' => 'minimal', 'public' => true];
    $shareToken = $matches[1];
}
// Track page - /track/{share_id}
if ($route === null && preg_match('#^/track/([a-f0-9-]{36})$#i', $path, $matches)) {
    $route = ['view' => 'public/track', 'layout' => 'minimal', 'public' => true];
    $shareId = $matches[1];
}

// ============================================
// SPECIAL ACTIONS
// ============================================

// Health check
if ($route !== null && ($route['action'] ?? null) === 'health') {
    header('Content-Type: text/plain');
    echo 'SHIELD OK';
    exit;
}

// Logout
if ($route !== null && ($route['action'] ?? null) === 'logout') {
    // Detruire la session
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    redirect_to('/auth/login');
}

// Redirection
if ($route !== null && isset($route['redirect'])) {
    redirect_to($route['redirect']);
}

// ============================================
// 404 NOT FOUND
// ============================================

if ($route === null) {
    http_response_code(404);
    $pageTitle = '404 - ' . __('error.page_not_found');
    $errorCode = 404;
    $errorMessage = __('error.page_not_found');
    include VIEWS_PATH . '/errors/error.phtml';
    exit;
}

// ============================================
// AUTHENTICATION CHECK
// ============================================

$isAuthenticated = isset($_SESSION['user_id']);

if (!empty($route['auth']) && !$isAuthenticated) {
    $_SESSION['redirect_after_login'] = $path;
    redirect_to('/auth/login');
}

// ============================================
// CSRF CHECK (POST requests)
// ============================================

if ($method === 'POST' && !verify_csrf()) {
    if (is_ajax()) {
        json_error('csrf_invalid', 419);
    }
    http_response_code(419);
    $pageTitle = '419 - Session expirée';
    $errorCode = 419;
    $errorMessage = __('error.session_expired');
    include VIEWS_PATH . '/errors/error.phtml';
    exit;
}

// ============================================
// VIEW RENDERING
// ============================================

try {
    // Variables globales pour les vues
    $csrfToken = csrf_token();
    $currentUser = null;
    $currentPath = $path;

    // Charger l'utilisateur si authentifie
    if ($isAuthenticated && isset($_SESSION['user_id'])) {
        try {
            require_once MODELS_PATH . '/User.php';
            $userModel = new \Shield\Models\User(get_db());
            $currentUser = $userModel->findById((int)$_SESSION['user_id']);
        } catch (Exception $e) {
            error_log('SHIELD: Failed to load user: ' . $e->getMessage());
        }
    }

    // Verifier que la vue existe
    $viewFile = VIEWS_PATH . '/' . $route['view'] . '.phtml';
    if (!file_exists($viewFile)) {
        throw new Exception("View not found: {$route['view']}");
    }

    // Variables par defaut (peuvent etre surchargees par la vue)
    $pageTitle = 'SHIELD';
    $bodyClass = '';
    $pageScripts = [];

    // Capturer le contenu de la vue
    ob_start();
    include $viewFile;
    $content = ob_get_clean();

    // Charger le layout
    $layoutName = $route['layout'] ?? 'app';
    $layoutFile = VIEWS_PATH . '/layouts/' . $layoutName . '.phtml';

    if (file_exists($layoutFile)) {
        include $layoutFile;
    } else {
        // Fallback: afficher le contenu directement
        echo $content;
    }

} catch (Exception $e) {
    error_log('SHIELD Router Error: ' . $e->getMessage());

    if (APP_DEBUG) {
        throw $e;
    }

    http_response_code(500);
    $pageTitle = '500 - Erreur serveur';
    $errorCode = 500;
    $errorMessage = __('error.internal');
    include VIEWS_PATH . '/errors/error.phtml';
    exit;
}

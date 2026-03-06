<?php
declare(strict_types=1);

/**
 * SHIELD API Bootstrap
 *
 * Initialise la connexion BDD, l'authentification et les helpers API
 */

// Headers CORS et JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Autoload
require_once __DIR__ . '/../../backend/php/bootstrap.php';

// Connexion BDD (utilise les constantes de bootstrap.php)
$db = null;
try {
    $db = get_db();
} catch (PDOException $e) {
    jsonError('database_error', 500);
}

// Utilisateur authentifié
$authUserId = null;

/**
 * Vérifier l'authentification JWT
 */
function requireAuth(): int
{
    global $authUserId, $db;

    $token = getBearerToken();
    if (!$token) {
        jsonError('unauthorized', 401);
    }

    try {
        require_once __DIR__ . '/../../backend/php/Services/AuthService.php';
        $authService = new \Shield\Services\AuthService($db);
        $payload = $authService->validateToken($token);

        if (!$payload || !isset($payload['user_id'])) {
            jsonError('invalid_token', 401);
        }

        $authUserId = (int) $payload['user_id'];
        return $authUserId;
    } catch (Exception $e) {
        jsonError('invalid_token', 401);
    }

    return 0;
}

/**
 * Vérifier le CSRF token (pour POST/PUT/DELETE depuis le web)
 */
function requireCsrf(): void
{
    // Skip pour les requêtes API avec Bearer token
    if (getBearerToken()) {
        return;
    }

    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['_csrf'] ?? null;
    $sessionToken = $_SESSION['csrf_token'] ?? null;

    if (!$csrfToken || !$sessionToken || !hash_equals($sessionToken, $csrfToken)) {
        jsonError('csrf_invalid', 403);
    }
}

/**
 * Extraire le Bearer token
 */
function getBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (preg_match('/Bearer\s+(.+)$/i', $header, $matches)) {
        return $matches[1];
    }

    return null;
}

/**
 * Obtenir les données JSON du body
 */
function getJsonInput(): array
{
    $input = file_get_contents('php://input');
    if (empty($input)) {
        return [];
    }

    $data = json_decode($input, true);
    return is_array($data) ? $data : [];
}

/**
 * Réponse JSON succès
 */
function jsonResponse(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Réponse JSON erreur
 */
function jsonError(string $error, int $code = 400, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(array_merge(['success' => false, 'error' => $error], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Logger une requête API
 */
function logApiRequest(string $endpoint, string $method, ?int $userId = null): void
{
    global $db;

    try {
        $stmt = $db->prepare("
            INSERT INTO api_logs (endpoint, method, user_id, ip_address, user_agent, created_at)
            VALUES (:endpoint, :method, :user_id, :ip, :ua, NOW())
        ");
        $stmt->execute([
            'endpoint' => $endpoint,
            'method' => $method,
            'user_id' => $userId,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'ua' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255)
        ]);
    } catch (Exception $e) {
        // Silencieux
    }
}

/**
 * Rate limiting avec Redis
 *
 * @param string $key Clé unique (ex: "api:user:123" ou "track:192.168.1.1")
 * @param int $maxRequests Nombre max de requêtes
 * @param int $windowSeconds Fenêtre de temps en secondes
 * @return bool True si autorisé, false si limite atteinte
 */
function checkRateLimit(string $key, int $maxRequests = 60, int $windowSeconds = 60): bool
{
    // Essayer Redis si disponible
    $redis = getRedisConnection();

    if ($redis) {
        try {
            $redisKey = "rate_limit:{$key}";
            $current = (int) $redis->get($redisKey);

            if ($current >= $maxRequests) {
                return false;
            }

            // Incrémenter ou créer
            $newCount = $redis->incr($redisKey);

            // Définir TTL seulement à la première requête
            if ($newCount === 1) {
                $redis->expire($redisKey, $windowSeconds);
            }

            return true;
        } catch (Exception $e) {
            error_log('Redis rate limit error: ' . $e->getMessage());
            // Fallback: autoriser en cas d'erreur Redis
            return true;
        }
    }

    // Fallback sans Redis: utiliser la session (moins précis mais fonctionnel)
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return true; // Pas de session = pas de rate limiting
    }

    $sessionKey = "rate_limit_{$key}";
    $now = time();

    if (!isset($_SESSION[$sessionKey])) {
        $_SESSION[$sessionKey] = [
            'count' => 1,
            'window_start' => $now
        ];
        return true;
    }

    $data = $_SESSION[$sessionKey];

    // Réinitialiser si la fenêtre est expirée
    if ($now - $data['window_start'] >= $windowSeconds) {
        $_SESSION[$sessionKey] = [
            'count' => 1,
            'window_start' => $now
        ];
        return true;
    }

    // Vérifier la limite
    if ($data['count'] >= $maxRequests) {
        return false;
    }

    // Incrémenter
    $_SESSION[$sessionKey]['count']++;
    return true;
}

/**
 * Obtenir une connexion Redis
 */
function getRedisConnection(): ?Redis
{
    static $redis = null;
    static $connected = null;

    // Cache le résultat pour éviter les reconnexions
    if ($connected === false) {
        return null;
    }

    if ($redis !== null && $connected === true) {
        return $redis;
    }

    // Vérifier si l'extension Redis est chargée
    if (!extension_loaded('redis')) {
        $connected = false;
        return null;
    }

    try {
        $redis = new Redis();
        $host = $_ENV['REDIS_HOST'] ?? '127.0.0.1';
        $port = (int) ($_ENV['REDIS_PORT'] ?? 6380);
        $timeout = 1.0; // Timeout court pour ne pas bloquer

        if (!$redis->connect($host, $port, $timeout)) {
            $connected = false;
            return null;
        }

        // Auth si configuré
        $password = $_ENV['REDIS_PASSWORD'] ?? null;
        if ($password) {
            $redis->auth($password);
        }

        // Sélectionner la DB
        $db = (int) ($_ENV['REDIS_DB'] ?? 0);
        $redis->select($db);

        $connected = true;
        return $redis;
    } catch (Exception $e) {
        error_log('Redis connection failed: ' . $e->getMessage());
        $connected = false;
        return null;
    }
}

/**
 * Valider que la requête est admin
 */
function requireAdmin(): void
{
    global $authUserId, $db;

    requireAuth();

    $stmt = $db->prepare("SELECT is_admin FROM users WHERE id = :id");
    $stmt->execute(['id' => $authUserId]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_admin']) {
        jsonError('forbidden', 403);
    }
}

<?php
/**
 * SHIELD - API Bootstrap
 *
 * Point d'entree commun pour tous les endpoints API.
 * Gere l'authentification, CSRF et les reponses JSON.
 *
 * USAGE dans chaque endpoint API:
 *
 *   require '_bootstrap.php';
 *   requireAuth();      // Optionnel si endpoint public
 *   requireCsrf();      // Obligatoire pour POST/PUT/DELETE
 *
 *   try {
 *       require_once CONTROLLERS_PATH . '/MonController.php';
 *       $controller = new Controllers\MonController($db);
 *       // ...
 *   } catch (Exception $e) {
 *       handleApiError($e);
 *   }
 */

declare(strict_types=1);

// Charger le bootstrap principal
require_once __DIR__ . '/../../../backend/php/bootstrap.php';

// ============================================
// CONFIGURATION API
// ============================================

// Headers CORS
header('Access-Control-Allow-Origin: ' . (APP_ENV === 'development' ? '*' : APP_URL));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ============================================
// FONCTIONS HELPER API
// ============================================

/**
 * Verifie que l'utilisateur est authentifie
 * Termine avec erreur 401 si non authentifie
 */
function requireAuth(): void
{
    // Check session auth
    if (isset($_SESSION['user_id'])) {
        return;
    }

    // Check JWT auth (pour mobile app)
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        if (validateJwt($token)) {
            return;
        }
    }

    json_error(__('error.401'), 401);
}

/**
 * Verifie le token CSRF (obligatoire pour POST/PUT/DELETE)
 * Termine avec erreur 419 si invalide
 */
function requireCsrf(): void
{
    // Skip pour les methodes safe
    if (in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'OPTIONS'])) {
        return;
    }

    // Skip si JWT auth (mobile app gere autrement)
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader)) {
        return;
    }

    // Verifier le token CSRF
    $token = $_POST['_token']
        ?? $_SERVER['HTTP_X_CSRF_TOKEN']
        ?? getJsonInput()['_token']
        ?? '';

    if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        json_error(__('error.419'), 419);
    }
}

/**
 * Verifie qu'une requete est bien POST
 */
function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('Method not allowed', 405);
    }
}

/**
 * Verifie qu'une requete est bien GET
 */
function requireGet(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        json_error('Method not allowed', 405);
    }
}

/**
 * Obtient les donnees JSON de la requete
 *
 * @return array<string, mixed>
 */
function getJsonInput(): array
{
    static $input = null;

    if ($input === null) {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true) ?? [];
    }

    return $input;
}

/**
 * Obtient un parametre de la requete (GET, POST ou JSON)
 *
 * @param string $key Nom du parametre
 * @param mixed $default Valeur par defaut
 * @return mixed
 */
function getParam(string $key, mixed $default = null): mixed
{
    return $_GET[$key]
        ?? $_POST[$key]
        ?? getJsonInput()[$key]
        ?? $default;
}

/**
 * Obtient un parametre entier
 *
 * @param string $key Nom du parametre
 * @param int $default Valeur par defaut
 * @return int
 */
function getIntParam(string $key, int $default = 0): int
{
    $value = getParam($key);
    return $value !== null ? (int)$value : $default;
}

/**
 * Obtient l'ID de l'utilisateur connecte
 *
 * @return int|null
 */
function getCurrentUserId(): ?int
{
    if (isset($_SESSION['user_id'])) {
        return (int)$_SESSION['user_id'];
    }

    // Check JWT
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $payload = decodeJwt($matches[1]);
        if ($payload && isset($payload['user_id'])) {
            return (int)$payload['user_id'];
        }
    }

    return null;
}

/**
 * Valide un token JWT
 *
 * @param string $token Token JWT
 * @return bool
 */
function validateJwt(string $token): bool
{
    $payload = decodeJwt($token);
    if ($payload === null) {
        return false;
    }

    // Verifier expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return false;
    }

    return true;
}

/**
 * Decode un token JWT
 *
 * @param string $token Token JWT
 * @return array<string, mixed>|null
 */
function decodeJwt(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$header, $payload, $signature] = $parts;

    // Verifier signature
    $expectedSignature = hash_hmac('sha256', "$header.$payload", JWT_SECRET, true);
    $expectedSignature = rtrim(strtr(base64_encode($expectedSignature), '+/', '-_'), '=');

    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }

    // Decoder payload
    $payloadJson = base64_decode(strtr($payload, '-_', '+/'));
    $payloadData = json_decode($payloadJson, true);

    return is_array($payloadData) ? $payloadData : null;
}

/**
 * Genere un token JWT
 *
 * @param array<string, mixed> $payload Donnees du token
 * @return string
 */
function generateJwt(array $payload): string
{
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $header = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');

    // Ajouter timestamps
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;

    $payloadJson = json_encode($payload);
    $payloadEncoded = rtrim(strtr(base64_encode($payloadJson), '+/', '-_'), '=');

    $signature = hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true);
    $signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

    return "$header.$payloadEncoded.$signature";
}

/**
 * Gere les erreurs API de maniere uniforme
 *
 * @param Throwable $e Exception
 */
function handleApiError(Throwable $e): never
{
    error_log('SHIELD API Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());

    $statusCode = 500;
    $message = __('msg.error');

    // Certaines exceptions ont un code HTTP specifique
    if ($e->getCode() >= 400 && $e->getCode() < 600) {
        $statusCode = $e->getCode();
    }

    // En mode debug, afficher le message reel
    if (APP_DEBUG) {
        $message = $e->getMessage();
    }

    json_error($message, $statusCode);
}

/**
 * Valide les champs requis
 *
 * @param array<string> $fields Liste des champs requis
 * @param array<string, mixed> $data Donnees a valider
 * @throws Exception Si un champ est manquant
 */
function validateRequired(array $fields, array $data): void
{
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            $missing[] = $field;
        }
    }

    if (!empty($missing)) {
        throw new Exception(__('validation.required') . ': ' . implode(', ', $missing), 422);
    }
}

/**
 * Valide un email
 *
 * @param string $email Email a valider
 * @throws Exception Si email invalide
 */
function validateEmail(string $email): void
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception(__('validation.email'), 422);
    }
}

/**
 * Valide un numero de telephone (format E.164)
 *
 * @param string $phone Telephone a valider
 * @throws Exception Si telephone invalide
 */
function validatePhone(string $phone): void
{
    // Format E.164: +[code pays][numero] ex: +33612345678
    if (!preg_match('/^\+[1-9]\d{6,14}$/', $phone)) {
        throw new Exception(__('validation.phone'), 422);
    }
}

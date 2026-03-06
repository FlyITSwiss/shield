<?php
/**
 * SHIELD - Bootstrap PHP
 * Initialisation de l'application
 *
 * Ce fichier definit les constantes, charge la configuration,
 * initialise la connexion BDD et fournit les helpers globaux.
 */

declare(strict_types=1);

// ============================================
// PREVENTION DOUBLE INCLUSION
// ============================================
if (defined('SHIELD_BOOTSTRAP_LOADED')) {
    return;
}
define('SHIELD_BOOTSTRAP_LOADED', true);

// ============================================
// CONSTANTES DE CHEMINS
// ============================================

// Racine du projet (un niveau au-dessus de backend/php)
define('ROOT_PATH', dirname(__DIR__, 2));

// Chemins backend
define('BACKEND_PATH', ROOT_PATH . '/backend/php');
define('CONTROLLERS_PATH', BACKEND_PATH . '/Controllers');
define('MODELS_PATH', BACKEND_PATH . '/Models');
define('SERVICES_PATH', BACKEND_PATH . '/Services');
define('VIEWS_PATH', BACKEND_PATH . '/Views');
define('HELPERS_PATH', BACKEND_PATH . '/Helpers');
define('MIDDLEWARE_PATH', BACKEND_PATH . '/Middleware');
define('CONFIG_PATH', BACKEND_PATH . '/config');
define('LANG_PATH', BACKEND_PATH . '/lang');

// Chemins public
define('PUBLIC_PATH', ROOT_PATH . '/public');
define('ASSETS_PATH', PUBLIC_PATH . '/assets');
define('UPLOADS_PATH', PUBLIC_PATH . '/uploads');

// Chemins storage
define('STORAGE_PATH', ROOT_PATH . '/storage');
define('LOGS_PATH', STORAGE_PATH . '/logs');
define('CACHE_PATH', STORAGE_PATH . '/cache');

// ============================================
// CHARGEMENT CONFIGURATION ENVIRONNEMENT
// ============================================

// Charger .env si existe (dev local)
$envFile = ROOT_PATH . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }
    }
}

// ============================================
// HELPER POUR ENV VARS
// ============================================

/**
 * Recupere une variable d'environnement depuis $_ENV ou getenv()
 */
function env(string $key, mixed $default = null): mixed
{
    $value = $_ENV[$key] ?? getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return $value;
}

// ============================================
// CONSTANTES D'APPLICATION
// ============================================

// Environnement
define('APP_ENV', env('APP_ENV', 'production'));
define('APP_DEBUG', filter_var(env('APP_DEBUG', false), FILTER_VALIDATE_BOOLEAN));
define('APP_URL', env('APP_URL', 'https://stabilis-it.ch/internal/shield'));

// Base path (vide en local, /internal/shield en prod)
$basePath = '';
if (strpos(APP_URL, '/internal/shield') !== false) {
    $basePath = '/internal/shield';
}
define('BASE_PATH', $basePath);

// Database
define('DB_HOST', env('DB_HOST', 'localhost'));
define('DB_PORT', (int)env('DB_PORT', 3306));
define('DB_DATABASE', env('DB_DATABASE', 'shield'));
define('DB_USERNAME', env('DB_USERNAME', 'shield_user'));
define('DB_PASSWORD', env('DB_PASSWORD', ''));
define('DB_CHARSET', 'utf8mb4');

// Session
define('SESSION_LIFETIME', 86400); // 24 heures

// Upload limits
define('MAX_UPLOAD_SIZE', 20 * 1024 * 1024); // 20 MB

// JWT
define('JWT_SECRET', env('JWT_SECRET', 'shield-secret-change-in-production'));
define('JWT_EXPIRY', 3600 * 24 * 7); // 7 jours

// API Keys (optionnel, pour services externes)
define('TWILIO_ACCOUNT_SID', env('TWILIO_ACCOUNT_SID', ''));
define('TWILIO_AUTH_TOKEN', env('TWILIO_AUTH_TOKEN', ''));
define('TWILIO_PHONE_NUMBER', env('TWILIO_PHONE_NUMBER', ''));
define('DEEPGRAM_API_KEY', env('DEEPGRAM_API_KEY', ''));
define('ELEVENLABS_API_KEY', env('ELEVENLABS_API_KEY', ''));
define('OPENAI_API_KEY', env('OPENAI_API_KEY', ''));
define('FIREBASE_SERVER_KEY', env('FIREBASE_SERVER_KEY', ''));

// ============================================
// CONFIGURATION ERREURS
// ============================================

if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
    ini_set('display_errors', '0');
}
ini_set('log_errors', '1');
ini_set('error_log', LOGS_PATH . '/php_errors.log');

// ============================================
// AUTOLOAD
// ============================================

// Autoload Composer si existe (cherche d'abord a la racine, puis dans backend/php)
$composerAutoload = ROOT_PATH . '/vendor/autoload.php';
if (!file_exists($composerAutoload)) {
    $composerAutoload = BACKEND_PATH . '/vendor/autoload.php';
}
if (file_exists($composerAutoload)) {
    require_once $composerAutoload;
}

// Autoload simple pour les classes du projet
spl_autoload_register(function (string $class): void {
    // Mapping des namespaces (avec prefixe Shield\\)
    $namespaces = [
        'Shield\\Controllers\\' => CONTROLLERS_PATH . '/',
        'Shield\\Models\\' => MODELS_PATH . '/',
        'Shield\\Services\\' => SERVICES_PATH . '/',
        'Shield\\Helpers\\' => HELPERS_PATH . '/',
        'Shield\\Middleware\\' => MIDDLEWARE_PATH . '/',
    ];

    foreach ($namespaces as $prefix => $basePath) {
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) === 0) {
            $relativeClass = substr($class, $len);
            $file = $basePath . str_replace('\\', '/', $relativeClass) . '.php';
            if (file_exists($file)) {
                require_once $file;
                return;
            }
        }
    }
});

// ============================================
// CHARGEMENT HELPERS
// ============================================

require_once HELPERS_PATH . '/PathHelper.php';

// ============================================
// FONCTIONS HELPERS GLOBALES
// ============================================

/**
 * Fonction de traduction i18n
 *
 * @param string $key Cle de traduction (format: module.key)
 * @param array<string, mixed> $params Parametres de remplacement
 * @return string Texte traduit
 */
function __(string $key, array $params = []): string
{
    static $translations = null;

    if ($translations === null) {
        // Detecter la langue (session, cookie, header, defaut)
        $lang = $_SESSION['lang'] ?? $_COOKIE['lang'] ?? 'fr';
        if (isset($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
            $acceptLang = substr($_SERVER['HTTP_ACCEPT_LANGUAGE'], 0, 2);
            if (in_array($acceptLang, ['fr', 'en', 'de', 'es', 'it', 'nl', 'sv', 'pl', 'el', 'pt'])) {
                $lang = $lang === 'fr' ? $acceptLang : $lang;
            }
        }

        $langFile = LANG_PATH . '/' . $lang . '.php';
        if (file_exists($langFile)) {
            $translations = require $langFile;
        } else {
            // Fallback francais
            $langFile = LANG_PATH . '/fr.php';
            $translations = file_exists($langFile) ? require $langFile : [];
        }
    }

    $text = $translations[$key] ?? $key;

    // Remplacement des parametres :param
    foreach ($params as $paramKey => $value) {
        $text = str_replace(':' . $paramKey, (string)$value, $text);
    }

    return $text;
}

/**
 * Genere une URL complete avec le base path
 *
 * @param string $path Chemin relatif
 * @return string URL complete
 */
function base_url(string $path = ''): string
{
    $basePath = BASE_PATH;
    if ($path !== '' && $path[0] !== '/') {
        $path = '/' . $path;
    }
    return $basePath . $path;
}

/**
 * Genere une URL pour les assets
 *
 * @param string $path Chemin relatif dans /assets/
 * @return string URL complete de l'asset
 */
function asset_url(string $path): string
{
    return base_url('assets/' . ltrim($path, '/'));
}

/**
 * Genere une URL pour les assets avec cache busting
 *
 * @param string $path Chemin relatif dans /assets/
 * @return string URL avec version hash
 */
function versioned_asset(string $path): string
{
    $filePath = PUBLIC_PATH . '/assets/' . ltrim($path, '/');
    $version = '';
    if (file_exists($filePath)) {
        $version = '?v=' . substr(md5_file($filePath), 0, 8);
    }
    return asset_url($path) . $version;
}

/**
 * Genere une URL pour l'API
 *
 * @param string $endpoint Endpoint API (sans /api/v1/)
 * @return string URL complete de l'API
 */
function api_url(string $endpoint): string
{
    return base_url('api/v1/' . ltrim($endpoint, '/'));
}

/**
 * Redirige vers une URL
 *
 * @param string $path Chemin relatif
 * @param int $statusCode Code HTTP (302 par defaut)
 */
function redirect_to(string $path, int $statusCode = 302): never
{
    header('Location: ' . base_url($path), true, $statusCode);
    exit;
}

/**
 * Echappe le HTML pour prevenir XSS
 *
 * @param string|null $string Chaine a echapper
 * @return string Chaine echappee
 */
function e(?string $string): string
{
    return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Retourne une reponse JSON
 *
 * @param mixed $data Donnees a encoder
 * @param int $statusCode Code HTTP
 */
function json_response(mixed $data, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Retourne une erreur JSON
 *
 * @param string $message Message d'erreur
 * @param int $statusCode Code HTTP
 * @param array<string, mixed> $extra Donnees supplementaires
 */
function json_error(string $message, int $statusCode = 400, array $extra = []): never
{
    $response = array_merge(['success' => false, 'error' => $message], $extra);
    json_response($response, $statusCode);
}

/**
 * Retourne un succes JSON
 *
 * @param mixed $data Donnees
 * @param string|null $message Message optionnel
 */
function json_success(mixed $data = null, ?string $message = null): never
{
    $response = ['success' => true];
    if ($message !== null) {
        $response['message'] = $message;
    }
    if ($data !== null) {
        $response['data'] = $data;
    }
    json_response($response);
}

/**
 * Verifie si la requete est AJAX
 *
 * @return bool
 */
function is_ajax(): bool
{
    return isset($_SERVER['HTTP_X_REQUESTED_WITH'])
        && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}

/**
 * Genere un token CSRF
 *
 * @return string Token CSRF
 */
function csrf_token(): string
{
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Verifie le token CSRF
 *
 * @return bool True si valide
 */
function verify_csrf(): bool
{
    $token = $_POST['_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Genere un champ hidden CSRF pour les formulaires
 *
 * @return string HTML du champ hidden
 */
function csrf_field(): string
{
    return '<input type="hidden" name="_token" value="' . e(csrf_token()) . '">';
}

// ============================================
// INITIALISATION SESSION
// ============================================

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path' => BASE_PATH ?: '/',
        'secure' => APP_ENV === 'production',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

// ============================================
// CONNEXION BASE DE DONNEES
// ============================================

/**
 * Obtient la connexion PDO
 *
 * @return PDO Instance PDO
 * @throws PDOException Si connexion echoue
 */
function get_db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            DB_HOST,
            DB_PORT,
            DB_DATABASE,
            DB_CHARSET
        );

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ];

        $pdo = new PDO($dsn, DB_USERNAME, DB_PASSWORD, $options);
    }

    return $pdo;
}

// Variable globale $db pour compatibilite
$db = null;
try {
    $db = get_db();
} catch (PDOException $e) {
    if (APP_DEBUG) {
        throw $e;
    }
    error_log('Database connection failed: ' . $e->getMessage());
}

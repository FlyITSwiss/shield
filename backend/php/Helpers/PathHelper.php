<?php
/**
 * SHIELD - PathHelper
 * Gestion centralisee des chemins de fichiers
 *
 * REGLE: Tous les chemins DOIVENT passer par ce helper.
 * INTERDIT: '/var/www/shield/...' ou dirname(__DIR__) . '/uploads'
 */

declare(strict_types=1);

namespace Helpers;

class PathHelper
{
    /**
     * Chemin racine du projet
     *
     * @return string Chemin absolu vers la racine
     */
    public static function getRootPath(): string
    {
        return defined('ROOT_PATH') ? ROOT_PATH : dirname(__DIR__, 3);
    }

    /**
     * Chemin du backend PHP
     *
     * @return string Chemin absolu vers backend/php
     */
    public static function getBackendPath(): string
    {
        return self::getRootPath() . '/backend/php';
    }

    /**
     * Chemin des controllers
     *
     * @return string Chemin absolu vers Controllers
     */
    public static function getControllersPath(): string
    {
        return self::getBackendPath() . '/Controllers';
    }

    /**
     * Chemin des models
     *
     * @return string Chemin absolu vers Models
     */
    public static function getModelsPath(): string
    {
        return self::getBackendPath() . '/Models';
    }

    /**
     * Chemin des services
     *
     * @return string Chemin absolu vers Services
     */
    public static function getServicesPath(): string
    {
        return self::getBackendPath() . '/Services';
    }

    /**
     * Chemin des vues
     *
     * @return string Chemin absolu vers Views
     */
    public static function getViewsPath(): string
    {
        return self::getBackendPath() . '/Views';
    }

    /**
     * Chemin de la configuration
     *
     * @return string Chemin absolu vers config
     */
    public static function getConfigPath(): string
    {
        return self::getBackendPath() . '/config';
    }

    /**
     * Chemin des traductions
     *
     * @return string Chemin absolu vers lang
     */
    public static function getLangPath(): string
    {
        return self::getBackendPath() . '/lang';
    }

    /**
     * Chemin public (document root)
     *
     * @return string Chemin absolu vers public
     */
    public static function getPublicPath(): string
    {
        return self::getRootPath() . '/public';
    }

    /**
     * Chemin des assets
     *
     * @return string Chemin absolu vers public/assets
     */
    public static function getAssetsPath(): string
    {
        return self::getPublicPath() . '/assets';
    }

    /**
     * Chemin des uploads
     *
     * @return string Chemin absolu vers public/uploads
     */
    public static function getUploadsPath(): string
    {
        return self::getPublicPath() . '/uploads';
    }

    /**
     * Chemin des avatars utilisateurs
     *
     * @return string Chemin absolu vers public/uploads/avatars
     */
    public static function getAvatarsPath(): string
    {
        return self::getUploadsPath() . '/avatars';
    }

    /**
     * Chemin des photos d'incidents
     *
     * @return string Chemin absolu vers public/uploads/incidents
     */
    public static function getIncidentsPath(): string
    {
        return self::getUploadsPath() . '/incidents';
    }

    /**
     * Chemin des fichiers audio (enregistrements)
     *
     * @return string Chemin absolu vers public/uploads/audio
     */
    public static function getAudioPath(): string
    {
        return self::getUploadsPath() . '/audio';
    }

    /**
     * Chemin du storage (donnees privees)
     *
     * @return string Chemin absolu vers storage
     */
    public static function getStoragePath(): string
    {
        return self::getRootPath() . '/storage';
    }

    /**
     * Chemin des logs
     *
     * @return string Chemin absolu vers storage/logs
     */
    public static function getLogsPath(): string
    {
        return self::getStoragePath() . '/logs';
    }

    /**
     * Chemin du cache
     *
     * @return string Chemin absolu vers storage/cache
     */
    public static function getCachePath(): string
    {
        return self::getStoragePath() . '/cache';
    }

    /**
     * Chemin des fichiers temporaires
     *
     * @return string Chemin absolu vers storage/temp
     */
    public static function getTempPath(): string
    {
        return self::getStoragePath() . '/temp';
    }

    /**
     * Construit un chemin absolu depuis la racine
     *
     * @param string ...$parts Segments du chemin
     * @return string Chemin absolu
     */
    public static function join(string ...$parts): string
    {
        $path = self::getRootPath();
        foreach ($parts as $part) {
            $part = trim($part, '/\\');
            if ($part !== '') {
                $path .= '/' . $part;
            }
        }
        return $path;
    }

    /**
     * Verifie si un chemin est dans un repertoire autorise
     *
     * @param string $path Chemin a verifier
     * @param string $basePath Repertoire de base autorise
     * @return bool True si le chemin est autorise
     */
    public static function isPathSafe(string $path, string $basePath): bool
    {
        $realPath = realpath($path);
        $realBase = realpath($basePath);

        if ($realPath === false || $realBase === false) {
            return false;
        }

        return strpos($realPath, $realBase) === 0;
    }

    /**
     * Cree un repertoire s'il n'existe pas
     *
     * @param string $path Chemin du repertoire
     * @param int $permissions Permissions (0755 par defaut)
     * @return bool True si cree ou existe deja
     */
    public static function ensureDirectory(string $path, int $permissions = 0755): bool
    {
        if (is_dir($path)) {
            return true;
        }

        return mkdir($path, $permissions, true);
    }

    /**
     * Genere un nom de fichier unique pour upload
     *
     * @param string $originalName Nom original du fichier
     * @param string $prefix Prefixe optionnel
     * @return string Nom unique
     */
    public static function generateUniqueFilename(string $originalName, string $prefix = ''): string
    {
        $extension = pathinfo($originalName, PATHINFO_EXTENSION);
        $unique = uniqid($prefix, true);
        $hash = substr(md5($originalName . time()), 0, 8);

        return sprintf('%s_%s.%s', $unique, $hash, strtolower($extension));
    }

    /**
     * Obtient le chemin relatif depuis la racine public
     *
     * @param string $absolutePath Chemin absolu
     * @return string|null Chemin relatif ou null si hors public
     */
    public static function getPublicRelativePath(string $absolutePath): ?string
    {
        $publicPath = self::getPublicPath();
        $realPath = realpath($absolutePath);
        $realPublic = realpath($publicPath);

        if ($realPath === false || $realPublic === false) {
            return null;
        }

        if (strpos($realPath, $realPublic) !== 0) {
            return null;
        }

        return substr($realPath, strlen($realPublic));
    }

    /**
     * Nettoie un nom de fichier (securite)
     *
     * @param string $filename Nom de fichier
     * @return string Nom nettoye
     */
    public static function sanitizeFilename(string $filename): string
    {
        // Supprimer les caracteres dangereux
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);

        // Supprimer les points multiples
        $filename = preg_replace('/\.+/', '.', $filename);

        // Supprimer les underscores multiples
        $filename = preg_replace('/_+/', '_', $filename);

        // Limiter la longueur
        if (strlen($filename) > 200) {
            $ext = pathinfo($filename, PATHINFO_EXTENSION);
            $name = pathinfo($filename, PATHINFO_FILENAME);
            $filename = substr($name, 0, 190) . '.' . $ext;
        }

        return trim($filename, '._');
    }
}

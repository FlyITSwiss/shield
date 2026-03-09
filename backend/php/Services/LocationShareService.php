<?php
declare(strict_types=1);

namespace Shield\Services;

use PDO;
use PDOException;

/**
 * LocationShareService - Gestion du partage de position en temps réel
 *
 * Feature Premium SHIELD:
 * - Partage de position temps réel avec contacts de confiance
 * - Mode "Je rentre" avec ETA et alertes automatiques
 * - Historique des déplacements
 */
class LocationShareService
{
    private PDO $db;
    private GeoService $geoService;

    // Durées par défaut (en minutes)
    private const DEFAULT_DURATION = 60;
    private const MAX_DURATION = 1440; // 24h
    private const UPDATE_INTERVAL_SECONDS = 30;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->geoService = new GeoService($db);
    }

    /**
     * Générer un token unique pour le partage
     */
    private function generateToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    /**
     * Créer un nouveau partage de position
     */
    public function create(int $userId, array $options = []): array
    {
        $token = $this->generateToken();
        $shareType = $options['type'] ?? 'realtime';
        $duration = min($options['duration'] ?? self::DEFAULT_DURATION, self::MAX_DURATION);

        $expiresAt = null;
        if ($duration > 0) {
            $expiresAt = date('Y-m-d H:i:s', strtotime("+{$duration} minutes"));
        }

        $stmt = $this->db->prepare("
            INSERT INTO location_shares (
                user_id, share_token, name, share_type,
                destination_name, destination_latitude, destination_longitude, expected_arrival_at,
                duration_minutes, expires_at, update_interval_seconds,
                notify_on_arrival, notify_on_delay, alert_if_no_movement_minutes
            ) VALUES (
                :user_id, :token, :name, :type,
                :dest_name, :dest_lat, :dest_lon, :eta,
                :duration, :expires, :interval,
                :notify_arrival, :notify_delay, :alert_no_movement
            )
        ");

        $stmt->execute([
            'user_id' => $userId,
            'token' => $token,
            'name' => $options['name'] ?? null,
            'type' => $shareType,
            'dest_name' => $options['destination_name'] ?? null,
            'dest_lat' => $options['destination_latitude'] ?? null,
            'dest_lon' => $options['destination_longitude'] ?? null,
            'eta' => $options['expected_arrival_at'] ?? null,
            'duration' => $duration,
            'expires' => $expiresAt,
            'interval' => $options['update_interval'] ?? self::UPDATE_INTERVAL_SECONDS,
            'notify_arrival' => (int)($options['notify_on_arrival'] ?? true),
            'notify_delay' => (int)($options['notify_on_delay'] ?? true),
            'alert_no_movement' => $options['alert_if_no_movement_minutes'] ?? null
        ]);

        $shareId = (int)$this->db->lastInsertId();

        // Ajouter les contacts autorisés
        if (!empty($options['contact_ids'])) {
            $this->addContacts($shareId, $options['contact_ids']);
        }

        return [
            'id' => $shareId,
            'token' => $token,
            'share_url' => $this->getShareUrl($token),
            'expires_at' => $expiresAt,
            'type' => $shareType
        ];
    }

    /**
     * Ajouter des contacts autorisés au partage
     */
    public function addContacts(int $shareId, array $contactIds): void
    {
        $stmt = $this->db->prepare("
            INSERT IGNORE INTO location_share_contacts (share_id, contact_id)
            VALUES (:share_id, :contact_id)
        ");

        foreach ($contactIds as $contactId) {
            $stmt->execute([
                'share_id' => $shareId,
                'contact_id' => (int)$contactId
            ]);
        }
    }

    /**
     * Obtenir l'URL de partage
     */
    public function getShareUrl(string $token): string
    {
        $basePath = $_ENV['APP_URL'] ?? '';
        return "{$basePath}/share/{$token}";
    }

    /**
     * Mettre à jour la position
     */
    public function updateLocation(int $shareId, array $location): bool
    {
        $latitude = (float)$location['latitude'];
        $longitude = (float)$location['longitude'];

        if (!$this->geoService->validateCoordinates($latitude, $longitude)) {
            return false;
        }

        // Obtenir l'adresse
        $address = $this->geoService->reverseGeocode($latitude, $longitude);

        // Mettre à jour la position actuelle
        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                last_latitude = :lat,
                last_longitude = :lon,
                last_accuracy = :accuracy,
                last_speed = :speed,
                last_heading = :heading,
                last_address = :address,
                last_location_at = NOW(),
                battery_level = :battery,
                updated_at = NOW()
            WHERE id = :id AND status = 'active'
        ");

        $result = $stmt->execute([
            'id' => $shareId,
            'lat' => $latitude,
            'lon' => $longitude,
            'accuracy' => $location['accuracy'] ?? null,
            'speed' => $location['speed'] ?? null,
            'heading' => $location['heading'] ?? null,
            'address' => $address,
            'battery' => $location['battery'] ?? null
        ]);

        // Ajouter à l'historique
        if ($result) {
            $this->addToHistory($shareId, $location);
        }

        // Vérifier arrivée si mode journey
        $this->checkArrival($shareId, $latitude, $longitude);

        return $result;
    }

    /**
     * Ajouter une position à l'historique
     */
    private function addToHistory(int $shareId, array $location): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO location_share_history (
                share_id, latitude, longitude, accuracy, altitude,
                speed, heading, battery_level, is_moving
            ) VALUES (
                :share_id, :lat, :lon, :accuracy, :altitude,
                :speed, :heading, :battery, :moving
            )
        ");

        $isMoving = isset($location['speed']) && $location['speed'] > 1;

        $stmt->execute([
            'share_id' => $shareId,
            'lat' => $location['latitude'],
            'lon' => $location['longitude'],
            'accuracy' => $location['accuracy'] ?? null,
            'altitude' => $location['altitude'] ?? null,
            'speed' => $location['speed'] ?? null,
            'heading' => $location['heading'] ?? null,
            'battery' => $location['battery'] ?? null,
            'moving' => (int)$isMoving
        ]);
    }

    /**
     * Vérifier si l'utilisateur est arrivé (mode journey)
     */
    private function checkArrival(int $shareId, float $latitude, float $longitude): void
    {
        $stmt = $this->db->prepare("
            SELECT share_type, destination_latitude, destination_longitude, status
            FROM location_shares
            WHERE id = :id AND share_type = 'journey' AND status = 'active'
        ");
        $stmt->execute(['id' => $shareId]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share || !$share['destination_latitude']) {
            return;
        }

        // Calculer la distance jusqu'à destination (en km)
        $distance = $this->geoService->calculateDistance(
            $latitude,
            $longitude,
            (float)$share['destination_latitude'],
            (float)$share['destination_longitude']
        );

        // Arrivé si < 100 mètres
        if ($distance < 0.1) {
            $this->markAsArrived($shareId);
        }
    }

    /**
     * Marquer comme arrivé
     */
    public function markAsArrived(int $shareId): bool
    {
        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                status = 'arrived',
                ended_at = NOW(),
                updated_at = NOW()
            WHERE id = :id AND status = 'active'
        ");

        return $stmt->execute(['id' => $shareId]);
    }

    /**
     * Obtenir un partage par son token (pour la page publique)
     */
    public function getByToken(string $token): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                ls.*,
                u.first_name as user_name,
                u.profile_picture_url as user_avatar
            FROM location_shares ls
            JOIN users u ON ls.user_id = u.id
            WHERE ls.share_token = :token
              AND (ls.expires_at IS NULL OR ls.expires_at > NOW())
              AND ls.status IN ('active', 'paused')
        ");
        $stmt->execute(['token' => $token]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            return null;
        }

        // Incrémenter le compteur de vues
        $this->incrementViewCount($token);

        return $share;
    }

    /**
     * Incrémenter le compteur de vues
     */
    private function incrementViewCount(string $token): void
    {
        // Mettre à jour le compteur global n'est pas nécessaire ici
        // car on track par contact dans location_share_contacts
    }

    /**
     * Enregistrer une vue par un contact
     */
    public function recordContactView(int $shareId, int $contactId): void
    {
        $stmt = $this->db->prepare("
            UPDATE location_share_contacts SET
                last_viewed_at = NOW(),
                view_count = view_count + 1
            WHERE share_id = :share_id AND contact_id = :contact_id
        ");
        $stmt->execute(['share_id' => $shareId, 'contact_id' => $contactId]);
    }

    /**
     * Obtenir l'historique des positions
     */
    public function getLocationHistory(int $shareId, int $limit = 100): array
    {
        $stmt = $this->db->prepare("
            SELECT latitude, longitude, accuracy, speed, heading, battery_level, recorded_at
            FROM location_share_history
            WHERE share_id = :share_id
            ORDER BY recorded_at DESC
            LIMIT :limit
        ");
        $stmt->bindValue('share_id', $shareId, PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir les partages actifs d'un utilisateur
     */
    public function getActiveByUser(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT ls.*,
                   COUNT(lsc.id) as contact_count,
                   GROUP_CONCAT(tc.name) as contact_names
            FROM location_shares ls
            LEFT JOIN location_share_contacts lsc ON ls.id = lsc.share_id
            LEFT JOIN trusted_contacts tc ON lsc.contact_id = tc.id
            WHERE ls.user_id = :user_id
              AND ls.status IN ('active', 'paused')
              AND (ls.expires_at IS NULL OR ls.expires_at > NOW())
            GROUP BY ls.id
            ORDER BY ls.created_at DESC
        ");
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Arrêter un partage
     */
    public function stop(int $shareId, int $userId): bool
    {
        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                status = 'revoked',
                ended_at = NOW(),
                updated_at = NOW()
            WHERE id = :id AND user_id = :user_id AND status IN ('active', 'paused')
        ");

        return $stmt->execute(['id' => $shareId, 'user_id' => $userId]);
    }

    /**
     * Mettre en pause un partage
     */
    public function pause(int $shareId, int $userId): bool
    {
        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                status = 'paused',
                paused_at = NOW(),
                updated_at = NOW()
            WHERE id = :id AND user_id = :user_id AND status = 'active'
        ");

        return $stmt->execute(['id' => $shareId, 'user_id' => $userId]);
    }

    /**
     * Reprendre un partage
     */
    public function resume(int $shareId, int $userId): bool
    {
        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                status = 'active',
                paused_at = NULL,
                updated_at = NOW()
            WHERE id = :id AND user_id = :user_id AND status = 'paused'
        ");

        return $stmt->execute(['id' => $shareId, 'user_id' => $userId]);
    }

    /**
     * Prolonger un partage
     */
    public function extend(int $shareId, int $userId, int $minutes): bool
    {
        $minutes = min($minutes, self::MAX_DURATION);

        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                expires_at = DATE_ADD(COALESCE(expires_at, NOW()), INTERVAL :minutes MINUTE),
                duration_minutes = duration_minutes + :minutes,
                updated_at = NOW()
            WHERE id = :id AND user_id = :user_id AND status IN ('active', 'paused')
        ");

        return $stmt->execute([
            'id' => $shareId,
            'user_id' => $userId,
            'minutes' => $minutes
        ]);
    }

    /**
     * Nettoyer les partages expirés
     */
    public function cleanupExpired(): int
    {
        $stmt = $this->db->prepare("
            UPDATE location_shares SET
                status = 'expired',
                ended_at = NOW()
            WHERE status = 'active'
              AND expires_at IS NOT NULL
              AND expires_at < NOW()
        ");
        $stmt->execute();

        return $stmt->rowCount();
    }

    /**
     * Nettoyer l'historique ancien (> 24h)
     */
    public function cleanupOldHistory(): int
    {
        $stmt = $this->db->prepare("
            DELETE FROM location_share_history
            WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ");
        $stmt->execute();

        return $stmt->rowCount();
    }
}

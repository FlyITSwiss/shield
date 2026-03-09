<?php
declare(strict_types=1);

namespace Shield\Controllers;

use PDO;
use Shield\Services\LocationShareService;

/**
 * LocationShareController - Gestion du partage de position en temps reel
 *
 * Feature Premium SHIELD:
 * - Partage de position en dehors des incidents
 * - Mode "Je rentre" avec ETA et alertes
 * - Historique des deplacements
 */
class LocationShareController
{
    private PDO $db;
    private LocationShareService $shareService;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->shareService = new LocationShareService($db);
    }

    /**
     * POST /api/location-share/create
     *
     * Creer un nouveau partage de position
     */
    public function create(int $userId, array $data): array
    {
        $options = [
            'type' => $data['type'] ?? 'realtime',
            'name' => $data['name'] ?? null,
            'duration' => (int)($data['duration'] ?? 60),
            'contact_ids' => $data['contact_ids'] ?? [],
            'destination_name' => $data['destination_name'] ?? null,
            'destination_latitude' => isset($data['destination_latitude']) ? (float)$data['destination_latitude'] : null,
            'destination_longitude' => isset($data['destination_longitude']) ? (float)$data['destination_longitude'] : null,
            'expected_arrival_at' => $data['expected_arrival_at'] ?? null,
            'notify_on_arrival' => $data['notify_on_arrival'] ?? true,
            'notify_on_delay' => $data['notify_on_delay'] ?? true,
            'alert_if_no_movement_minutes' => $data['alert_if_no_movement_minutes'] ?? null,
            'update_interval' => $data['update_interval'] ?? 30
        ];

        // Valider le type
        $validTypes = ['realtime', 'journey', 'timed'];
        if (!in_array($options['type'], $validTypes, true)) {
            return ['success' => false, 'error' => 'invalid_share_type'];
        }

        // Pour le mode journey, destination obligatoire
        if ($options['type'] === 'journey') {
            if (!$options['destination_latitude'] || !$options['destination_longitude']) {
                return ['success' => false, 'error' => 'destination_required_for_journey'];
            }
        }

        // Verifier qu'il y a au moins un contact
        if (empty($options['contact_ids'])) {
            return ['success' => false, 'error' => 'at_least_one_contact_required'];
        }

        try {
            $result = $this->shareService->create($userId, $options);

            return [
                'success' => true,
                'share' => $result,
                'message' => 'share_created'
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * POST /api/location-share/update-location
     *
     * Mettre a jour la position
     */
    public function updateLocation(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'share_id_required'];
        }

        if (!isset($data['latitude']) || !isset($data['longitude'])) {
            return ['success' => false, 'error' => 'coordinates_required'];
        }

        $shareId = (int)$data['share_id'];

        // Verifier que le partage appartient a l'utilisateur
        if (!$this->verifyShareOwnership($shareId, $userId)) {
            return ['success' => false, 'error' => 'share_not_found'];
        }

        $location = [
            'latitude' => (float)$data['latitude'],
            'longitude' => (float)$data['longitude'],
            'accuracy' => $data['accuracy'] ?? null,
            'altitude' => $data['altitude'] ?? null,
            'speed' => $data['speed'] ?? null,
            'heading' => $data['heading'] ?? null,
            'battery' => $data['battery'] ?? null
        ];

        $success = $this->shareService->updateLocation($shareId, $location);

        return [
            'success' => $success,
            'message' => $success ? 'location_updated' : 'update_failed'
        ];
    }

    /**
     * GET /api/location-share/active
     *
     * Obtenir les partages actifs de l'utilisateur
     */
    public function getActive(int $userId): array
    {
        $shares = $this->shareService->getActiveByUser($userId);

        return [
            'success' => true,
            'shares' => $shares,
            'count' => count($shares)
        ];
    }

    /**
     * GET /api/location-share/view/{token}
     *
     * Voir un partage via son token (page publique)
     */
    public function viewByToken(string $token): array
    {
        $share = $this->shareService->getByToken($token);

        if (!$share) {
            return ['success' => false, 'error' => 'share_not_found_or_expired'];
        }

        // Ne pas exposer certains champs sensibles
        unset($share['user_id']);

        return [
            'success' => true,
            'share' => $share
        ];
    }

    /**
     * GET /api/location-share/history
     *
     * Historique des positions d'un partage
     */
    public function getHistory(int $userId, int $shareId, int $limit = 100): array
    {
        // Verifier propriete
        if (!$this->verifyShareOwnership($shareId, $userId)) {
            return ['success' => false, 'error' => 'share_not_found'];
        }

        $history = $this->shareService->getLocationHistory($shareId, $limit);

        return [
            'success' => true,
            'history' => $history,
            'count' => count($history)
        ];
    }

    /**
     * POST /api/location-share/stop
     *
     * Arreter un partage
     */
    public function stop(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'share_id_required'];
        }

        $shareId = (int)$data['share_id'];
        $success = $this->shareService->stop($shareId, $userId);

        return [
            'success' => $success,
            'message' => $success ? 'share_stopped' : 'stop_failed'
        ];
    }

    /**
     * POST /api/location-share/pause
     *
     * Mettre en pause un partage
     */
    public function pause(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'share_id_required'];
        }

        $shareId = (int)$data['share_id'];
        $success = $this->shareService->pause($shareId, $userId);

        return [
            'success' => $success,
            'message' => $success ? 'share_paused' : 'pause_failed'
        ];
    }

    /**
     * POST /api/location-share/resume
     *
     * Reprendre un partage
     */
    public function resume(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'share_id_required'];
        }

        $shareId = (int)$data['share_id'];
        $success = $this->shareService->resume($shareId, $userId);

        return [
            'success' => $success,
            'message' => $success ? 'share_resumed' : 'resume_failed'
        ];
    }

    /**
     * POST /api/location-share/extend
     *
     * Prolonger un partage
     */
    public function extend(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'share_id_required'];
        }

        if (empty($data['minutes']) || $data['minutes'] < 1) {
            return ['success' => false, 'error' => 'invalid_minutes'];
        }

        $shareId = (int)$data['share_id'];
        $minutes = (int)$data['minutes'];

        $success = $this->shareService->extend($shareId, $userId, $minutes);

        return [
            'success' => $success,
            'message' => $success ? 'share_extended' : 'extend_failed'
        ];
    }

    /**
     * POST /api/location-share/arrived
     *
     * Marquer manuellement comme arrive
     */
    public function markArrived(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'share_id_required'];
        }

        $shareId = (int)$data['share_id'];

        // Verifier propriete
        if (!$this->verifyShareOwnership($shareId, $userId)) {
            return ['success' => false, 'error' => 'share_not_found'];
        }

        $success = $this->shareService->markAsArrived($shareId);

        return [
            'success' => $success,
            'message' => $success ? 'marked_as_arrived' : 'mark_failed'
        ];
    }

    /**
     * POST /api/location-share/contact-view
     *
     * Enregistrer qu'un contact a vu le partage
     */
    public function recordContactView(array $data): array
    {
        if (empty($data['share_id']) || empty($data['contact_id'])) {
            return ['success' => false, 'error' => 'share_id_and_contact_id_required'];
        }

        $this->shareService->recordContactView(
            (int)$data['share_id'],
            (int)$data['contact_id']
        );

        return ['success' => true];
    }

    /**
     * Verifier que le partage appartient a l'utilisateur
     */
    private function verifyShareOwnership(int $shareId, int $userId): bool
    {
        $stmt = $this->db->prepare("
            SELECT id FROM location_shares
            WHERE id = :id AND user_id = :user_id
        ");
        $stmt->execute(['id' => $shareId, 'user_id' => $userId]);

        return (bool)$stmt->fetch();
    }
}

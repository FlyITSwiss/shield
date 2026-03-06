<?php
declare(strict_types=1);

namespace Shield\Controllers;

use PDO;
use Shield\Services\IncidentService;
use Shield\Services\TwilioService;
use Shield\Services\GeoService;

/**
 * IncidentController - Gestion des alertes SOS
 */
class IncidentController
{
    private PDO $db;
    private IncidentService $incidentService;

    public function __construct(PDO $db)
    {
        $this->db = $db;

        // Injecter les services
        $twilioService = new TwilioService($db);
        $geoService = new GeoService($db);

        $this->incidentService = new IncidentService($db, $twilioService, $geoService);
    }

    /**
     * POST /api/incidents/trigger
     *
     * Déclencher une alerte SOS
     * Critère CDC: < 2 secondes
     */
    public function trigger(int $userId, array $data): array
    {
        // Valider les données minimales
        if (!isset($data['trigger_type'])) {
            $data['trigger_type'] = 'five_taps';
        }

        $validTriggers = ['five_taps', 'volume_hold', 'shake', 'voice_command', 'code_word'];
        if (!in_array($data['trigger_type'], $validTriggers, true)) {
            return ['success' => false, 'error' => 'invalid_trigger_type'];
        }

        return $this->incidentService->triggerSOS($userId, $data);
    }

    /**
     * POST /api/incidents/{id}/cancel
     *
     * Annuler une alerte (fausse alerte)
     */
    public function cancel(int $userId, string $incidentId, array $data = []): array
    {
        $reason = $data['reason'] ?? 'cancelled';

        if (!in_array($reason, ['cancelled', 'false_alarm'], true)) {
            $reason = 'cancelled';
        }

        return $this->incidentService->cancelSOS($userId, $incidentId, $reason);
    }

    /**
     * POST /api/incidents/{id}/safe
     *
     * Confirmer être en sécurité
     */
    public function confirmSafe(int $userId, string $incidentId): array
    {
        return $this->incidentService->confirmSafe($userId, $incidentId);
    }

    /**
     * POST /api/incidents/{id}/location
     *
     * Mettre à jour la position pendant un incident
     */
    public function updateLocation(string $incidentId, array $data): array
    {
        if (!isset($data['latitude']) || !isset($data['longitude'])) {
            return ['success' => false, 'error' => 'missing_coordinates'];
        }

        $latitude = (float) $data['latitude'];
        $longitude = (float) $data['longitude'];
        $accuracy = isset($data['accuracy']) ? (float) $data['accuracy'] : null;

        // Valider les coordonnées
        if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            return ['success' => false, 'error' => 'invalid_coordinates'];
        }

        return $this->incidentService->updateLocation($incidentId, $latitude, $longitude, $accuracy);
    }

    /**
     * POST /api/incidents/{id}/escalate
     *
     * Escalader vers la police
     */
    public function escalate(int $userId, string $incidentId): array
    {
        return $this->incidentService->escalateToPolice($userId, $incidentId);
    }

    /**
     * GET /api/incidents/active
     *
     * Obtenir l'incident actif de l'utilisatrice
     */
    public function getActive(int $userId): array
    {
        $incident = $this->incidentService->getActiveIncident($userId);

        return [
            'success' => true,
            'has_active' => $incident !== null,
            'incident' => $incident
        ];
    }

    /**
     * GET /api/incidents/{id}
     *
     * Obtenir les détails d'un incident
     */
    public function getById(int $userId, string $incidentId): array
    {
        $incident = $this->incidentService->getIncident($incidentId);

        if (!$incident) {
            return ['success' => false, 'error' => 'incident_not_found'];
        }

        // Vérifier que l'incident appartient à l'utilisatrice
        if ((int) $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'access_denied'];
        }

        return ['success' => true, 'incident' => $incident];
    }

    /**
     * GET /api/incidents/history
     *
     * Historique des incidents
     */
    public function getHistory(int $userId, array $params = []): array
    {
        $limit = min((int) ($params['limit'] ?? 20), 100);
        $offset = (int) ($params['offset'] ?? 0);

        $incidents = $this->incidentService->getHistory($userId, $limit, $offset);

        return [
            'success' => true,
            'incidents' => $incidents,
            'pagination' => [
                'limit' => $limit,
                'offset' => $offset
            ]
        ];
    }

    /**
     * POST /api/incidents/{id}/ai-transcript
     *
     * Sauvegarder la transcription IA (webhook interne)
     */
    public function saveAITranscript(string $incidentId, array $data): array
    {
        if (empty($data['transcript'])) {
            return ['success' => false, 'error' => 'missing_transcript'];
        }

        $success = $this->incidentService->saveAITranscript(
            $incidentId,
            $data['transcript'],
            $data['summary'] ?? null
        );

        return ['success' => $success];
    }

    /**
     * POST /api/incidents/{id}/risk-score
     *
     * Mettre à jour le score de risque IA (webhook interne)
     */
    public function updateRiskScore(string $incidentId, array $data): array
    {
        if (!isset($data['score'])) {
            return ['success' => false, 'error' => 'missing_score'];
        }

        $score = (int) $data['score'];
        if ($score < 0 || $score > 100) {
            return ['success' => false, 'error' => 'invalid_score_range'];
        }

        $success = $this->incidentService->updateRiskScore($incidentId, $score);

        return ['success' => $success];
    }

    /**
     * GET /api/incidents/stats (admin)
     *
     * Statistiques des incidents
     */
    public function getStats(array $params = []): array
    {
        $period = $params['period'] ?? 'month';

        if (!in_array($period, ['day', 'week', 'month', 'year', 'all'], true)) {
            $period = 'month';
        }

        $stats = $this->incidentService->getStats($period);

        return ['success' => true, 'stats' => $stats, 'period' => $period];
    }

    /**
     * GET /api/incidents/monitoring (admin)
     *
     * Incidents actifs pour monitoring
     */
    public function getActiveIncidents(array $params = []): array
    {
        $limit = min((int) ($params['limit'] ?? 50), 200);

        $incidents = $this->incidentService->getActiveIncidents($limit);

        return [
            'success' => true,
            'incidents' => $incidents,
            'count' => count($incidents)
        ];
    }

    // ========== INCIDENT SHARING ==========

    /**
     * POST /api/incidents/generate-share
     *
     * Générer un lien de partage pour l'incident
     */
    public function generateShare(int $userId, array $data): array
    {
        if (empty($data['incident_id'])) {
            return ['success' => false, 'error' => 'missing_incident_id'];
        }

        $incidentId = $data['incident_id'];
        $expiryHours = (int) ($data['expiry_hours'] ?? 24);
        $allowHistory = (bool) ($data['allow_history'] ?? false);
        $recipientType = $data['recipient_type'] ?? 'contact';

        // Valider que l'incident appartient à l'utilisatrice
        $incident = $this->incidentService->getIncident($incidentId);
        if (!$incident || (int) $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'access_denied'];
        }

        // Générer le share
        $shareId = $this->generateUUID();
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expiryHours} hours"));

        $stmt = $this->db->prepare('
            INSERT INTO incident_shares
            (incident_id, share_id, token, recipient_type, allow_location_history, expires_at)
            VALUES (
                (SELECT id FROM incidents WHERE uuid = :uuid),
                :share_id, :token, :recipient_type, :allow_history, :expires_at
            )
        ');

        $stmt->execute([
            'uuid' => $incidentId,
            'share_id' => $shareId,
            'token' => $token,
            'recipient_type' => $recipientType,
            'allow_history' => $allowHistory ? 1 : 0,
            'expires_at' => $expiresAt
        ]);

        return [
            'success' => true,
            'share_id' => $shareId,
            'token' => $token,
            'expires_at' => $expiresAt
        ];
    }

    /**
     * GET /api/incidents/get-shares
     *
     * Obtenir les partages actifs d'un incident
     */
    public function getShares(int $userId, string $incidentId): array
    {
        // Valider l'accès
        $incident = $this->incidentService->getIncident($incidentId);
        if (!$incident || (int) $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'access_denied'];
        }

        $stmt = $this->db->prepare('
            SELECT s.share_id, s.recipient_type, s.expires_at, s.view_count, s.last_viewed_at,
                   s.created_at, s.revoked_at,
                   c.name as contact_name
            FROM incident_shares s
            LEFT JOIN trusted_contacts c ON s.recipient_contact_id = c.id
            WHERE s.incident_id = (SELECT id FROM incidents WHERE uuid = :uuid)
            AND s.revoked_at IS NULL
            AND s.expires_at > NOW()
            ORDER BY s.created_at DESC
        ');

        $stmt->execute(['uuid' => $incidentId]);

        return [
            'success' => true,
            'shares' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ];
    }

    /**
     * POST /api/incidents/revoke-share
     *
     * Révoquer un lien de partage
     */
    public function revokeShare(int $userId, array $data): array
    {
        if (empty($data['share_id'])) {
            return ['success' => false, 'error' => 'missing_share_id'];
        }

        $shareId = $data['share_id'];

        // Vérifier que le partage appartient à un incident de l'utilisatrice
        $stmt = $this->db->prepare('
            SELECT s.id, i.user_id
            FROM incident_shares s
            JOIN incidents i ON s.incident_id = i.id
            WHERE s.share_id = :share_id
        ');
        $stmt->execute(['share_id' => $shareId]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share || (int) $share['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'access_denied'];
        }

        // Révoquer
        $stmt = $this->db->prepare('
            UPDATE incident_shares SET revoked_at = NOW() WHERE share_id = :share_id
        ');
        $stmt->execute(['share_id' => $shareId]);

        return ['success' => true];
    }

    // ========== CONTACT TRACKING ==========

    /**
     * GET /api/incidents/contact-statuses
     *
     * Obtenir les statuts de réponse des contacts
     */
    public function getContactStatuses(int $userId, string $incidentId): array
    {
        // Valider l'accès
        $incident = $this->incidentService->getIncident($incidentId);
        if (!$incident || (int) $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'access_denied'];
        }

        $stmt = $this->db->prepare('
            SELECT cr.contact_id, cr.status, cr.notified_at, cr.delivered_at,
                   cr.acknowledged_at, cr.responding_at, cr.arrived_at,
                   cr.response_message, cr.eta_minutes,
                   tc.name as contact_name, tc.phone
            FROM contact_responses cr
            JOIN trusted_contacts tc ON cr.contact_id = tc.id
            WHERE cr.incident_id = (SELECT id FROM incidents WHERE uuid = :uuid)
            ORDER BY tc.priority ASC, cr.created_at ASC
        ');

        $stmt->execute(['uuid' => $incidentId]);

        return [
            'success' => true,
            'contacts' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ];
    }

    /**
     * POST /api/incidents/acknowledge-contact
     *
     * Marquer un contact comme ayant confirmé réception
     */
    public function acknowledgeContact(array $data): array
    {
        if (empty($data['incident_id']) || empty($data['contact_id'])) {
            return ['success' => false, 'error' => 'missing_parameters'];
        }

        $incidentId = $data['incident_id'];
        $contactId = (int) $data['contact_id'];
        $responseMessage = $data['response_message'] ?? null;

        $stmt = $this->db->prepare('
            UPDATE contact_responses
            SET status = "acknowledged",
                acknowledged_at = NOW(),
                response_message = :message
            WHERE incident_id = (SELECT id FROM incidents WHERE uuid = :uuid)
            AND contact_id = :contact_id
        ');

        $stmt->execute([
            'uuid' => $incidentId,
            'contact_id' => $contactId,
            'message' => $responseMessage
        ]);

        return ['success' => $stmt->rowCount() > 0];
    }

    /**
     * POST /api/incidents/contact-arrived
     *
     * Marquer un contact comme étant arrivé sur place
     */
    public function contactArrived(array $data): array
    {
        if (empty($data['incident_id']) || empty($data['contact_id'])) {
            return ['success' => false, 'error' => 'missing_parameters'];
        }

        $incidentId = $data['incident_id'];
        $contactId = (int) $data['contact_id'];

        $stmt = $this->db->prepare('
            UPDATE contact_responses
            SET status = "arrived",
                arrived_at = NOW()
            WHERE incident_id = (SELECT id FROM incidents WHERE uuid = :uuid)
            AND contact_id = :contact_id
        ');

        $stmt->execute([
            'uuid' => $incidentId,
            'contact_id' => $contactId
        ]);

        return ['success' => $stmt->rowCount() > 0];
    }

    /**
     * POST /api/incidents/contact-responding
     *
     * Marquer un contact comme étant en route
     */
    public function contactResponding(array $data): array
    {
        if (empty($data['incident_id']) || empty($data['contact_id'])) {
            return ['success' => false, 'error' => 'missing_parameters'];
        }

        $incidentId = $data['incident_id'];
        $contactId = (int) $data['contact_id'];
        $etaMinutes = isset($data['eta_minutes']) ? (int) $data['eta_minutes'] : null;

        $stmt = $this->db->prepare('
            UPDATE contact_responses
            SET status = "responding",
                responding_at = NOW(),
                eta_minutes = :eta
            WHERE incident_id = (SELECT id FROM incidents WHERE uuid = :uuid)
            AND contact_id = :contact_id
        ');

        $stmt->execute([
            'uuid' => $incidentId,
            'contact_id' => $contactId,
            'eta' => $etaMinutes
        ]);

        return ['success' => $stmt->rowCount() > 0];
    }

    /**
     * POST /api/incidents/send-share-sms
     *
     * Envoyer le lien de partage par SMS
     */
    public function sendShareSMS(int $userId, array $data): array
    {
        if (empty($data['incident_id']) || empty($data['contact_id'])) {
            return ['success' => false, 'error' => 'missing_parameters'];
        }

        $incidentId = $data['incident_id'];
        $contactId = (int) $data['contact_id'];

        // Valider l'accès
        $incident = $this->incidentService->getIncident($incidentId);
        if (!$incident || (int) $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'access_denied'];
        }

        // Obtenir le contact
        $stmt = $this->db->prepare('
            SELECT id, name, phone FROM trusted_contacts
            WHERE id = :id AND user_id = :user_id
        ');
        $stmt->execute(['id' => $contactId, 'user_id' => $userId]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$contact || empty($contact['phone'])) {
            return ['success' => false, 'error' => 'contact_not_found'];
        }

        // Générer le share pour ce contact
        $shareResult = $this->generateShare($userId, [
            'incident_id' => $incidentId,
            'recipient_type' => 'contact',
            'expiry_hours' => 24
        ]);

        if (!$shareResult['success']) {
            return $shareResult;
        }

        // Envoyer le SMS via TwilioService
        $shareLink = $data['share_link'] ?? "https://shield.app/track/{$shareResult['share_id']}";

        $twilioService = new TwilioService($this->db);
        $message = sprintf(
            "SHIELD ALERTE: %s a besoin d'aide! Suivez sa position: %s",
            $incident['user_name'] ?? 'Un contact',
            $shareLink
        );

        $smsResult = $twilioService->sendSMS($contact['phone'], $message);

        // Mettre à jour le statut de notification
        $stmt = $this->db->prepare('
            INSERT INTO contact_responses (incident_id, contact_id, status, notified_at)
            VALUES (
                (SELECT id FROM incidents WHERE uuid = :uuid),
                :contact_id, "notified", NOW()
            )
            ON DUPLICATE KEY UPDATE status = "notified", notified_at = NOW()
        ');
        $stmt->execute(['uuid' => $incidentId, 'contact_id' => $contactId]);

        return [
            'success' => $smsResult['success'] ?? false,
            'share_id' => $shareResult['share_id']
        ];
    }

    /**
     * POST /api/incidents/update-shared-location
     *
     * Mettre à jour la position pour les partages actifs
     */
    public function updateSharedLocation(int $userId, array $data): array
    {
        if (empty($data['incident_id'])) {
            return ['success' => false, 'error' => 'missing_incident_id'];
        }

        // Utiliser updateLocation existant
        return $this->updateLocation($data['incident_id'], $data);
    }

    /**
     * Générer un UUID v4
     */
    private function generateUUID(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

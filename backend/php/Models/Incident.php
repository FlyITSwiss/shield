<?php
declare(strict_types=1);

namespace Shield\Models;

use PDO;
use PDOException;

/**
 * Incident Model - Gestion des incidents/alertes SOS
 */
class Incident
{
    private PDO $db;
    private string $table = 'incidents';

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Générer un UUID v4
     */
    private function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * Créer un nouvel incident
     */
    public function create(array $data): string
    {
        $uuid = $this->generateUuid();

        $sql = "
            INSERT INTO {$this->table} (
                id, user_id, trigger_type, status, alert_mode,
                latitude, longitude, country_code, created_at
            ) VALUES (
                :id, :user_id, :trigger_type, 'active', :alert_mode,
                :latitude, :longitude, :country_code, NOW()
            )
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'id' => $uuid,
            'user_id' => $data['user_id'],
            'trigger_type' => $data['trigger_type'] ?? 'five_taps',
            'alert_mode' => $data['alert_mode'] ?? 'sonic',
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'country_code' => $data['country_code'] ?? null
        ]);

        return $uuid;
    }

    /**
     * Trouver un incident par ID
     */
    public function findById(string $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT i.*, u.first_name, u.phone, u.email
            FROM {$this->table} i
            JOIN users u ON i.user_id = u.id
            WHERE i.id = :id
        ");
        $stmt->execute(['id' => $id]);
        $incident = $stmt->fetch(PDO::FETCH_ASSOC);

        return $incident ?: null;
    }

    /**
     * Obtenir l'incident actif d'une utilisatrice
     */
    public function getActiveByUser(int $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE user_id = :user_id AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $stmt->execute(['user_id' => $userId]);
        $incident = $stmt->fetch(PDO::FETCH_ASSOC);

        return $incident ?: null;
    }

    /**
     * Mettre à jour le statut d'un incident
     */
    public function updateStatus(string $id, string $status): bool
    {
        $validStatuses = ['active', 'escalated', 'resolved', 'cancelled', 'false_alarm'];
        if (!in_array($status, $validStatuses, true)) {
            return false;
        }

        $sql = "UPDATE {$this->table} SET status = :status, updated_at = NOW()";

        if ($status === 'cancelled' || $status === 'false_alarm') {
            $sql .= ", cancelled_at = NOW()";
        } elseif ($status === 'resolved') {
            $sql .= ", resolved_at = NOW()";
        }

        $sql .= " WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $id, 'status' => $status]);
    }

    /**
     * Mettre à jour la position GPS
     */
    public function updateLocation(string $id, float $latitude, float $longitude, ?string $address = null): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                latitude = :latitude,
                longitude = :longitude,
                address_resolved = :address,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute([
            'id' => $id,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'address' => $address
        ]);
    }

    /**
     * Ajouter une position à l'historique de tracking
     */
    public function addLocationHistory(string $incidentId, float $latitude, float $longitude, ?float $accuracy = null): bool
    {
        $stmt = $this->db->prepare("
            INSERT INTO incident_location_updates (
                incident_id, latitude, longitude, accuracy, recorded_at
            ) VALUES (
                :incident_id, :latitude, :longitude, :accuracy, NOW()
            )
        ");

        return $stmt->execute([
            'incident_id' => $incidentId,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy
        ]);
    }

    /**
     * Obtenir l'historique des positions
     */
    public function getLocationHistory(string $incidentId): array
    {
        $stmt = $this->db->prepare("
            SELECT latitude, longitude, accuracy, recorded_at
            FROM incident_location_updates
            WHERE incident_id = :incident_id
            ORDER BY recorded_at ASC
        ");
        $stmt->execute(['incident_id' => $incidentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Mettre à jour le score de risque IA
     */
    public function updateRiskScore(string $id, int $score): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                risk_score = :score,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id, 'score' => min(100, max(0, $score))]);
    }

    /**
     * Marquer comme escaladé vers la police
     */
    public function escalateToPolice(string $id, int $serviceId): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                status = 'escalated',
                escalated_to_police = 1,
                police_service_id = :service_id,
                escalated_at = NOW(),
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id, 'service_id' => $serviceId]);
    }

    /**
     * Sauvegarder la session IA
     */
    public function saveAISession(string $id, string $sessionId, ?string $callSid = null): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                ai_session_id = :session_id,
                twilio_call_sid = :call_sid,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute([
            'id' => $id,
            'session_id' => $sessionId,
            'call_sid' => $callSid
        ]);
    }

    /**
     * Sauvegarder la transcription IA
     */
    public function saveAITranscript(string $id, string $transcript, ?string $summary = null): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                ai_transcript = :transcript,
                ai_summary = :summary,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute([
            'id' => $id,
            'transcript' => $transcript,
            'summary' => $summary
        ]);
    }

    /**
     * Sauvegarder l'enregistrement audio
     */
    public function saveAudioRecording(string $id, string $path): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                audio_recording_path = :path,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id, 'path' => $path]);
    }

    /**
     * Obtenir l'historique des incidents d'une utilisatrice
     */
    public function getHistoryByUser(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare("
            SELECT
                id, trigger_type, status, alert_mode,
                latitude, longitude, address_resolved, country_code,
                risk_score, escalated_to_police,
                created_at, resolved_at, cancelled_at
            FROM {$this->table}
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        ");

        $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Compter les incidents d'une utilisatrice
     */
    public function countByUser(int $userId): int
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM {$this->table}
            WHERE user_id = :user_id
        ");
        $stmt->execute(['user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Obtenir les incidents actifs (admin/monitoring)
     */
    public function getActiveIncidents(int $limit = 50): array
    {
        $stmt = $this->db->prepare("
            SELECT
                i.*, u.first_name, u.phone, u.email
            FROM {$this->table} i
            JOIN users u ON i.user_id = u.id
            WHERE i.status IN ('active', 'escalated')
            ORDER BY i.created_at DESC
            LIMIT :limit
        ");

        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Statistiques des incidents
     */
    public function getStats(string $period = 'month'): array
    {
        $dateCondition = match($period) {
            'day' => "DATE(created_at) = CURDATE()",
            'week' => "created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)",
            'month' => "created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)",
            'year' => "created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)",
            default => "1=1"
        };

        $sql = "
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated,
                SUM(CASE WHEN status = 'cancelled' OR status = 'false_alarm' THEN 1 ELSE 0 END) as cancelled,
                AVG(risk_score) as avg_risk_score,
                SUM(CASE WHEN escalated_to_police = 1 THEN 1 ELSE 0 END) as police_escalations
            FROM {$this->table}
            WHERE {$dateCondition}
        ";

        return $this->db->query($sql)->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Incidents par pays
     */
    public function getByCountry(string $countryCode, int $limit = 20): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE country_code = :country_code
            ORDER BY created_at DESC
            LIMIT :limit
        ");

        $stmt->bindValue('country_code', strtoupper($countryCode), PDO::PARAM_STR);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

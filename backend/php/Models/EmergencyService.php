<?php
declare(strict_types=1);

namespace Shield\Models;

use PDO;

/**
 * EmergencyService Model - Services d'urgence par pays
 */
class EmergencyService
{
    private PDO $db;
    private string $table = 'emergency_services';

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtenir tous les services d'urgence d'un pays
     */
    public function getByCountry(string $countryCode): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE country_code = :country_code AND is_active = 1
            ORDER BY service_type ASC
        ");
        $stmt->execute(['country_code' => strtoupper($countryCode)]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir le service de police principal d'un pays
     */
    public function getPoliceService(string $countryCode): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE country_code = :country_code
              AND service_type = 'police'
              AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
        ");
        $stmt->execute(['country_code' => strtoupper($countryCode)]);
        $service = $stmt->fetch(PDO::FETCH_ASSOC);

        return $service ?: null;
    }

    /**
     * Obtenir le numéro d'urgence général (112 en Europe)
     */
    public function getEmergencyNumber(string $countryCode): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE country_code = :country_code
              AND service_type = 'emergency'
              AND is_active = 1
            LIMIT 1
        ");
        $stmt->execute(['country_code' => strtoupper($countryCode)]);
        $service = $stmt->fetch(PDO::FETCH_ASSOC);

        return $service ?: null;
    }

    /**
     * Obtenir le service spécialisé violences femmes
     */
    public function getWomenHelpService(string $countryCode): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE country_code = :country_code
              AND service_type = 'women_help'
              AND is_active = 1
            LIMIT 1
        ");
        $stmt->execute(['country_code' => strtoupper($countryCode)]);
        $service = $stmt->fetch(PDO::FETCH_ASSOC);

        return $service ?: null;
    }

    /**
     * Trouver un service par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);
        $service = $stmt->fetch(PDO::FETCH_ASSOC);

        return $service ?: null;
    }

    /**
     * Obtenir tous les pays supportés
     */
    public function getSupportedCountries(): array
    {
        $stmt = $this->db->query("
            SELECT DISTINCT country_code FROM {$this->table}
            WHERE is_active = 1
            ORDER BY country_code ASC
        ");

        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Vérifier si un pays est supporté
     */
    public function isCountrySupported(string $countryCode): bool
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM {$this->table}
            WHERE country_code = :country_code AND is_active = 1
        ");
        $stmt->execute(['country_code' => strtoupper($countryCode)]);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Obtenir le meilleur numéro à appeler selon le contexte
     */
    public function getBestEmergencyNumber(string $countryCode, string $context = 'default'): ?array
    {
        // Pour les violences, privilégier le service spécialisé
        if ($context === 'violence' || $context === 'domestic') {
            $service = $this->getWomenHelpService($countryCode);
            if ($service) {
                return $service;
            }
        }

        // Sinon, police en priorité
        $service = $this->getPoliceService($countryCode);
        if ($service) {
            return $service;
        }

        // Fallback sur le 112 européen
        return $this->getEmergencyNumber($countryCode);
    }

    /**
     * Créer un nouveau service (admin)
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO {$this->table} (
                country_code, service_name, service_type,
                phone_number, phone_number_local, is_eu_112,
                description_fr, description_en, is_active, created_at
            ) VALUES (
                :country_code, :service_name, :service_type,
                :phone_number, :phone_number_local, :is_eu_112,
                :description_fr, :description_en, 1, NOW()
            )
        ");

        $stmt->execute([
            'country_code' => strtoupper($data['country_code']),
            'service_name' => $data['service_name'],
            'service_type' => $data['service_type'],
            'phone_number' => $data['phone_number'],
            'phone_number_local' => $data['phone_number_local'] ?? null,
            'is_eu_112' => $data['is_eu_112'] ?? 0,
            'description_fr' => $data['description_fr'] ?? null,
            'description_en' => $data['description_en'] ?? null
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Mettre à jour un service (admin)
     */
    public function update(int $id, array $data): bool
    {
        $allowedFields = [
            'service_name', 'service_type', 'phone_number', 'phone_number_local',
            'is_eu_112', 'description_fr', 'description_en', 'is_active'
        ];

        $updates = [];
        $params = ['id' => $id];

        foreach ($data as $key => $value) {
            if (in_array($key, $allowedFields, true)) {
                $updates[] = "{$key} = :{$key}";
                $params[$key] = $value;
            }
        }

        if (empty($updates)) {
            return false;
        }

        $sql = "UPDATE {$this->table} SET " . implode(', ', $updates) .
               ", updated_at = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * Désactiver un service (admin)
     */
    public function deactivate(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                is_active = 0,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Obtenir tous les services (admin)
     */
    public function getAll(bool $includeInactive = false): array
    {
        $sql = "SELECT * FROM {$this->table}";
        if (!$includeInactive) {
            $sql .= " WHERE is_active = 1";
        }
        $sql .= " ORDER BY country_code ASC, service_type ASC";

        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Statistiques par type de service
     */
    public function getStatsByType(): array
    {
        return $this->db->query("
            SELECT
                service_type,
                COUNT(*) as count,
                COUNT(DISTINCT country_code) as countries
            FROM {$this->table}
            WHERE is_active = 1
            GROUP BY service_type
        ")->fetchAll(PDO::FETCH_ASSOC);
    }
}

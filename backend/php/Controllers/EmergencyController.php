<?php
declare(strict_types=1);

namespace Shield\Controllers;

use PDO;
use Shield\Models\EmergencyService;
use Shield\Services\GeoService;

/**
 * EmergencyController - Gestion des services d'urgence
 */
class EmergencyController
{
    private PDO $db;
    private EmergencyService $emergencyModel;
    private GeoService $geoService;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->emergencyModel = new EmergencyService($db);
        $this->geoService = new GeoService($db);
    }

    /**
     * GET /api/emergency/countries
     *
     * Liste des pays supportés
     */
    public function getSupportedCountries(): array
    {
        $countries = $this->emergencyModel->getSupportedCountries();
        $countryDetails = [];

        foreach ($countries as $code) {
            $info = $this->geoService->getCountryInfo($code);
            if ($info) {
                $countryDetails[] = [
                    'code' => $code,
                    'name' => $info['name'],
                    'emergency' => $info['emergency'],
                    'police' => $info['police']
                ];
            }
        }

        return [
            'success' => true,
            'countries' => $countryDetails,
            'count' => count($countryDetails)
        ];
    }

    /**
     * GET /api/emergency/{country_code}
     *
     * Services d'urgence d'un pays
     */
    public function getByCountry(string $countryCode): array
    {
        $code = strtoupper($countryCode);

        if (!$this->emergencyModel->isCountrySupported($code)) {
            return [
                'success' => false,
                'error' => 'country_not_supported',
                'fallback' => '112' // Numéro européen
            ];
        }

        $services = $this->emergencyModel->getByCountry($code);
        $countryInfo = $this->geoService->getCountryInfo($code);

        return [
            'success' => true,
            'country' => $countryInfo,
            'services' => $services
        ];
    }

    /**
     * GET /api/emergency/best
     *
     * Meilleur numéro à appeler selon le contexte et la position
     */
    public function getBestNumber(array $params): array
    {
        $countryCode = $params['country_code'] ?? null;
        $context = $params['context'] ?? 'default';
        $latitude = isset($params['latitude']) ? (float) $params['latitude'] : null;
        $longitude = isset($params['longitude']) ? (float) $params['longitude'] : null;

        // Détecter le pays si non fourni
        if (!$countryCode && $latitude !== null && $longitude !== null) {
            $countryCode = $this->geoService->getCountryFromCoords($latitude, $longitude);
        }

        if (!$countryCode) {
            $countryCode = 'FR'; // Défaut France
        }

        $code = strtoupper($countryCode);

        // Obtenir le meilleur service selon le contexte
        $service = $this->emergencyModel->getBestEmergencyNumber($code, $context);

        if (!$service) {
            // Fallback sur 112
            return [
                'success' => true,
                'service' => [
                    'phone_number' => '112',
                    'service_name' => 'European Emergency',
                    'service_type' => 'emergency',
                    'is_fallback' => true
                ],
                'country_code' => $code
            ];
        }

        return [
            'success' => true,
            'service' => $service,
            'country_code' => $code
        ];
    }

    /**
     * GET /api/emergency/police/{country_code}
     *
     * Numéro de police d'un pays
     */
    public function getPolice(string $countryCode): array
    {
        $code = strtoupper($countryCode);
        $service = $this->emergencyModel->getPoliceService($code);

        if (!$service) {
            // Fallback
            $countryInfo = $this->geoService->getCountryInfo($code);
            return [
                'success' => true,
                'service' => [
                    'phone_number' => $countryInfo['police'] ?? '112',
                    'service_name' => 'Police',
                    'service_type' => 'police',
                    'is_fallback' => true
                ]
            ];
        }

        return ['success' => true, 'service' => $service];
    }

    /**
     * GET /api/emergency/women-help/{country_code}
     *
     * Numéro d'aide aux femmes
     */
    public function getWomenHelp(string $countryCode): array
    {
        $code = strtoupper($countryCode);
        $service = $this->emergencyModel->getWomenHelpService($code);

        if (!$service) {
            return [
                'success' => false,
                'error' => 'no_women_help_service',
                'fallback' => $this->getPolice($countryCode)['service']
            ];
        }

        return ['success' => true, 'service' => $service];
    }

    /**
     * GET /api/emergency/detect
     *
     * Détecter le pays depuis les coordonnées GPS
     */
    public function detectCountry(array $params): array
    {
        if (!isset($params['latitude']) || !isset($params['longitude'])) {
            return ['success' => false, 'error' => 'missing_coordinates'];
        }

        $latitude = (float) $params['latitude'];
        $longitude = (float) $params['longitude'];

        if (!$this->geoService->validateCoordinates($latitude, $longitude)) {
            return ['success' => false, 'error' => 'invalid_coordinates'];
        }

        $countryCode = $this->geoService->getCountryFromCoords($latitude, $longitude);

        if (!$countryCode) {
            return [
                'success' => false,
                'error' => 'country_not_detected',
                'fallback' => 'FR'
            ];
        }

        $isSupported = $this->emergencyModel->isCountrySupported($countryCode);
        $countryInfo = $this->geoService->getCountryInfo($countryCode);

        return [
            'success' => true,
            'country_code' => $countryCode,
            'country_info' => $countryInfo,
            'is_supported' => $isSupported
        ];
    }

    /**
     * GET /api/emergency/stats (admin)
     *
     * Statistiques des services d'urgence
     */
    public function getStats(): array
    {
        $stats = $this->emergencyModel->getStatsByType();
        $countries = $this->emergencyModel->getSupportedCountries();

        return [
            'success' => true,
            'stats_by_type' => $stats,
            'total_countries' => count($countries)
        ];
    }

    /**
     * GET /api/emergency/all (admin)
     *
     * Liste complète des services
     */
    public function getAll(bool $includeInactive = false): array
    {
        $services = $this->emergencyModel->getAll($includeInactive);

        return [
            'success' => true,
            'services' => $services,
            'count' => count($services)
        ];
    }

    /**
     * POST /api/emergency (admin)
     *
     * Créer un service d'urgence
     */
    public function create(array $data): array
    {
        $errors = $this->validateServiceData($data);
        if (!empty($errors)) {
            return ['success' => false, 'errors' => $errors];
        }

        $id = $this->emergencyModel->create($data);

        return [
            'success' => true,
            'id' => $id,
            'message' => 'service_created'
        ];
    }

    /**
     * PUT /api/emergency/{id} (admin)
     *
     * Modifier un service d'urgence
     */
    public function update(int $id, array $data): array
    {
        $service = $this->emergencyModel->findById($id);
        if (!$service) {
            return ['success' => false, 'error' => 'service_not_found'];
        }

        $success = $this->emergencyModel->update($id, $data);

        return [
            'success' => $success,
            'message' => $success ? 'service_updated' : 'update_failed'
        ];
    }

    /**
     * DELETE /api/emergency/{id} (admin)
     *
     * Désactiver un service d'urgence
     */
    public function deactivate(int $id): array
    {
        $service = $this->emergencyModel->findById($id);
        if (!$service) {
            return ['success' => false, 'error' => 'service_not_found'];
        }

        $success = $this->emergencyModel->deactivate($id);

        return [
            'success' => $success,
            'message' => $success ? 'service_deactivated' : 'deactivate_failed'
        ];
    }

    /**
     * Valider les données d'un service
     */
    private function validateServiceData(array $data): array
    {
        $errors = [];

        if (empty($data['country_code']) || strlen($data['country_code']) !== 2) {
            $errors['country_code'] = 'invalid_country_code';
        }

        if (empty($data['service_name'])) {
            $errors['service_name'] = 'service_name_required';
        }

        if (empty($data['service_type'])) {
            $errors['service_type'] = 'service_type_required';
        } else {
            $validTypes = ['emergency', 'police', 'ambulance', 'fire', 'women_help', 'child_help', 'other'];
            if (!in_array($data['service_type'], $validTypes, true)) {
                $errors['service_type'] = 'invalid_service_type';
            }
        }

        if (empty($data['phone_number'])) {
            $errors['phone_number'] = 'phone_number_required';
        }

        return $errors;
    }
}

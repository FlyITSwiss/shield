<?php
declare(strict_types=1);

namespace Shield\Services;

use PDO;

/**
 * GeoService - Services de géolocalisation SHIELD
 */
class GeoService
{
    private PDO $db;
    private string $googleMapsKey;
    private string $openCageKey;
    private bool $useOpenCage;

    // Pays européens supportés par SHIELD
    private const SUPPORTED_COUNTRIES = [
        'FR' => ['name' => 'France', 'emergency' => '112', 'police' => '17'],
        'BE' => ['name' => 'Belgique', 'emergency' => '112', 'police' => '101'],
        'CH' => ['name' => 'Suisse', 'emergency' => '112', 'police' => '117'],
        'DE' => ['name' => 'Allemagne', 'emergency' => '112', 'police' => '110'],
        'ES' => ['name' => 'Espagne', 'emergency' => '112', 'police' => '091'],
        'IT' => ['name' => 'Italie', 'emergency' => '112', 'police' => '113'],
        'NL' => ['name' => 'Pays-Bas', 'emergency' => '112', 'police' => '0900-8844'],
        'PT' => ['name' => 'Portugal', 'emergency' => '112', 'police' => '112'],
        'AT' => ['name' => 'Autriche', 'emergency' => '112', 'police' => '133'],
        'LU' => ['name' => 'Luxembourg', 'emergency' => '112', 'police' => '113']
    ];

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->googleMapsKey = $_ENV['GOOGLE_MAPS_API_KEY'] ?? '';
        $this->openCageKey = $_ENV['OPENCAGE_API_KEY'] ?? '';
        $this->useOpenCage = !empty($this->openCageKey);
    }

    /**
     * Géocodage inverse - coordonnées vers adresse
     */
    public function reverseGeocode(float $latitude, float $longitude): ?string
    {
        // Essayer OpenCage d'abord (gratuit jusqu'à 2500 req/jour)
        if ($this->useOpenCage) {
            $result = $this->reverseGeocodeOpenCage($latitude, $longitude);
            if ($result) {
                return $result;
            }
        }

        // Fallback sur Google Maps
        if (!empty($this->googleMapsKey)) {
            return $this->reverseGeocodeGoogle($latitude, $longitude);
        }

        return null;
    }

    /**
     * Obtenir le pays depuis les coordonnées
     */
    public function getCountryFromCoords(float $latitude, float $longitude): ?string
    {
        // Vérifier le cache local
        $cached = $this->getCachedCountry($latitude, $longitude);
        if ($cached) {
            return $cached;
        }

        if ($this->useOpenCage) {
            $country = $this->getCountryOpenCage($latitude, $longitude);
        } elseif (!empty($this->googleMapsKey)) {
            $country = $this->getCountryGoogle($latitude, $longitude);
        } else {
            $country = $this->estimateCountryFromCoords($latitude, $longitude);
        }

        if ($country) {
            $this->cacheCountry($latitude, $longitude, $country);
        }

        return $country;
    }

    /**
     * Vérifier si un pays est supporté
     */
    public function isCountrySupported(string $countryCode): bool
    {
        return isset(self::SUPPORTED_COUNTRIES[strtoupper($countryCode)]);
    }

    /**
     * Obtenir les infos d'un pays supporté
     */
    public function getCountryInfo(string $countryCode): ?array
    {
        $code = strtoupper($countryCode);
        return self::SUPPORTED_COUNTRIES[$code] ?? null;
    }

    /**
     * Obtenir tous les pays supportés
     */
    public function getSupportedCountries(): array
    {
        return self::SUPPORTED_COUNTRIES;
    }

    /**
     * Calculer la distance entre deux points (Haversine)
     */
    public function calculateDistance(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2,
        string $unit = 'km'
    ): float {
        $earthRadius = $unit === 'km' ? 6371 : 3959;

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    /**
     * Générer un lien Google Maps
     */
    public function generateMapsLink(float $latitude, float $longitude): string
    {
        return sprintf(
            'https://www.google.com/maps?q=%s,%s',
            $latitude,
            $longitude
        );
    }

    /**
     * Générer un lien What3Words (si disponible)
     */
    public function generateW3WLink(float $latitude, float $longitude): string
    {
        // What3Words nécessite une API pour la conversion
        // Fallback sur le lien de localisation directe
        return sprintf(
            'https://w3w.co/locate?lat=%s&lng=%s',
            $latitude,
            $longitude
        );
    }

    /**
     * Valider des coordonnées GPS
     */
    public function validateCoordinates(float $latitude, float $longitude): bool
    {
        return $latitude >= -90 && $latitude <= 90 &&
               $longitude >= -180 && $longitude <= 180;
    }

    /**
     * Formater une adresse pour l'affichage
     */
    public function formatAddress(array $components): string
    {
        $parts = [];

        if (!empty($components['street_number'])) {
            $parts[] = $components['street_number'];
        }
        if (!empty($components['street'])) {
            $parts[] = $components['street'];
        }
        if (!empty($components['city'])) {
            $parts[] = $components['city'];
        }
        if (!empty($components['postal_code'])) {
            $parts[] = $components['postal_code'];
        }
        if (!empty($components['country'])) {
            $parts[] = $components['country'];
        }

        return implode(', ', $parts);
    }

    /**
     * Reverse geocode via OpenCage
     */
    private function reverseGeocodeOpenCage(float $latitude, float $longitude): ?string
    {
        $url = sprintf(
            'https://api.opencagedata.com/geocode/v1/json?q=%s+%s&key=%s&language=fr&limit=1',
            $latitude,
            $longitude,
            $this->openCageKey
        );

        $response = $this->httpGet($url);
        if (!$response) {
            return null;
        }

        $data = json_decode($response, true);
        if (empty($data['results'][0]['formatted'])) {
            return null;
        }

        return $data['results'][0]['formatted'];
    }

    /**
     * Reverse geocode via Google Maps
     */
    private function reverseGeocodeGoogle(float $latitude, float $longitude): ?string
    {
        $url = sprintf(
            'https://maps.googleapis.com/maps/api/geocode/json?latlng=%s,%s&key=%s&language=fr',
            $latitude,
            $longitude,
            $this->googleMapsKey
        );

        $response = $this->httpGet($url);
        if (!$response) {
            return null;
        }

        $data = json_decode($response, true);
        if (empty($data['results'][0]['formatted_address'])) {
            return null;
        }

        return $data['results'][0]['formatted_address'];
    }

    /**
     * Obtenir le pays via OpenCage
     */
    private function getCountryOpenCage(float $latitude, float $longitude): ?string
    {
        $url = sprintf(
            'https://api.opencagedata.com/geocode/v1/json?q=%s+%s&key=%s&limit=1',
            $latitude,
            $longitude,
            $this->openCageKey
        );

        $response = $this->httpGet($url);
        if (!$response) {
            return null;
        }

        $data = json_decode($response, true);
        if (empty($data['results'][0]['components']['ISO_3166-1_alpha-2'])) {
            return null;
        }

        return strtoupper($data['results'][0]['components']['ISO_3166-1_alpha-2']);
    }

    /**
     * Obtenir le pays via Google Maps
     */
    private function getCountryGoogle(float $latitude, float $longitude): ?string
    {
        $url = sprintf(
            'https://maps.googleapis.com/maps/api/geocode/json?latlng=%s,%s&key=%s&result_type=country',
            $latitude,
            $longitude,
            $this->googleMapsKey
        );

        $response = $this->httpGet($url);
        if (!$response) {
            return null;
        }

        $data = json_decode($response, true);
        if (empty($data['results'][0]['address_components'])) {
            return null;
        }

        foreach ($data['results'][0]['address_components'] as $component) {
            if (in_array('country', $component['types'], true)) {
                return strtoupper($component['short_name']);
            }
        }

        return null;
    }

    /**
     * Estimation approximative du pays (fallback sans API)
     */
    private function estimateCountryFromCoords(float $latitude, float $longitude): ?string
    {
        // Approximations grossières des bounding boxes européennes
        $countries = [
            'FR' => ['lat' => [41.3, 51.1], 'lon' => [-5.1, 9.6]],
            'BE' => ['lat' => [49.5, 51.5], 'lon' => [2.5, 6.4]],
            'CH' => ['lat' => [45.8, 47.8], 'lon' => [5.9, 10.5]],
            'DE' => ['lat' => [47.3, 55.1], 'lon' => [5.9, 15.0]],
            'ES' => ['lat' => [36.0, 43.8], 'lon' => [-9.3, 3.3]],
            'IT' => ['lat' => [35.5, 47.1], 'lon' => [6.6, 18.5]],
            'NL' => ['lat' => [50.8, 53.5], 'lon' => [3.4, 7.2]],
            'PT' => ['lat' => [36.9, 42.2], 'lon' => [-9.5, -6.2]],
            'AT' => ['lat' => [46.4, 49.0], 'lon' => [9.5, 17.2]],
            'LU' => ['lat' => [49.4, 50.2], 'lon' => [5.7, 6.5]]
        ];

        foreach ($countries as $code => $bounds) {
            if ($latitude >= $bounds['lat'][0] && $latitude <= $bounds['lat'][1] &&
                $longitude >= $bounds['lon'][0] && $longitude <= $bounds['lon'][1]) {
                return $code;
            }
        }

        // Défaut Europe
        if ($latitude >= 35 && $latitude <= 72 && $longitude >= -10 && $longitude <= 40) {
            return 'FR'; // Défaut France
        }

        return null;
    }

    /**
     * Obtenir le pays depuis le cache
     */
    private function getCachedCountry(float $latitude, float $longitude): ?string
    {
        // Arrondir pour le cache (précision ~1km)
        $latRound = round($latitude, 2);
        $lonRound = round($longitude, 2);

        $stmt = $this->db->prepare("
            SELECT country_code FROM geo_cache
            WHERE lat_rounded = :lat AND lon_rounded = :lon
              AND cached_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
            LIMIT 1
        ");
        $stmt->execute(['lat' => $latRound, 'lon' => $lonRound]);
        $result = $stmt->fetch(\PDO::FETCH_ASSOC);

        return $result ? $result['country_code'] : null;
    }

    /**
     * Mettre en cache le pays
     */
    private function cacheCountry(float $latitude, float $longitude, string $countryCode): void
    {
        $latRound = round($latitude, 2);
        $lonRound = round($longitude, 2);

        $stmt = $this->db->prepare("
            INSERT INTO geo_cache (lat_rounded, lon_rounded, country_code, cached_at)
            VALUES (:lat, :lon, :country, NOW())
            ON DUPLICATE KEY UPDATE country_code = VALUES(country_code), cached_at = NOW()
        ");
        $stmt->execute([
            'lat' => $latRound,
            'lon' => $lonRound,
            'country' => $countryCode
        ]);
    }

    /**
     * Requête HTTP GET
     */
    private function httpGet(string $url): ?string
    {
        $context = stream_context_create([
            'http' => [
                'timeout' => 5,
                'user_agent' => 'SHIELD-App/1.0'
            ]
        ]);

        $response = @file_get_contents($url, false, $context);

        return $response !== false ? $response : null;
    }
}

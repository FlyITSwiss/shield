<?php
declare(strict_types=1);

namespace Shield\Services;

use PDO;
use Shield\Models\Incident;
use Shield\Models\Contact;
use Shield\Models\User;
use Shield\Models\EmergencyService;

/**
 * IncidentService - Gestion des incidents SOS SHIELD
 */
class IncidentService
{
    private PDO $db;
    private Incident $incidentModel;
    private Contact $contactModel;
    private User $userModel;
    private EmergencyService $emergencyModel;
    private ?TwilioService $twilioService;
    private ?GeoService $geoService;

    public function __construct(
        PDO $db,
        ?TwilioService $twilioService = null,
        ?GeoService $geoService = null
    ) {
        $this->db = $db;
        $this->incidentModel = new Incident($db);
        $this->contactModel = new Contact($db);
        $this->userModel = new User($db);
        $this->emergencyModel = new EmergencyService($db);
        $this->twilioService = $twilioService;
        $this->geoService = $geoService;
    }

    /**
     * Déclencher une alerte SOS
     *
     * Critère CDC: déclenchement < 2 secondes
     */
    public function triggerSOS(int $userId, array $data): array
    {
        $startTime = microtime(true);

        // Vérifier s'il y a déjà un incident actif
        $activeIncident = $this->incidentModel->getActiveByUser($userId);
        if ($activeIncident) {
            return [
                'success' => false,
                'error' => 'active_incident_exists',
                'incident_id' => $activeIncident['id']
            ];
        }

        // Créer l'incident
        $incidentId = $this->incidentModel->create([
            'user_id' => $userId,
            'trigger_method' => $data['trigger_method'] ?? 'button',
            'silent_mode' => $data['silent_mode'] ?? false,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'country_code' => $data['country_code'] ?? $this->detectCountry($data)
        ]);

        // Résoudre l'adresse en arrière-plan
        if (isset($data['latitude'], $data['longitude']) && $this->geoService) {
            $address = $this->geoService->reverseGeocode(
                (float) $data['latitude'],
                (float) $data['longitude']
            );
            if ($address) {
                $this->incidentModel->updateLocation(
                    $incidentId,
                    (float) $data['latitude'],
                    (float) $data['longitude'],
                    $address
                );
            }
        }

        // Notifier les contacts de confiance
        // $this->notifyTrustedContacts($incidentId, $userId);

        // Si mode sonic, déclencher l'alarme sonore (géré côté client)
        // Si mode silencieux, lancer l'agent vocal IA
        if (($data['silent_mode'] ?? false) === 'silent') {
            $this->initiateAIVoiceAgent($incidentId, $userId);
        }

        $executionTime = (microtime(true) - $startTime) * 1000;

        return [
            'success' => true,
            'incident_id' => $incidentId,
            'execution_time_ms' => round($executionTime, 2),
            'contacts_notified' => false
        ];
    }

    /**
     * Annuler une alerte (fausse alerte ou résolution)
     */
    public function cancelSOS(int $userId, string $incidentId, string $reason = 'cancelled'): array
    {
        $incident = $this->incidentModel->findById($incidentId);

        if (!$incident || $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'incident_not_found'];
        }

        if ($incident['status'] !== 'active' && $incident['status'] !== 'escalated') {
            return ['success' => false, 'error' => 'incident_already_resolved'];
        }

        $status = $reason === 'false_alarm' ? 'false_alarm' : 'cancelled';
        $this->incidentModel->updateStatus($incidentId, $status);

        // Notifier les contacts que l'alerte est annulée
        // $this->notifyContactsCancellation($incidentId, $userId);

        return ['success' => true, 'status' => $status];
    }

    /**
     * Confirmer que l'utilisatrice est en sécurité
     */
    public function confirmSafe(int $userId, string $incidentId): array
    {
        $incident = $this->incidentModel->findById($incidentId);

        if (!$incident || $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'incident_not_found'];
        }

        $this->incidentModel->updateStatus($incidentId, 'resolved');

        // Notifier les contacts
        // $this->notifyContactsResolution($incidentId, $userId);

        return ['success' => true, 'status' => 'resolved'];
    }

    /**
     * Mettre à jour la position pendant un incident
     */
    public function updateLocation(string $incidentId, float $latitude, float $longitude, ?float $accuracy = null): array
    {
        $incident = $this->incidentModel->findById($incidentId);

        if (!$incident) {
            return ['success' => false, 'error' => 'incident_not_found'];
        }

        if (!in_array($incident['status'], ['active', 'escalated'], true)) {
            return ['success' => false, 'error' => 'incident_not_active'];
        }

        // Ajouter à l'historique
        $this->incidentModel->addLocationHistory($incidentId, $latitude, $longitude, $accuracy);

        // Mettre à jour la position actuelle
        $address = null;
        if ($this->geoService) {
            $address = $this->geoService->reverseGeocode($latitude, $longitude);
        }
        $this->incidentModel->updateLocation($incidentId, $latitude, $longitude, $address);

        return ['success' => true, 'address' => $address];
    }

    /**
     * Escalader vers la police
     */
    public function escalateToPolice(int $userId, string $incidentId): array
    {
        $incident = $this->incidentModel->findById($incidentId);

        if (!$incident || $incident['user_id'] !== $userId) {
            return ['success' => false, 'error' => 'incident_not_found'];
        }

        $countryCode = $incident['country_code'] ?? 'FR';

        // Obtenir le service de police approprié
        $policeService = $this->emergencyModel->getPoliceService($countryCode);
        if (!$policeService) {
            $policeService = $this->emergencyModel->getEmergencyNumber($countryCode);
        }

        if (!$policeService) {
            return [
                'success' => false,
                'error' => 'no_emergency_service',
                'fallback_number' => '112' // Numéro d'urgence européen
            ];
        }

        $this->incidentModel->escalateToPolice($incidentId, (int) $policeService['id']);

        return [
            'success' => true,
            'service' => $policeService,
            'phone_number' => $policeService['phone_number']
        ];
    }

    /**
     * Obtenir l'incident actif
     */
    public function getActiveIncident(int $userId): ?array
    {
        return $this->incidentModel->getActiveByUser($userId);
    }

    /**
     * Obtenir les détails d'un incident
     */
    public function getIncident(string $incidentId): ?array
    {
        $incident = $this->incidentModel->findById($incidentId);

        if ($incident) {
            $incident['location_history'] = $this->incidentModel->getLocationHistory($incidentId);
            $incident['notification_log'] = $this->contactModel->getNotificationLog($incidentId);
        }

        return $incident;
    }

    /**
     * Obtenir l'historique des incidents
     */
    public function getHistory(int $userId, int $limit = 20, int $offset = 0): array
    {
        return $this->incidentModel->getHistoryByUser($userId, $limit, $offset);
    }

    /**
     * Mettre à jour le score de risque IA
     */
    public function updateRiskScore(string $incidentId, int $score): bool
    {
        return $this->incidentModel->updateRiskScore($incidentId, $score);
    }

    /**
     * Sauvegarder la transcription IA
     */
    public function saveAITranscript(string $incidentId, string $transcript, ?string $summary = null): bool
    {
        return $this->incidentModel->saveAITranscript($incidentId, $transcript, $summary);
    }

    /**
     * Notifier les contacts de confiance
     */
    private function notifyTrustedContacts(string $incidentId, int $userId): void
    {
        $user = $this->userModel->findById($userId);
        $contacts = $this->contactModel->getContactsToNotify($userId, 'sms');
        $incident = $this->incidentModel->findById($incidentId);

        foreach ($contacts as $contact) {
            $message = $this->buildAlertMessage($user, $incident, $contact);

            $success = false;
            $errorMessage = null;

            if ($this->twilioService && $contact['notify_by_sms']) {
                try {
                    $this->twilioService->sendSMS($contact['phone'], $message);
                    $success = true;
                } catch (\Exception $e) {
                    $errorMessage = $e->getMessage();
                }
            }

            // Log la notification
            $this->contactModel->logNotification(
                (int) $contact['id'],
                $incidentId,
                'sms',
                $success,
                $errorMessage
            );
        }
    }

    /**
     * Notifier les contacts de l'annulation
     */
    private function notifyContactsCancellation(string $incidentId, int $userId): void
    {
        $user = $this->userModel->findById($userId);
        $contacts = $this->contactModel->getContactsToNotify($userId, 'sms');

        foreach ($contacts as $contact) {
            $message = sprintf(
                "SHIELD - %s a annulé son alerte. Elle est en sécurité.",
                $user['first_name']
            );

            if ($this->twilioService && $contact['notify_by_sms']) {
                try {
                    $this->twilioService->sendSMS($contact['phone'], $message);
                } catch (\Exception $e) {
                    // Log silencieux
                }
            }
        }
    }

    /**
     * Notifier les contacts de la résolution
     */
    private function notifyContactsResolution(string $incidentId, int $userId): void
    {
        $user = $this->userModel->findById($userId);
        $contacts = $this->contactModel->getContactsToNotify($userId, 'sms');

        foreach ($contacts as $contact) {
            $message = sprintf(
                "SHIELD - %s a confirmé être en sécurité. L'alerte est terminée.",
                $user['first_name']
            );

            if ($this->twilioService && $contact['notify_by_sms']) {
                try {
                    $this->twilioService->sendSMS($contact['phone'], $message);
                } catch (\Exception $e) {
                    // Log silencieux
                }
            }
        }
    }

    /**
     * Construire le message d'alerte
     */
    private function buildAlertMessage(array $user, array $incident, array $contact): string
    {
        $message = sprintf(
            "ALERTE SHIELD - %s a besoin d'aide !",
            $user['first_name']
        );

        if (!empty($incident['address'])) {
            $message .= sprintf("\nPosition : %s", $incident['address']);
        } elseif (!empty($incident['latitude']) && !empty($incident['longitude'])) {
            $message .= sprintf(
                "\nPosition GPS : https://maps.google.com/?q=%s,%s",
                $incident['latitude'],
                $incident['longitude']
            );
        }

        $message .= "\n\nSi vous ne pouvez pas la joindre, appelez les secours.";

        return $message;
    }

    /**
     * Initier l'agent vocal IA (mode silencieux)
     */
    private function initiateAIVoiceAgent(string $incidentId, int $userId): void
    {
        $user = $this->userModel->findById($userId);

        if (!$this->twilioService) {
            return;
        }

        try {
            $sessionId = $this->twilioService->initiateAICall(
                $user['phone'],
                $incidentId,
                $user['preferred_language'] ?? 'fr'
            );

            $this->incidentModel->saveAISession($incidentId, $sessionId);
        } catch (\Exception $e) {
            // Log l'erreur mais ne bloque pas l'alerte
            error_log("AI Voice Agent error: " . $e->getMessage());
        }
    }

    /**
     * Détecter le pays depuis les données
     */
    private function detectCountry(array $data): string
    {
        // Priorité: code pays explicite > géolocalisation > défaut
        if (!empty($data['country_code'])) {
            return strtoupper($data['country_code']);
        }

        if (isset($data['latitude'], $data['longitude']) && $this->geoService) {
            $country = $this->geoService->getCountryFromCoords(
                (float) $data['latitude'],
                (float) $data['longitude']
            );
            if ($country) {
                return $country;
            }
        }

        return 'FR'; // Défaut
    }

    /**
     * Obtenir les statistiques (admin)
     */
    public function getStats(string $period = 'month'): array
    {
        return $this->incidentModel->getStats($period);
    }

    /**
     * Obtenir les incidents actifs (monitoring)
     */
    public function getActiveIncidents(int $limit = 50): array
    {
        return $this->incidentModel->getActiveIncidents($limit);
    }
}

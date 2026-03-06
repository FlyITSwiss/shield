<?php
declare(strict_types=1);

namespace Shield\Controllers;

use PDO;
use Shield\Models\Contact;
use Shield\Models\User;
use Shield\Services\TwilioService;

/**
 * ContactController - Gestion des contacts de confiance
 */
class ContactController
{
    private PDO $db;
    private Contact $contactModel;
    private User $userModel;
    private TwilioService $twilioService;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->contactModel = new Contact($db);
        $this->userModel = new User($db);
        $this->twilioService = new TwilioService($db);
    }

    /**
     * GET /api/contacts
     *
     * Lister les contacts de confiance
     */
    public function index(int $userId): array
    {
        $contacts = $this->contactModel->getByUser($userId);

        return [
            'success' => true,
            'contacts' => $contacts,
            'count' => count($contacts),
            'max_allowed' => 5,
            'can_add' => $this->contactModel->canAddContact($userId)
        ];
    }

    /**
     * GET /api/contacts/{id}
     *
     * Détail d'un contact
     */
    public function show(int $userId, int $contactId): array
    {
        $contact = $this->contactModel->findByIdAndUser($contactId, $userId);

        if (!$contact) {
            return ['success' => false, 'error' => 'contact_not_found'];
        }

        return ['success' => true, 'contact' => $contact];
    }

    /**
     * POST /api/contacts
     *
     * Ajouter un contact de confiance
     */
    public function store(int $userId, array $data): array
    {
        // Valider les données requises
        $errors = $this->validateContactData($data);
        if (!empty($errors)) {
            return ['success' => false, 'errors' => $errors];
        }

        // Vérifier la limite
        if (!$this->contactModel->canAddContact($userId)) {
            return [
                'success' => false,
                'error' => 'max_contacts_reached',
                'max_allowed' => 5
            ];
        }

        // Vérifier si le téléphone existe déjà pour cette utilisatrice
        if ($this->contactModel->phoneExists($userId, $data['phone'])) {
            return ['success' => false, 'error' => 'phone_already_contact'];
        }

        $contactId = $this->contactModel->create($userId, $data);

        if (!$contactId) {
            return ['success' => false, 'error' => 'creation_failed'];
        }

        $contact = $this->contactModel->findById($contactId);

        return [
            'success' => true,
            'contact' => $contact,
            'message' => 'contact_created'
        ];
    }

    /**
     * PUT /api/contacts/{id}
     *
     * Modifier un contact
     */
    public function update(int $userId, int $contactId, array $data): array
    {
        // Vérifier que le contact existe et appartient à l'utilisatrice
        $contact = $this->contactModel->findByIdAndUser($contactId, $userId);
        if (!$contact) {
            return ['success' => false, 'error' => 'contact_not_found'];
        }

        // Valider les données modifiées
        $errors = $this->validateContactData($data, true);
        if (!empty($errors)) {
            return ['success' => false, 'errors' => $errors];
        }

        // Vérifier le téléphone unique si modifié
        if (isset($data['phone']) && $data['phone'] !== $contact['phone']) {
            if ($this->contactModel->phoneExists($userId, $data['phone'], $contactId)) {
                return ['success' => false, 'error' => 'phone_already_contact'];
            }
        }

        $success = $this->contactModel->update($contactId, $userId, $data);

        if (!$success) {
            return ['success' => false, 'error' => 'update_failed'];
        }

        $updatedContact = $this->contactModel->findById($contactId);

        return [
            'success' => true,
            'contact' => $updatedContact,
            'message' => 'contact_updated'
        ];
    }

    /**
     * DELETE /api/contacts/{id}
     *
     * Supprimer un contact
     */
    public function destroy(int $userId, int $contactId): array
    {
        $contact = $this->contactModel->findByIdAndUser($contactId, $userId);
        if (!$contact) {
            return ['success' => false, 'error' => 'contact_not_found'];
        }

        $success = $this->contactModel->delete($contactId, $userId);

        return [
            'success' => $success,
            'message' => $success ? 'contact_deleted' : 'delete_failed'
        ];
    }

    /**
     * PUT /api/contacts/reorder
     *
     * Réordonner les contacts
     */
    public function reorder(int $userId, array $data): array
    {
        if (empty($data['order']) || !is_array($data['order'])) {
            return ['success' => false, 'error' => 'invalid_order_data'];
        }

        $orderedIds = array_map('intval', $data['order']);

        // Vérifier que tous les IDs appartiennent à l'utilisatrice
        foreach ($orderedIds as $id) {
            $contact = $this->contactModel->findByIdAndUser($id, $userId);
            if (!$contact) {
                return ['success' => false, 'error' => 'invalid_contact_id', 'id' => $id];
            }
        }

        $success = $this->contactModel->reorder($userId, $orderedIds);

        if (!$success) {
            return ['success' => false, 'error' => 'reorder_failed'];
        }

        $contacts = $this->contactModel->getByUser($userId);

        return [
            'success' => true,
            'contacts' => $contacts,
            'message' => 'contacts_reordered'
        ];
    }

    /**
     * POST /api/contacts/{id}/test
     *
     * Envoyer un SMS de test au contact
     */
    public function sendTest(int $userId, int $contactId): array
    {
        $contact = $this->contactModel->findByIdAndUser($contactId, $userId);
        if (!$contact) {
            return ['success' => false, 'error' => 'contact_not_found'];
        }

        // Récupérer l'utilisatrice pour le message personnalisé
        $user = $this->userModel->findById($userId);
        $userName = $user ? $user['first_name'] : 'Une utilisatrice';
        $language = $user['preferred_language'] ?? 'fr';

        // Messages de test selon la langue
        $messages = [
            'fr' => "SHIELD TEST - %s vous a ajouté(e) comme contact de confiance sur SHIELD. En cas d'alerte, vous recevrez un message de détresse.",
            'en' => "SHIELD TEST - %s has added you as a trusted contact on SHIELD. In case of an alert, you will receive a distress message.",
            'de' => "SHIELD TEST - %s hat Sie als Vertrauenskontakt bei SHIELD hinzugefügt. Im Notfall erhalten Sie eine Notrufnachricht.",
            'es' => "SHIELD TEST - %s te ha añadido como contacto de confianza en SHIELD. En caso de alerta, recibirás un mensaje de emergencia.",
            'it' => "SHIELD TEST - %s ti ha aggiunto come contatto di fiducia su SHIELD. In caso di allarme, riceverai un messaggio di emergenza."
        ];

        $message = sprintf($messages[$language] ?? $messages['fr'], $userName);
        $result = $this->twilioService->sendSMS($contact['phone'], $message);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => 'sms_send_failed',
                'details' => $result['error'] ?? null
            ];
        }

        return [
            'success' => true,
            'message' => 'test_sms_sent',
            'phone' => $contact['phone'],
            'sid' => $result['sid'] ?? null
        ];
    }

    /**
     * PUT /api/contacts/{id}/notifications
     *
     * Modifier les préférences de notification d'un contact
     */
    public function updateNotifications(int $userId, int $contactId, array $data): array
    {
        $contact = $this->contactModel->findByIdAndUser($contactId, $userId);
        if (!$contact) {
            return ['success' => false, 'error' => 'contact_not_found'];
        }

        $notificationFields = ['notify_by_sms', 'notify_by_push', 'notify_by_call'];
        $updateData = array_intersect_key($data, array_flip($notificationFields));

        if (empty($updateData)) {
            return ['success' => false, 'error' => 'no_notification_fields'];
        }

        // Convertir en booléens
        foreach ($updateData as $key => $value) {
            $updateData[$key] = (int) (bool) $value;
        }

        $success = $this->contactModel->update($contactId, $userId, $updateData);

        return [
            'success' => $success,
            'message' => $success ? 'notifications_updated' : 'update_failed'
        ];
    }

    /**
     * Valider les données d'un contact
     */
    private function validateContactData(array $data, bool $isUpdate = false): array
    {
        $errors = [];

        // Nom requis sauf en update
        if (!$isUpdate && (empty($data['name']) || strlen(trim($data['name'])) < 2)) {
            $errors['name'] = 'name_required';
        }

        // Téléphone requis et format valide
        if (!$isUpdate && empty($data['phone'])) {
            $errors['phone'] = 'phone_required';
        } elseif (isset($data['phone']) && !preg_match('/^\+[1-9]\d{6,14}$/', $data['phone'])) {
            $errors['phone'] = 'invalid_phone_format';
        }

        // Email optionnel mais valide si fourni
        if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'invalid_email';
        }

        // Relation optionnelle
        if (isset($data['relation'])) {
            $validRelations = ['family', 'friend', 'partner', 'colleague', 'neighbor', 'other'];
            if (!in_array($data['relation'], $validRelations, true)) {
                $errors['relation'] = 'invalid_relation';
            }
        }

        return $errors;
    }
}

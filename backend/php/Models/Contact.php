<?php
declare(strict_types=1);

namespace Shield\Models;

use PDO;
use PDOException;

/**
 * Contact Model - Gestion des contacts de confiance
 */
class Contact
{
    private PDO $db;
    private string $table = 'trusted_contacts';
    private const MAX_CONTACTS = 5;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtenir tous les contacts d'une utilisatrice
     */
    public function getByUser(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE user_id = :user_id
            ORDER BY priority ASC
        ");
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Trouver un contact par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);

        return $contact ?: null;
    }

    /**
     * Trouver un contact par ID et user_id (sécurité)
     */
    public function findByIdAndUser(int $id, int $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE id = :id AND user_id = :user_id
        ");
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);

        return $contact ?: null;
    }

    /**
     * Compter les contacts actifs d'une utilisatrice
     */
    public function countByUser(int $userId): int
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM {$this->table}
            WHERE user_id = :user_id AND is_active = 1
        ");
        $stmt->execute(['user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Vérifier si l'utilisatrice peut ajouter un contact
     */
    public function canAddContact(int $userId): bool
    {
        return $this->countByUser($userId) < self::MAX_CONTACTS;
    }

    /**
     * Ajouter un contact de confiance
     */
    public function create(int $userId, array $data): ?int
    {
        // Vérifier la limite
        if (!$this->canAddContact($userId)) {
            return null;
        }

        // Déterminer la priorité
        $nextPriority = $this->countByUser($userId) + 1;

        $sql = "
            INSERT INTO {$this->table} (
                user_id, name, phone, email, relation,
                notify_by_sms, notify_by_push, notify_by_call,
                priority_order, created_at
            ) VALUES (
                :user_id, :name, :phone, :email, :relation,
                :notify_by_sms, :notify_by_push, :notify_by_call,
                :priority_order, NOW()
            )
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'user_id' => $userId,
            'name' => trim($data['name']),
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'relation' => $data['relation'] ?? null,
            'notify_by_sms' => $data['notify_by_sms'] ?? 1,
            'notify_by_push' => $data['notify_by_push'] ?? 0,
            'notify_by_call' => $data['notify_by_call'] ?? 0,
            'priority_order' => $data['priority_order'] ?? $nextPriority
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Mettre à jour un contact
     */
    public function update(int $id, int $userId, array $data): bool
    {
        // Vérifier que le contact appartient à l'utilisatrice
        $contact = $this->findByIdAndUser($id, $userId);
        if (!$contact) {
            return false;
        }

        $allowedFields = [
            'name', 'phone', 'email', 'relation',
            'notify_by_sms', 'notify_by_push', 'notify_by_call',
            'priority_order', 'is_active'
        ];

        $updates = [];
        $params = ['id' => $id, 'user_id' => $userId];

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
               ", updated_at = NOW() WHERE id = :id AND user_id = :user_id";
        $stmt = $this->db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * Supprimer un contact (soft delete)
     */
    public function delete(int $id, int $userId): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                is_active = 0,
                updated_at = NOW()
            WHERE id = :id AND user_id = :user_id
        ");

        return $stmt->execute(['id' => $id, 'user_id' => $userId]);
    }

    /**
     * Supprimer définitivement un contact
     */
    public function hardDelete(int $id, int $userId): bool
    {
        $stmt = $this->db->prepare("
            DELETE FROM {$this->table}
            WHERE id = :id AND user_id = :user_id
        ");

        return $stmt->execute(['id' => $id, 'user_id' => $userId]);
    }

    /**
     * Réordonner les contacts
     */
    public function reorder(int $userId, array $orderedIds): bool
    {
        $this->db->beginTransaction();

        try {
            foreach ($orderedIds as $priority => $contactId) {
                $stmt = $this->db->prepare("
                    UPDATE {$this->table} SET
                        priority_order = :priority,
                        updated_at = NOW()
                    WHERE id = :id AND user_id = :user_id
                ");
                $stmt->execute([
                    'priority' => $priority + 1,
                    'id' => $contactId,
                    'user_id' => $userId
                ]);
            }

            $this->db->commit();
            return true;
        } catch (PDOException $e) {
            $this->db->rollBack();
            return false;
        }
    }

    /**
     * Obtenir les contacts à notifier pour un incident
     */
    public function getContactsToNotify(int $userId, string $notificationType = 'sms'): array
    {
        $column = match($notificationType) {
            'sms' => 'notify_by_sms',
            'push' => 'notify_by_push',
            'call' => 'notify_by_call',
            default => 'notify_by_sms'
        };

        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE user_id = :user_id
              AND is_active = 1
              AND {$column} = 1
            ORDER BY priority_order ASC
        ");
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Vérifier si un numéro de téléphone est déjà contact de l'utilisatrice
     */
    public function phoneExists(int $userId, string $phone, ?int $excludeId = null): bool
    {
        $sql = "SELECT COUNT(*) FROM {$this->table}
                WHERE user_id = :user_id AND phone = :phone AND is_active = 1";
        $params = ['user_id' => $userId, 'phone' => $phone];

        if ($excludeId !== null) {
            $sql .= " AND id != :exclude_id";
            $params['exclude_id'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Marquer un contact comme notifié pour un incident
     */
    public function logNotification(int $contactId, string $incidentId, string $method, bool $success, ?string $errorMessage = null): bool
    {
        $stmt = $this->db->prepare("
            INSERT INTO incident_contact_notifications (
                incident_id, contact_id, notification_method,
                sent_at, delivered, error_message
            ) VALUES (
                :incident_id, :contact_id, :method,
                NOW(), :delivered, :error_message
            )
        ");

        return $stmt->execute([
            'incident_id' => $incidentId,
            'contact_id' => $contactId,
            'method' => $method,
            'delivered' => $success ? 1 : 0,
            'error_message' => $errorMessage
        ]);
    }

    /**
     * Obtenir l'historique des notifications d'un incident
     */
    public function getNotificationLog(string $incidentId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                n.*, c.name as contact_name, c.phone as contact_phone
            FROM incident_contact_notifications n
            JOIN {$this->table} c ON n.contact_id = c.id
            WHERE n.incident_id = :incident_id
            ORDER BY n.sent_at ASC
        ");
        $stmt->execute(['incident_id' => $incidentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

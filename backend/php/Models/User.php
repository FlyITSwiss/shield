<?php
declare(strict_types=1);

namespace Shield\Models;

use PDO;
use PDOException;

/**
 * User Model - Gestion des utilisatrices SHIELD
 */
class User
{
    private PDO $db;
    private string $table = 'users';

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Trouver une utilisatrice par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE id = :id AND is_active = 1
        ");
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Trouver une utilisatrice par email
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE email = :email
        ");
        $stmt->execute(['email' => strtolower(trim($email))]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Trouver une utilisatrice par téléphone
     */
    public function findByPhone(string $phone): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE phone = :phone
        ");
        $stmt->execute(['phone' => $phone]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Trouver par OAuth provider
     */
    public function findByOAuth(string $provider, string $oauthId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE oauth_provider = :provider AND oauth_id = :oauth_id
        ");
        $stmt->execute([
            'provider' => $provider,
            'oauth_id' => $oauthId
        ]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Créer une nouvelle utilisatrice
     */
    public function create(array $data): int
    {
        $sql = "
            INSERT INTO {$this->table} (
                email, password_hash, first_name, phone, country_code,
                preferred_language, alert_mode, oauth_provider, oauth_id,
                profile_picture_url, created_at
            ) VALUES (
                :email, :password_hash, :first_name, :phone, :country_code,
                :preferred_language, :alert_mode, :oauth_provider, :oauth_id,
                :profile_picture_url, NOW()
            )
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'email' => strtolower(trim($data['email'])),
            'password_hash' => $data['password_hash'] ?? null,
            'first_name' => trim($data['first_name']),
            'phone' => $data['phone'],
            'country_code' => strtoupper($data['country_code'] ?? 'FR'),
            'preferred_language' => $data['preferred_language'] ?? 'fr',
            'alert_mode' => $data['alert_mode'] ?? 'sonic',
            'oauth_provider' => $data['oauth_provider'] ?? 'email',
            'oauth_id' => $data['oauth_id'] ?? null,
            'profile_picture_url' => $data['profile_picture_url'] ?? null
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Mettre à jour une utilisatrice
     */
    public function update(int $id, array $data): bool
    {
        $allowedFields = [
            'first_name', 'phone', 'country_code', 'preferred_language',
            'alert_mode', 'code_word_red', 'code_word_orange', 'code_word_cancel',
            'profile_picture_url', 'date_of_birth', 'home_address',
            'phone_verified', 'email_verified_at', 'is_active'
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

        $sql = "UPDATE {$this->table} SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * Mettre à jour le mot de passe
     */
    public function updatePassword(int $id, string $passwordHash): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET password_hash = :password_hash, updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute([
            'id' => $id,
            'password_hash' => $passwordHash
        ]);
    }

    /**
     * Marquer le téléphone comme vérifié
     */
    public function markPhoneVerified(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET phone_verified = 1, updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Marquer l'email comme vérifié
     */
    public function markEmailVerified(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET email_verified_at = NOW(), updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Désactiver une utilisatrice (soft delete)
     */
    public function deactivate(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET is_active = 0, updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Supprimer définitivement (RGPD)
     */
    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Mettre à jour la dernière connexion
     */
    public function updateLastLogin(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET last_login_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Vérifier si l'email existe déjà
     */
    public function emailExists(string $email, ?int $excludeId = null): bool
    {
        $sql = "SELECT COUNT(*) FROM {$this->table} WHERE email = :email";
        $params = ['email' => strtolower(trim($email))];

        if ($excludeId !== null) {
            $sql .= " AND id != :exclude_id";
            $params['exclude_id'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Vérifier si le téléphone existe déjà
     */
    public function phoneExists(string $phone, ?int $excludeId = null): bool
    {
        $sql = "SELECT COUNT(*) FROM {$this->table} WHERE phone = :phone";
        $params = ['phone' => $phone];

        if ($excludeId !== null) {
            $sql .= " AND id != :exclude_id";
            $params['exclude_id'] = $excludeId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Obtenir les préférences d'alerte
     */
    public function getAlertPreferences(int $id): array
    {
        $stmt = $this->db->prepare("
            SELECT
                alert_mode, code_word_red, code_word_orange, code_word_cancel,
                volume_trigger_duration, tap_trigger_enabled, volume_trigger_enabled,
                confirmation_delay
            FROM {$this->table}
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Mettre à jour les préférences d'alerte
     */
    public function updateAlertPreferences(int $id, array $prefs): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} SET
                alert_mode = :alert_mode,
                code_word_red = :code_word_red,
                code_word_orange = :code_word_orange,
                code_word_cancel = :code_word_cancel,
                volume_trigger_duration = :volume_trigger_duration,
                confirmation_delay = :confirmation_delay,
                updated_at = NOW()
            WHERE id = :id
        ");

        return $stmt->execute([
            'id' => $id,
            'alert_mode' => $prefs['alert_mode'] ?? 'sonic',
            'code_word_red' => $prefs['code_word_red'] ?? null,
            'code_word_orange' => $prefs['code_word_orange'] ?? null,
            'code_word_cancel' => $prefs['code_word_cancel'] ?? null,
            'volume_trigger_duration' => $prefs['volume_trigger_duration'] ?? 3,
            'confirmation_delay' => $prefs['confirmation_delay'] ?? 0
        ]);
    }

    /**
     * Rechercher des utilisatrices (admin)
     */
    public function search(string $query, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare("
            SELECT id, email, first_name, phone, country_code, is_active, created_at
            FROM {$this->table}
            WHERE
                email LIKE :query OR
                first_name LIKE :query OR
                phone LIKE :query
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        ");

        $searchQuery = "%{$query}%";
        $stmt->bindValue('query', $searchQuery, PDO::PARAM_STR);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Compter le nombre total d'utilisatrices
     */
    public function count(bool $activeOnly = true): int
    {
        $sql = "SELECT COUNT(*) FROM {$this->table}";
        if ($activeOnly) {
            $sql .= " WHERE is_active = 1";
        }

        return (int) $this->db->query($sql)->fetchColumn();
    }
}

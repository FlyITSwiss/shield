<?php
declare(strict_types=1);

namespace Shield\Controllers;

use PDO;

/**
 * SettingsController - Gestion des paramètres utilisateur
 */
class SettingsController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * GET /api/settings
     *
     * Récupérer tous les paramètres utilisateur
     */
    public function getAll(int $userId): array
    {
        // Récupérer les préférences d'alerte
        $stmt = $this->db->prepare("
            SELECT * FROM alert_preferences
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        $alertPrefs = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Récupérer les infos utilisateur
        $stmt = $this->db->prepare("
            SELECT id, email, first_name, last_name, phone_number,
                   preferred_language, country_code, profile_picture_url,
                   created_at
            FROM users
            WHERE id = ?
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'success' => true,
            'user' => $user,
            'alert_preferences' => $alertPrefs
        ];
    }

    /**
     * PUT /api/settings/profile
     *
     * Mettre à jour le profil
     */
    public function updateProfile(int $userId, array $data): array
    {
        $allowedFields = ['first_name', 'last_name', 'phone_number', 'preferred_language', 'country_code'];
        $updates = [];
        $params = [];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = ?";
                $params[] = trim($data[$field]);
            }
        }

        if (empty($updates)) {
            return ['success' => false, 'error' => 'no_fields_to_update'];
        }

        $params[] = $userId;

        $sql = "UPDATE users SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $success = $stmt->execute($params);

        return [
            'success' => $success,
            'message' => $success ? 'profile_updated' : 'update_failed'
        ];
    }

    /**
     * PUT /api/settings/alert-preferences
     *
     * Mettre à jour les préférences d'alerte
     */
    public function updateAlertPreferences(int $userId, array $data): array
    {
        // Vérifier si les préférences existent
        $stmt = $this->db->prepare("SELECT id FROM alert_preferences WHERE user_id = ?");
        $stmt->execute([$userId]);
        $exists = $stmt->fetch();

        $fields = [
            'alert_mode' => $data['alert_mode'] ?? 'sonic',
            'confirmation_delay' => (int)($data['confirmation_delay'] ?? 0),
            'volume_trigger_enabled' => !empty($data['volume_trigger_enabled']) ? 1 : 0,
            'volume_trigger_duration' => (int)($data['volume_trigger_duration'] ?? 3),
            'code_word_red' => trim($data['code_word_red'] ?? ''),
            'code_word_orange' => trim($data['code_word_orange'] ?? ''),
            'code_word_cancel' => trim($data['code_word_cancel'] ?? '')
        ];

        // Valider alert_mode
        if (!in_array($fields['alert_mode'], ['sonic', 'silent'], true)) {
            $fields['alert_mode'] = 'sonic';
        }

        // Valider confirmation_delay
        if (!in_array($fields['confirmation_delay'], [0, 3, 5], true)) {
            $fields['confirmation_delay'] = 0;
        }

        // Valider volume_trigger_duration
        if (!in_array($fields['volume_trigger_duration'], [2, 3, 5], true)) {
            $fields['volume_trigger_duration'] = 3;
        }

        if ($exists) {
            $stmt = $this->db->prepare("
                UPDATE alert_preferences SET
                    alert_mode = ?,
                    confirmation_delay = ?,
                    volume_trigger_enabled = ?,
                    volume_trigger_duration = ?,
                    code_word_red = ?,
                    code_word_orange = ?,
                    code_word_cancel = ?,
                    updated_at = NOW()
                WHERE user_id = ?
            ");
            $success = $stmt->execute([
                $fields['alert_mode'],
                $fields['confirmation_delay'],
                $fields['volume_trigger_enabled'],
                $fields['volume_trigger_duration'],
                $fields['code_word_red'],
                $fields['code_word_orange'],
                $fields['code_word_cancel'],
                $userId
            ]);
        } else {
            $stmt = $this->db->prepare("
                INSERT INTO alert_preferences
                (user_id, alert_mode, confirmation_delay, volume_trigger_enabled,
                 volume_trigger_duration, code_word_red, code_word_orange, code_word_cancel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $success = $stmt->execute([
                $userId,
                $fields['alert_mode'],
                $fields['confirmation_delay'],
                $fields['volume_trigger_enabled'],
                $fields['volume_trigger_duration'],
                $fields['code_word_red'],
                $fields['code_word_orange'],
                $fields['code_word_cancel']
            ]);
        }

        return [
            'success' => $success,
            'message' => $success ? 'preferences_updated' : 'update_failed'
        ];
    }

    /**
     * PUT /api/settings/password
     *
     * Changer le mot de passe
     */
    public function changePassword(int $userId, array $data): array
    {
        if (empty($data['current_password']) || empty($data['new_password'])) {
            return ['success' => false, 'error' => 'missing_passwords'];
        }

        // Vérifier le mot de passe actuel
        $stmt = $this->db->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($data['current_password'], $user['password_hash'])) {
            return ['success' => false, 'error' => 'invalid_current_password'];
        }

        // Valider le nouveau mot de passe
        if (strlen($data['new_password']) < 8) {
            return ['success' => false, 'error' => 'password_too_short'];
        }

        // Mettre à jour
        $newHash = password_hash($data['new_password'], PASSWORD_DEFAULT);
        $stmt = $this->db->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
        $success = $stmt->execute([$newHash, $userId]);

        return [
            'success' => $success,
            'message' => $success ? 'password_changed' : 'change_failed'
        ];
    }

    /**
     * DELETE /api/settings/account
     *
     * Supprimer le compte
     */
    public function deleteAccount(int $userId, array $data): array
    {
        if (empty($data['password'])) {
            return ['success' => false, 'error' => 'password_required'];
        }

        // Vérifier le mot de passe
        $stmt = $this->db->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($data['password'], $user['password_hash'])) {
            return ['success' => false, 'error' => 'invalid_password'];
        }

        // Soft delete (garder les données pour les incidents)
        $stmt = $this->db->prepare("
            UPDATE users SET
                is_active = 0,
                email = CONCAT('deleted_', id, '_', email),
                deleted_at = NOW()
            WHERE id = ?
        ");
        $success = $stmt->execute([$userId]);

        return [
            'success' => $success,
            'message' => $success ? 'account_deleted' : 'delete_failed'
        ];
    }
}

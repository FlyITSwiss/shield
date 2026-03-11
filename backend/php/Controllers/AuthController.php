<?php
declare(strict_types=1);

namespace Shield\Controllers;

use PDO;
use Shield\Services\AuthService;
use Shield\Services\TwilioService;
use Shield\Models\User;

/**
 * AuthController - Gestion de l'authentification
 */
class AuthController
{
    private PDO $db;
    private AuthService $authService;
    private TwilioService $twilioService;
    private User $userModel;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->twilioService = new TwilioService($db);
        $this->authService = new AuthService($db, $this->twilioService);
        $this->userModel = new User($db);
    }

    /**
     * POST /api/auth/register
     */
    public function register(array $data): array
    {
        return $this->authService->register($data);
    }

    /**
     * POST /api/auth/login
     */
    public function login(array $data): array
    {
        if (empty($data['email']) || empty($data['password'])) {
            return ['success' => false, 'error' => 'missing_credentials'];
        }

        $remember = !empty($data['remember']) && $data['remember'] === true;

        return $this->authService->login($data['email'], $data['password'], $remember);
    }

    /**
     * POST /api/auth/oauth
     */
    public function oauthLogin(array $data): array
    {
        if (empty($data['provider']) || empty($data['oauth_id'])) {
            return ['success' => false, 'error' => 'missing_oauth_data'];
        }

        return $this->authService->oauthLogin($data['provider'], $data);
    }

    /**
     * POST /api/auth/verify-phone
     */
    public function verifyPhone(int $userId, array $data): array
    {
        if (empty($data['code'])) {
            return ['success' => false, 'error' => 'missing_code'];
        }

        return $this->authService->verifyPhone($userId, $data['code']);
    }

    /**
     * POST /api/auth/forgot-password
     */
    public function forgotPassword(array $data): array
    {
        if (empty($data['email'])) {
            return ['success' => false, 'error' => 'missing_email'];
        }

        return $this->authService->requestPasswordReset($data['email']);
    }

    /**
     * POST /api/auth/reset-password
     */
    public function resetPassword(array $data): array
    {
        if (empty($data['email']) || empty($data['code']) || empty($data['new_password'])) {
            return ['success' => false, 'error' => 'missing_fields'];
        }

        return $this->authService->resetPassword(
            $data['email'],
            $data['code'],
            $data['new_password']
        );
    }

    /**
     * POST /api/auth/refresh-token
     */
    public function refreshToken(array $data): array
    {
        if (empty($data['token'])) {
            return ['success' => false, 'error' => 'missing_token'];
        }

        return $this->authService->refreshToken($data['token']);
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(int $userId): array
    {
        return $this->authService->logout($userId);
    }

    /**
     * GET /api/auth/me
     */
    public function getProfile(int $userId): array
    {
        $user = $this->userModel->findById($userId);

        if (!$user) {
            return ['success' => false, 'error' => 'user_not_found'];
        }

        // Nettoyer les données sensibles
        unset($user['password_hash'], $user['oauth_id']);

        return ['success' => true, 'user' => $user];
    }

    /**
     * PUT /api/auth/profile
     */
    public function updateProfile(int $userId, array $data): array
    {
        $allowedFields = [
            'first_name', 'phone', 'country_code', 'preferred_language',
            'date_of_birth', 'home_address'
        ];

        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            return ['success' => false, 'error' => 'no_fields_to_update'];
        }

        // Vérifier le téléphone unique si modifié
        if (isset($data['phone']) && $this->userModel->phoneExists($data['phone'], $userId)) {
            return ['success' => false, 'error' => 'phone_already_exists'];
        }

        $success = $this->userModel->update($userId, $updateData);

        return ['success' => $success];
    }

    /**
     * PUT /api/auth/password
     */
    public function changePassword(int $userId, array $data): array
    {
        if (empty($data['current_password']) || empty($data['new_password'])) {
            return ['success' => false, 'error' => 'missing_passwords'];
        }

        if (strlen($data['new_password']) < 8) {
            return ['success' => false, 'error' => 'password_too_short'];
        }

        $user = $this->userModel->findById($userId);
        if (!$user || !password_verify($data['current_password'], $user['password_hash'])) {
            return ['success' => false, 'error' => 'invalid_current_password'];
        }

        $newHash = password_hash($data['new_password'], PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 3
        ]);

        $success = $this->userModel->updatePassword($userId, $newHash);

        return ['success' => $success];
    }

    /**
     * GET /api/auth/alert-preferences
     */
    public function getAlertPreferences(int $userId): array
    {
        $prefs = $this->userModel->getAlertPreferences($userId);

        return ['success' => true, 'preferences' => $prefs];
    }

    /**
     * PUT /api/auth/alert-preferences
     */
    public function updateAlertPreferences(int $userId, array $data): array
    {
        $success = $this->userModel->updateAlertPreferences($userId, $data);

        return ['success' => $success];
    }

    /**
     * DELETE /api/auth/account
     */
    public function deleteAccount(int $userId, array $data): array
    {
        // Vérifier le mot de passe pour confirmation
        if (!empty($data['password'])) {
            $user = $this->userModel->findById($userId);
            if (!$user || !password_verify($data['password'], $user['password_hash'])) {
                return ['success' => false, 'error' => 'invalid_password'];
            }
        }

        // Soft delete par défaut, hard delete si demandé explicitement
        if (!empty($data['permanent']) && $data['permanent'] === true) {
            $success = $this->userModel->delete($userId);
        } else {
            $success = $this->userModel->deactivate($userId);
        }

        return ['success' => $success];
    }

    /**
     * POST /api/auth/resend-verification
     */
    public function resendVerification(int $userId): array
    {
        $user = $this->userModel->findById($userId);

        if (!$user) {
            return ['success' => false, 'error' => 'user_not_found'];
        }

        if ($user['phone_verified']) {
            return ['success' => false, 'error' => 'already_verified'];
        }

        if (empty($user['phone'])) {
            return ['success' => false, 'error' => 'no_phone_number'];
        }

        // Déléguer à AuthService (évite SQL dans Controller)
        return $this->authService->resendPhoneVerification($userId, $user);
    }
}

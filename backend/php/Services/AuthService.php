<?php
declare(strict_types=1);

namespace Shield\Services;

use PDO;
use Shield\Models\User;
use Shield\Services\TwilioService;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/**
 * AuthService - Gestion de l'authentification SHIELD
 */
class AuthService
{
    private PDO $db;
    private User $userModel;
    private TwilioService $twilioService;
    private string $jwtSecret;
    private int $jwtExpiry = 86400; // 24 heures
    private int $jwtExpiryRemember = 2592000; // 30 jours pour "Se souvenir de moi"

    public function __construct(PDO $db, ?TwilioService $twilioService = null)
    {
        $this->db = $db;
        $this->userModel = new User($db);
        $this->twilioService = $twilioService ?? new TwilioService($db);
        $this->jwtSecret = $_ENV['JWT_SECRET'] ?? 'shield-secret-key-change-in-production';
    }

    /**
     * Inscription par email/mot de passe
     */
    public function register(array $data): array
    {
        // Valider les données
        $errors = $this->validateRegistration($data);
        if (!empty($errors)) {
            return ['success' => false, 'errors' => $errors];
        }

        // Vérifier si email existe déjà
        if ($this->userModel->emailExists($data['email'])) {
            return ['success' => false, 'errors' => ['email' => 'email_already_exists']];
        }

        // Vérifier si téléphone existe déjà
        if ($this->userModel->phoneExists($data['phone'])) {
            return ['success' => false, 'errors' => ['phone' => 'phone_already_exists']];
        }

        // Hasher le mot de passe
        $passwordHash = password_hash($data['password'], PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 3
        ]);

        // Créer l'utilisatrice
        $userId = $this->userModel->create([
            'email' => $data['email'],
            'password_hash' => $passwordHash,
            'first_name' => $data['first_name'],
            'phone' => $data['phone'],
            'country_code' => $data['country_code'] ?? 'FR',
            'preferred_language' => $data['preferred_language'] ?? 'fr',
            'oauth_provider' => 'email'
        ]);

        // Générer le token JWT
        $token = $this->generateToken($userId);

        // Envoyer le code de vérification par SMS
        $this->sendPhoneVerification($userId, $data['phone']);

        return [
            'success' => true,
            'user_id' => $userId,
            'token' => $token,
            'requires_phone_verification' => true
        ];
    }

    /**
     * Connexion par email/mot de passe
     *
     * @param string $email
     * @param string $password
     * @param bool $remember Se souvenir de moi (token 30 jours)
     */
    public function login(string $email, string $password, bool $remember = false): array
    {
        $user = $this->userModel->findByEmail($email);

        if (!$user) {
            return ['success' => false, 'error' => 'invalid_credentials'];
        }

        if (!$user['is_active']) {
            return ['success' => false, 'error' => 'account_disabled'];
        }

        if (!password_verify($password, $user['password_hash'])) {
            return ['success' => false, 'error' => 'invalid_credentials'];
        }

        // Mettre à jour la dernière connexion
        $this->userModel->updateLastLogin($user['id']);

        // Générer le token (30 jours si remember, 24h sinon)
        $token = $this->generateToken($user['id'], $remember);

        return [
            'success' => true,
            'user' => $this->sanitizeUser($user),
            'token' => $token,
            'remember' => $remember,
            'expires_in' => $remember ? $this->jwtExpiryRemember : $this->jwtExpiry
        ];
    }

    /**
     * Connexion OAuth (Google, Facebook, Instagram)
     */
    public function oauthLogin(string $provider, array $oauthData): array
    {
        $validProviders = ['google', 'facebook', 'instagram'];
        if (!in_array($provider, $validProviders, true)) {
            return ['success' => false, 'error' => 'invalid_oauth_provider'];
        }

        // Chercher l'utilisatrice par OAuth ID
        $user = $this->userModel->findByOAuth($provider, $oauthData['oauth_id']);

        if ($user) {
            // Utilisatrice existante - connexion
            if (!$user['is_active']) {
                return ['success' => false, 'error' => 'account_disabled'];
            }

            $this->userModel->updateLastLogin($user['id']);
            $token = $this->generateToken($user['id']);

            return [
                'success' => true,
                'user' => $this->sanitizeUser($user),
                'token' => $token,
                'is_new_user' => false
            ];
        }

        // Vérifier si l'email existe déjà (compte email à lier)
        if (isset($oauthData['email'])) {
            $existingUser = $this->userModel->findByEmail($oauthData['email']);
            if ($existingUser) {
                // Lier le compte OAuth au compte email existant
                $this->linkOAuthAccount($existingUser['id'], $provider, $oauthData['oauth_id']);
                $token = $this->generateToken($existingUser['id']);

                return [
                    'success' => true,
                    'user' => $this->sanitizeUser($existingUser),
                    'token' => $token,
                    'is_new_user' => false,
                    'linked_account' => true
                ];
            }
        }

        // Nouvelle utilisatrice via OAuth
        $userId = $this->userModel->create([
            'email' => $oauthData['email'] ?? null,
            'first_name' => $oauthData['first_name'] ?? $oauthData['name'] ?? 'Utilisatrice',
            'phone' => $oauthData['phone'] ?? null,
            'country_code' => $oauthData['country_code'] ?? 'FR',
            'preferred_language' => $oauthData['preferred_language'] ?? 'fr',
            'oauth_provider' => $provider,
            'oauth_id' => $oauthData['oauth_id'],
            'profile_picture_url' => $oauthData['picture'] ?? null
        ]);

        $user = $this->userModel->findById($userId);
        $token = $this->generateToken($userId);

        return [
            'success' => true,
            'user' => $this->sanitizeUser($user),
            'token' => $token,
            'is_new_user' => true,
            'requires_phone' => empty($oauthData['phone'])
        ];
    }

    /**
     * Vérifier le code SMS
     */
    public function verifyPhone(int $userId, string $code): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM phone_verifications
            WHERE user_id = :user_id
              AND code = :code
              AND used_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $stmt->execute(['user_id' => $userId, 'code' => $code]);
        $verification = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$verification) {
            return ['success' => false, 'error' => 'invalid_or_expired_code'];
        }

        // Marquer comme utilisé
        $stmt = $this->db->prepare("
            UPDATE phone_verifications
            SET used_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute(['id' => $verification['id']]);

        // Marquer le téléphone comme vérifié
        $this->userModel->markPhoneVerified($userId);

        return ['success' => true];
    }

    /**
     * Mot de passe oublié - envoyer code
     */
    public function requestPasswordReset(string $email): array
    {
        $user = $this->userModel->findByEmail($email);

        // Toujours retourner succès (sécurité)
        if (!$user) {
            return ['success' => true, 'message' => 'reset_email_sent'];
        }

        // Générer un code à 6 chiffres
        $code = sprintf('%06d', random_int(0, 999999));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 minutes'));

        $stmt = $this->db->prepare("
            INSERT INTO password_resets (user_id, code, expires_at)
            VALUES (:user_id, :code, :expires_at)
        ");
        $stmt->execute([
            'user_id' => $user['id'],
            'code' => $code,
            'expires_at' => $expiresAt
        ]);

        // Envoyer par email et SMS si disponible
        $this->sendPasswordResetCode($user, $code);

        return ['success' => true, 'message' => 'reset_email_sent'];
    }

    /**
     * Réinitialiser le mot de passe
     */
    public function resetPassword(string $email, string $code, string $newPassword): array
    {
        $user = $this->userModel->findByEmail($email);
        if (!$user) {
            return ['success' => false, 'error' => 'invalid_reset_code'];
        }

        $stmt = $this->db->prepare("
            SELECT * FROM password_resets
            WHERE user_id = :user_id
              AND code = :code
              AND used_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $stmt->execute(['user_id' => $user['id'], 'code' => $code]);
        $reset = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$reset) {
            return ['success' => false, 'error' => 'invalid_reset_code'];
        }

        // Valider le nouveau mot de passe
        if (strlen($newPassword) < 8) {
            return ['success' => false, 'error' => 'password_too_short'];
        }

        // Hasher et mettre à jour
        $passwordHash = password_hash($newPassword, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 3
        ]);
        $this->userModel->updatePassword($user['id'], $passwordHash);

        // Marquer le code comme utilisé
        $stmt = $this->db->prepare("
            UPDATE password_resets SET used_at = NOW() WHERE id = :id
        ");
        $stmt->execute(['id' => $reset['id']]);

        return ['success' => true];
    }

    /**
     * Rafraîchir le token JWT
     */
    public function refreshToken(string $token): array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));
            $userId = $decoded->user_id;

            $user = $this->userModel->findById($userId);
            if (!$user || !$user['is_active']) {
                return ['success' => false, 'error' => 'invalid_token'];
            }

            $newToken = $this->generateToken($userId);

            return [
                'success' => true,
                'token' => $newToken,
                'user' => $this->sanitizeUser($user)
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'invalid_token'];
        }
    }

    /**
     * Valider un token JWT
     */
    public function validateToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));
            return (array) $decoded;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Déconnexion (invalider le token côté client)
     */
    public function logout(int $userId): array
    {
        // Pour une vraie invalidation, stocker les tokens révoqués en Redis
        // Pour l'instant, le client supprime simplement le token
        return ['success' => true];
    }

    /**
     * Générer un token JWT
     *
     * @param int $userId
     * @param bool $remember Utiliser une expiration longue (30 jours)
     */
    private function generateToken(int $userId, bool $remember = false): string
    {
        $issuedAt = time();
        $expiry = $remember ? $this->jwtExpiryRemember : $this->jwtExpiry;
        $expiresAt = $issuedAt + $expiry;

        $payload = [
            'iss' => 'shield-app',
            'aud' => 'shield-mobile',
            'iat' => $issuedAt,
            'exp' => $expiresAt,
            'user_id' => $userId,
            'remember' => $remember
        ];

        return JWT::encode($payload, $this->jwtSecret, 'HS256');
    }

    /**
     * Valider les données d'inscription
     */
    private function validateRegistration(array $data): array
    {
        $errors = [];

        if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'invalid_email';
        }

        if (empty($data['password']) || strlen($data['password']) < 8) {
            $errors['password'] = 'password_too_short';
        }

        if (empty($data['first_name']) || strlen(trim($data['first_name'])) < 2) {
            $errors['first_name'] = 'first_name_required';
        }

        if (empty($data['phone'])) {
            $errors['phone'] = 'phone_required';
        } elseif (!preg_match('/^\+[1-9]\d{6,14}$/', $data['phone'])) {
            $errors['phone'] = 'invalid_phone_format';
        }

        return $errors;
    }

    /**
     * Renvoyer le code de vérification SMS (appelé depuis Controller)
     */
    public function resendPhoneVerification(int $userId, array $user): array
    {
        $phone = $user['phone'];
        $language = $user['preferred_language'] ?? 'fr';

        try {
            $this->sendPhoneVerification($userId, $phone, $language);
            return ['success' => true, 'message' => 'verification_sent'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'sms_send_failed'];
        }
    }

    /**
     * Envoyer le code de vérification SMS
     */
    private function sendPhoneVerification(int $userId, string $phone, string $language = 'fr'): void
    {
        $code = sprintf('%06d', random_int(0, 999999));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

        $stmt = $this->db->prepare("
            INSERT INTO phone_verifications (user_id, phone, code, expires_at)
            VALUES (:user_id, :phone, :code, :expires_at)
        ");
        $stmt->execute([
            'user_id' => $userId,
            'phone' => $phone,
            'code' => $code,
            'expires_at' => $expiresAt
        ]);

        // Envoyer via Twilio
        $this->twilioService->sendVerificationSMS($phone, $code, $language);
    }

    /**
     * Envoyer le code de réinitialisation
     */
    private function sendPasswordResetCode(array $user, string $code): void
    {
        // Envoyer par SMS si le téléphone est disponible
        if (!empty($user['phone'])) {
            $language = $user['preferred_language'] ?? 'fr';
            $messages = [
                'fr' => "SHIELD - Code de réinitialisation : %s (valide 30 min)",
                'en' => "SHIELD - Reset code: %s (valid 30 min)",
                'de' => "SHIELD - Zurücksetzungscode: %s (30 Min gültig)",
                'es' => "SHIELD - Código de restablecimiento: %s (válido 30 min)",
                'it' => "SHIELD - Codice di ripristino: %s (valido 30 min)"
            ];
            $message = sprintf($messages[$language] ?? $messages['fr'], $code);
            $this->twilioService->sendSMS($user['phone'], $message);
        }
    }

    /**
     * Lier un compte OAuth
     */
    private function linkOAuthAccount(int $userId, string $provider, string $oauthId): void
    {
        $stmt = $this->db->prepare("
            UPDATE users
            SET oauth_provider = :provider, oauth_id = :oauth_id, updated_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            'id' => $userId,
            'provider' => $provider,
            'oauth_id' => $oauthId
        ]);
    }

    /**
     * Nettoyer les données utilisateur pour le retour API
     */
    private function sanitizeUser(?array $user): ?array
    {
        if (!$user) {
            return null;
        }

        unset(
            $user['password_hash'],
            $user['oauth_id']
        );

        return $user;
    }
}

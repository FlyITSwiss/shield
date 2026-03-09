-- SHIELD - Migration 001: Table users
-- Table principale des utilisatrices

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `phone_verifications`;
DROP TABLE IF EXISTS `password_resets`;
DROP TABLE IF EXISTS `incident_shares`;
DROP TABLE IF EXISTS `location_shares`;
DROP TABLE IF EXISTS `ai_voice_sessions`;
DROP TABLE IF EXISTS `incidents`;
DROP TABLE IF EXISTS `trusted_contacts`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NULL COMMENT 'Null si OAuth uniquement',
    `first_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `country_code` VARCHAR(5) NOT NULL DEFAULT 'FR' COMMENT 'Code pays ISO',
    `phone_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `email_verified_at` TIMESTAMP NULL,

    -- Preferences utilisateur
    `preferred_language` VARCHAR(5) NOT NULL DEFAULT 'fr' COMMENT 'Code langue ISO: fr, en, de, es, it',
    `alert_mode` ENUM('sonic', 'silent') NOT NULL DEFAULT 'sonic' COMMENT 'Mode alerte: sonic (alarme) ou silent (discret)',

    -- Mots-codes pour agent IA
    `code_word_red` VARCHAR(50) NULL COMMENT 'Mot-code urgence maximale',
    `code_word_orange` VARCHAR(50) NULL COMMENT 'Mot-code situation preoccupante',
    `code_word_cancel` VARCHAR(50) NULL COMMENT 'Mot d annulation',

    -- Preferences de declenchement
    `volume_trigger_duration` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT 'Duree appui volume en secondes',
    `volume_trigger_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `tap_trigger_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `confirmation_delay` TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Delai avant envoi en secondes (0, 5, 10, 15)',

    -- OAuth providers
    `oauth_provider` VARCHAR(20) NULL COMMENT 'google, facebook, instagram, email',
    `oauth_id` VARCHAR(255) NULL,

    -- Photo profil et infos
    `profile_picture_url` VARCHAR(500) NULL,
    `date_of_birth` DATE NULL,
    `home_address` TEXT NULL,

    -- Push notifications
    `fcm_token` VARCHAR(500) NULL COMMENT 'Firebase Cloud Messaging token',

    -- Securite
    `last_login_at` TIMESTAMP NULL,

    -- Statut compte
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_email` (`email`),
    KEY `idx_users_phone` (`phone`),
    KEY `idx_users_oauth` (`oauth_provider`, `oauth_id`),
    KEY `idx_users_active` (`is_active`),
    KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table de verification telephone
CREATE TABLE IF NOT EXISTS `phone_verifications` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `used_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_phone_verif_user` (`user_id`),
    KEY `idx_phone_verif_code` (`code`, `expires_at`),
    CONSTRAINT `fk_phone_verif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table de reinitialisation mot de passe
CREATE TABLE IF NOT EXISTS `password_resets` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `used_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_pwd_reset_user` (`user_id`),
    KEY `idx_pwd_reset_code` (`code`, `expires_at`),
    CONSTRAINT `fk_pwd_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

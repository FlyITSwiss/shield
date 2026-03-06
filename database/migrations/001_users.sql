-- SHIELD - Migration 001: Table users
-- Table principale des utilisateurs

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NULL COMMENT 'Null si OAuth uniquement',
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `phone_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `email_verified_at` TIMESTAMP NULL,
    `avatar` VARCHAR(255) NULL COMMENT 'Chemin relatif dans uploads/avatars/',

    -- Informations medicales d'urgence
    `blood_type` ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NULL,
    `allergies` TEXT NULL,
    `medications` TEXT NULL,
    `medical_notes` TEXT NULL,

    -- Preferences utilisateur
    `language` VARCHAR(5) NOT NULL DEFAULT 'fr' COMMENT 'Code langue ISO: fr, en, de, es, it, nl, sv, pl, el, pt',
    `theme` ENUM('dark', 'light', 'auto') NOT NULL DEFAULT 'dark',
    `silent_mode_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Mode silencieux par defaut pour violences conjugales',
    `auto_call_emergency` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Appeler automatiquement les services d urgence',
    `countdown_duration` TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Duree compte a rebours en secondes (5, 10, 15)',
    `alarm_type` ENUM('siren', 'horn', 'voice') NOT NULL DEFAULT 'siren',

    -- OAuth providers
    `google_id` VARCHAR(255) NULL,
    `facebook_id` VARCHAR(255) NULL,
    `instagram_id` VARCHAR(255) NULL,

    -- Push notifications
    `fcm_token` VARCHAR(500) NULL COMMENT 'Firebase Cloud Messaging token',

    -- Securite
    `password_reset_token` VARCHAR(255) NULL,
    `password_reset_expires` TIMESTAMP NULL,
    `remember_token` VARCHAR(255) NULL,
    `last_login_at` TIMESTAMP NULL,
    `last_login_ip` VARCHAR(45) NULL,

    -- Statut compte
    `status` ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
    `onboarding_completed` TINYINT(1) NOT NULL DEFAULT 0,

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL COMMENT 'Soft delete',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_email` (`email`),
    UNIQUE KEY `uk_users_google_id` (`google_id`),
    UNIQUE KEY `uk_users_facebook_id` (`facebook_id`),
    UNIQUE KEY `uk_users_instagram_id` (`instagram_id`),
    KEY `idx_users_phone` (`phone`),
    KEY `idx_users_status` (`status`),
    KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index pour recherche full-text sur nom/prenom (optionnel)
-- ALTER TABLE `users` ADD FULLTEXT INDEX `ft_users_name` (`first_name`, `last_name`);

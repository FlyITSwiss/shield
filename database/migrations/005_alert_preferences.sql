-- SHIELD - Migration 005: Table alert_preferences et tables Twilio
-- Préférences d'alerte séparées de la table users

CREATE TABLE IF NOT EXISTS `alert_preferences` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,

    -- Mode d'alerte par défaut
    `alert_mode` ENUM('sonic', 'silent') NOT NULL DEFAULT 'sonic' COMMENT 'sonic = avec alarme, silent = discret',

    -- Délai de confirmation
    `confirmation_delay` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Délai en secondes avant envoi (0, 3, 5)',

    -- Déclenchement par volume
    `volume_trigger_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Activer déclenchement par boutons volume',
    `volume_trigger_duration` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT 'Durée d appui en secondes (2, 3, 5)',

    -- Mots-codes pour agent IA
    `code_word_red` VARCHAR(50) NULL COMMENT 'Mot-code urgence maximale',
    `code_word_orange` VARCHAR(50) NULL COMMENT 'Mot-code situation inquiétante',
    `code_word_cancel` VARCHAR(50) NULL COMMENT 'Mot-code annulation',

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_alert_prefs_user` (`user_id`),
    CONSTRAINT `fk_alert_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLES TWILIO LOGS
-- ============================================

-- Logs des SMS envoyés via Twilio
CREATE TABLE IF NOT EXISTS `twilio_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('sms', 'verification') NOT NULL DEFAULT 'sms',
    `phone_to` VARCHAR(20) NOT NULL,
    `content` VARCHAR(500) NULL,
    `sid` VARCHAR(100) NULL COMMENT 'Twilio Message SID',
    `status` ENUM('pending', 'sent', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_twilio_logs_phone` (`phone_to`),
    KEY `idx_twilio_logs_status` (`status`),
    KEY `idx_twilio_logs_sid` (`sid`),
    KEY `idx_twilio_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logs des appels Twilio (agent IA vocal)
CREATE TABLE IF NOT EXISTS `twilio_calls` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incident_id` INT UNSIGNED NULL,
    `phone_to` VARCHAR(20) NOT NULL,
    `call_sid` VARCHAR(100) NULL COMMENT 'Twilio Call SID',
    `status` ENUM('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy') NOT NULL DEFAULT 'initiated',
    `duration_seconds` INT UNSIGNED NULL,
    `recording_url` VARCHAR(500) NULL,
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_twilio_calls_incident` (`incident_id`),
    KEY `idx_twilio_calls_phone` (`phone_to`),
    KEY `idx_twilio_calls_sid` (`call_sid`),
    KEY `idx_twilio_calls_status` (`status`),
    CONSTRAINT `fk_twilio_calls_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

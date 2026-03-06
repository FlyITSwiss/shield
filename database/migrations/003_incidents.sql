-- SHIELD - Migration 003: Table incidents
-- Historique des alertes SOS declenchees

CREATE TABLE IF NOT EXISTS `incidents` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `uuid` VARCHAR(36) NOT NULL COMMENT 'UUID public pour partage',

    -- Informations temporelles
    `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Debut de l alerte',
    `ended_at` TIMESTAMP NULL COMMENT 'Fin de l alerte',
    `duration_seconds` INT UNSIGNED NULL COMMENT 'Duree totale en secondes',

    -- Statut de l'incident
    `status` ENUM('active', 'resolved', 'false_alarm', 'cancelled') NOT NULL DEFAULT 'active',
    `resolution_notes` TEXT NULL COMMENT 'Notes de resolution',

    -- Geolocalisation au declenchement
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `accuracy` DECIMAL(10, 2) NULL COMMENT 'Precision en metres',
    `address` TEXT NULL COMMENT 'Adresse geocodee',
    `country_code` VARCHAR(2) NULL COMMENT 'Code ISO pays detecte',

    -- Declenchement
    `trigger_method` ENUM('button', 'tap_5', 'volume_hold', 'voice', 'api') NOT NULL DEFAULT 'button',
    `silent_mode` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Mode silencieux active',
    `alarm_played` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Alarme sonore jouee',

    -- Agent IA
    `ai_session_id` VARCHAR(100) NULL COMMENT 'ID session agent vocal',
    `ai_call_duration` INT UNSIGNED NULL COMMENT 'Duree appel IA en secondes',
    `ai_transcript` TEXT NULL COMMENT 'Transcription de la conversation',

    -- Contacts notifies
    `contacts_notified_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `contacts_notified_ids` JSON NULL COMMENT 'IDs des contacts alertes',

    -- Services d'urgence
    `emergency_called` TINYINT(1) NOT NULL DEFAULT 0,
    `emergency_service` VARCHAR(50) NULL COMMENT 'Service appele (police, ambulance, etc.)',
    `emergency_number` VARCHAR(20) NULL,
    `emergency_call_duration` INT UNSIGNED NULL COMMENT 'Duree appel urgence en secondes',

    -- Medias
    `audio_recording_path` VARCHAR(255) NULL COMMENT 'Chemin enregistrement audio',
    `audio_duration` INT UNSIGNED NULL COMMENT 'Duree audio en secondes',

    -- Metadonnees device
    `device_type` VARCHAR(50) NULL COMMENT 'ios, android, web',
    `device_model` VARCHAR(100) NULL,
    `app_version` VARCHAR(20) NULL,
    `os_version` VARCHAR(50) NULL,
    `battery_level` TINYINT UNSIGNED NULL,
    `network_type` VARCHAR(20) NULL COMMENT 'wifi, 4g, 5g, etc.',

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_incidents_uuid` (`uuid`),
    KEY `idx_incidents_user_id` (`user_id`),
    KEY `idx_incidents_status` (`status`),
    KEY `idx_incidents_started_at` (`started_at`),
    KEY `idx_incidents_country` (`country_code`),
    KEY `idx_incidents_user_status` (`user_id`, `status`),
    CONSTRAINT `fk_incidents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les positions GPS pendant l'incident (tracking temps reel)
CREATE TABLE IF NOT EXISTS `incident_locations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incident_id` INT UNSIGNED NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `accuracy` DECIMAL(10, 2) NULL,
    `altitude` DECIMAL(10, 2) NULL,
    `speed` DECIMAL(10, 2) NULL COMMENT 'Vitesse en m/s',
    `heading` DECIMAL(5, 2) NULL COMMENT 'Direction en degres',
    `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_incident_locations_incident` (`incident_id`),
    KEY `idx_incident_locations_recorded` (`incident_id`, `recorded_at`),
    CONSTRAINT `fk_incident_locations_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les photos prises pendant l'incident
CREATE TABLE IF NOT EXISTS `incident_photos` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incident_id` INT UNSIGNED NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `file_size` INT UNSIGNED NULL,
    `mime_type` VARCHAR(50) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `taken_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_incident_photos_incident` (`incident_id`),
    CONSTRAINT `fk_incident_photos_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les notifications envoyees pendant l'incident
CREATE TABLE IF NOT EXISTS `incident_notifications` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incident_id` INT UNSIGNED NOT NULL,
    `contact_id` INT UNSIGNED NULL COMMENT 'Null si service urgence',
    `type` ENUM('sms', 'call', 'push', 'email') NOT NULL,
    `recipient` VARCHAR(255) NOT NULL COMMENT 'Numero ou email',
    `status` ENUM('pending', 'sent', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
    `provider_id` VARCHAR(100) NULL COMMENT 'ID Twilio/Firebase',
    `error_message` TEXT NULL,
    `sent_at` TIMESTAMP NULL,
    `delivered_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_incident_notifs_incident` (`incident_id`),
    KEY `idx_incident_notifs_contact` (`contact_id`),
    KEY `idx_incident_notifs_status` (`status`),
    CONSTRAINT `fk_incident_notifs_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_incident_notifs_contact` FOREIGN KEY (`contact_id`) REFERENCES `trusted_contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

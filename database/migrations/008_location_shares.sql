-- SHIELD - Migration 008: Location Shares (Premium Feature)
-- Partage de position en temps réel HORS incidents
-- Permet de partager sa localisation avec des contacts de confiance

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `location_share_history`;
DROP TABLE IF EXISTS `location_share_contacts`;
DROP TABLE IF EXISTS `location_shares`;

SET FOREIGN_KEY_CHECKS = 1;

-- Table principale pour les sessions de partage de position
CREATE TABLE IF NOT EXISTS `location_shares` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `share_token` VARCHAR(64) NOT NULL COMMENT 'Token unique pour URL de partage',

    -- Configuration du partage
    `name` VARCHAR(100) NULL COMMENT 'Nom du partage (ex: "Trajet maison")',
    `share_type` ENUM('realtime', 'journey', 'timed') NOT NULL DEFAULT 'realtime',

    -- Pour le mode journey
    `destination_name` VARCHAR(255) NULL,
    `destination_latitude` DECIMAL(10, 8) NULL,
    `destination_longitude` DECIMAL(11, 8) NULL,
    `expected_arrival_at` TIMESTAMP NULL COMMENT 'ETA pour mode journey',

    -- Durée et expiration
    `duration_minutes` INT UNSIGNED NULL COMMENT 'Durée du partage (NULL = jusqu à révocation)',
    `expires_at` TIMESTAMP NULL COMMENT 'Expiration automatique',
    `auto_extend` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Prolonger auto si mouvement détecté',

    -- Dernière position connue
    `last_latitude` DECIMAL(10, 8) NULL,
    `last_longitude` DECIMAL(11, 8) NULL,
    `last_accuracy` DECIMAL(6, 2) NULL COMMENT 'Précision en mètres',
    `last_speed` DECIMAL(6, 2) NULL COMMENT 'Vitesse en km/h',
    `last_heading` DECIMAL(5, 2) NULL COMMENT 'Direction en degrés',
    `last_address` VARCHAR(500) NULL,
    `last_location_at` TIMESTAMP NULL,

    -- Statut
    `status` ENUM('active', 'paused', 'expired', 'revoked', 'arrived', 'emergency') NOT NULL DEFAULT 'active',
    `battery_level` TINYINT UNSIGNED NULL COMMENT 'Niveau batterie 0-100',

    -- Paramètres
    `update_interval_seconds` INT UNSIGNED NOT NULL DEFAULT 30 COMMENT 'Intervalle mise à jour position',
    `notify_on_arrival` TINYINT(1) NOT NULL DEFAULT 1,
    `notify_on_delay` TINYINT(1) NOT NULL DEFAULT 1,
    `alert_if_no_movement_minutes` INT UNSIGNED NULL COMMENT 'Alerter si pas de mouvement',

    -- Timestamps
    `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `paused_at` TIMESTAMP NULL,
    `ended_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_location_shares_token` (`share_token`),
    KEY `idx_location_shares_user` (`user_id`),
    KEY `idx_location_shares_status` (`status`),
    KEY `idx_location_shares_expires` (`expires_at`),
    CONSTRAINT `fk_location_shares_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contacts autorisés à voir le partage
CREATE TABLE IF NOT EXISTS `location_share_contacts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `share_id` INT UNSIGNED NOT NULL,
    `contact_id` INT UNSIGNED NOT NULL,

    -- Permissions
    `can_see_history` TINYINT(1) NOT NULL DEFAULT 0,
    `can_see_battery` TINYINT(1) NOT NULL DEFAULT 1,
    `can_request_update` TINYINT(1) NOT NULL DEFAULT 1,

    -- Statut du contact
    `notified_at` TIMESTAMP NULL,
    `last_viewed_at` TIMESTAMP NULL,
    `view_count` INT UNSIGNED NOT NULL DEFAULT 0,

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_location_share_contacts` (`share_id`, `contact_id`),
    KEY `idx_location_share_contacts_contact` (`contact_id`),
    CONSTRAINT `fk_location_share_contacts_share` FOREIGN KEY (`share_id`) REFERENCES `location_shares` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_location_share_contacts_contact` FOREIGN KEY (`contact_id`) REFERENCES `trusted_contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des positions pour le tracking
CREATE TABLE IF NOT EXISTS `location_share_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `share_id` INT UNSIGNED NOT NULL,

    -- Position
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `accuracy` DECIMAL(6, 2) NULL,
    `altitude` DECIMAL(8, 2) NULL,
    `speed` DECIMAL(6, 2) NULL,
    `heading` DECIMAL(5, 2) NULL,

    -- Metadata
    `battery_level` TINYINT UNSIGNED NULL,
    `is_moving` TINYINT(1) NOT NULL DEFAULT 0,

    -- Timestamp
    `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_location_share_history_share` (`share_id`),
    KEY `idx_location_share_history_time` (`share_id`, `recorded_at`),
    KEY `idx_location_share_history_cleanup` (`recorded_at`),
    CONSTRAINT `fk_location_share_history_share` FOREIGN KEY (`share_id`) REFERENCES `location_shares` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

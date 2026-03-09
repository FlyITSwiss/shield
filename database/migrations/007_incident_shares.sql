-- SHIELD - Migration 007: Tables pour partage et tracking d'incidents
-- Permet le partage de position en temps reel avec les contacts de confiance

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `contact_responses`;
DROP TABLE IF EXISTS `incident_shares`;

SET FOREIGN_KEY_CHECKS = 1;

-- Table pour les liens de partage d'incident
CREATE TABLE IF NOT EXISTS `incident_shares` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incident_id` INT UNSIGNED NOT NULL,
    `share_id` VARCHAR(36) NOT NULL COMMENT 'UUID public pour l URL',
    `token` VARCHAR(64) NOT NULL COMMENT 'Token de securite',

    -- Destinataire
    `recipient_type` ENUM('contact', 'emergency', 'public') NOT NULL DEFAULT 'contact',
    `recipient_contact_id` INT UNSIGNED NULL COMMENT 'Contact specifique si type=contact',
    `recipient_phone` VARCHAR(20) NULL COMMENT 'Telephone du destinataire',
    `recipient_email` VARCHAR(255) NULL COMMENT 'Email du destinataire',

    -- Options de partage
    `allow_location_history` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Autoriser historique positions',
    `allow_contact_list` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Voir autres contacts notifies',

    -- Expiration et statut
    `expires_at` TIMESTAMP NOT NULL COMMENT 'Date/heure expiration',
    `revoked_at` TIMESTAMP NULL COMMENT 'Revoque manuellement',
    `last_viewed_at` TIMESTAMP NULL COMMENT 'Derniere consultation',
    `view_count` INT UNSIGNED NOT NULL DEFAULT 0,

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_incident_shares_share_id` (`share_id`),
    KEY `idx_incident_shares_incident` (`incident_id`),
    KEY `idx_incident_shares_token` (`token`),
    KEY `idx_incident_shares_contact` (`recipient_contact_id`),
    KEY `idx_incident_shares_expires` (`expires_at`),
    KEY `idx_incident_shares_incident_active` (`incident_id`, `expires_at`, `revoked_at`),
    CONSTRAINT `fk_incident_shares_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_incident_shares_contact` FOREIGN KEY (`recipient_contact_id`) REFERENCES `trusted_contacts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour le suivi des reponses des contacts
CREATE TABLE IF NOT EXISTS `contact_responses` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incident_id` INT UNSIGNED NOT NULL,
    `contact_id` INT UNSIGNED NOT NULL,

    -- Statut de la reponse
    `status` ENUM('pending', 'notified', 'delivered', 'viewed', 'acknowledged', 'responding', 'arrived', 'declined') NOT NULL DEFAULT 'pending',

    -- Timestamps des etapes
    `notified_at` TIMESTAMP NULL COMMENT 'Notification envoyee',
    `delivered_at` TIMESTAMP NULL COMMENT 'Notification recue',
    `viewed_at` TIMESTAMP NULL COMMENT 'Partage consulte',
    `acknowledged_at` TIMESTAMP NULL COMMENT 'Contact a confirme reception',
    `responding_at` TIMESTAMP NULL COMMENT 'Contact en route',
    `arrived_at` TIMESTAMP NULL COMMENT 'Contact sur place',

    -- Message du contact
    `response_message` TEXT NULL COMMENT 'Message du contact',
    `eta_minutes` INT UNSIGNED NULL COMMENT 'Temps estime arrivee',

    -- Position du contact (si partagee)
    `contact_latitude` DECIMAL(10, 8) NULL,
    `contact_longitude` DECIMAL(11, 8) NULL,
    `contact_last_location_at` TIMESTAMP NULL,

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contact_responses_incident_contact` (`incident_id`, `contact_id`),
    KEY `idx_contact_responses_incident` (`incident_id`),
    KEY `idx_contact_responses_contact` (`contact_id`),
    KEY `idx_contact_responses_status` (`status`),
    CONSTRAINT `fk_contact_responses_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_contact_responses_contact` FOREIGN KEY (`contact_id`) REFERENCES `trusted_contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

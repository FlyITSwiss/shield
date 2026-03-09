-- SHIELD - Migration 002: Table trusted_contacts
-- Contacts de confiance pour alertes SOS

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `trusted_contacts`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS `trusted_contacts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL COMMENT 'Proprietaire du contact',
    `name` VARCHAR(150) NOT NULL COMMENT 'Nom complet du contact',
    `phone` VARCHAR(20) NOT NULL COMMENT 'Numero de telephone (format E.164)',
    `phone_country_code` VARCHAR(5) NULL COMMENT 'Code pays (+33, +41, etc.)',
    `email` VARCHAR(255) NULL COMMENT 'Email optionnel pour notifications',

    -- Relation avec l'utilisateur
    `relation` ENUM('family', 'friend', 'partner', 'colleague', 'other') NOT NULL DEFAULT 'other',
    `relation_detail` VARCHAR(100) NULL COMMENT 'Detail de la relation (ex: mere, soeur)',

    -- Configuration des alertes
    `priority` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Ordre de priorite (1 = plus haut)',
    `notify_sms` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Envoyer SMS en cas d alerte',
    `notify_call` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Appeler ce contact',
    `notify_push` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Envoyer push notification si app installee',

    -- Statut du contact
    `is_verified` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Contact a confirme son role',
    `verification_token` VARCHAR(64) NULL,
    `verified_at` TIMESTAMP NULL,
    `last_notified_at` TIMESTAMP NULL COMMENT 'Derniere notification envoyee',

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_contacts_user_id` (`user_id`),
    KEY `idx_contacts_phone` (`phone`),
    KEY `idx_contacts_priority` (`user_id`, `priority`),
    CONSTRAINT `fk_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Limite de 5 contacts par utilisateur (geree au niveau applicatif)
-- Trigger optionnel pour enforcement:
/*
DELIMITER //
CREATE TRIGGER trg_check_contact_limit
BEFORE INSERT ON trusted_contacts
FOR EACH ROW
BEGIN
    DECLARE contact_count INT;
    SELECT COUNT(*) INTO contact_count FROM trusted_contacts WHERE user_id = NEW.user_id;
    IF contact_count >= 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Maximum 5 trusted contacts allowed';
    END IF;
END //
DELIMITER ;
*/

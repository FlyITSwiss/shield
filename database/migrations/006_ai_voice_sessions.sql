-- SHIELD - Migration 006: Tables AI Voice Agent
-- Sessions vocales IA et historique de conversation

CREATE TABLE IF NOT EXISTS `ai_voice_sessions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `session_id` VARCHAR(100) NOT NULL COMMENT 'ID unique de session',
    `incident_id` VARCHAR(36) NOT NULL COMMENT 'UUID de l incident',
    `user_id` INT UNSIGNED NOT NULL,
    `language` VARCHAR(5) NOT NULL DEFAULT 'fr',
    `code_words` JSON NULL COMMENT 'Mots-codes configurés',
    `status` ENUM('active', 'completed', 'abandoned') NOT NULL DEFAULT 'active',
    `transcript` TEXT NULL COMMENT 'Transcription complète',
    `provider_used` VARCHAR(20) NULL COMMENT 'openai, anthropic, gemini',
    `total_turns` INT UNSIGNED NOT NULL DEFAULT 0,
    `max_urgency_level` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ended_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_ai_sessions_session_id` (`session_id`),
    KEY `idx_ai_sessions_incident` (`incident_id`),
    KEY `idx_ai_sessions_user` (`user_id`),
    KEY `idx_ai_sessions_status` (`status`),
    KEY `idx_ai_sessions_created` (`created_at`),
    CONSTRAINT `fk_ai_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tours de conversation individuels
CREATE TABLE IF NOT EXISTS `ai_conversation_turns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `session_id` VARCHAR(100) NOT NULL,
    `turn_number` INT UNSIGNED NOT NULL DEFAULT 0,
    `user_message` TEXT NOT NULL COMMENT 'Message transcrit de l utilisateur',
    `agent_response` TEXT NOT NULL COMMENT 'Réponse de l agent IA',
    `urgency_level` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    `detected_code` VARCHAR(20) NULL COMMENT 'CODE_RED, CODE_ORANGE, CANCEL',
    `action_taken` VARCHAR(50) NULL COMMENT 'CALL_POLICE, ESCALATE, CANCEL_ALERT',
    `provider` VARCHAR(20) NULL COMMENT 'Provider AI utilisé',
    `processing_time_ms` INT UNSIGNED NULL COMMENT 'Temps de traitement en ms',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_ai_turns_session` (`session_id`),
    KEY `idx_ai_turns_urgency` (`urgency_level`),
    KEY `idx_ai_turns_detected_code` (`detected_code`),
    KEY `idx_ai_turns_created` (`created_at`),
    CONSTRAINT `fk_ai_turns_session` FOREIGN KEY (`session_id`) REFERENCES `ai_voice_sessions` (`session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index pour analyse des conversations
CREATE INDEX `idx_ai_turns_analysis` ON `ai_conversation_turns` (`session_id`, `turn_number`);

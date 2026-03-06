-- SHIELD - Migration 004: Table emergency_services
-- Services d'urgence par pays (10 pays europeens supportes)

CREATE TABLE IF NOT EXISTS `emergency_services` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `country_code` VARCHAR(2) NOT NULL COMMENT 'Code ISO 3166-1 alpha-2',
    `country_name` VARCHAR(100) NOT NULL,
    `service_type` ENUM('police', 'ambulance', 'fire', 'general', 'domestic_violence', 'helpline') NOT NULL,
    `service_name` VARCHAR(150) NOT NULL COMMENT 'Nom du service en langue locale',
    `service_name_en` VARCHAR(150) NULL COMMENT 'Nom en anglais',
    `phone_number` VARCHAR(20) NOT NULL,
    `is_primary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Service principal pour ce type',
    `available_24h` TINYINT(1) NOT NULL DEFAULT 1,
    `sms_capable` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Accepte les SMS',
    `description` TEXT NULL,
    `description_en` TEXT NULL,
    `website` VARCHAR(255) NULL,

    -- Ordre d'affichage
    `display_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,

    -- Statut
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,

    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_emergency_country` (`country_code`),
    KEY `idx_emergency_type` (`service_type`),
    KEY `idx_emergency_country_type` (`country_code`, `service_type`),
    KEY `idx_emergency_primary` (`country_code`, `service_type`, `is_primary`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DONNEES INITIALES - 10 PAYS EUROPEENS
-- ============================================

-- FRANCE (FR)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('FR', 'France', 'general', 'Numero d\'urgence europeen', 'European emergency number', '112', 1, 0, 'Numero d\'urgence valable dans toute l\'Europe', 'Emergency number valid throughout Europe', 1),
('FR', 'France', 'police', 'Police Secours', 'Police Emergency', '17', 1, 0, 'Police nationale et gendarmerie', 'National police and gendarmerie', 2),
('FR', 'France', 'ambulance', 'SAMU', 'Emergency Medical Services', '15', 1, 0, 'Service d\'Aide Medicale Urgente', 'Emergency Medical Aid Service', 3),
('FR', 'France', 'fire', 'Sapeurs-Pompiers', 'Fire Brigade', '18', 1, 0, 'Incendies et accidents', 'Fires and accidents', 4),
('FR', 'France', 'domestic_violence', 'Violences Femmes Info', 'Women Violence Helpline', '3919', 1, 0, 'Ecoute, information et orientation pour les femmes victimes de violences', 'Listening, information and guidance for women victims of violence', 5),
('FR', 'France', 'helpline', 'SOS Amitie', 'Friendship SOS', '09 72 39 40 50', 0, 0, 'Ecoute et soutien psychologique 24h/24', 'Psychological support 24/7', 6);

-- SUISSE (CH)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('CH', 'Suisse', 'general', 'Numero d\'urgence europeen', 'European emergency number', '112', 1, 0, 'Numero d\'urgence valable dans toute l\'Europe', 'Emergency number valid throughout Europe', 1),
('CH', 'Suisse', 'police', 'Police', 'Police', '117', 1, 0, 'Police cantonale et municipale', 'Cantonal and municipal police', 2),
('CH', 'Suisse', 'ambulance', 'Ambulance', 'Ambulance', '144', 1, 0, 'Services medicaux d\'urgence', 'Emergency medical services', 3),
('CH', 'Suisse', 'fire', 'Pompiers', 'Fire Brigade', '118', 1, 0, 'Incendies et secours', 'Fires and rescue', 4),
('CH', 'Suisse', 'domestic_violence', 'Aide aux victimes', 'Victim Support', '0848 019 019', 1, 0, 'Centre d\'aide aux victimes de violences', 'Support center for violence victims', 5);

-- BELGIQUE (BE)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('BE', 'Belgique', 'general', 'Numero d\'urgence europeen', 'European emergency number', '112', 1, 0, 'Numero d\'urgence valable dans toute l\'Europe', 'Emergency number valid throughout Europe', 1),
('BE', 'Belgique', 'police', 'Police', 'Police', '101', 1, 0, 'Police federale et locale', 'Federal and local police', 2),
('BE', 'Belgique', 'ambulance', 'Aide medicale urgente', 'Emergency Medical Aid', '100', 1, 0, 'Ambulances et SMUR', 'Ambulances and mobile emergency', 3),
('BE', 'Belgique', 'fire', 'Pompiers', 'Fire Brigade', '100', 0, 0, 'Service incendie', 'Fire service', 4),
('BE', 'Belgique', 'domestic_violence', 'Ecoute violences conjugales', 'Domestic Violence Helpline', '0800 30 030', 1, 0, 'Ligne d\'ecoute gratuite pour victimes de violences conjugales', 'Free helpline for domestic violence victims', 5);

-- ALLEMAGNE (DE)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('DE', 'Allemagne', 'general', 'Europaische Notrufnummer', 'European emergency number', '112', 1, 0, 'Europaweite Notrufnummer', 'Europe-wide emergency number', 1),
('DE', 'Allemagne', 'police', 'Polizei', 'Police', '110', 1, 0, 'Landespolizei', 'State police', 2),
('DE', 'Allemagne', 'ambulance', 'Rettungsdienst', 'Rescue Service', '112', 1, 0, 'Notarztwagen und Krankenwagen', 'Emergency doctors and ambulances', 3),
('DE', 'Allemagne', 'fire', 'Feuerwehr', 'Fire Brigade', '112', 0, 0, 'Berufsfeuerwehr und freiwillige Feuerwehr', 'Professional and volunteer fire brigade', 4),
('DE', 'Allemagne', 'domestic_violence', 'Hilfetelefon Gewalt gegen Frauen', 'Women Violence Helpline', '08000 116 016', 1, 0, 'Kostenlose Beratung bei Gewalt gegen Frauen', 'Free counseling for violence against women', 5);

-- ESPAGNE (ES)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('ES', 'Espagne', 'general', 'Numero de emergencia europeo', 'European emergency number', '112', 1, 0, 'Numero de emergencia valido en toda Europa', 'Emergency number valid throughout Europe', 1),
('ES', 'Espagne', 'police', 'Policia Nacional', 'National Police', '091', 1, 0, 'Cuerpo Nacional de Policia', 'National Police Corps', 2),
('ES', 'Espagne', 'ambulance', 'Emergencias Sanitarias', 'Health Emergencies', '112', 1, 0, 'Servicios de urgencias medicas', 'Medical emergency services', 3),
('ES', 'Espagne', 'fire', 'Bomberos', 'Fire Brigade', '080', 1, 0, 'Servicio de bomberos', 'Fire service', 4),
('ES', 'Espagne', 'domestic_violence', 'Violencia de Genero', 'Gender Violence', '016', 1, 0, 'Linea de atencion a victimas de violencia de genero', 'Helpline for gender violence victims', 5);

-- ITALIE (IT)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('IT', 'Italie', 'general', 'Numero di emergenza europeo', 'European emergency number', '112', 1, 0, 'Numero di emergenza valido in tutta Europa', 'Emergency number valid throughout Europe', 1),
('IT', 'Italie', 'police', 'Carabinieri', 'Carabinieri', '112', 1, 0, 'Arma dei Carabinieri', 'Carabinieri Corps', 2),
('IT', 'Italie', 'ambulance', 'Emergenza Sanitaria', 'Health Emergency', '118', 1, 0, 'Servizio sanitario di emergenza', 'Emergency health service', 3),
('IT', 'Italie', 'fire', 'Vigili del Fuoco', 'Fire Brigade', '115', 1, 0, 'Corpo nazionale dei vigili del fuoco', 'National fire brigade corps', 4),
('IT', 'Italie', 'domestic_violence', 'Antiviolenza Donna', 'Anti-violence Women', '1522', 1, 0, 'Numero antiviolenza e stalking', 'Anti-violence and stalking number', 5);

-- PAYS-BAS (NL)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('NL', 'Pays-Bas', 'general', 'Europees alarmnummer', 'European emergency number', '112', 1, 0, 'Europees noodoproepnummer', 'European emergency call number', 1),
('NL', 'Pays-Bas', 'police', 'Politie', 'Police', '112', 1, 0, 'Nederlandse Politie', 'Dutch Police', 2),
('NL', 'Pays-Bas', 'ambulance', 'Ambulance', 'Ambulance', '112', 1, 0, 'Ambulancedienst', 'Ambulance service', 3),
('NL', 'Pays-Bas', 'fire', 'Brandweer', 'Fire Brigade', '112', 0, 0, 'Brandweerdienst', 'Fire service', 4),
('NL', 'Pays-Bas', 'domestic_violence', 'Veilig Thuis', 'Safe Home', '0800 2000', 1, 0, 'Advies en hulp bij huiselijk geweld', 'Advice and help for domestic violence', 5);

-- PORTUGAL (PT)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('PT', 'Portugal', 'general', 'Numero de emergencia europeu', 'European emergency number', '112', 1, 0, 'Numero de emergencia valido em toda a Europa', 'Emergency number valid throughout Europe', 1),
('PT', 'Portugal', 'police', 'PSP', 'Public Security Police', '112', 1, 0, 'Policia de Seguranca Publica', 'Public Security Police', 2),
('PT', 'Portugal', 'ambulance', 'INEM', 'Medical Emergency Institute', '112', 1, 0, 'Instituto Nacional de Emergencia Medica', 'National Medical Emergency Institute', 3),
('PT', 'Portugal', 'fire', 'Bombeiros', 'Fire Brigade', '112', 0, 0, 'Corpo de Bombeiros', 'Fire Brigade Corps', 4),
('PT', 'Portugal', 'domestic_violence', 'Violencia Domestica', 'Domestic Violence', '800 202 148', 1, 0, 'Linha de apoio a vitimas de violencia domestica', 'Support line for domestic violence victims', 5);

-- SUEDE (SE)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('SE', 'Suede', 'general', 'Europeiskt larmnummer', 'European emergency number', '112', 1, 0, 'Europeiskt nodnummer', 'European emergency number', 1),
('SE', 'Suede', 'police', 'Polis', 'Police', '112', 1, 0, 'Polisen', 'Swedish Police', 2),
('SE', 'Suede', 'ambulance', 'Ambulans', 'Ambulance', '112', 1, 0, 'Ambulanssjukvard', 'Ambulance healthcare', 3),
('SE', 'Suede', 'fire', 'Raddningstjanst', 'Rescue Service', '112', 0, 0, 'Raddningstjansten', 'Rescue service', 4),
('SE', 'Suede', 'domestic_violence', 'Kvinnofridslinjen', 'Women\'s Helpline', '020 50 50 50', 1, 0, 'Nationell stodlinje for valdsutsatta kvinnor', 'National support line for abused women', 5);

-- POLOGNE (PL)
INSERT INTO `emergency_services` (`country_code`, `country_name`, `service_type`, `service_name`, `service_name_en`, `phone_number`, `is_primary`, `sms_capable`, `description`, `description_en`, `display_order`) VALUES
('PL', 'Pologne', 'general', 'Europejski numer alarmowy', 'European emergency number', '112', 1, 0, 'Europejski numer alarmowy', 'European emergency number', 1),
('PL', 'Pologne', 'police', 'Policja', 'Police', '997', 1, 0, 'Polska Policja', 'Polish Police', 2),
('PL', 'Pologne', 'ambulance', 'Pogotowie Ratunkowe', 'Emergency Medical Service', '999', 1, 0, 'Ratownictwo medyczne', 'Medical rescue', 3),
('PL', 'Pologne', 'fire', 'Straz Pozarna', 'Fire Brigade', '998', 1, 0, 'Panstwowa Straz Pozarna', 'State Fire Service', 4),
('PL', 'Pologne', 'domestic_violence', 'Niebieska Linia', 'Blue Line', '800 120 002', 1, 0, 'Ogolnopolski telefon dla ofiar przemocy w rodzinie', 'National helpline for domestic violence victims', 5);

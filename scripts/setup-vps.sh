#!/bin/bash
# SHIELD - Script de configuration VPS
# Usage: sudo ./setup-vps.sh
#
# Ce script configure:
# - Les répertoires de l'application
# - Le pool PHP-FPM dédié
# - Les permissions
# - La base de données (optionnel)

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SHIELD VPS Setup ===${NC}"

# Vérifier root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit être exécuté en tant que root (sudo)${NC}"
    exit 1
fi

# Variables
APP_PATH="/var/www/shield"
PHP_VERSION="8.2"

# ============================================
# 1. Création des répertoires
# ============================================
echo -e "\n${YELLOW}[1/5] Création des répertoires...${NC}"

mkdir -p $APP_PATH/backend/php
mkdir -p $APP_PATH/public/assets
mkdir -p $APP_PATH/public/uploads
mkdir -p $APP_PATH/database/migrations
mkdir -p $APP_PATH/storage/logs
mkdir -p $APP_PATH/storage/cache
mkdir -p $APP_PATH/storage/sessions

# Logs PHP-FPM
mkdir -p /var/log/php-fpm

echo -e "${GREEN}✓ Répertoires créés${NC}"

# ============================================
# 2. Configuration PHP-FPM
# ============================================
echo -e "\n${YELLOW}[2/5] Configuration PHP-FPM...${NC}"

# Copier la configuration du pool
if [ -f "$APP_PATH/scripts/php-fpm-shield.conf" ]; then
    cp $APP_PATH/scripts/php-fpm-shield.conf /etc/php/$PHP_VERSION/fpm/pool.d/shield.conf
    echo -e "${GREEN}✓ Pool PHP-FPM configuré${NC}"
else
    echo -e "${YELLOW}⚠ Fichier php-fpm-shield.conf non trouvé, configuration manuelle requise${NC}"
fi

# ============================================
# 3. Configuration Nginx
# ============================================
echo -e "\n${YELLOW}[3/5] Configuration Nginx...${NC}"

# Copier le snippet
if [ -f "$APP_PATH/docker/nginx-shield.conf" ]; then
    cp $APP_PATH/docker/nginx-shield.conf /etc/nginx/snippets/shield.conf

    # Vérifier si l'include existe dans la config principale
    if ! grep -q "include /etc/nginx/snippets/shield.conf" /etc/nginx/sites-enabled/helios 2>/dev/null; then
        echo -e "${YELLOW}⚠ Ajoutez manuellement dans /etc/nginx/sites-enabled/helios:${NC}"
        echo -e "   include /etc/nginx/snippets/shield.conf;"
    fi

    echo -e "${GREEN}✓ Snippet Nginx configuré${NC}"
else
    echo -e "${YELLOW}⚠ Fichier nginx-shield.conf non trouvé${NC}"
fi

# ============================================
# 4. Permissions
# ============================================
echo -e "\n${YELLOW}[4/5] Configuration des permissions...${NC}"

chown -R www-data:www-data $APP_PATH
chmod -R 755 $APP_PATH
chmod -R 775 $APP_PATH/public/uploads
chmod -R 775 $APP_PATH/storage

# Permissions logs
chown www-data:www-data /var/log/php-fpm
chmod 755 /var/log/php-fpm

echo -e "${GREEN}✓ Permissions configurées${NC}"

# ============================================
# 5. Redémarrage des services
# ============================================
echo -e "\n${YELLOW}[5/5] Redémarrage des services...${NC}"

# Test config Nginx
nginx -t

# Redémarrer PHP-FPM
systemctl restart php$PHP_VERSION-fpm

# Recharger Nginx
systemctl reload nginx

echo -e "${GREEN}✓ Services redémarrés${NC}"

# ============================================
# Résumé
# ============================================
echo -e "\n${GREEN}=== Configuration terminée ===${NC}"
echo -e "Application: $APP_PATH"
echo -e "URL: https://stabilis-it.ch/internal/shield"
echo -e ""
echo -e "${YELLOW}Étapes suivantes:${NC}"
echo -e "1. Configurer .env avec les credentials de production"
echo -e "2. Créer la base de données MySQL 'shield_prod'"
echo -e "3. Exécuter les migrations SQL"
echo -e "4. Tester: curl https://stabilis-it.ch/internal/shield/health"

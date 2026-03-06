# SHIELD - Dockerfile PHP 8.2
FROM php:8.2-fpm

# Arguments de build
ARG DEBIAN_FRONTEND=noninteractive

# Installation des dependances systeme
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    zip \
    unzip \
    nginx \
    supervisor \
    cron \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Installation des extensions PHP
RUN docker-php-ext-install \
    pdo_mysql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    zip \
    opcache \
    curl \
    xml

# Installation de Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Installation de Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Configuration PHP pour production
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

# Configuration PHP personnalisee
COPY docker/php.ini /usr/local/etc/php/conf.d/shield.ini

# Configuration PHP-FPM pour passer les variables d'environnement
COPY docker/www-override.conf /usr/local/etc/php-fpm.d/zzz-shield-env.conf

# Configuration Nginx
COPY docker/nginx-local.conf /etc/nginx/sites-available/default

# Configuration Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Creation des dossiers de logs
RUN mkdir -p /var/log/supervisor /var/log/nginx /var/log/php /var/log/cron \
    && chmod -R 755 /var/log/supervisor /var/log/nginx /var/log/php /var/log/cron

# Creation du repertoire de travail
WORKDIR /var/www/shield

# Copie du code source
COPY backend/php /var/www/shield/backend/php
COPY public /var/www/shield/public

# Permissions
RUN chown -R www-data:www-data /var/www/shield \
    && chmod -R 755 /var/www/shield \
    && chmod -R 775 /var/www/shield/public/uploads \
    && chmod -R 775 /var/www/shield/storage 2>/dev/null || true

# Installation des dependances Composer (si composer.json existe)
RUN if [ -f "/var/www/shield/backend/php/composer.json" ]; then \
    cd /var/www/shield/backend/php && composer install --no-dev --optimize-autoloader; \
    fi

# Exposition du port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Demarrage via Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

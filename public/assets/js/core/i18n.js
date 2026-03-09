/**
 * SHIELD i18n Service
 *
 * Gestion des traductions côté client
 */

const I18n = {
    /**
     * Version des traductions
     */
    cacheVersion: 'v2',

    /**
     * Langue courante
     */
    locale: 'fr',

    /**
     * Traductions chargées
     */
    translations: {},

    /**
     * Initialiser le service
     */
    async init(locale = null) {
        this.locale = locale || window.ShieldConfig?.lang || 'fr';
        await this.loadTranslations(this.locale);
    },

    /**
     * Charger les traductions
     */
    async loadTranslations(locale) {
        try {
            const cacheBust = `?v=${this.cacheVersion}`;
            const response = await fetch(`${window.ShieldConfig?.basePath || ''}/assets/lang/${locale}.json${cacheBust}`);
            if (response.ok) {
                this.translations = await response.json();
            }
        } catch (error) {
            console.warn(`Failed to load translations for ${locale}`, error);
        }
    },

    /**
     * Changer de langue
     */
    async setLocale(locale) {
        this.locale = locale;
        await this.loadTranslations(locale);
        this.updatePageTranslations();
    },

    /**
     * Traduire une clé
     */
    t(key, params = {}) {
        let value = this.getNestedValue(this.translations, key);

        if (value === undefined) {
            console.warn(`Translation missing: ${key}`);
            return key;
        }

        // Remplacer les placeholders {:name}
        if (params && typeof value === 'string') {
            Object.keys(params).forEach(param => {
                value = value.replace(new RegExp(`{:${param}}`, 'g'), params[param]);
            });
        }

        return value;
    },

    /**
     * Obtenir une valeur imbriquée
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    },

    /**
     * Mettre à jour les traductions sur la page
     */
    updatePageTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            el.textContent = this.t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            el.placeholder = this.t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            el.title = this.t(key);
        });
    },

    /**
     * Formater une date
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = {
            short: { day: '2-digit', month: '2-digit', year: 'numeric' },
            long: { day: 'numeric', month: 'long', year: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        };

        return d.toLocaleDateString(this.locale, options[format] || options.short);
    },

    /**
     * Formater un nombre
     */
    formatNumber(number, decimals = 0) {
        return new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    },

    /**
     * Formater une durée (secondes vers mm:ss)
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};

/**
 * Fonction raccourci globale
 */
window.__ = (key, params) => I18n.t(key, params);

// Auto-init si DOM ready
if (document.readyState !== 'loading') {
    I18n.init();
} else {
    document.addEventListener('DOMContentLoaded', () => I18n.init());
}

// Export pour utilisation globale
window.I18n = I18n;

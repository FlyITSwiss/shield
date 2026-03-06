/**
 * SHIELD Settings Page Module
 */

const SettingsPage = {
    /**
     * Éléments DOM
     */
    elements: {},

    /**
     * État
     */
    state: {
        hasChanges: false,
        originalValues: {}
    },

    /**
     * Initialiser
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.saveOriginalValues();
    },

    /**
     * Cacher les éléments DOM
     */
    cacheElements() {
        this.elements = {
            btnBack: document.getElementById('btn-back'),
            btnEditProfile: document.getElementById('btn-edit-profile'),
            btnLogout: document.getElementById('btn-logout'),
            btnDeleteAccount: document.getElementById('btn-delete-account'),

            // Alert settings
            alertMode: document.getElementById('alert-mode'),
            confirmationDelay: document.getElementById('confirmation-delay'),
            volumeTrigger: document.getElementById('volume-trigger'),
            volumeDuration: document.getElementById('volume-duration'),
            volumeDurationSetting: document.getElementById('volume-duration-setting'),

            // Code words
            codeWordRed: document.getElementById('code-word-red'),
            codeWordOrange: document.getElementById('code-word-orange'),
            codeWordCancel: document.getElementById('code-word-cancel'),

            // Language & region
            language: document.getElementById('language'),
            country: document.getElementById('country')
        };
    },

    /**
     * Lier les événements
     */
    bindEvents() {
        // Navigation
        this.elements.btnBack?.addEventListener('click', () => this.goBack());

        // Profile
        this.elements.btnEditProfile?.addEventListener('click', () => this.editProfile());

        // Logout
        this.elements.btnLogout?.addEventListener('click', () => this.logout());

        // Delete account
        this.elements.btnDeleteAccount?.addEventListener('click', () => this.deleteAccount());

        // Alert settings changes
        this.elements.alertMode?.addEventListener('change', () => this.saveAlertPreferences());
        this.elements.confirmationDelay?.addEventListener('change', () => this.saveAlertPreferences());
        this.elements.volumeTrigger?.addEventListener('change', (e) => {
            this.toggleVolumeDuration(e.target.checked);
            this.saveAlertPreferences();
        });
        this.elements.volumeDuration?.addEventListener('change', () => this.saveAlertPreferences());

        // Code words (debounced)
        let codeWordTimeout;
        const saveCodeWords = () => {
            clearTimeout(codeWordTimeout);
            codeWordTimeout = setTimeout(() => this.saveAlertPreferences(), 500);
        };

        this.elements.codeWordRed?.addEventListener('input', saveCodeWords);
        this.elements.codeWordOrange?.addEventListener('input', saveCodeWords);
        this.elements.codeWordCancel?.addEventListener('input', saveCodeWords);

        // Language & region
        this.elements.language?.addEventListener('change', () => this.saveProfileSettings());
        this.elements.country?.addEventListener('change', () => this.saveProfileSettings());

        // Toggle volume duration visibility
        this.toggleVolumeDuration(this.elements.volumeTrigger?.checked);
    },

    /**
     * Sauvegarder les valeurs originales
     */
    saveOriginalValues() {
        this.state.originalValues = {
            alertMode: this.elements.alertMode?.value,
            confirmationDelay: this.elements.confirmationDelay?.value,
            volumeTrigger: this.elements.volumeTrigger?.checked,
            volumeDuration: this.elements.volumeDuration?.value,
            codeWordRed: this.elements.codeWordRed?.value,
            codeWordOrange: this.elements.codeWordOrange?.value,
            codeWordCancel: this.elements.codeWordCancel?.value,
            language: this.elements.language?.value,
            country: this.elements.country?.value
        };
    },

    /**
     * Toggle volume duration setting visibility
     */
    toggleVolumeDuration(show) {
        if (this.elements.volumeDurationSetting) {
            this.elements.volumeDurationSetting.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Sauvegarder les préférences d'alerte
     */
    async saveAlertPreferences() {
        const data = {
            alert_mode: this.elements.alertMode?.value,
            confirmation_delay: parseInt(this.elements.confirmationDelay?.value || '0', 10),
            volume_trigger_enabled: this.elements.volumeTrigger?.checked ? 1 : 0,
            volume_trigger_duration: parseInt(this.elements.volumeDuration?.value || '3', 10),
            code_word_red: this.elements.codeWordRed?.value || null,
            code_word_orange: this.elements.codeWordOrange?.value || null,
            code_word_cancel: this.elements.codeWordCancel?.value || null
        };

        try {
            const result = await window.ApiService.auth.updateAlertPreferences(data);

            if (result.success) {
                this.showToast(window.__('settings.saved'));

                // Mettre à jour le localStorage pour le module alarm-trigger
                localStorage.setItem('shield_alert_prefs', JSON.stringify(data));
            } else {
                this.showToast(window.__('error.save_failed'), 'error');
            }
        } catch (error) {
            console.error('[Settings] Save error:', error);
            this.showToast(window.__('error.network'), 'error');
        }
    },

    /**
     * Sauvegarder les paramètres de profil
     */
    async saveProfileSettings() {
        const data = {
            preferred_language: this.elements.language?.value,
            country_code: this.elements.country?.value
        };

        try {
            const result = await window.ApiService.auth.updateProfile(data);

            if (result.success) {
                this.showToast(window.__('settings.saved'));

                // Changer la langue si modifiée
                if (data.preferred_language !== this.state.originalValues.language) {
                    window.I18n?.setLocale(data.preferred_language);
                }
            } else {
                this.showToast(window.__('error.save_failed'), 'error');
            }
        } catch (error) {
            console.error('[Settings] Save error:', error);
            this.showToast(window.__('error.network'), 'error');
        }
    },

    /**
     * Retour
     */
    goBack() {
        window.history.back();
    },

    /**
     * Éditer le profil
     */
    editProfile() {
        window.location.href = window.ShieldConfig?.basePath + '/app/profile/edit';
    },

    /**
     * Déconnexion
     */
    async logout() {
        if (!confirm(window.__('settings.confirm_logout'))) {
            return;
        }

        try {
            await window.ApiService.auth.logout();
            window.location.href = window.ShieldConfig?.basePath + '/auth/login';
        } catch (error) {
            console.error('[Settings] Logout error:', error);
            // Forcer la déconnexion locale même en cas d'erreur
            localStorage.removeItem('shield_token');
            localStorage.removeItem('shield_user');
            window.location.href = window.ShieldConfig?.basePath + '/auth/login';
        }
    },

    /**
     * Supprimer le compte
     */
    async deleteAccount() {
        // Double confirmation
        if (!confirm(window.__('settings.confirm_delete_1'))) {
            return;
        }

        const password = prompt(window.__('settings.enter_password'));
        if (!password) {
            return;
        }

        try {
            const result = await window.ApiService.delete('auth.php?action=account', {
                password,
                permanent: false
            });

            if (result.success) {
                alert(window.__('settings.account_deleted'));
                localStorage.removeItem('shield_token');
                localStorage.removeItem('shield_user');
                window.location.href = window.ShieldConfig?.basePath + '/auth/login';
            } else {
                alert(window.__('error.invalid_password'));
            }
        } catch (error) {
            console.error('[Settings] Delete error:', error);
            alert(window.__('error.generic'));
        }
    },

    /**
     * Afficher un toast
     */
    showToast(message, type = 'success') {
        if (window.Toast) {
            window.Toast.show(message, type);
        } else {
            console.log(`[Toast] ${type}: ${message}`);
        }
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    SettingsPage.init();
});

export default SettingsPage;

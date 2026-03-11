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
        originalValues: {},
        deleteCountdownInterval: null,
        deleteCountdownValue: 5
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
            alarmSound: document.getElementById('alarm-sound'),
            alarmSoundSetting: document.getElementById('alarm-sound-setting'),
            btnPreviewSound: document.getElementById('btn-preview-sound'),
            confirmationDelay: document.getElementById('confirmation-delay'),
            volumeTrigger: document.getElementById('volume-trigger'),
            volumeDuration: document.getElementById('volume-duration'),
            volumeDurationSetting: document.getElementById('volume-duration-setting'),
            backTapTrigger: document.getElementById('back-tap-trigger'),
            backTapSensitivity: document.getElementById('back-tap-sensitivity'),
            backTapSensitivitySetting: document.getElementById('back-tap-sensitivity-setting'),

            // Code words
            codeWordRed: document.getElementById('code-word-red'),
            codeWordOrange: document.getElementById('code-word-orange'),
            codeWordCancel: document.getElementById('code-word-cancel'),

            // Language & region
            language: document.getElementById('language'),
            country: document.getElementById('country'),

            // Delete account modal
            deleteModal: document.getElementById('delete-account-modal'),
            deleteCountdown: document.getElementById('delete-countdown'),
            countdownSeconds: document.getElementById('countdown-seconds'),
            btnCancelDelete: document.getElementById('btn-cancel-delete'),
            btnConfirmDelete: document.getElementById('btn-confirm-delete')
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
        this.elements.alertMode?.addEventListener('change', (e) => {
            this.toggleAlarmSoundSetting(e.target.value === 'sonic');
            this.saveAlertPreferences();
        });
        this.elements.alarmSound?.addEventListener('change', () => this.saveAlertPreferences());
        this.elements.btnPreviewSound?.addEventListener('click', () => this.previewSound());
        this.elements.confirmationDelay?.addEventListener('change', () => this.saveAlertPreferences());

        // Toggle alarm sound visibility based on alert mode
        this.toggleAlarmSoundSetting(this.elements.alertMode?.value === 'sonic');
        this.elements.volumeTrigger?.addEventListener('change', (e) => {
            this.toggleVolumeDuration(e.target.checked);
            this.saveAlertPreferences();
        });
        this.elements.volumeDuration?.addEventListener('change', () => this.saveAlertPreferences());

        // Back tap settings
        this.elements.backTapTrigger?.addEventListener('change', (e) => {
            this.toggleBackTapSensitivity(e.target.checked);
            this.saveAlertPreferences();
        });
        this.elements.backTapSensitivity?.addEventListener('change', () => this.saveAlertPreferences());

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

        // Toggle back tap sensitivity visibility
        this.toggleBackTapSensitivity(this.elements.backTapTrigger?.checked);

        // Delete account modal
        this.elements.btnCancelDelete?.addEventListener('click', () => this.hideDeleteModal());
        this.elements.btnConfirmDelete?.addEventListener('click', () => this.confirmDeleteAccount());

        // Close modal on overlay click
        this.elements.deleteModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteModal) {
                this.hideDeleteModal();
            }
        });
    },

    /**
     * Sauvegarder les valeurs originales
     */
    saveOriginalValues() {
        this.state.originalValues = {
            alertMode: this.elements.alertMode?.value,
            alarmSound: this.elements.alarmSound?.value,
            confirmationDelay: this.elements.confirmationDelay?.value,
            volumeTrigger: this.elements.volumeTrigger?.checked,
            volumeDuration: this.elements.volumeDuration?.value,
            backTapTrigger: this.elements.backTapTrigger?.checked,
            backTapSensitivity: this.elements.backTapSensitivity?.value,
            codeWordRed: this.elements.codeWordRed?.value,
            codeWordOrange: this.elements.codeWordOrange?.value,
            codeWordCancel: this.elements.codeWordCancel?.value,
            language: this.elements.language?.value,
            country: this.elements.country?.value
        };
    },

    /**
     * Toggle alarm sound setting visibility
     */
    toggleAlarmSoundSetting(show) {
        if (this.elements.alarmSoundSetting) {
            this.elements.alarmSoundSetting.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Preview the selected alarm sound
     */
    async previewSound() {
        const soundType = this.elements.alarmSound?.value || 'siren';

        // Arrêter tout son en cours
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio = null;
        }

        // Si AlarmService est disponible, l'utiliser
        if (window.AlarmService) {
            await window.AlarmService.init();
            window.AlarmService.previewAlarmSound(soundType, 3000); // 3 secondes
        } else {
            // Fallback sur audio direct
            console.warn('[Settings] AlarmService not available');
        }

        // Animation du bouton
        const btn = this.elements.btnPreviewSound;
        if (btn) {
            btn.classList.add('playing');
            setTimeout(() => btn.classList.remove('playing'), 3000);
        }
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
     * Toggle back tap sensitivity setting visibility
     */
    toggleBackTapSensitivity(show) {
        if (this.elements.backTapSensitivitySetting) {
            this.elements.backTapSensitivitySetting.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Sauvegarder les préférences d'alerte
     */
    async saveAlertPreferences() {
        const data = {
            alert_mode: this.elements.alertMode?.value,
            alarm_sound: this.elements.alarmSound?.value || 'siren',
            confirmation_delay: parseInt(this.elements.confirmationDelay?.value || '0', 10),
            volume_trigger_enabled: this.elements.volumeTrigger?.checked ? 1 : 0,
            volume_trigger_duration: parseInt(this.elements.volumeDuration?.value || '3', 10),
            back_tap_enabled: this.elements.backTapTrigger?.checked ? 1 : 0,
            back_tap_sensitivity: this.elements.backTapSensitivity?.value || 'medium',
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
     * Supprimer le compte - Affiche la modal de confirmation
     */
    deleteAccount() {
        this.showDeleteModal();
    },

    /**
     * Afficher la modal de suppression
     */
    showDeleteModal() {
        if (this.elements.deleteModal) {
            this.elements.deleteModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            this.startCountdown();
        }
    },

    /**
     * Masquer la modal de suppression
     */
    hideDeleteModal() {
        if (this.elements.deleteModal) {
            this.elements.deleteModal.classList.add('hidden');
            document.body.style.overflow = '';
            this.resetCountdown();
        }
    },

    /**
     * Démarrer le compte à rebours
     */
    startCountdown() {
        this.state.deleteCountdownValue = 5;

        if (this.elements.countdownSeconds) {
            this.elements.countdownSeconds.textContent = this.state.deleteCountdownValue;
        }
        if (this.elements.btnConfirmDelete) {
            this.elements.btnConfirmDelete.disabled = true;
        }
        if (this.elements.deleteCountdown) {
            this.elements.deleteCountdown.style.display = 'flex';
        }

        this.state.deleteCountdownInterval = setInterval(() => {
            this.state.deleteCountdownValue--;

            if (this.elements.countdownSeconds) {
                this.elements.countdownSeconds.textContent = this.state.deleteCountdownValue;
            }

            if (this.state.deleteCountdownValue <= 0) {
                this.endCountdown();
            }
        }, 1000);
    },

    /**
     * Fin du compte à rebours
     */
    endCountdown() {
        clearInterval(this.state.deleteCountdownInterval);
        this.state.deleteCountdownInterval = null;

        if (this.elements.deleteCountdown) {
            this.elements.deleteCountdown.style.display = 'none';
        }
        if (this.elements.btnConfirmDelete) {
            this.elements.btnConfirmDelete.disabled = false;
        }
    },

    /**
     * Réinitialiser le compte à rebours
     */
    resetCountdown() {
        if (this.state.deleteCountdownInterval) {
            clearInterval(this.state.deleteCountdownInterval);
            this.state.deleteCountdownInterval = null;
        }
        this.state.deleteCountdownValue = 5;

        if (this.elements.btnConfirmDelete) {
            this.elements.btnConfirmDelete.disabled = true;
        }
    },

    /**
     * Confirmer la suppression du compte
     */
    async confirmDeleteAccount() {
        // Demander le mot de passe
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
                this.hideDeleteModal();
                this.showToast(window.__('settings.account_deleted'), 'success');
                localStorage.removeItem('shield_token');
                localStorage.removeItem('shield_user');
                setTimeout(() => {
                    window.location.href = window.ShieldConfig?.basePath + '/auth/login';
                }, 1500);
            } else {
                this.showToast(window.__('error.invalid_password'), 'error');
            }
        } catch (error) {
            console.error('[Settings] Delete error:', error);
            this.showToast(window.__('error.generic'), 'error');
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

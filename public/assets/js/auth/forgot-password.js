/**
 * SHIELD Forgot Password Page Module
 */

const ForgotPasswordPage = {
    /**
     * Elements DOM
     */
    elements: {},

    /**
     * Etat
     */
    state: {
        isSubmitting: false
    },

    /**
     * Initialiser
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    /**
     * Cacher les elements DOM
     */
    cacheElements() {
        this.elements = {
            form: document.getElementById('forgot-password-form'),
            email: document.getElementById('email'),
            btnSubmit: document.getElementById('btn-submit'),
            btnText: document.querySelector('#btn-submit .btn-text'),
            btnLoader: document.querySelector('#btn-submit .btn-loader'),
            emailError: document.getElementById('email-error'),
            alert: document.getElementById('auth-alert'),
            alertMessage: document.querySelector('.alert-message'),
            alertClose: document.querySelector('.alert-close'),
            successMessage: document.getElementById('success-message')
        };
    },

    /**
     * Lier les evenements
     */
    bindEvents() {
        // Soumission du formulaire
        this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Fermer l'alerte
        this.elements.alertClose?.addEventListener('click', () => this.hideAlert());

        // Clear errors on input
        this.elements.email?.addEventListener('input', () => this.clearError('email'));
    },

    /**
     * Gerer la soumission
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.state.isSubmitting) return;

        // Valider
        if (!this.validate()) return;

        this.setLoading(true);

        try {
            const result = await window.ApiService.post('auth.php?action=forgot-password', {
                email: this.elements.email.value.trim()
            });

            if (result.success) {
                // Afficher le message de succes
                this.showSuccess();
                // Masquer le formulaire
                this.elements.form?.classList.add('hidden');
            } else {
                this.showAlert(this.getErrorMessage(result.error));
            }
        } catch (error) {
            console.error('[ForgotPassword] Error:', error);
            this.showAlert(this.getErrorMessage(error.error || 'network_error'));
        } finally {
            this.setLoading(false);
        }
    },

    /**
     * Valider le formulaire
     */
    validate() {
        let isValid = true;

        // Email
        const email = this.elements.email?.value.trim();
        if (!email) {
            this.showError('email', window.__('validation.email_required'));
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showError('email', window.__('validation.email_invalid'));
            isValid = false;
        }

        return isValid;
    },

    /**
     * Valider format email
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Afficher une erreur sur un champ
     */
    showError(field, message) {
        const errorEl = this.elements[`${field}Error`];
        const inputEl = this.elements[field];

        if (errorEl) {
            errorEl.textContent = message;
        }
        if (inputEl) {
            inputEl.classList.add('error');
        }
    },

    /**
     * Effacer une erreur
     */
    clearError(field) {
        const errorEl = this.elements[`${field}Error`];
        const inputEl = this.elements[field];

        if (errorEl) {
            errorEl.textContent = '';
        }
        if (inputEl) {
            inputEl.classList.remove('error');
        }
    },

    /**
     * Afficher l'alerte
     */
    showAlert(message) {
        if (this.elements.alertMessage) {
            this.elements.alertMessage.textContent = message;
        }
        this.elements.alert?.classList.remove('hidden');
    },

    /**
     * Masquer l'alerte
     */
    hideAlert() {
        this.elements.alert?.classList.add('hidden');
    },

    /**
     * Afficher le message de succes
     */
    showSuccess() {
        this.elements.successMessage?.classList.remove('hidden');
    },

    /**
     * Etat de chargement
     */
    setLoading(loading) {
        this.state.isSubmitting = loading;

        if (this.elements.btnSubmit) {
            this.elements.btnSubmit.disabled = loading;
        }
        this.elements.btnText?.classList.toggle('hidden', loading);
        this.elements.btnLoader?.classList.toggle('hidden', !loading);
    },

    /**
     * Obtenir le message d'erreur
     */
    getErrorMessage(errorCode) {
        const messages = {
            'user_not_found': window.__('error.not_found'),
            'network_error': window.__('error.network'),
            'timeout': window.__('error.timeout'),
            'rate_limit': window.__('error.429')
        };

        return messages[errorCode] || window.__('error.generic');
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    ForgotPasswordPage.init();
});

export default ForgotPasswordPage;

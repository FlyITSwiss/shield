/**
 * SHIELD Register Page Module
 */

const RegisterPage = {
    /**
     * Elements DOM
     */
    elements: {},

    /**
     * State
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
            form: document.getElementById('register-form'),
            firstName: document.getElementById('first_name'),
            lastName: document.getElementById('last_name'),
            email: document.getElementById('email'),
            phonePrefix: document.getElementById('phone_prefix'),
            phone: document.getElementById('phone'),
            password: document.getElementById('password'),
            passwordConfirmation: document.getElementById('password_confirmation'),
            terms: document.getElementById('terms'),
            btnRegister: document.getElementById('btn-register'),
            btnText: document.querySelector('#btn-register .btn-text'),
            btnLoader: document.querySelector('#btn-register .btn-loader'),
            togglePassword: document.querySelector('.btn-toggle-password'),
            passwordStrength: document.getElementById('password-strength'),
            alert: document.getElementById('auth-alert'),
            alertMessage: document.querySelector('.alert-message'),
            alertClose: document.querySelector('.alert-close')
        };
    },

    /**
     * Lier les evenements
     */
    bindEvents() {
        // Soumission du formulaire
        this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Toggle password visibility
        this.elements.togglePassword?.addEventListener('click', () => this.togglePasswordVisibility());

        // Password strength
        this.elements.password?.addEventListener('input', () => this.updatePasswordStrength());

        // Fermer l'alerte
        this.elements.alertClose?.addEventListener('click', () => this.hideAlert());

        // Clear errors on input
        ['firstName', 'lastName', 'email', 'phone', 'password', 'passwordConfirmation'].forEach(field => {
            this.elements[field]?.addEventListener('input', () => this.clearError(field));
        });
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
            const result = await window.ApiService.auth.register({
                first_name: this.elements.firstName.value.trim(),
                last_name: this.elements.lastName.value.trim(),
                email: this.elements.email.value.trim(),
                phone: this.elements.phonePrefix.value + this.elements.phone.value.trim(),
                password: this.elements.password.value,
                password_confirmation: this.elements.passwordConfirmation.value
            });

            if (result.success) {
                // Rediriger vers verification telephone ou app
                window.location.href = window.ShieldConfig?.basePath + '/app';
            } else {
                this.showAlert(this.getErrorMessage(result.error));
            }
        } catch (error) {
            console.error('[Register] Error:', error);
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

        // Prenom
        if (!this.elements.firstName?.value.trim()) {
            this.showError('firstName', window.__('validation.first_name_required'));
            isValid = false;
        }

        // Nom
        if (!this.elements.lastName?.value.trim()) {
            this.showError('lastName', window.__('validation.last_name_required'));
            isValid = false;
        }

        // Email
        const email = this.elements.email?.value.trim();
        if (!email) {
            this.showError('email', window.__('validation.email_required'));
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showError('email', window.__('validation.email_invalid'));
            isValid = false;
        }

        // Telephone
        const phone = this.elements.phone?.value.trim();
        if (!phone) {
            this.showError('phone', window.__('validation.phone_required'));
            isValid = false;
        } else if (!this.isValidPhone(phone)) {
            this.showError('phone', window.__('validation.phone_invalid'));
            isValid = false;
        }

        // Mot de passe
        const password = this.elements.password?.value;
        if (!password) {
            this.showError('password', window.__('validation.password_required'));
            isValid = false;
        } else if (password.length < 8) {
            this.showError('password', window.__('validation.password_min_length'));
            isValid = false;
        }

        // Confirmation mot de passe
        const passwordConfirmation = this.elements.passwordConfirmation?.value;
        if (password !== passwordConfirmation) {
            this.showError('passwordConfirmation', window.__('validation.password_mismatch'));
            isValid = false;
        }

        // CGU
        if (!this.elements.terms?.checked) {
            this.showError('terms', window.__('validation.terms_required'));
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
     * Valider format telephone
     */
    isValidPhone(phone) {
        return /^[0-9]{6,15}$/.test(phone.replace(/\s/g, ''));
    },

    /**
     * Mettre a jour l'indicateur de force du mot de passe
     */
    updatePasswordStrength() {
        const password = this.elements.password?.value || '';
        const strength = this.calculatePasswordStrength(password);

        if (this.elements.passwordStrength) {
            this.elements.passwordStrength.className = 'password-strength';
            this.elements.passwordStrength.setAttribute('data-strength', strength.level);
            this.elements.passwordStrength.textContent = strength.text;
        }
    },

    /**
     * Calculer la force du mot de passe
     */
    calculatePasswordStrength(password) {
        let score = 0;

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 2) return { level: 'weak', text: window.__('auth.password_weak') };
        if (score <= 4) return { level: 'medium', text: window.__('auth.password_medium') };
        return { level: 'strong', text: window.__('auth.password_strong') };
    },

    /**
     * Afficher une erreur sur un champ
     */
    showError(field, message) {
        const fieldMap = {
            firstName: 'first_name',
            lastName: 'last_name',
            passwordConfirmation: 'password_confirmation'
        };
        const errorId = fieldMap[field] || field;
        const errorEl = document.getElementById(`${errorId}-error`);
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
        const fieldMap = {
            firstName: 'first_name',
            lastName: 'last_name',
            passwordConfirmation: 'password_confirmation'
        };
        const errorId = fieldMap[field] || field;
        const errorEl = document.getElementById(`${errorId}-error`);
        const inputEl = this.elements[field];

        if (errorEl) {
            errorEl.textContent = '';
        }
        if (inputEl) {
            inputEl.classList.remove('error');
        }
    },

    /**
     * Toggle password visibility
     */
    togglePasswordVisibility() {
        const input = this.elements.password;
        const isPassword = input?.type === 'password';

        if (input) {
            input.type = isPassword ? 'text' : 'password';
        }

        document.querySelector('.icon-eye')?.classList.toggle('hidden', !isPassword);
        document.querySelector('.icon-eye-off')?.classList.toggle('hidden', isPassword);
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
     * Etat de chargement
     */
    setLoading(loading) {
        this.state.isSubmitting = loading;

        if (this.elements.btnRegister) {
            this.elements.btnRegister.disabled = loading;
        }
        this.elements.btnText?.classList.toggle('hidden', loading);
        this.elements.btnLoader?.classList.toggle('hidden', !loading);
    },

    /**
     * Obtenir le message d'erreur
     */
    getErrorMessage(errorCode) {
        const messages = {
            'email_exists': window.__('auth.email_exists'),
            'phone_exists': window.__('auth.phone_exists'),
            'validation_error': window.__('validation.check_fields'),
            'network_error': window.__('error.network'),
            'timeout': window.__('error.timeout')
        };

        return messages[errorCode] || window.__('error.generic');
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    RegisterPage.init();
});

export default RegisterPage;

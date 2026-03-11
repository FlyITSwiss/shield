/**
 * SHIELD Login Page Module
 */

const LoginPage = {
    /**
     * Éléments DOM
     */
    elements: {},

    /**
     * État
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
        this.checkExistingSession();
    },

    /**
     * Cacher les éléments DOM
     */
    cacheElements() {
        this.elements = {
            form: document.getElementById('login-form'),
            email: document.getElementById('email'),
            password: document.getElementById('password'),
            remember: document.getElementById('remember'),
            btnLogin: document.getElementById('btn-login'),
            btnText: document.querySelector('#btn-login .btn-text'),
            btnLoader: document.querySelector('#btn-login .btn-loader'),
            togglePassword: document.querySelector('.btn-toggle-password'),
            iconEye: document.querySelector('.icon-eye'),
            iconEyeOff: document.querySelector('.icon-eye-off'),
            emailError: document.getElementById('email-error'),
            passwordError: document.getElementById('password-error'),
            alert: document.getElementById('auth-alert'),
            alertMessage: document.querySelector('.alert-message'),
            alertClose: document.querySelector('.alert-close'),
            oauthButtons: document.querySelectorAll('.btn-oauth')
        };
    },

    /**
     * Lier les événements
     */
    bindEvents() {
        // Soumission du formulaire
        this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Toggle password visibility
        this.elements.togglePassword?.addEventListener('click', () => this.togglePasswordVisibility());

        // Fermer l'alerte
        this.elements.alertClose?.addEventListener('click', () => this.hideAlert());

        // OAuth buttons
        this.elements.oauthButtons?.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleOAuth(e));
        });

        // Clear errors on input
        this.elements.email?.addEventListener('input', () => this.clearError('email'));
        this.elements.password?.addEventListener('input', () => this.clearError('password'));
    },

    /**
     * Vérifier session existante
     */
    async checkExistingSession() {
        const token = localStorage.getItem('shield_token');
        if (!token) return;

        try {
            // Valider le token côté serveur
            const response = await fetch(window.ShieldConfig?.apiUrl + '/auth.php?action=verify', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success && result.valid) {
                // Token valide, rediriger vers l'app
                window.location.href = window.ShieldConfig?.basePath + '/app';
            } else {
                // Token invalide, le supprimer
                localStorage.removeItem('shield_token');
                localStorage.removeItem('shield_user');
            }
        } catch (error) {
            // Erreur réseau, supprimer le token par sécurité
            console.warn('[Login] Token validation failed:', error);
            localStorage.removeItem('shield_token');
            localStorage.removeItem('shield_user');
        }
    },

    /**
     * Gérer la soumission
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.state.isSubmitting) return;

        // Valider
        if (!this.validate()) return;

        this.setLoading(true);

        try {
            const remember = this.elements.remember?.checked || false;

            const result = await window.ApiService.auth.login(
                this.elements.email.value.trim(),
                this.elements.password.value,
                remember
            );

            if (result.success) {
                // Rediriger vers l'app
                window.location.href = window.ShieldConfig?.basePath + '/app';
            } else {
                this.showAlert(this.getErrorMessage(result.error));
            }
        } catch (error) {
            console.error('[Login] Error:', error);
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

        // Password
        const password = this.elements.password?.value;
        if (!password) {
            this.showError('password', window.__('validation.password_required'));
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
     * Toggle password visibility
     */
    togglePasswordVisibility() {
        const input = this.elements.password;
        const isPassword = input?.type === 'password';

        if (input) {
            input.type = isPassword ? 'text' : 'password';
        }

        this.elements.iconEye?.classList.toggle('hidden', !isPassword);
        this.elements.iconEyeOff?.classList.toggle('hidden', isPassword);
    },

    /**
     * Gérer OAuth
     */
    async handleOAuth(e) {
        const provider = e.currentTarget.dataset.provider;
        console.log(`[Login] OAuth with ${provider}`);

        if (!window.ShieldOAuth || !window.ShieldOAuth.isConfigured(provider)) {
            this.showAlert(window.__('auth.oauth_not_configured'));
            return;
        }

        this.setLoading(true);

        try {
            // Initier le flow OAuth (popup ou redirect selon plateforme)
            const oauthData = await window.ShieldOAuth.authenticate(provider);

            if (!oauthData || !oauthData.oauth_id) {
                throw new Error('oauth_cancelled');
            }

            // Envoyer au backend
            const result = await window.ApiService.post('auth.php?action=oauth', {
                provider: provider,
                oauth_id: oauthData.oauth_id,
                email: oauthData.email || null,
                first_name: oauthData.first_name || oauthData.name || null,
                picture: oauthData.picture || null
            });

            if (result.success) {
                // Si nouveau compte, peut nécessiter téléphone
                if (result.requires_phone) {
                    localStorage.setItem('shield_pending_phone', result.user_id);
                    window.location.href = window.ShieldConfig?.basePath + '/auth/complete-profile';
                } else {
                    window.location.href = window.ShieldConfig?.basePath + '/app';
                }
            } else {
                this.showAlert(this.getErrorMessage(result.error));
            }
        } catch (error) {
            console.error('[Login] OAuth error:', error);
            if (error.message !== 'oauth_cancelled') {
                this.showAlert(window.__('auth.oauth_failed'));
            }
        } finally {
            this.setLoading(false);
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
     * État de chargement
     */
    setLoading(loading) {
        this.state.isSubmitting = loading;

        if (this.elements.btnLogin) {
            this.elements.btnLogin.disabled = loading;
        }
        this.elements.btnText?.classList.toggle('hidden', loading);
        this.elements.btnLoader?.classList.toggle('hidden', !loading);
    },

    /**
     * Obtenir le message d'erreur
     */
    getErrorMessage(errorCode) {
        const messages = {
            'invalid_credentials': window.__('auth.invalid_credentials'),
            'account_disabled': window.__('auth.account_disabled'),
            'network_error': window.__('error.network'),
            'timeout': window.__('error.timeout')
        };

        return messages[errorCode] || window.__('error.generic');
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    LoginPage.init();
});

export default LoginPage;

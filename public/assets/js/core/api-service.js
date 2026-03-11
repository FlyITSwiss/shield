/**
 * SHIELD API Service
 *
 * Service centralisé pour les appels API avec gestion CSRF automatique
 */

const ApiService = {
    /**
     * Configuration
     */
    config: {
        baseUrl: window.ShieldConfig?.apiUrl || '/api',
        timeout: 30000,
        retries: 2
    },

    /**
     * Obtenir le token CSRF
     */
    getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content ||
               window.ShieldConfig?.csrfToken || '';
    },

    /**
     * Obtenir le token JWT (vérifie localStorage puis sessionStorage)
     */
    getAuthToken() {
        return localStorage.getItem('shield_token') ||
               sessionStorage.getItem('shield_token') || '';
    },

    /**
     * Sauvegarder le token JWT
     * @param {string|null} token - Le token JWT
     * @param {boolean} remember - Si true, utilise localStorage (persistent), sinon sessionStorage
     */
    setAuthToken(token, remember = true) {
        // Nettoyer les deux storages pour éviter les conflits
        localStorage.removeItem('shield_token');
        sessionStorage.removeItem('shield_token');

        if (token) {
            if (remember) {
                localStorage.setItem('shield_token', token);
                localStorage.setItem('shield_remember', 'true');
            } else {
                sessionStorage.setItem('shield_token', token);
                localStorage.removeItem('shield_remember');
            }
        } else {
            localStorage.removeItem('shield_remember');
        }
    },

    /**
     * Headers par défaut
     */
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (includeAuth) {
            const token = this.getAuthToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const csrf = this.getCsrfToken();
        if (csrf) {
            headers['X-CSRF-Token'] = csrf;
        }

        return headers;
    },

    /**
     * Requête générique
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.config.baseUrl}/${endpoint.replace(/^\//, '')}`;

        const fetchOptions = {
            method: method.toUpperCase(),
            headers: this.getHeaders(options.auth !== false),
            credentials: 'same-origin'
        };

        if (data && ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method)) {
            fetchOptions.body = JSON.stringify(data);
        }

        // Timeout avec AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);
        fetchOptions.signal = controller.signal;

        try {
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            // Parse JSON
            let result;
            try {
                result = await response.json();
            } catch {
                result = { success: false, error: 'invalid_response' };
            }

            // Gestion des erreurs HTTP
            if (!response.ok) {
                if (response.status === 401) {
                    this.handleUnauthorized();
                }
                throw { status: response.status, ...result };
            }

            return result;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw { success: false, error: 'timeout' };
            }

            throw error;
        }
    },

    /**
     * GET
     */
    async get(endpoint, params = {}, options = {}) {
        let url = endpoint;
        if (Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            url += (url.includes('?') ? '&' : '?') + queryString;
        }
        return this.request('GET', url, null, options);
    },

    /**
     * POST
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request('POST', endpoint, data, options);
    },

    /**
     * PUT
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request('PUT', endpoint, data, options);
    },

    /**
     * DELETE
     */
    async delete(endpoint, data = {}, options = {}) {
        return this.request('DELETE', endpoint, data, options);
    },

    /**
     * Gestion des erreurs 401
     */
    handleUnauthorized() {
        this.setAuthToken(null);
        localStorage.removeItem('shield_user');
        sessionStorage.removeItem('shield_user');

        // Rediriger vers login si pas déjà sur la page
        if (!window.location.pathname.includes('/auth/')) {
            window.location.href = window.ShieldConfig?.basePath + '/auth/login';
        }
    },

    // ========== API Shortcuts ==========

    /**
     * Authentification
     */
    auth: {
        /**
         * Connexion utilisateur
         * @param {string} email
         * @param {string} password
         * @param {boolean} remember - Se souvenir de moi (token 30 jours)
         */
        async login(email, password, remember = false) {
            const result = await ApiService.post('auth.php?action=login', { email, password, remember }, { auth: false });
            if (result.success && result.token) {
                ApiService.setAuthToken(result.token, remember);
                if (remember) {
                    localStorage.setItem('shield_user', JSON.stringify(result.user));
                } else {
                    sessionStorage.setItem('shield_user', JSON.stringify(result.user));
                    localStorage.removeItem('shield_user');
                }
            }
            return result;
        },

        async register(data) {
            const result = await ApiService.post('auth.php?action=register', data, { auth: false });
            if (result.success && result.token) {
                ApiService.setAuthToken(result.token);
            }
            return result;
        },

        async oauth(provider, oauthData) {
            const result = await ApiService.post('auth.php?action=oauth', { provider, ...oauthData }, { auth: false });
            if (result.success && result.token) {
                ApiService.setAuthToken(result.token);
                localStorage.setItem('shield_user', JSON.stringify(result.user));
            }
            return result;
        },

        async logout() {
            try {
                await ApiService.post('auth.php?action=logout');
            } finally {
                ApiService.setAuthToken(null);
                localStorage.removeItem('shield_user');
                sessionStorage.removeItem('shield_user');
            }
        },

        async getProfile() {
            return ApiService.get('auth.php?action=me');
        },

        async updateProfile(data) {
            return ApiService.put('auth.php?action=profile', data);
        },

        async getAlertPreferences() {
            return ApiService.get('auth.php?action=alert-preferences');
        },

        async updateAlertPreferences(data) {
            return ApiService.put('auth.php?action=alert-preferences', data);
        }
    },

    /**
     * Incidents SOS
     */
    incidents: {
        async trigger(data) {
            return ApiService.post('incidents.php?action=trigger', data);
        },

        async cancel(incidentId, reason = 'cancelled') {
            return ApiService.post(`incidents.php?action=cancel&id=${incidentId}`, { reason });
        },

        async confirmSafe(incidentId) {
            return ApiService.post(`incidents.php?action=safe&id=${incidentId}`);
        },

        async updateLocation(incidentId, latitude, longitude, accuracy = null) {
            return ApiService.post(`incidents.php?action=location&id=${incidentId}`, {
                latitude, longitude, accuracy
            });
        },

        async escalate(incidentId) {
            return ApiService.post(`incidents.php?action=escalate&id=${incidentId}`);
        },

        async getActive() {
            return ApiService.get('incidents.php?action=active');
        },

        async getHistory(limit = 20, offset = 0) {
            return ApiService.get('incidents.php?action=history', { limit, offset });
        }
    },

    /**
     * Contacts de confiance
     */
    contacts: {
        async list() {
            return ApiService.get('contacts.php?action=index');
        },

        async get(id) {
            return ApiService.get(`contacts.php?action=show&id=${id}`);
        },

        async create(data) {
            return ApiService.post('contacts.php?action=store', data);
        },

        async update(id, data) {
            return ApiService.put(`contacts.php?action=update&id=${id}`, data);
        },

        async delete(id) {
            return ApiService.delete(`contacts.php?action=destroy&id=${id}`);
        },

        async reorder(orderedIds) {
            return ApiService.put('contacts.php?action=reorder', { order: orderedIds });
        },

        async sendTest(id) {
            return ApiService.post(`contacts.php?action=test&id=${id}`);
        }
    },

    /**
     * Services d'urgence
     */
    emergency: {
        async getCountries() {
            return ApiService.get('emergency.php?action=countries', {}, { auth: false });
        },

        async getByCountry(countryCode) {
            return ApiService.get(`emergency.php?action=by-country&country_code=${countryCode}`, {}, { auth: false });
        },

        async getBestNumber(countryCode, context = 'default', coords = null) {
            const params = { country_code: countryCode, context };
            if (coords) {
                params.latitude = coords.latitude;
                params.longitude = coords.longitude;
            }
            return ApiService.get('emergency.php?action=best', params, { auth: false });
        },

        async detectCountry(latitude, longitude) {
            return ApiService.get('emergency.php?action=detect', { latitude, longitude }, { auth: false });
        }
    }
};

// Export pour utilisation globale
window.ApiService = ApiService;

// Support ES modules si utilisé comme module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}

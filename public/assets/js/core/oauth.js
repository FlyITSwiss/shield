/**
 * SHIELD OAuth Service
 *
 * Handles OAuth authentication for Google, Facebook, and Instagram
 * Works with both web (popup) and Capacitor (native plugin)
 */

const ShieldOAuth = {
    /**
     * Configuration for each provider
     */
    config: {
        google: {
            clientId: null,
            scope: 'email profile',
            authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
        },
        facebook: {
            appId: null,
            scope: 'email,public_profile',
            authUrl: 'https://www.facebook.com/v18.0/dialog/oauth'
        },
        instagram: {
            appId: null,
            scope: 'user_profile',
            authUrl: 'https://api.instagram.com/oauth/authorize'
        }
    },

    /**
     * Active popup window
     */
    popup: null,

    /**
     * Promise resolver for popup flow
     */
    resolver: null,

    /**
     * Initialize OAuth with configuration
     */
    init(config = {}) {
        if (config.google?.clientId) {
            this.config.google.clientId = config.google.clientId;
        }
        if (config.facebook?.appId) {
            this.config.facebook.appId = config.facebook.appId;
        }
        if (config.instagram?.appId) {
            this.config.instagram.appId = config.instagram.appId;
        }

        // Listen for OAuth callback messages
        window.addEventListener('message', this.handleMessage.bind(this));

        console.log('[OAuth] Initialized');
    },

    /**
     * Check if a provider is configured
     */
    isConfigured(provider) {
        const providerConfig = this.config[provider];
        if (!providerConfig) return false;

        return !!(providerConfig.clientId || providerConfig.appId);
    },

    /**
     * Authenticate with a provider
     */
    async authenticate(provider) {
        // Check for Capacitor native plugins first
        if (window.Capacitor?.isNativePlatform()) {
            return this.authenticateNative(provider);
        }

        // Fall back to web popup
        return this.authenticateWeb(provider);
    },

    /**
     * Native authentication via Capacitor plugins
     */
    async authenticateNative(provider) {
        try {
            switch (provider) {
                case 'google': {
                    // Uses @codetrix-studio/capacitor-google-auth
                    if (window.Plugins?.GoogleAuth) {
                        const user = await window.Plugins.GoogleAuth.signIn();
                        return {
                            oauth_id: user.id,
                            email: user.email,
                            first_name: user.givenName,
                            name: user.name,
                            picture: user.imageUrl
                        };
                    }
                    break;
                }
                case 'facebook': {
                    // Uses @capacitor-community/facebook-login
                    if (window.Plugins?.FacebookLogin) {
                        const result = await window.Plugins.FacebookLogin.login({
                            permissions: ['email', 'public_profile']
                        });
                        if (result.accessToken) {
                            const profile = await this.getFacebookProfile(result.accessToken.token);
                            return {
                                oauth_id: profile.id,
                                email: profile.email,
                                first_name: profile.first_name,
                                name: profile.name,
                                picture: profile.picture?.data?.url
                            };
                        }
                    }
                    break;
                }
            }
        } catch (error) {
            console.error(`[OAuth] Native ${provider} error:`, error);
        }

        // Fall back to web
        return this.authenticateWeb(provider);
    },

    /**
     * Web authentication via popup
     */
    authenticateWeb(provider) {
        return new Promise((resolve, reject) => {
            const providerConfig = this.config[provider];
            if (!providerConfig) {
                reject(new Error('Unknown provider'));
                return;
            }

            const redirectUri = `${window.location.origin}${window.ShieldConfig?.basePath || ''}/auth/oauth-callback`;
            const state = this.generateState();

            // Store state for verification
            sessionStorage.setItem('oauth_state', state);
            sessionStorage.setItem('oauth_provider', provider);

            let authUrl;

            switch (provider) {
                case 'google':
                    authUrl = `${providerConfig.authUrl}?` +
                        `client_id=${encodeURIComponent(providerConfig.clientId)}` +
                        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                        `&response_type=code` +
                        `&scope=${encodeURIComponent(providerConfig.scope)}` +
                        `&state=${encodeURIComponent(state)}` +
                        `&access_type=offline` +
                        `&prompt=select_account`;
                    break;

                case 'facebook':
                    authUrl = `${providerConfig.authUrl}?` +
                        `client_id=${encodeURIComponent(providerConfig.appId)}` +
                        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                        `&state=${encodeURIComponent(state)}` +
                        `&scope=${encodeURIComponent(providerConfig.scope)}`;
                    break;

                case 'instagram':
                    authUrl = `${providerConfig.authUrl}?` +
                        `client_id=${encodeURIComponent(providerConfig.appId)}` +
                        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                        `&scope=${encodeURIComponent(providerConfig.scope)}` +
                        `&response_type=code` +
                        `&state=${encodeURIComponent(state)}`;
                    break;

                default:
                    reject(new Error('Unknown provider'));
                    return;
            }

            // Store resolver for callback handling
            this.resolver = { resolve, reject };

            // Open popup
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.innerWidth - width) / 2;
            const top = window.screenY + (window.innerHeight - height) / 2;

            this.popup = window.open(
                authUrl,
                'shield_oauth',
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no`
            );

            if (!this.popup) {
                reject(new Error('Popup blocked'));
                return;
            }

            // Check if popup is closed without completing
            const checkClosed = setInterval(() => {
                if (this.popup?.closed) {
                    clearInterval(checkClosed);
                    if (this.resolver) {
                        this.resolver.reject(new Error('oauth_cancelled'));
                        this.resolver = null;
                    }
                }
            }, 500);
        });
    },

    /**
     * Handle OAuth callback message from popup
     */
    handleMessage(event) {
        // Verify origin
        if (event.origin !== window.location.origin) return;

        const data = event.data;
        if (!data || data.type !== 'oauth_callback') return;

        // Verify state
        const savedState = sessionStorage.getItem('oauth_state');
        if (data.state !== savedState) {
            console.error('[OAuth] State mismatch');
            if (this.resolver) {
                this.resolver.reject(new Error('State mismatch'));
                this.resolver = null;
            }
            return;
        }

        // Clean up
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_provider');

        // Close popup
        if (this.popup) {
            this.popup.close();
            this.popup = null;
        }

        // Resolve with data
        if (this.resolver) {
            if (data.error) {
                this.resolver.reject(new Error(data.error));
            } else {
                this.resolver.resolve(data);
            }
            this.resolver = null;
        }
    },

    /**
     * Get Facebook profile from access token
     */
    async getFacebookProfile(accessToken) {
        const response = await fetch(
            `https://graph.facebook.com/me?fields=id,name,first_name,email,picture&access_token=${accessToken}`
        );
        return response.json();
    },

    /**
     * Generate random state for CSRF protection
     */
    generateState() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
};

// Initialize with config from window if available
document.addEventListener('DOMContentLoaded', () => {
    if (window.ShieldConfig?.oauth) {
        ShieldOAuth.init(window.ShieldConfig.oauth);
    }
});

// Export globally
window.ShieldOAuth = ShieldOAuth;

export default ShieldOAuth;

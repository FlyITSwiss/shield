/**
 * SHIELD Incident Sharing Service
 *
 * Handles sharing incident location and status with:
 * - Trusted contacts via SMS/native share
 * - Emergency services via generated link
 * - Real-time location tracking for responders
 */

const IncidentSharing = {
    /**
     * Configuration
     */
    config: {
        shareBaseUrl: null, // Set during init
        linkExpiryHours: 24,
        updateInterval: 30000 // 30 seconds for live tracking
    },

    /**
     * State
     */
    state: {
        activeShareId: null,
        isSharing: false,
        trackingInterval: null
    },

    /**
     * Initialize sharing service
     */
    init(config = {}) {
        Object.assign(this.config, config);

        // Determine base URL
        if (!this.config.shareBaseUrl) {
            const baseUrl = window.AppConfig?.baseUrl || window.location.origin;
            this.config.shareBaseUrl = `${baseUrl}/track`;
        }

        console.log('[IncidentSharing] Initialized');
    },

    /**
     * Generate shareable tracking link
     * @param {string} incidentId - Incident UUID
     * @param {Object} options - Sharing options
     * @returns {Promise<Object>} Share data with link and token
     */
    async generateShareLink(incidentId, options = {}) {
        const {
            expiryHours = this.config.linkExpiryHours,
            allowLocationHistory = false,
            recipientType = 'contact' // 'contact' | 'emergency' | 'public'
        } = options;

        try {
            const result = await window.ApiService?.post('incidents.php?action=generate-share', {
                incident_id: incidentId,
                expiry_hours: expiryHours,
                allow_history: allowLocationHistory,
                recipient_type: recipientType
            });

            if (!result?.success) {
                throw new Error(result?.error || 'share_generation_failed');
            }

            const shareData = {
                shareId: result.share_id,
                token: result.token,
                link: `${this.config.shareBaseUrl}/${result.share_id}`,
                expiresAt: result.expires_at,
                incidentId: incidentId
            };

            this.state.activeShareId = result.share_id;
            return shareData;

        } catch (error) {
            console.error('[IncidentSharing] Generate link failed:', error);
            throw error;
        }
    },

    /**
     * Share incident via native share dialog
     * @param {string} incidentId - Incident UUID
     * @param {Object} options - Share options
     */
    async shareNative(incidentId, options = {}) {
        const {
            title = window.__?.('sos.share_title') || 'Alerte SHIELD',
            text = window.__?.('sos.share_text') || 'Je suis en situation d\'urgence. Voici ma position en temps réel:',
            includeLocation = true
        } = options;

        try {
            // Generate share link
            const shareData = await this.generateShareLink(incidentId, options);

            let shareText = text;
            if (includeLocation && window.GeolocationService) {
                const position = await window.GeolocationService.getCurrentPosition();
                if (position) {
                    const mapsUrl = `https://maps.google.com/?q=${position.latitude},${position.longitude}`;
                    shareText += `\n\n${window.__?.('sos.current_location') || 'Position actuelle:'} ${mapsUrl}`;
                }
            }

            shareText += `\n\n${window.__?.('sos.tracking_link') || 'Suivi en temps réel:'} ${shareData.link}`;

            // Use Capacitor Share plugin if available
            if (window.Capacitor?.isNativePlatform()) {
                await this.shareNativeCapacitor(title, shareText, shareData.link);
            } else {
                await this.shareWeb(title, shareText, shareData.link);
            }

            return shareData;

        } catch (error) {
            console.error('[IncidentSharing] Native share failed:', error);
            throw error;
        }
    },

    /**
     * Share via Capacitor Share plugin
     */
    async shareNativeCapacitor(title, text, url) {
        const { Share } = window.Capacitor?.Plugins || {};

        if (!Share) {
            // Fallback to web share
            return this.shareWeb(title, text, url);
        }

        await Share.share({
            title: title,
            text: text,
            url: url,
            dialogTitle: window.__?.('sos.share_dialog') || 'Partager ma position'
        });
    },

    /**
     * Share via Web Share API or fallback
     */
    async shareWeb(title, text, url) {
        // Try Web Share API
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: text,
                    url: url
                });
                return;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.warn('[IncidentSharing] Web Share failed:', error);
                }
            }
        }

        // Fallback: copy to clipboard
        const fullText = `${title}\n\n${text}`;
        await this.copyToClipboard(fullText);

        if (window.Toast) {
            window.Toast.success(window.__?.('msg.copied_clipboard') || 'Lien copié');
        }
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    },

    /**
     * Share via SMS to contacts
     * @param {string} incidentId - Incident UUID
     * @param {Array} contacts - Array of contact objects with phone numbers
     */
    async shareViaSMS(incidentId, contacts = []) {
        try {
            const shareData = await this.generateShareLink(incidentId, {
                recipientType: 'contact'
            });

            const results = [];

            for (const contact of contacts) {
                if (!contact.phone) continue;

                try {
                    const result = await window.ApiService?.post('incidents.php?action=send-share-sms', {
                        incident_id: incidentId,
                        contact_id: contact.id,
                        share_link: shareData.link
                    });

                    results.push({
                        contactId: contact.id,
                        success: result?.success || false,
                        error: result?.error
                    });
                } catch (error) {
                    results.push({
                        contactId: contact.id,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                shareData,
                results,
                successCount: results.filter(r => r.success).length,
                failCount: results.filter(r => !r.success).length
            };

        } catch (error) {
            console.error('[IncidentSharing] SMS share failed:', error);
            throw error;
        }
    },

    /**
     * Start live location sharing
     * @param {string} incidentId - Incident UUID
     */
    async startLiveSharing(incidentId) {
        if (this.state.isSharing) {
            return;
        }

        this.state.isSharing = true;

        // Update location periodically
        this.state.trackingInterval = setInterval(async () => {
            try {
                await this.updateSharedLocation(incidentId);
            } catch (error) {
                console.error('[IncidentSharing] Location update failed:', error);
            }
        }, this.config.updateInterval);

        // Initial update
        await this.updateSharedLocation(incidentId);

        console.log('[IncidentSharing] Live sharing started');
    },

    /**
     * Stop live location sharing
     */
    stopLiveSharing() {
        if (this.state.trackingInterval) {
            clearInterval(this.state.trackingInterval);
            this.state.trackingInterval = null;
        }

        this.state.isSharing = false;
        console.log('[IncidentSharing] Live sharing stopped');
    },

    /**
     * Update shared location
     */
    async updateSharedLocation(incidentId) {
        if (!window.GeolocationService) {
            return;
        }

        const position = await window.GeolocationService.getCurrentPosition();
        if (!position) {
            return;
        }

        await window.ApiService?.post('incidents.php?action=update-shared-location', {
            incident_id: incidentId,
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
            speed: position.speed,
            heading: position.heading,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Revoke share link
     * @param {string} shareId - Share ID to revoke
     */
    async revokeShare(shareId) {
        try {
            const result = await window.ApiService?.post('incidents.php?action=revoke-share', {
                share_id: shareId
            });

            if (result?.success && this.state.activeShareId === shareId) {
                this.state.activeShareId = null;
            }

            return result?.success || false;

        } catch (error) {
            console.error('[IncidentSharing] Revoke failed:', error);
            return false;
        }
    },

    /**
     * Get active shares for incident
     * @param {string} incidentId - Incident UUID
     */
    async getActiveShares(incidentId) {
        try {
            const result = await window.ApiService?.get(`incidents.php?action=get-shares&incident_id=${incidentId}`);
            return result?.shares || [];
        } catch (error) {
            console.error('[IncidentSharing] Get shares failed:', error);
            return [];
        }
    },

    /**
     * Check if currently sharing
     */
    isSharing() {
        return this.state.isSharing;
    },

    /**
     * Get share stats
     */
    getShareStats() {
        return {
            activeShareId: this.state.activeShareId,
            isSharing: this.state.isSharing
        };
    },

    /**
     * Destroy service
     */
    destroy() {
        this.stopLiveSharing();
        this.state.activeShareId = null;
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    IncidentSharing.init();
});

// Export globally
window.IncidentSharing = IncidentSharing;

export default IncidentSharing;

/**
 * SHIELD Contact Acknowledgment Tracker
 *
 * Tracks contact responses to SOS alerts:
 * - SMS delivery status
 * - Call status (answered, voicemail, no answer)
 * - App notification received/read
 * - Manual acknowledgment
 */

const ContactTracker = {
    /**
     * Configuration
     */
    config: {
        pollInterval: 5000, // 5 seconds
        maxPollAttempts: 60, // 5 minutes max
        webSocketEnabled: true
    },

    /**
     * State
     */
    state: {
        incidentId: null,
        contacts: new Map(), // contactId -> status
        pollTimer: null,
        pollCount: 0,
        isTracking: false
    },

    /**
     * Event callbacks
     */
    callbacks: {
        onContactUpdate: null,
        onAllAcknowledged: null,
        onStatusChange: null
    },

    /**
     * Contact status enum
     */
    STATUS: {
        PENDING: 'pending',
        SENDING: 'sending',
        DELIVERED: 'delivered',
        FAILED: 'failed',
        ACKNOWLEDGED: 'acknowledged',
        RESPONDING: 'responding',
        ARRIVED: 'arrived'
    },

    /**
     * Initialize tracker
     */
    init(config = {}) {
        Object.assign(this.config, config);

        // Listen for WebSocket events if available
        if (this.config.webSocketEnabled && window.HeliosWebSocket) {
            this.initWebSocket();
        }

        console.log('[ContactTracker] Initialized');
    },

    /**
     * Initialize WebSocket listeners
     */
    initWebSocket() {
        window.HeliosWebSocket?.on('contact_acknowledgment', (data) => {
            this.handleAcknowledgment(data);
        });

        window.HeliosWebSocket?.on('contact_status_update', (data) => {
            this.updateContactStatus(data.contact_id, data.status, data);
        });
    },

    /**
     * Start tracking contacts for an incident
     * @param {string} incidentId - Incident UUID
     * @param {Array} contacts - Array of contact objects
     */
    async startTracking(incidentId, contacts = []) {
        if (this.state.isTracking) {
            this.stopTracking();
        }

        this.state.incidentId = incidentId;
        this.state.isTracking = true;
        this.state.pollCount = 0;

        // Initialize contact statuses
        for (const contact of contacts) {
            this.state.contacts.set(contact.id, {
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                status: this.STATUS.PENDING,
                notifiedAt: null,
                acknowledgedAt: null,
                responseMessage: null,
                callAttempts: 0,
                smsDelivered: false
            });
        }

        // Start polling for updates
        this.startPolling();

        // Initial fetch
        await this.fetchContactStatuses();

        console.log('[ContactTracker] Tracking started for incident:', incidentId);
    },

    /**
     * Stop tracking
     */
    stopTracking() {
        if (this.state.pollTimer) {
            clearInterval(this.state.pollTimer);
            this.state.pollTimer = null;
        }

        this.state.isTracking = false;
        this.state.contacts.clear();
        this.state.incidentId = null;

        console.log('[ContactTracker] Tracking stopped');
    },

    /**
     * Start polling for status updates
     */
    startPolling() {
        if (this.state.pollTimer) {
            return;
        }

        this.state.pollTimer = setInterval(async () => {
            this.state.pollCount++;

            if (this.state.pollCount > this.config.maxPollAttempts) {
                console.log('[ContactTracker] Max poll attempts reached');
                this.stopPolling();
                return;
            }

            await this.fetchContactStatuses();

        }, this.config.pollInterval);
    },

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.state.pollTimer) {
            clearInterval(this.state.pollTimer);
            this.state.pollTimer = null;
        }
    },

    /**
     * Fetch contact statuses from server
     */
    async fetchContactStatuses() {
        if (!this.state.incidentId) {
            return;
        }

        try {
            const result = await window.ApiService?.get(
                `incidents.php?action=contact-statuses&incident_id=${this.state.incidentId}`
            );

            if (!result?.success || !result?.contacts) {
                return;
            }

            let allAcknowledged = true;
            let hasChanges = false;

            for (const serverContact of result.contacts) {
                const current = this.state.contacts.get(serverContact.contact_id);
                if (!current) continue;

                // Check for status change
                if (current.status !== serverContact.status) {
                    hasChanges = true;
                    this.updateContactStatus(serverContact.contact_id, serverContact.status, serverContact);
                }

                if (serverContact.status !== this.STATUS.ACKNOWLEDGED &&
                    serverContact.status !== this.STATUS.ARRIVED) {
                    allAcknowledged = false;
                }
            }

            // Trigger callback if all contacts acknowledged
            if (allAcknowledged && this.callbacks.onAllAcknowledged) {
                this.callbacks.onAllAcknowledged();
                this.stopPolling(); // No need to poll anymore
            }

        } catch (error) {
            console.error('[ContactTracker] Fetch statuses failed:', error);
        }
    },

    /**
     * Update contact status
     */
    updateContactStatus(contactId, status, data = {}) {
        const contact = this.state.contacts.get(contactId);
        if (!contact) {
            return;
        }

        const previousStatus = contact.status;

        // Update contact data
        Object.assign(contact, {
            status: status,
            notifiedAt: data.notified_at || contact.notifiedAt,
            acknowledgedAt: data.acknowledged_at || contact.acknowledgedAt,
            responseMessage: data.response_message || contact.responseMessage,
            callAttempts: data.call_attempts ?? contact.callAttempts,
            smsDelivered: data.sms_delivered ?? contact.smsDelivered
        });

        this.state.contacts.set(contactId, contact);

        // Trigger callback
        if (this.callbacks.onContactUpdate) {
            this.callbacks.onContactUpdate(contact, previousStatus);
        }

        if (this.callbacks.onStatusChange && previousStatus !== status) {
            this.callbacks.onStatusChange(contact, previousStatus, status);
        }

        console.log(`[ContactTracker] Contact ${contactId} status: ${previousStatus} -> ${status}`);
    },

    /**
     * Handle acknowledgment from WebSocket
     */
    handleAcknowledgment(data) {
        const { contact_id, status, response_message, acknowledged_at } = data;

        this.updateContactStatus(contact_id, status || this.STATUS.ACKNOWLEDGED, {
            acknowledged_at: acknowledged_at || new Date().toISOString(),
            response_message: response_message
        });
    },

    /**
     * Mark contact as acknowledged (manual)
     * @param {number} contactId - Contact ID
     * @param {string} responseMessage - Optional response message
     */
    async acknowledgeContact(contactId, responseMessage = null) {
        try {
            const result = await window.ApiService?.post('incidents.php?action=acknowledge-contact', {
                incident_id: this.state.incidentId,
                contact_id: contactId,
                response_message: responseMessage
            });

            if (result?.success) {
                this.updateContactStatus(contactId, this.STATUS.ACKNOWLEDGED, {
                    acknowledged_at: new Date().toISOString(),
                    response_message: responseMessage
                });
            }

            return result?.success || false;

        } catch (error) {
            console.error('[ContactTracker] Acknowledge failed:', error);
            return false;
        }
    },

    /**
     * Mark contact as arrived
     * @param {number} contactId - Contact ID
     */
    async markContactArrived(contactId) {
        try {
            const result = await window.ApiService?.post('incidents.php?action=contact-arrived', {
                incident_id: this.state.incidentId,
                contact_id: contactId
            });

            if (result?.success) {
                this.updateContactStatus(contactId, this.STATUS.ARRIVED, {
                    arrived_at: new Date().toISOString()
                });
            }

            return result?.success || false;

        } catch (error) {
            console.error('[ContactTracker] Mark arrived failed:', error);
            return false;
        }
    },

    /**
     * Get all contacts with their statuses
     */
    getContacts() {
        return Array.from(this.state.contacts.values());
    },

    /**
     * Get contact by ID
     */
    getContact(contactId) {
        return this.state.contacts.get(contactId);
    },

    /**
     * Get contacts by status
     */
    getContactsByStatus(status) {
        return this.getContacts().filter(c => c.status === status);
    },

    /**
     * Get summary stats
     */
    getStats() {
        const contacts = this.getContacts();
        return {
            total: contacts.length,
            pending: contacts.filter(c => c.status === this.STATUS.PENDING).length,
            sending: contacts.filter(c => c.status === this.STATUS.SENDING).length,
            delivered: contacts.filter(c => c.status === this.STATUS.DELIVERED).length,
            failed: contacts.filter(c => c.status === this.STATUS.FAILED).length,
            acknowledged: contacts.filter(c => c.status === this.STATUS.ACKNOWLEDGED).length,
            responding: contacts.filter(c => c.status === this.STATUS.RESPONDING).length,
            arrived: contacts.filter(c => c.status === this.STATUS.ARRIVED).length
        };
    },

    /**
     * Check if all contacts acknowledged
     */
    allAcknowledged() {
        const contacts = this.getContacts();
        if (contacts.length === 0) return false;

        return contacts.every(c =>
            c.status === this.STATUS.ACKNOWLEDGED ||
            c.status === this.STATUS.ARRIVED
        );
    },

    /**
     * Set callbacks
     */
    setCallbacks(callbacks) {
        Object.assign(this.callbacks, callbacks);
    },

    /**
     * Get status display info
     * @param {string} status - Status code
     * @returns {Object} Display info with label, icon, color
     */
    getStatusDisplay(status) {
        const displays = {
            [this.STATUS.PENDING]: {
                label: window.__?.('contacts.status.pending') || 'En attente',
                icon: 'clock',
                color: 'var(--warning)'
            },
            [this.STATUS.SENDING]: {
                label: window.__?.('contacts.status.sending') || 'Envoi en cours',
                icon: 'send',
                color: 'var(--info)'
            },
            [this.STATUS.DELIVERED]: {
                label: window.__?.('contacts.status.delivered') || 'Délivré',
                icon: 'check',
                color: 'var(--success)'
            },
            [this.STATUS.FAILED]: {
                label: window.__?.('contacts.status.failed') || 'Échec',
                icon: 'x-circle',
                color: 'var(--danger)'
            },
            [this.STATUS.ACKNOWLEDGED]: {
                label: window.__?.('contacts.status.acknowledged') || 'Confirmé',
                icon: 'check-circle',
                color: 'var(--success)'
            },
            [this.STATUS.RESPONDING]: {
                label: window.__?.('contacts.status.responding') || 'En route',
                icon: 'navigation',
                color: 'var(--primary)'
            },
            [this.STATUS.ARRIVED]: {
                label: window.__?.('contacts.status.arrived') || 'Sur place',
                icon: 'map-pin',
                color: 'var(--success)'
            }
        };

        return displays[status] || displays[this.STATUS.PENDING];
    },

    /**
     * Check if tracking is active
     */
    isTracking() {
        return this.state.isTracking;
    },

    /**
     * Destroy tracker
     */
    destroy() {
        this.stopTracking();
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    ContactTracker.init();
});

// Export globally
window.ContactTracker = ContactTracker;

export default ContactTracker;

/**
 * SHIELD Offline Queue Service
 *
 * Queues SOS triggers and location updates when offline
 * Syncs automatically when connection is restored
 */

const OfflineQueue = {
    /**
     * Queue storage key
     */
    STORAGE_KEY: 'shield_offline_queue',

    /**
     * State
     */
    state: {
        isOnline: navigator.onLine,
        isSyncing: false
    },

    /**
     * Queue items
     */
    queue: [],

    /**
     * Initialize offline queue
     */
    init() {
        // Load existing queue from storage
        this.loadQueue();

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Try to sync on init if online
        if (this.state.isOnline && this.queue.length > 0) {
            this.sync();
        }

        console.log('[OfflineQueue] Initialized', {
            isOnline: this.state.isOnline,
            pendingItems: this.queue.length
        });
    },

    /**
     * Handle coming online
     */
    async handleOnline() {
        console.log('[OfflineQueue] Back online');
        this.state.isOnline = true;

        // Show toast
        if (window.Toast) {
            window.Toast.info(window.__?.('msg.back_online') || 'Connexion rétablie');
        }

        // Sync queued items
        await this.sync();
    },

    /**
     * Handle going offline
     */
    handleOffline() {
        console.log('[OfflineQueue] Gone offline');
        this.state.isOnline = false;

        // Show toast
        if (window.Toast) {
            window.Toast.warning(window.__?.('msg.offline') || 'Mode hors-ligne');
        }
    },

    /**
     * Add item to queue
     * @param {string} type - Item type: 'sos_trigger' | 'location_update' | 'incident_resolve'
     * @param {Object} data - Item data
     */
    add(type, data) {
        const item = {
            id: this.generateId(),
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
            retries: 0
        };

        this.queue.push(item);
        this.saveQueue();

        console.log('[OfflineQueue] Added item:', item.type);

        // Try immediate sync if online
        if (this.state.isOnline) {
            this.sync();
        }

        return item.id;
    },

    /**
     * Queue SOS trigger
     */
    queueSOSTrigger(triggerData) {
        return this.add('sos_trigger', {
            trigger_type: triggerData.trigger_type || 'button',
            latitude: triggerData.latitude,
            longitude: triggerData.longitude,
            accuracy: triggerData.accuracy,
            silent_mode: triggerData.silent_mode || false,
            device_info: this.getDeviceInfo()
        });
    },

    /**
     * Queue location update
     */
    queueLocationUpdate(incidentId, location) {
        return this.add('location_update', {
            incident_id: incidentId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            speed: location.speed,
            heading: location.heading
        });
    },

    /**
     * Queue incident resolution
     */
    queueIncidentResolve(incidentId, status) {
        return this.add('incident_resolve', {
            incident_id: incidentId,
            status: status // 'safe' | 'cancelled' | 'escalated'
        });
    },

    /**
     * Sync queued items to server
     */
    async sync() {
        if (this.state.isSyncing || this.queue.length === 0) {
            return;
        }

        if (!this.state.isOnline) {
            console.log('[OfflineQueue] Offline, skipping sync');
            return;
        }

        this.state.isSyncing = true;
        console.log('[OfflineQueue] Syncing', this.queue.length, 'items');

        const processedIds = [];
        const failedItems = [];

        for (const item of this.queue) {
            try {
                await this.processItem(item);
                processedIds.push(item.id);
            } catch (error) {
                console.error('[OfflineQueue] Failed to process item:', item.id, error);

                item.retries++;
                if (item.retries < 3) {
                    failedItems.push(item);
                } else {
                    console.error('[OfflineQueue] Max retries reached, discarding:', item.id);
                    processedIds.push(item.id); // Remove after max retries
                }
            }
        }

        // Remove processed items
        this.queue = failedItems;
        this.saveQueue();

        this.state.isSyncing = false;

        if (processedIds.length > 0) {
            console.log('[OfflineQueue] Synced', processedIds.length, 'items');

            // Show toast if there were SOS triggers
            const sosTriggers = processedIds.filter(id =>
                this.queue.find(q => q.id === id && q.type === 'sos_trigger')
            );
            if (sosTriggers.length > 0 && window.Toast) {
                window.Toast.success(window.__?.('sos.synced') || 'Alertes synchronisées');
            }
        }
    },

    /**
     * Process a single queued item
     */
    async processItem(item) {
        switch (item.type) {
            case 'sos_trigger':
                return this.processSOS(item.data);

            case 'location_update':
                return this.processLocationUpdate(item.data);

            case 'incident_resolve':
                return this.processIncidentResolve(item.data);

            default:
                throw new Error(`Unknown item type: ${item.type}`);
        }
    },

    /**
     * Process SOS trigger
     */
    async processSOS(data) {
        const result = await window.ApiService?.incidents?.trigger(
            data.trigger_type,
            data.latitude,
            data.longitude,
            {
                accuracy: data.accuracy,
                silent_mode: data.silent_mode,
                device_info: data.device_info,
                offline_timestamp: data.timestamp
            }
        );

        if (!result?.success) {
            throw new Error(result?.error || 'SOS trigger failed');
        }

        // Store incident ID for reference
        if (result.incident_id) {
            localStorage.setItem('shield_active_incident', result.incident_id);
        }

        return result;
    },

    /**
     * Process location update
     */
    async processLocationUpdate(data) {
        const result = await window.ApiService?.incidents?.updateLocation(
            data.incident_id,
            data.latitude,
            data.longitude,
            {
                accuracy: data.accuracy,
                speed: data.speed,
                heading: data.heading
            }
        );

        if (!result?.success) {
            throw new Error(result?.error || 'Location update failed');
        }

        return result;
    },

    /**
     * Process incident resolution
     */
    async processIncidentResolve(data) {
        let result;

        switch (data.status) {
            case 'safe':
                result = await window.ApiService?.incidents?.confirmSafe(data.incident_id);
                break;
            case 'cancelled':
                result = await window.ApiService?.incidents?.cancel(data.incident_id);
                break;
            case 'escalated':
                result = await window.ApiService?.incidents?.escalate(data.incident_id);
                break;
            default:
                throw new Error(`Unknown status: ${data.status}`);
        }

        if (!result?.success) {
            throw new Error(result?.error || 'Incident resolve failed');
        }

        return result;
    },

    /**
     * Get device info for SOS
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: screen.width,
            screenHeight: screen.height,
            batteryLevel: null, // Will be filled by Battery API if available
            networkType: navigator.connection?.effectiveType || 'unknown'
        };
    },

    /**
     * Load queue from storage
     */
    loadQueue() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('[OfflineQueue] Failed to load queue:', error);
            this.queue = [];
        }
    },

    /**
     * Save queue to storage
     */
    saveQueue() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
        } catch (error) {
            console.error('[OfflineQueue] Failed to save queue:', error);
        }
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Get pending items count
     */
    getPendingCount() {
        return this.queue.length;
    },

    /**
     * Get pending items by type
     */
    getPendingByType(type) {
        return this.queue.filter(item => item.type === type);
    },

    /**
     * Check if online
     */
    isOnline() {
        return this.state.isOnline;
    },

    /**
     * Clear all queued items
     */
    clear() {
        this.queue = [];
        this.saveQueue();
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    OfflineQueue.init();
});

// Export globally
window.OfflineQueue = OfflineQueue;

export default OfflineQueue;

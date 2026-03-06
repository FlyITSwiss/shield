/**
 * SHIELD Notification Service
 *
 * Handles push notifications (Firebase) and local notifications (alarms)
 * Works with Capacitor plugins on mobile and web fallback
 */

const NotificationService = {
    /**
     * State
     */
    state: {
        initialized: false,
        pushToken: null,
        permissionGranted: false,
        isNative: false
    },

    /**
     * Notification handlers
     */
    handlers: {
        onPushReceived: null,
        onPushTapped: null,
        onLocalTapped: null
    },

    /**
     * Initialize notification service
     */
    async init() {
        if (this.state.initialized) return;

        this.state.isNative = window.Capacitor?.isNativePlatform() || false;

        if (this.state.isNative) {
            await this.initNative();
        } else {
            await this.initWeb();
        }

        this.state.initialized = true;
        console.log('[Notifications] Initialized', { isNative: this.state.isNative });
    },

    /**
     * Initialize native notifications (Capacitor)
     */
    async initNative() {
        const { PushNotifications, LocalNotifications } = window.Capacitor?.Plugins || {};

        if (!PushNotifications || !LocalNotifications) {
            console.warn('[Notifications] Capacitor plugins not available');
            return;
        }

        // Request permission
        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            const result = await PushNotifications.requestPermissions();
            this.state.permissionGranted = result.receive === 'granted';
        } else {
            this.state.permissionGranted = permStatus.receive === 'granted';
        }

        if (!this.state.permissionGranted) {
            console.warn('[Notifications] Permission denied');
            return;
        }

        // Register for push
        await PushNotifications.register();

        // Listen for registration
        PushNotifications.addListener('registration', (token) => {
            this.state.pushToken = token.value;
            console.log('[Notifications] Push token:', token.value);
            this.sendTokenToServer(token.value);
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[Notifications] Registration error:', error);
        });

        // Listen for push received (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[Notifications] Push received:', notification);
            this.handlers.onPushReceived?.(notification);

            // Show as local notification if in foreground
            this.showLocal({
                title: notification.title || 'SHIELD',
                body: notification.body || '',
                data: notification.data
            });
        });

        // Listen for push action (tapped)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[Notifications] Push tapped:', action);
            this.handlers.onPushTapped?.(action.notification);
            this.handleNotificationAction(action.notification.data);
        });

        // Local notification listeners
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
            console.log('[Notifications] Local tapped:', action);
            this.handlers.onLocalTapped?.(action.notification);
            this.handleNotificationAction(action.notification.extra);
        });

        // Request local notification permission
        await LocalNotifications.requestPermissions();
    },

    /**
     * Initialize web notifications (Service Worker)
     */
    async initWeb() {
        if (!('Notification' in window)) {
            console.warn('[Notifications] Web notifications not supported');
            return;
        }

        if (Notification.permission === 'default') {
            const result = await Notification.requestPermission();
            this.state.permissionGranted = result === 'granted';
        } else {
            this.state.permissionGranted = Notification.permission === 'granted';
        }
    },

    /**
     * Send push token to server
     */
    async sendTokenToServer(token) {
        try {
            await window.ApiService?.post('auth.php?action=push-token', {
                token: token,
                platform: window.Capacitor?.getPlatform() || 'web'
            });
        } catch (error) {
            console.error('[Notifications] Failed to send token:', error);
        }
    },

    /**
     * Show local notification
     */
    async showLocal(options) {
        const { title, body, data = {}, sound = false, vibrate = true } = options;

        if (this.state.isNative) {
            const { LocalNotifications } = window.Capacitor?.Plugins || {};
            if (!LocalNotifications) return;

            await LocalNotifications.schedule({
                notifications: [{
                    id: Date.now(),
                    title: title,
                    body: body,
                    extra: data,
                    sound: sound ? 'alarm_siren.wav' : undefined,
                    smallIcon: 'ic_stat_shield',
                    iconColor: '#8E24AA',
                    ongoing: data.ongoing || false
                }]
            });
        } else if (this.state.permissionGranted) {
            // Web notification
            const notification = new Notification(title, {
                body: body,
                icon: '/assets/images/shield-icon.png',
                badge: '/assets/images/shield-badge.png',
                vibrate: vibrate ? [200, 100, 200] : undefined,
                data: data
            });

            notification.onclick = () => {
                window.focus();
                this.handleNotificationAction(data);
                notification.close();
            };
        }
    },

    /**
     * Show SOS alarm notification (persistent)
     */
    async showSOSAlarm(incidentId) {
        await this.showLocal({
            title: window.__?.('sos.activated') || 'ALERTE SOS ACTIVEE',
            body: window.__?.('sos.help_on_way') || 'Les secours sont en route',
            data: {
                type: 'sos_active',
                incidentId: incidentId,
                ongoing: true
            },
            sound: true,
            vibrate: true
        });
    },

    /**
     * Show contact alert notification
     */
    async showContactAlert(contactName, userName) {
        await this.showLocal({
            title: 'ALERTE SHIELD',
            body: `${userName} a déclenché une alerte de sécurité !`,
            data: {
                type: 'contact_alert',
                contactName: contactName
            },
            sound: true,
            vibrate: true
        });
    },

    /**
     * Show safe confirmation notification
     */
    async showSafeConfirmation() {
        await this.showLocal({
            title: window.__?.('sos.cancelled') || 'Alerte annulée',
            body: window.__?.('sos.stay_calm') || 'Vous êtes en sécurité',
            data: { type: 'safe' }
        });
    },

    /**
     * Cancel all notifications
     */
    async cancelAll() {
        if (this.state.isNative) {
            const { LocalNotifications } = window.Capacitor?.Plugins || {};
            if (LocalNotifications) {
                const pending = await LocalNotifications.getPending();
                if (pending.notifications.length > 0) {
                    await LocalNotifications.cancel({
                        notifications: pending.notifications
                    });
                }
            }
        }
    },

    /**
     * Handle notification action
     */
    handleNotificationAction(data) {
        if (!data) return;

        switch (data.type) {
            case 'sos_active':
                // Navigate to SOS screen
                window.location.href = window.ShieldConfig?.basePath + '/app/sos';
                break;

            case 'contact_alert':
                // Navigate to incident details
                if (data.incidentId) {
                    window.location.href = window.ShieldConfig?.basePath + '/app/history/' + data.incidentId;
                }
                break;

            case 'safe':
                // Navigate to home
                window.location.href = window.ShieldConfig?.basePath + '/app';
                break;

            default:
                // Default: go to app
                window.location.href = window.ShieldConfig?.basePath + '/app';
        }
    },

    /**
     * Check if notifications are supported
     */
    isSupported() {
        return this.state.isNative || ('Notification' in window);
    },

    /**
     * Check if permission granted
     */
    hasPermission() {
        return this.state.permissionGranted;
    },

    /**
     * Request permission
     */
    async requestPermission() {
        if (this.state.isNative) {
            const { PushNotifications } = window.Capacitor?.Plugins || {};
            if (PushNotifications) {
                const result = await PushNotifications.requestPermissions();
                this.state.permissionGranted = result.receive === 'granted';
            }
        } else if ('Notification' in window) {
            const result = await Notification.requestPermission();
            this.state.permissionGranted = result === 'granted';
        }
        return this.state.permissionGranted;
    },

    /**
     * Set handlers
     */
    setHandlers(handlers) {
        this.handlers = { ...this.handlers, ...handlers };
    },

    /**
     * Get push token
     */
    getPushToken() {
        return this.state.pushToken;
    }
};

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    NotificationService.init().catch(console.error);
});

// Export globally
window.NotificationService = NotificationService;

export default NotificationService;

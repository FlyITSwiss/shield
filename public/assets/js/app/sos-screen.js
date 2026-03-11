/**
 * SHIELD SOS Screen Module
 *
 * Gestion de l'écran SOS et des états
 *
 * États:
 * - idle: en attente
 * - countdown: compte à rebours avant envoi
 * - active: alerte en cours
 * - resolved: alerte terminée
 */

import AlarmTrigger from './alarm-trigger.js';
// AlarmService est chargé globalement via window.AlarmService

const SOSScreen = {
    /**
     * Configuration
     */
    config: {
        countdownSeconds: 5,
        locationUpdateInterval: 10000, // 10s
        alertTimerInterval: 1000
    },

    /**
     * État
     */
    state: {
        currentState: 'idle',
        incidentId: null,
        silentMode: false,
        alertStartTime: null,
        countdownRemaining: 5
    },

    /**
     * Éléments DOM
     */
    elements: {},

    /**
     * Timers
     */
    timers: {
        countdown: null,
        location: null,
        alertDuration: null
    },

    /**
     * Audio
     */
    alarmAudio: null,

    /**
     * Initialiser
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.initAlarmTrigger();
        this.initAudio();
        this.checkActiveIncident();

        console.log('[SOSScreen] Initialized');
    },

    /**
     * Cacher les éléments DOM
     */
    cacheElements() {
        this.elements = {
            container: document.getElementById('sos-container'),
            states: {
                idle: document.getElementById('state-idle'),
                countdown: document.getElementById('state-countdown'),
                active: document.getElementById('state-active'),
                resolved: document.getElementById('state-resolved')
            },
            sosButton: document.getElementById('sos-button'),
            silentMode: document.getElementById('silent-mode'),
            countdownNumber: document.getElementById('countdown-number'),
            countdownProgress: document.getElementById('countdown-progress'),
            btnCancelCountdown: document.getElementById('btn-cancel-countdown'),
            btnSafe: document.getElementById('btn-safe'),
            btnEscalate: document.getElementById('btn-escalate'),
            btnCancelAlert: document.getElementById('btn-cancel-alert'),
            btnBackHome: document.getElementById('btn-back-home'),
            alertStatus: document.getElementById('alert-status'),
            alertTimer: document.getElementById('alert-timer'),
            locationText: document.getElementById('location-text')
        };
    },

    /**
     * Lier les événements
     */
    bindEvents() {
        // Toggle mode silencieux
        this.elements.silentMode?.addEventListener('change', (e) => {
            this.state.silentMode = e.target.checked;
            localStorage.setItem('shield_silent_mode', this.state.silentMode);
        });

        // Boutons d'action
        this.elements.btnCancelCountdown?.addEventListener('click', () => this.cancelCountdown());
        this.elements.btnSafe?.addEventListener('click', () => this.confirmSafe());
        this.elements.btnEscalate?.addEventListener('click', () => this.escalateToPolice());
        this.elements.btnCancelAlert?.addEventListener('click', () => this.cancelAlert());
        this.elements.btnBackHome?.addEventListener('click', () => this.backToHome());

        // Bouton settings
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            window.location.href = window.ShieldConfig?.basePath + '/app/settings';
        });

        // Restaurer le mode silencieux
        const savedSilentMode = localStorage.getItem('shield_silent_mode');
        if (savedSilentMode === 'true') {
            this.state.silentMode = true;
            if (this.elements.silentMode) {
                this.elements.silentMode.checked = true;
            }
        }
    },

    /**
     * Initialiser le module de déclenchement
     */
    initAlarmTrigger() {
        AlarmTrigger.init({
            onTrigger: (method) => this.onAlarmTrigger(method),
            onProgress: (data) => this.onTriggerProgress(data)
        });
    },

    /**
     * Initialiser l'audio
     */
    async initAudio() {
        // Fallback: élément audio HTML
        this.alarmAudio = document.getElementById('alarm-audio');

        // Initialiser AlarmService pour le son fort (sirène synthétique)
        if (window.AlarmService) {
            await window.AlarmService.init();
            console.log('[SOSScreen] AlarmService initialized');
        }
    },

    /**
     * Vérifier s'il y a un incident actif
     */
    async checkActiveIncident() {
        // Vérifier les données injectées par le serveur
        if (window.ShieldActiveIncident) {
            this.state.incidentId = window.ShieldActiveIncident.id;
            this.state.alertStartTime = new Date(window.ShieldActiveIncident.created_at);
            this.showState('active');
            this.startLocationTracking();
            this.startAlertTimer();
            return;
        }

        // Ou vérifier via API
        try {
            const result = await window.ApiService.incidents.getActive();
            if (result.success && result.has_active && result.incident) {
                this.state.incidentId = result.incident.id;
                this.state.alertStartTime = new Date(result.incident.created_at);
                this.showState('active');
                this.startLocationTracking();
                this.startAlertTimer();
            }
        } catch (error) {
            console.error('[SOSScreen] Error checking active incident:', error);
        }
    },

    // ========== STATE MANAGEMENT ==========

    /**
     * Afficher un état
     */
    showState(stateName) {
        this.state.currentState = stateName;

        // Masquer tous les états
        Object.values(this.elements.states).forEach(el => {
            el?.classList.remove('active');
        });

        // Afficher l'état demandé
        this.elements.states[stateName]?.classList.add('active');

        // Actions spécifiques
        if (stateName === 'active' && !this.state.silentMode) {
            this.playAlarm();
        } else {
            this.stopAlarm();
        }

        // Mettre à jour AlarmTrigger
        AlarmTrigger.setActive(stateName === 'active');
    },

    // ========== TRIGGER HANDLERS ==========

    /**
     * Callback du déclenchement
     */
    onAlarmTrigger(method) {
        console.log(`[SOSScreen] Alarm triggered via ${method}`);
        this.startCountdown(method);
    },

    /**
     * Callback de progression
     */
    onTriggerProgress(data) {
        // Feedback visuel pour les taps
        if (data.type === 'tap') {
            const sosButton = this.elements.sosButton;
            if (sosButton) {
                sosButton.style.setProperty('--tap-progress', `${data.percent}%`);
            }
        }
    },

    // ========== COUNTDOWN ==========

    /**
     * Démarrer le compte à rebours
     */
    startCountdown(triggerMethod) {
        this.state.countdownRemaining = this.config.countdownSeconds;
        this.state.triggerMethod = triggerMethod;

        this.showState('countdown');
        this.updateCountdownDisplay();

        // Timer
        this.timers.countdown = setInterval(() => {
            this.state.countdownRemaining--;
            this.updateCountdownDisplay();

            if (this.state.countdownRemaining <= 0) {
                this.clearCountdown();
                this.sendAlert();
            }
        }, 1000);
    },

    /**
     * Mettre à jour l'affichage du compte à rebours
     */
    updateCountdownDisplay() {
        if (this.elements.countdownNumber) {
            this.elements.countdownNumber.textContent = this.state.countdownRemaining;
        }

        // Progress circle
        if (this.elements.countdownProgress) {
            const circumference = 2 * Math.PI * 45; // r=45
            const progress = (this.config.countdownSeconds - this.state.countdownRemaining) / this.config.countdownSeconds;
            const offset = circumference * (1 - progress);
            this.elements.countdownProgress.style.strokeDashoffset = offset;
        }
    },

    /**
     * Annuler le compte à rebours
     */
    cancelCountdown() {
        this.clearCountdown();
        AlarmTrigger.reset();
        this.showState('idle');
    },

    /**
     * Nettoyer le timer du countdown
     */
    clearCountdown() {
        if (this.timers.countdown) {
            clearInterval(this.timers.countdown);
            this.timers.countdown = null;
        }
    },

    // ========== ALERT ==========

    /**
     * Envoyer l'alerte
     */
    async sendAlert() {
        try {
            // Obtenir la position GPS
            const position = await this.getCurrentPosition();

            // Envoyer à l'API
            const result = await window.ApiService.incidents.trigger({
                trigger_method: this.state.triggerMethod || 'tap_5',
                alert_mode: this.state.silentMode ? 'silent' : 'sonic',
                latitude: position?.coords?.latitude,
                longitude: position?.coords?.longitude,
                accuracy: position?.coords?.accuracy
            });

            if (result.success) {
                this.state.incidentId = result.incident_id;
                this.state.alertStartTime = new Date();

                this.showState('active');
                this.startLocationTracking();
                this.startAlertTimer();
                this.updateLocation();

                console.log(`[SOSScreen] Alert sent in ${result.execution_time_ms}ms`);
            } else {
                console.error('[SOSScreen] Failed to send alert:', result.error);
                this.showError(result.error);
                this.showState('idle');
            }
        } catch (error) {
            console.error('[SOSScreen] Error sending alert:', error);
            this.showError('network_error');
            this.showState('idle');
        }
    },

    /**
     * Confirmer être en sécurité
     */
    async confirmSafe() {
        if (!this.state.incidentId) return;

        try {
            const result = await window.ApiService.incidents.confirmSafe(this.state.incidentId);

            if (result.success) {
                this.stopAlarm();
                this.stopLocationTracking();
                this.stopAlertTimer();
                this.showState('resolved');
            }
        } catch (error) {
            console.error('[SOSScreen] Error confirming safe:', error);
        }
    },

    /**
     * Escalader vers la police
     */
    async escalateToPolice() {
        if (!this.state.incidentId) return;

        try {
            const result = await window.ApiService.incidents.escalate(this.state.incidentId);

            if (result.success && result.phone_number) {
                // Lancer l'appel
                window.location.href = `tel:${result.phone_number}`;

                // Mettre à jour le statut
                if (this.elements.alertStatus) {
                    this.elements.alertStatus.textContent = window.__('sos.police_contacted');
                }
            }
        } catch (error) {
            console.error('[SOSScreen] Error escalating:', error);
        }
    },

    /**
     * Annuler l'alerte (fausse alerte)
     */
    async cancelAlert() {
        if (!this.state.incidentId) return;

        // Demander confirmation
        if (!confirm(window.__('sos.confirm_false_alarm'))) {
            return;
        }

        try {
            const result = await window.ApiService.incidents.cancel(this.state.incidentId, 'false_alarm');

            if (result.success) {
                this.stopAlarm();
                this.stopLocationTracking();
                this.stopAlertTimer();
                this.showState('idle');
                AlarmTrigger.reset();
            }
        } catch (error) {
            console.error('[SOSScreen] Error cancelling:', error);
        }
    },

    /**
     * Retour à l'accueil
     */
    backToHome() {
        this.state.incidentId = null;
        this.state.alertStartTime = null;
        AlarmTrigger.reset();
        this.showState('idle');
    },

    // ========== LOCATION TRACKING ==========

    /**
     * Obtenir la position actuelle
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => {
                    console.warn('[SOSScreen] Geolocation error:', error);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    },

    /**
     * Démarrer le tracking de position
     */
    startLocationTracking() {
        this.timers.location = setInterval(() => this.updateLocation(), this.config.locationUpdateInterval);
    },

    /**
     * Arrêter le tracking
     */
    stopLocationTracking() {
        if (this.timers.location) {
            clearInterval(this.timers.location);
            this.timers.location = null;
        }
    },

    /**
     * Mettre à jour la position
     */
    async updateLocation() {
        if (!this.state.incidentId) return;

        try {
            const position = await this.getCurrentPosition();
            if (!position) return;

            const result = await window.ApiService.incidents.updateLocation(
                this.state.incidentId,
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy
            );

            if (result.success && result.address && this.elements.locationText) {
                this.elements.locationText.textContent = result.address;
            }
        } catch (error) {
            console.warn('[SOSScreen] Location update error:', error);
        }
    },

    // ========== ALERT TIMER ==========

    /**
     * Démarrer le timer d'alerte
     */
    startAlertTimer() {
        this.timers.alertDuration = setInterval(() => {
            if (this.state.alertStartTime && this.elements.alertTimer) {
                const elapsed = Math.floor((Date.now() - this.state.alertStartTime.getTime()) / 1000);
                this.elements.alertTimer.textContent = this.formatDuration(elapsed);
            }
        }, this.config.alertTimerInterval);
    },

    /**
     * Arrêter le timer
     */
    stopAlertTimer() {
        if (this.timers.alertDuration) {
            clearInterval(this.timers.alertDuration);
            this.timers.alertDuration = null;
        }
    },

    /**
     * Formater une durée
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    // ========== AUDIO ==========

    /**
     * Jouer l'alarme sonore (sirène forte pour faire fuir l'agresseur)
     */
    playAlarm() {
        // Utiliser AlarmService pour un son synthétique très fort
        if (window.AlarmService) {
            window.AlarmService.playPanicAlarm();
            console.log('[SOSScreen] Panic alarm started via AlarmService');
            return;
        }

        // Fallback: élément audio HTML
        if (this.alarmAudio) {
            this.alarmAudio.currentTime = 0;
            this.alarmAudio.play().catch(e => {
                console.warn('[SOSScreen] Audio play failed:', e);
            });
        }
    },

    /**
     * Arrêter l'alarme
     */
    stopAlarm() {
        // Arrêter AlarmService
        if (window.AlarmService) {
            window.AlarmService.stop();
        }

        // Arrêter aussi l'audio HTML (fallback)
        if (this.alarmAudio) {
            this.alarmAudio.pause();
            this.alarmAudio.currentTime = 0;
        }
    },

    // ========== UTILS ==========

    /**
     * Afficher une erreur
     */
    showError(errorKey) {
        const message = window.__?.(errorKey) || errorKey;
        if (window.Toast) {
            window.Toast.error(message);
        } else {
            console.error('[SOSScreen] Error:', message);
        }
    },

    /**
     * Afficher un message de succès
     */
    showSuccess(messageKey) {
        const message = window.__?.(messageKey) || messageKey;
        if (window.Toast) {
            window.Toast.success(message);
        } else {
            console.log('[SOSScreen] Success:', message);
        }
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    SOSScreen.init();
});

// Export
window.SOSScreen = SOSScreen;

export default SOSScreen;

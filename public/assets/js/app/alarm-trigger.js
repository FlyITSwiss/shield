/**
 * SHIELD Alarm Trigger Module
 *
 * Gestion du déclenchement d'alerte SOS
 * Critère CDC: < 2 secondes de déclenchement
 *
 * Méthodes de déclenchement:
 * - 5 taps rapides sur l'écran
 * - Maintien des boutons volume (configurable)
 * - Shake detection (optionnel)
 */

const AlarmTrigger = {
    /**
     * Configuration
     */
    config: {
        // 5 taps
        tapCount: 5,
        tapTimeWindow: 2000, // ms entre le premier et dernier tap
        tapMaxInterval: 400, // ms max entre deux taps consécutifs

        // Volume hold
        volumeHoldDuration: 3000, // ms (configurable)
        volumeEnabled: true,

        // Shake
        shakeThreshold: 15,
        shakeEnabled: false
    },

    /**
     * État
     */
    state: {
        taps: [],
        volumeStart: null,
        isTriggering: false,
        isActive: false
    },

    /**
     * Callbacks
     */
    onTrigger: null,
    onProgress: null,

    /**
     * Initialiser le module
     */
    init(options = {}) {
        // Fusionner les options
        if (options.config) {
            Object.assign(this.config, options.config);
        }
        this.onTrigger = options.onTrigger || null;
        this.onProgress = options.onProgress || null;

        // Charger les préférences utilisateur
        this.loadUserPreferences();

        // Initialiser les listeners
        this.initTapDetection();
        this.initVolumeDetection();

        if (this.config.shakeEnabled) {
            this.initShakeDetection();
        }

        console.log('[AlarmTrigger] Initialized');
    },

    /**
     * Charger les préférences utilisateur
     */
    loadUserPreferences() {
        const prefs = JSON.parse(localStorage.getItem('shield_alert_prefs') || '{}');

        if (prefs.volume_trigger_duration) {
            this.config.volumeHoldDuration = prefs.volume_trigger_duration * 1000;
        }
        if (prefs.volume_trigger_enabled !== undefined) {
            this.config.volumeEnabled = prefs.volume_trigger_enabled;
        }
    },

    /**
     * Sauvegarder les préférences
     */
    saveUserPreferences(prefs) {
        localStorage.setItem('shield_alert_prefs', JSON.stringify(prefs));
        this.loadUserPreferences();
    },

    // ========== TAP DETECTION ==========

    /**
     * Initialiser la détection des taps
     */
    initTapDetection() {
        const sosButton = document.getElementById('sos-button');
        const container = document.getElementById('sos-container');

        // Taps sur le bouton SOS
        if (sosButton) {
            sosButton.addEventListener('touchstart', (e) => this.handleTap(e), { passive: true });
            sosButton.addEventListener('click', (e) => this.handleTap(e));
        }

        // Taps n'importe où sur l'écran (en mode idle)
        if (container) {
            container.addEventListener('touchstart', (e) => {
                if (document.querySelector('.sos-state-idle.active')) {
                    this.handleTap(e);
                }
            }, { passive: true });
        }
    },

    /**
     * Gérer un tap
     */
    handleTap(e) {
        if (this.state.isTriggering || this.state.isActive) {
            return;
        }

        const now = Date.now();

        // Nettoyer les taps trop anciens
        this.state.taps = this.state.taps.filter(t => now - t < this.config.tapTimeWindow);

        // Vérifier l'intervalle avec le dernier tap
        const lastTap = this.state.taps[this.state.taps.length - 1];
        if (lastTap && now - lastTap > this.config.tapMaxInterval) {
            // Intervalle trop long, reset
            this.state.taps = [];
        }

        // Ajouter le tap
        this.state.taps.push(now);

        // Feedback visuel
        this.showTapFeedback(this.state.taps.length);

        // Vérifier si on atteint le nombre requis
        if (this.state.taps.length >= this.config.tapCount) {
            this.trigger('five_taps');
        }
    },

    /**
     * Feedback visuel des taps
     */
    showTapFeedback(count) {
        if (this.onProgress) {
            this.onProgress({
                type: 'tap',
                current: count,
                total: this.config.tapCount,
                percent: (count / this.config.tapCount) * 100
            });
        }

        // Animation du bouton SOS
        const sosButton = document.getElementById('sos-button');
        if (sosButton) {
            sosButton.classList.add('tap-feedback');
            setTimeout(() => sosButton.classList.remove('tap-feedback'), 100);
        }
    },

    // ========== VOLUME BUTTON DETECTION ==========

    /**
     * Initialiser la détection des boutons volume
     *
     * Utilise VolumeButtonsPlugin pour la détection native et web
     */
    async initVolumeDetection() {
        if (!this.config.volumeEnabled) {
            return;
        }

        // Utiliser VolumeButtonsPlugin si disponible
        if (window.VolumeButtonsPlugin) {
            await this.initVolumePlugin();
        } else {
            // Fallback: détection web basique (simulation via clavier)
            document.addEventListener('keydown', (e) => this.handleVolumeKeyDown(e));
            document.addEventListener('keyup', (e) => this.handleVolumeKeyUp(e));
        }
    },

    /**
     * Initialiser VolumeButtonsPlugin
     */
    async initVolumePlugin() {
        const plugin = window.VolumeButtonsPlugin;

        // Configurer la durée de maintien
        plugin.setHoldDuration(this.config.volumeHoldDuration);

        // Définir les handlers
        plugin.setHandlers({
            onHoldStart: (button) => {
                if (this.state.isTriggering || this.state.isActive) {
                    return;
                }
                console.log(`[AlarmTrigger] Volume ${button} hold started`);
            },

            onHoldProgress: (data) => {
                if (this.state.isTriggering || this.state.isActive) {
                    return;
                }

                if (this.onProgress) {
                    this.onProgress({
                        type: 'volume',
                        button: data.button,
                        elapsed: data.elapsed,
                        total: data.total,
                        percent: data.percent
                    });
                }
            },

            onHoldComplete: (button) => {
                if (this.state.isTriggering || this.state.isActive) {
                    return;
                }
                console.log(`[AlarmTrigger] Volume ${button} hold completed`);
                this.trigger('volume_hold');
            },

            onHoldCancel: (button) => {
                if (this.onProgress) {
                    this.onProgress({ type: 'volume', percent: 0 });
                }
            }
        });

        // Initialiser le plugin
        await plugin.init({
            holdDuration: this.config.volumeHoldDuration
        });

        console.log('[AlarmTrigger] VolumeButtonsPlugin initialized');
    },

    /**
     * Volume key down (fallback web)
     */
    handleVolumeKeyDown(e) {
        // AudioVolumeUp ou AudioVolumeDown
        if (e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown') {
            e.preventDefault();

            if (this.state.isTriggering || this.state.isActive) {
                return;
            }

            if (!this.state.volumeStart) {
                this.state.volumeStart = Date.now();
                this.startVolumeHoldTimer();
            }
        }
    },

    /**
     * Volume key up (fallback web)
     */
    handleVolumeKeyUp(e) {
        if (e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown') {
            this.cancelVolumeHold();
        }
    },

    /**
     * Timer pour le maintien volume (fallback web)
     */
    startVolumeHoldTimer() {
        this.volumeInterval = setInterval(() => {
            if (!this.state.volumeStart) {
                return;
            }

            const elapsed = Date.now() - this.state.volumeStart;
            const percent = (elapsed / this.config.volumeHoldDuration) * 100;

            if (this.onProgress) {
                this.onProgress({
                    type: 'volume',
                    elapsed,
                    total: this.config.volumeHoldDuration,
                    percent: Math.min(percent, 100)
                });
            }

            if (elapsed >= this.config.volumeHoldDuration) {
                this.cancelVolumeHold();
                this.trigger('volume_hold');
            }
        }, 50);
    },

    /**
     * Annuler le maintien volume (fallback web)
     */
    cancelVolumeHold() {
        this.state.volumeStart = null;
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }

        if (this.onProgress) {
            this.onProgress({ type: 'volume', percent: 0 });
        }
    },

    // ========== SHAKE DETECTION ==========

    /**
     * Initialiser la détection de secousse
     */
    initShakeDetection() {
        if (!window.DeviceMotionEvent) {
            console.warn('[AlarmTrigger] DeviceMotionEvent not supported');
            return;
        }

        let lastX = 0, lastY = 0, lastZ = 0;
        let lastTime = Date.now();

        window.addEventListener('devicemotion', (e) => {
            if (this.state.isTriggering || this.state.isActive) {
                return;
            }

            const current = e.accelerationIncludingGravity;
            if (!current) return;

            const now = Date.now();
            const timeDiff = now - lastTime;

            if (timeDiff > 100) {
                const deltaX = Math.abs(current.x - lastX);
                const deltaY = Math.abs(current.y - lastY);
                const deltaZ = Math.abs(current.z - lastZ);

                const speed = (deltaX + deltaY + deltaZ) / timeDiff * 10000;

                if (speed > this.config.shakeThreshold) {
                    this.trigger('shake');
                }

                lastX = current.x;
                lastY = current.y;
                lastZ = current.z;
                lastTime = now;
            }
        });
    },

    // ========== TRIGGER ==========

    /**
     * Déclencher l'alerte
     */
    trigger(method) {
        if (this.state.isTriggering || this.state.isActive) {
            return;
        }

        console.log(`[AlarmTrigger] Triggered via ${method}`);

        this.state.isTriggering = true;
        this.state.taps = [];
        this.cancelVolumeHold();

        // Vibration feedback
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        // Callback
        if (this.onTrigger) {
            this.onTrigger(method);
        }
    },

    /**
     * Activer l'état "alerte active"
     */
    setActive(active) {
        this.state.isActive = active;
        this.state.isTriggering = false;
    },

    /**
     * Reset complet
     */
    reset() {
        this.state.taps = [];
        this.state.volumeStart = null;
        this.state.isTriggering = false;
        this.state.isActive = false;
        this.cancelVolumeHold();
    },

    /**
     * Détruire le module
     */
    destroy() {
        this.reset();
        // Note: les event listeners persistent (pas de cleanup)
    }
};

// Export
window.AlarmTrigger = AlarmTrigger;

export default AlarmTrigger;

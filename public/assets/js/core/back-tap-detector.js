/**
 * SHIELD - Back Tap Detector
 *
 * Détecte les tapotements sur le dos du téléphone via l'accéléromètre.
 * Fonctionne avec Capacitor (natif) ou Web API (fallback).
 *
 * Usage:
 *   BackTapDetector.init({ onDoubleTap: () => triggerSOS() });
 *   BackTapDetector.start();
 */

const BackTapDetector = {
    /**
     * Configuration
     */
    config: {
        // Seuil d'accélération pour détecter un tap (en m/s²)
        tapThreshold: 15,
        // Fenêtre de temps pour double tap (ms)
        doubleTapWindow: 400,
        // Temps minimum entre deux détections (évite les faux positifs)
        debounceTime: 200,
        // Nombre de taps requis pour déclencher
        requiredTaps: 2,
        // Fréquence d'échantillonnage (ms)
        sampleRate: 50,
        // Activer les logs de debug
        debug: false
    },

    /**
     * État interne
     */
    state: {
        isRunning: false,
        isSupported: false,
        lastTapTime: 0,
        tapCount: 0,
        watchId: null,
        useCapacitor: false,
        permissionGranted: false
    },

    /**
     * Callbacks
     */
    callbacks: {
        onDoubleTap: null,
        onTripleTap: null,
        onTap: null,
        onError: null
    },

    /**
     * Initialiser le détecteur
     * @param {Object} options - Configuration et callbacks
     */
    async init(options = {}) {
        // Merge config
        if (options.config) {
            this.config = { ...this.config, ...options.config };
        }

        // Set callbacks
        if (options.onDoubleTap) this.callbacks.onDoubleTap = options.onDoubleTap;
        if (options.onTripleTap) this.callbacks.onTripleTap = options.onTripleTap;
        if (options.onTap) this.callbacks.onTap = options.onTap;
        if (options.onError) this.callbacks.onError = options.onError;

        // Détecter le support
        await this.detectSupport();

        if (this.config.debug) {
            console.log('[BackTap] Initialized', {
                isSupported: this.state.isSupported,
                useCapacitor: this.state.useCapacitor
            });
        }

        return this.state.isSupported;
    },

    /**
     * Détecter le support de l'accéléromètre
     */
    async detectSupport() {
        // Vérifier Capacitor Motion plugin
        if (window.Capacitor?.isPluginAvailable('Motion')) {
            this.state.useCapacitor = true;
            this.state.isSupported = true;
            return;
        }

        // Fallback: Web DeviceMotion API
        if ('DeviceMotionEvent' in window) {
            // iOS 13+ nécessite une permission
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    this.state.permissionGranted = permission === 'granted';
                    this.state.isSupported = this.state.permissionGranted;
                } catch (e) {
                    console.warn('[BackTap] Permission denied:', e);
                    this.state.isSupported = false;
                }
            } else {
                // Android et autres
                this.state.isSupported = true;
                this.state.permissionGranted = true;
            }
        } else {
            this.state.isSupported = false;
        }
    },

    /**
     * Demander la permission (iOS 13+)
     */
    async requestPermission() {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                this.state.permissionGranted = permission === 'granted';
                this.state.isSupported = this.state.permissionGranted;
                return this.state.permissionGranted;
            } catch (e) {
                console.error('[BackTap] Permission request failed:', e);
                return false;
            }
        }
        return true;
    },

    /**
     * Démarrer la détection
     */
    async start() {
        if (!this.state.isSupported) {
            console.warn('[BackTap] Not supported on this device');
            return false;
        }

        if (this.state.isRunning) {
            return true;
        }

        if (this.state.useCapacitor) {
            return this.startCapacitor();
        } else {
            return this.startWebAPI();
        }
    },

    /**
     * Démarrer avec Capacitor Motion plugin
     */
    async startCapacitor() {
        try {
            const { Motion } = await import('@capacitor/motion');

            this.state.watchId = await Motion.addListener('accel', (event) => {
                this.processAcceleration(event.acceleration);
            });

            this.state.isRunning = true;
            console.log('[BackTap] Started (Capacitor)');
            return true;
        } catch (e) {
            console.error('[BackTap] Capacitor start failed:', e);
            this.callbacks.onError?.(e);
            return false;
        }
    },

    /**
     * Démarrer avec Web DeviceMotion API
     */
    startWebAPI() {
        try {
            window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
            this.state.isRunning = true;
            console.log('[BackTap] Started (Web API)');
            return true;
        } catch (e) {
            console.error('[BackTap] Web API start failed:', e);
            this.callbacks.onError?.(e);
            return false;
        }
    },

    /**
     * Handler pour DeviceMotion event
     */
    handleDeviceMotion(event) {
        if (!event.acceleration) return;
        this.processAcceleration(event.acceleration);
    },

    /**
     * Traiter les données d'accélération
     */
    processAcceleration(acceleration) {
        if (!acceleration) return;

        const { x, y, z } = acceleration;

        // Calculer la magnitude totale de l'accélération
        const magnitude = Math.sqrt(x * x + y * y + z * z);

        if (this.config.debug && magnitude > 10) {
            console.log('[BackTap] Acceleration:', magnitude.toFixed(2));
        }

        // Détecter un pic d'accélération (tap)
        if (magnitude > this.config.tapThreshold) {
            this.handleTap();
        }
    },

    /**
     * Gérer la détection d'un tap
     */
    handleTap() {
        const now = Date.now();
        const timeSinceLastTap = now - this.state.lastTapTime;

        // Debounce pour éviter les détections multiples du même tap
        if (timeSinceLastTap < this.config.debounceTime) {
            return;
        }

        // Vérifier si c'est dans la fenêtre de double tap
        if (timeSinceLastTap < this.config.doubleTapWindow) {
            this.state.tapCount++;
        } else {
            // Nouveau cycle de taps
            this.state.tapCount = 1;
        }

        this.state.lastTapTime = now;

        if (this.config.debug) {
            console.log('[BackTap] Tap detected, count:', this.state.tapCount);
        }

        // Callback pour chaque tap
        this.callbacks.onTap?.(this.state.tapCount);

        // Vérifier les seuils
        if (this.state.tapCount === 2) {
            console.log('[BackTap] DOUBLE TAP DETECTED!');
            this.callbacks.onDoubleTap?.();
        } else if (this.state.tapCount === 3) {
            console.log('[BackTap] TRIPLE TAP DETECTED!');
            this.callbacks.onTripleTap?.();
        }
    },

    /**
     * Arrêter la détection
     */
    async stop() {
        if (!this.state.isRunning) {
            return;
        }

        if (this.state.useCapacitor && this.state.watchId) {
            await this.state.watchId.remove();
            this.state.watchId = null;
        } else {
            window.removeEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
        }

        this.state.isRunning = false;
        this.state.tapCount = 0;
        console.log('[BackTap] Stopped');
    },

    /**
     * Vérifier si le détecteur est actif
     */
    isRunning() {
        return this.state.isRunning;
    },

    /**
     * Vérifier si le détecteur est supporté
     */
    isSupported() {
        return this.state.isSupported;
    }
};

// Export global
window.BackTapDetector = BackTapDetector;

// Support ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackTapDetector;
}

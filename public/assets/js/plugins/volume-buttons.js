/**
 * SHIELD Volume Buttons Plugin
 *
 * Capacitor plugin wrapper for detecting volume button presses
 * Provides both native (via App plugin) and web fallback
 */

const VolumeButtonsPlugin = {
    /**
     * State
     */
    state: {
        isListening: false,
        isNative: false,
        holdStart: null,
        holdButton: null
    },

    /**
     * Handlers
     */
    handlers: {
        onVolumeUp: null,
        onVolumeDown: null,
        onHoldStart: null,
        onHoldProgress: null,
        onHoldComplete: null,
        onHoldCancel: null
    },

    /**
     * Hold timer
     */
    holdTimer: null,
    progressInterval: null,

    /**
     * Configuration
     */
    config: {
        holdDuration: 3000, // ms
        progressInterval: 50 // ms
    },

    /**
     * Initialize plugin
     */
    async init(config = {}) {
        Object.assign(this.config, config);

        this.state.isNative = window.Capacitor?.isNativePlatform() || false;

        if (this.state.isNative) {
            await this.initNative();
        } else {
            this.initWeb();
        }

        console.log('[VolumeButtons] Initialized', { isNative: this.state.isNative });
    },

    /**
     * Initialize native listeners
     */
    async initNative() {
        const { App } = window.Capacitor?.Plugins || {};

        if (!App) {
            console.warn('[VolumeButtons] App plugin not available');
            this.initWeb(); // Fallback to web
            return;
        }

        // Listen for hardware back button (Android)
        // Note: Volume buttons require a custom native plugin
        // For now, we use App plugin events as a workaround

        // On Android, we can intercept volume via a custom plugin
        // This is a placeholder for when the native plugin is built
        if (window.Plugins?.VolumeButtons) {
            window.Plugins.VolumeButtons.addListener('volumeUp', () => {
                this.handleVolumePress('up');
            });

            window.Plugins.VolumeButtons.addListener('volumeDown', () => {
                this.handleVolumePress('down');
            });

            window.Plugins.VolumeButtons.addListener('volumeUpReleased', () => {
                this.handleVolumeRelease('up');
            });

            window.Plugins.VolumeButtons.addListener('volumeDownReleased', () => {
                this.handleVolumeRelease('down');
            });

            this.state.isListening = true;
        } else {
            // Fallback: use web detection
            this.initWeb();
        }
    },

    /**
     * Initialize web listeners (keyboard simulation)
     */
    initWeb() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        this.state.isListening = true;
    },

    /**
     * Handle key down (web)
     */
    handleKeyDown(e) {
        // Volume keys
        if (e.key === 'AudioVolumeUp') {
            e.preventDefault();
            this.handleVolumePress('up');
        } else if (e.key === 'AudioVolumeDown') {
            e.preventDefault();
            this.handleVolumePress('down');
        }
        // Arrow keys for testing on desktop
        else if (e.key === 'ArrowUp' && e.shiftKey) {
            this.handleVolumePress('up');
        } else if (e.key === 'ArrowDown' && e.shiftKey) {
            this.handleVolumePress('down');
        }
    },

    /**
     * Handle key up (web)
     */
    handleKeyUp(e) {
        if (e.key === 'AudioVolumeUp' || (e.key === 'ArrowUp' && e.shiftKey)) {
            this.handleVolumeRelease('up');
        } else if (e.key === 'AudioVolumeDown' || (e.key === 'ArrowDown' && e.shiftKey)) {
            this.handleVolumeRelease('down');
        }
    },

    /**
     * Handle volume button press
     */
    handleVolumePress(button) {
        // Trigger immediate callback
        if (button === 'up' && this.handlers.onVolumeUp) {
            this.handlers.onVolumeUp();
        } else if (button === 'down' && this.handlers.onVolumeDown) {
            this.handlers.onVolumeDown();
        }

        // Start hold detection if not already holding
        if (!this.state.holdStart) {
            this.state.holdStart = Date.now();
            this.state.holdButton = button;

            // Callback
            if (this.handlers.onHoldStart) {
                this.handlers.onHoldStart(button);
            }

            // Start progress interval
            this.progressInterval = setInterval(() => {
                this.updateHoldProgress();
            }, this.config.progressInterval);

            // Set completion timer
            this.holdTimer = setTimeout(() => {
                this.completeHold();
            }, this.config.holdDuration);
        }
    },

    /**
     * Handle volume button release
     */
    handleVolumeRelease(button) {
        if (this.state.holdStart && this.state.holdButton === button) {
            this.cancelHold();
        }
    },

    /**
     * Update hold progress
     */
    updateHoldProgress() {
        if (!this.state.holdStart) return;

        const elapsed = Date.now() - this.state.holdStart;
        const percent = Math.min((elapsed / this.config.holdDuration) * 100, 100);

        if (this.handlers.onHoldProgress) {
            this.handlers.onHoldProgress({
                button: this.state.holdButton,
                elapsed,
                total: this.config.holdDuration,
                percent
            });
        }
    },

    /**
     * Complete hold (reached duration)
     */
    completeHold() {
        const button = this.state.holdButton;

        this.clearTimers();
        this.state.holdStart = null;
        this.state.holdButton = null;

        // Vibrate on complete
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        if (this.handlers.onHoldComplete) {
            this.handlers.onHoldComplete(button);
        }
    },

    /**
     * Cancel hold (released early)
     */
    cancelHold() {
        const button = this.state.holdButton;

        this.clearTimers();
        this.state.holdStart = null;
        this.state.holdButton = null;

        if (this.handlers.onHoldCancel) {
            this.handlers.onHoldCancel(button);
        }
    },

    /**
     * Clear timers
     */
    clearTimers() {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    },

    /**
     * Set handlers
     */
    setHandlers(handlers) {
        Object.assign(this.handlers, handlers);
    },

    /**
     * Set hold duration
     */
    setHoldDuration(ms) {
        this.config.holdDuration = ms;
    },

    /**
     * Check if listening
     */
    isListening() {
        return this.state.isListening;
    },

    /**
     * Check if currently holding
     */
    isHolding() {
        return this.state.holdStart !== null;
    },

    /**
     * Destroy plugin
     */
    destroy() {
        this.clearTimers();
        this.state.isListening = false;
        // Note: event listeners persist
    }
};

// Export globally
window.VolumeButtonsPlugin = VolumeButtonsPlugin;

export default VolumeButtonsPlugin;

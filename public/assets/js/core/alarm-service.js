/**
 * SHIELD - Alarm Service
 *
 * Service pour jouer des alarmes sonores fortes.
 * Utilise Web Audio API pour un contrôle précis du volume et des effets.
 *
 * Usage:
 *   await AlarmService.init();
 *   AlarmService.playPanicAlarm(); // Sirène forte
 *   AlarmService.stop();
 */

const AlarmService = {
    /**
     * Configuration
     */
    config: {
        // Volume de l'alarme (0.0 à 1.0)
        volume: 1.0,
        // Durée maximale de l'alarme (ms) - 0 = infini
        maxDuration: 60000,
        // Fréquences pour la sirène (Hz)
        sirenFrequencies: [800, 1200],
        // Vitesse d'oscillation de la sirène (Hz)
        sirenOscillationSpeed: 2,
        // Pattern de vibration (ms) - [vibrate, pause, vibrate, pause...]
        vibrationPattern: [500, 200, 500, 200, 1000, 500]
    },

    /**
     * État interne
     */
    state: {
        isPlaying: false,
        audioContext: null,
        oscillator: null,
        gainNode: null,
        lfoNode: null,
        stopTimeout: null,
        audioElement: null
    },

    /**
     * Sons pré-définis
     */
    sounds: {
        panic: '/assets/audio/alarm-siren.mp3',
        beep: '/assets/audio/beep-alert.mp3',
        countdown: '/assets/audio/countdown-tick.mp3'
    },

    /**
     * Configurations des sons d'alarme synthétiques
     */
    alarmTypes: {
        siren: {
            frequencies: [800, 1200],
            oscillationSpeed: 2,
            waveType: 'sawtooth',
            distortion: 200
        },
        horn: {
            frequencies: [400, 500],
            oscillationSpeed: 0.5,
            waveType: 'square',
            distortion: 100
        },
        alarm: {
            frequencies: [600, 900],
            oscillationSpeed: 4,
            waveType: 'triangle',
            distortion: 50
        },
        whistle: {
            frequencies: [2000, 2500],
            oscillationSpeed: 8,
            waveType: 'sine',
            distortion: 0
        },
        voice: {
            // La voix utilise un fichier audio
            audioFile: '/assets/audio/help-voice.mp3',
            useFile: true
        }
    },

    /**
     * Initialiser le service
     */
    async init() {
        // Créer le contexte audio
        try {
            this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[AlarmService] Initialized');
            return true;
        } catch (e) {
            console.error('[AlarmService] Failed to init AudioContext:', e);
            return false;
        }
    },

    /**
     * Jouer l'alarme de panique (sirène synthétique)
     * Son très fort et agressif pour faire fuir un agresseur
     */
    playPanicAlarm() {
        if (this.state.isPlaying) {
            return;
        }

        this.ensureAudioContext();

        const ctx = this.state.audioContext;
        if (!ctx) {
            console.error('[AlarmService] No audio context');
            return;
        }

        try {
            // Créer l'oscillateur principal (sirène)
            const oscillator = ctx.createOscillator();
            oscillator.type = 'sawtooth'; // Son agressif

            // Créer le gain (volume)
            const gainNode = ctx.createGain();
            gainNode.gain.value = this.config.volume;

            // Créer un LFO pour moduler la fréquence (effet sirène)
            const lfo = ctx.createOscillator();
            lfo.frequency.value = this.config.sirenOscillationSpeed;

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = (this.config.sirenFrequencies[1] - this.config.sirenFrequencies[0]) / 2;

            // Connecter le LFO
            lfo.connect(lfoGain);
            lfoGain.connect(oscillator.frequency);

            // Fréquence de base
            const baseFreq = (this.config.sirenFrequencies[0] + this.config.sirenFrequencies[1]) / 2;
            oscillator.frequency.value = baseFreq;

            // Ajouter de la distorsion pour un son plus agressif
            const distortion = ctx.createWaveShaper();
            distortion.curve = this.makeDistortionCurve(200);
            distortion.oversample = '4x';

            // Chaîne: oscillator -> distortion -> gain -> destination
            oscillator.connect(distortion);
            distortion.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Démarrer
            oscillator.start();
            lfo.start();

            // Sauvegarder les références
            this.state.oscillator = oscillator;
            this.state.gainNode = gainNode;
            this.state.lfoNode = lfo;
            this.state.isPlaying = true;

            // Vibration continue
            this.startVibration();

            // Auto-stop après durée max
            if (this.config.maxDuration > 0) {
                this.state.stopTimeout = setTimeout(() => {
                    this.stop();
                }, this.config.maxDuration);
            }

            console.log('[AlarmService] Panic alarm started');
        } catch (e) {
            console.error('[AlarmService] Failed to play panic alarm:', e);
        }
    },

    /**
     * Jouer un fichier audio (alarme pré-enregistrée)
     * @param {string} soundKey - Clé du son (panic, beep, countdown) ou URL
     */
    async playSound(soundKey) {
        const url = this.sounds[soundKey] || soundKey;

        if (this.state.audioElement) {
            this.state.audioElement.pause();
        }

        try {
            const audio = new Audio(url);
            audio.volume = this.config.volume;
            audio.loop = true;

            await audio.play();

            this.state.audioElement = audio;
            this.state.isPlaying = true;

            // Vibration
            this.startVibration();

            console.log('[AlarmService] Sound playing:', url);
        } catch (e) {
            console.error('[AlarmService] Failed to play sound:', e);
            // Fallback sur la sirène synthétique
            this.playPanicAlarm();
        }
    },

    /**
     * Arrêter l'alarme
     */
    stop() {
        // Arrêter l'oscillateur
        if (this.state.oscillator) {
            try {
                this.state.oscillator.stop();
                this.state.oscillator.disconnect();
            } catch (e) {
                // Ignore
            }
            this.state.oscillator = null;
        }

        // Arrêter le LFO
        if (this.state.lfoNode) {
            try {
                this.state.lfoNode.stop();
                this.state.lfoNode.disconnect();
            } catch (e) {
                // Ignore
            }
            this.state.lfoNode = null;
        }

        // Arrêter l'audio element
        if (this.state.audioElement) {
            this.state.audioElement.pause();
            this.state.audioElement.currentTime = 0;
            this.state.audioElement = null;
        }

        // Arrêter le timeout
        if (this.state.stopTimeout) {
            clearTimeout(this.state.stopTimeout);
            this.state.stopTimeout = null;
        }

        // Arrêter la vibration
        this.stopVibration();

        this.state.isPlaying = false;
        console.log('[AlarmService] Alarm stopped');
    },

    /**
     * Démarrer la vibration continue
     */
    startVibration() {
        if (!('vibrate' in navigator)) {
            return;
        }

        // Vibration en boucle
        const vibrate = () => {
            if (this.state.isPlaying) {
                navigator.vibrate(this.config.vibrationPattern);
                // Répéter
                const totalDuration = this.config.vibrationPattern.reduce((a, b) => a + b, 0);
                setTimeout(vibrate, totalDuration);
            }
        };

        vibrate();
    },

    /**
     * Arrêter la vibration
     */
    stopVibration() {
        if ('vibrate' in navigator) {
            navigator.vibrate(0);
        }
    },

    /**
     * S'assurer que le contexte audio est actif
     */
    ensureAudioContext() {
        if (!this.state.audioContext) {
            this.init();
        }

        // Reprendre si suspendu (nécessaire sur mobile après interaction)
        if (this.state.audioContext?.state === 'suspended') {
            this.state.audioContext.resume();
        }
    },

    /**
     * Créer une courbe de distorsion
     * @param {number} amount - Intensité de la distorsion
     */
    makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }

        return curve;
    },

    /**
     * Définir le volume
     * @param {number} volume - Volume de 0.0 à 1.0
     */
    setVolume(volume) {
        this.config.volume = Math.max(0, Math.min(1, volume));

        if (this.state.gainNode) {
            this.state.gainNode.gain.value = this.config.volume;
        }

        if (this.state.audioElement) {
            this.state.audioElement.volume = this.config.volume;
        }
    },

    /**
     * Vérifier si une alarme est en cours
     */
    isPlaying() {
        return this.state.isPlaying;
    },

    /**
     * Jouer un bip court (feedback)
     */
    beep(frequency = 800, duration = 200) {
        this.ensureAudioContext();

        const ctx = this.state.audioContext;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = frequency;
        osc.type = 'sine';
        gain.gain.value = 0.3;

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        setTimeout(() => {
            osc.stop();
            osc.disconnect();
        }, duration);
    },

    /**
     * Jouer l'alarme selon le type sélectionné par l'utilisateur
     * @param {string} alarmType - Type d'alarme (siren, horn, alarm, whistle, voice)
     */
    playAlarm(alarmType = 'siren') {
        const config = this.alarmTypes[alarmType];

        if (!config) {
            console.warn(`[AlarmService] Unknown alarm type: ${alarmType}, falling back to siren`);
            this.playPanicAlarm();
            return;
        }

        // Si c'est un fichier audio
        if (config.useFile && config.audioFile) {
            this.playSound(config.audioFile);
            return;
        }

        // Sinon, générer le son synthétique
        this.playSyntheticAlarm(config);
    },

    /**
     * Jouer une alarme synthétique avec configuration personnalisée
     */
    playSyntheticAlarm(config) {
        if (this.state.isPlaying) {
            return;
        }

        this.ensureAudioContext();

        const ctx = this.state.audioContext;
        if (!ctx) {
            console.error('[AlarmService] No audio context');
            return;
        }

        try {
            // Créer l'oscillateur principal
            const oscillator = ctx.createOscillator();
            oscillator.type = config.waveType || 'sawtooth';

            // Créer le gain (volume)
            const gainNode = ctx.createGain();
            gainNode.gain.value = this.config.volume;

            // Créer un LFO pour moduler la fréquence
            const lfo = ctx.createOscillator();
            lfo.frequency.value = config.oscillationSpeed || 2;

            const lfoGain = ctx.createGain();
            const freqRange = (config.frequencies[1] - config.frequencies[0]) / 2;
            lfoGain.gain.value = freqRange;

            // Connecter le LFO
            lfo.connect(lfoGain);
            lfoGain.connect(oscillator.frequency);

            // Fréquence de base
            const baseFreq = (config.frequencies[0] + config.frequencies[1]) / 2;
            oscillator.frequency.value = baseFreq;

            // Ajouter de la distorsion si configurée
            if (config.distortion > 0) {
                const distortion = ctx.createWaveShaper();
                distortion.curve = this.makeDistortionCurve(config.distortion);
                distortion.oversample = '4x';

                oscillator.connect(distortion);
                distortion.connect(gainNode);
            } else {
                oscillator.connect(gainNode);
            }

            gainNode.connect(ctx.destination);

            // Démarrer
            oscillator.start();
            lfo.start();

            // Sauvegarder les références
            this.state.oscillator = oscillator;
            this.state.gainNode = gainNode;
            this.state.lfoNode = lfo;
            this.state.isPlaying = true;

            // Vibration continue
            this.startVibration();

            // Auto-stop après durée max
            if (this.config.maxDuration > 0) {
                this.state.stopTimeout = setTimeout(() => {
                    this.stop();
                }, this.config.maxDuration);
            }

            console.log('[AlarmService] Synthetic alarm started');
        } catch (e) {
            console.error('[AlarmService] Failed to play synthetic alarm:', e);
        }
    },

    /**
     * Prévisualiser un son d'alarme (durée limitée)
     * @param {string} alarmType - Type d'alarme
     * @param {number} duration - Durée en ms (défaut 3000)
     */
    previewAlarmSound(alarmType = 'siren', duration = 3000) {
        this.playAlarm(alarmType);

        // Arrêter après la durée spécifiée
        setTimeout(() => {
            this.stop();
        }, duration);
    },

    /**
     * Obtenir le type d'alarme depuis les préférences utilisateur
     */
    getUserAlarmType() {
        try {
            const prefs = JSON.parse(localStorage.getItem('shield_alert_prefs') || '{}');
            return prefs.alarm_sound || 'siren';
        } catch {
            return 'siren';
        }
    }
};

// Export global
window.AlarmService = AlarmService;

// Support ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlarmService;
}

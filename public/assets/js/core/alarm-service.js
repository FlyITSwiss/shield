/**
 * SHIELD - Alarm Service v2.0
 *
 * Service pour jouer des alarmes sonores EXTRÊMEMENT FORTES.
 * Conçu pour faire fuir un agresseur - SON MAXIMUM, TERRIFIRANT.
 *
 * Utilise Web Audio API avec:
 * - Multi-oscillateurs pour son plus riche et plus fort
 * - Distorsion agressive
 * - Compression pour volume constant MAX
 * - Bypass du mode silencieux quand possible
 *
 * Usage:
 *   await AlarmService.init();
 *   AlarmService.playPanicAlarm(); // HURLE à volume MAX
 *   AlarmService.stop();
 */

const AlarmService = {
    /**
     * Configuration - VOLUME MAXIMUM
     */
    config: {
        // Volume MAXIMUM (1.0 = 100%)
        volume: 1.0,
        // Gain additionnel pour amplification (attention: peut saturer)
        boostGain: 3.0,
        // Durée maximale de l'alarme (ms) - 0 = infini
        maxDuration: 120000, // 2 minutes
        // Pattern de vibration AGRESSIF (ms)
        vibrationPattern: [200, 100, 200, 100, 400, 100, 200, 100, 200, 100, 400, 200]
    },

    /**
     * État interne
     */
    state: {
        isPlaying: false,
        audioContext: null,
        oscillators: [],
        gainNodes: [],
        masterGain: null,
        compressor: null,
        stopTimeout: null,
        audioElement: null,
        vibrationInterval: null
    },

    /**
     * Configurations des sons d'alarme - TOUS TERRIFIANTS
     * Chaque type utilise plusieurs oscillateurs pour un son plus riche et plus fort
     */
    alarmTypes: {
        // SIRÈNE DE POLICE - Son par défaut, très reconnaissable
        siren: {
            name: 'Sirène Police',
            layers: [
                { waveType: 'sawtooth', freqLow: 650, freqHigh: 1800, speed: 2, gain: 1.0 },
                { waveType: 'square', freqLow: 600, freqHigh: 1700, speed: 2.1, gain: 0.7 },
                { waveType: 'sawtooth', freqLow: 1300, freqHigh: 3600, speed: 4, gain: 0.4 }
            ],
            distortion: 400,
            pulseSpeed: 0 // Continu
        },
        // KLAXON DE CAMION - Grave et puissant
        horn: {
            name: 'Klaxon Camion',
            layers: [
                { waveType: 'sawtooth', freqLow: 180, freqHigh: 220, speed: 0.3, gain: 1.0 },
                { waveType: 'square', freqLow: 360, freqHigh: 440, speed: 0.3, gain: 0.8 },
                { waveType: 'sawtooth', freqLow: 540, freqHigh: 660, speed: 0.3, gain: 0.5 },
                { waveType: 'triangle', freqLow: 720, freqHigh: 880, speed: 0.3, gain: 0.3 }
            ],
            distortion: 300,
            pulseSpeed: 2 // Pulsation lente
        },
        // ALARME INCENDIE - Rapide et stridente
        alarm: {
            name: 'Alarme Incendie',
            layers: [
                { waveType: 'square', freqLow: 800, freqHigh: 1000, speed: 8, gain: 1.0 },
                { waveType: 'sawtooth', freqLow: 1600, freqHigh: 2000, speed: 8, gain: 0.6 },
                { waveType: 'square', freqLow: 2400, freqHigh: 3000, speed: 8, gain: 0.3 }
            ],
            distortion: 350,
            pulseSpeed: 4 // Pulsation rapide
        },
        // SIFFLET D'URGENCE - Très aigu, perçant
        whistle: {
            name: 'Sifflet Urgence',
            layers: [
                { waveType: 'sine', freqLow: 2800, freqHigh: 3500, speed: 6, gain: 1.0 },
                { waveType: 'sine', freqLow: 3200, freqHigh: 4000, speed: 7, gain: 0.8 },
                { waveType: 'triangle', freqLow: 1400, freqHigh: 1750, speed: 6, gain: 0.5 }
            ],
            distortion: 150,
            pulseSpeed: 3
        },
        // VOIX "AU SECOURS" - Utilise fichier audio si disponible, sinon sirène
        voice: {
            name: 'Voix Au Secours',
            audioFile: '/assets/audio/help-voice.mp3',
            useFile: true,
            fallbackTo: 'siren'
        }
    },

    /**
     * Initialiser le service - Prépare tout pour réponse INSTANTANÉE
     */
    async init() {
        try {
            // Créer le contexte audio avec options pour mobile
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.state.audioContext = new AudioContext({
                latencyHint: 'interactive',
                sampleRate: 44100
            });

            // Créer le compresseur pour volume constant MAX
            this.state.compressor = this.state.audioContext.createDynamicsCompressor();
            this.state.compressor.threshold.value = -50;
            this.state.compressor.knee.value = 40;
            this.state.compressor.ratio.value = 12;
            this.state.compressor.attack.value = 0;
            this.state.compressor.release.value = 0.25;
            this.state.compressor.connect(this.state.audioContext.destination);

            // Master gain pour boost global
            this.state.masterGain = this.state.audioContext.createGain();
            this.state.masterGain.gain.value = this.config.boostGain;
            this.state.masterGain.connect(this.state.compressor);

            console.log('[AlarmService] Initialized - MAXIMUM VOLUME READY');
            return true;
        } catch (e) {
            console.error('[AlarmService] Failed to init AudioContext:', e);
            return false;
        }
    },

    /**
     * JOUER L'ALARME DE PANIQUE - SON MAXIMUM TERRIFIRANT
     * Utilise le type d'alarme sélectionné par l'utilisateur
     */
    playPanicAlarm() {
        const alarmType = this.getUserAlarmType();
        this.playAlarm(alarmType);
    },

    /**
     * Jouer une alarme selon le type
     * @param {string} alarmType - Type d'alarme
     */
    playAlarm(alarmType = 'siren') {
        if (this.state.isPlaying) {
            return;
        }

        const config = this.alarmTypes[alarmType];

        if (!config) {
            console.warn(`[AlarmService] Unknown type: ${alarmType}, using siren`);
            this.playAlarm('siren');
            return;
        }

        // Si fichier audio
        if (config.useFile && config.audioFile) {
            this.playAudioFile(config.audioFile, config.fallbackTo);
            return;
        }

        // Générer le son synthétique TERRIFIANT
        this.playSyntheticAlarm(config);
    },

    /**
     * Jouer une alarme synthétique multi-couches - SON MAXIMUM
     */
    playSyntheticAlarm(config) {
        this.ensureAudioContext();

        const ctx = this.state.audioContext;
        if (!ctx) {
            console.error('[AlarmService] No audio context');
            return;
        }

        try {
            // Nettoyer les précédents oscillateurs
            this.stopOscillators();

            // Créer la distorsion AGRESSIVE
            const distortion = ctx.createWaveShaper();
            distortion.curve = this.makeDistortionCurve(config.distortion || 400);
            distortion.oversample = '4x';
            distortion.connect(this.state.masterGain);

            // Créer chaque couche de son
            config.layers.forEach((layer, index) => {
                // Oscillateur principal
                const osc = ctx.createOscillator();
                osc.type = layer.waveType;

                // Gain pour cette couche
                const layerGain = ctx.createGain();
                layerGain.gain.value = layer.gain * this.config.volume;

                // LFO pour modulation de fréquence (effet sirène)
                const lfo = ctx.createOscillator();
                lfo.frequency.value = layer.speed;

                const lfoGain = ctx.createGain();
                const freqRange = (layer.freqHigh - layer.freqLow) / 2;
                lfoGain.gain.value = freqRange;

                // Fréquence de base
                const baseFreq = (layer.freqLow + layer.freqHigh) / 2;
                osc.frequency.value = baseFreq;

                // Connecter LFO -> fréquence oscillateur
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);

                // Connecter oscillateur -> gain -> distorsion
                osc.connect(layerGain);
                layerGain.connect(distortion);

                // Démarrer
                osc.start();
                lfo.start();

                // Sauvegarder références
                this.state.oscillators.push(osc, lfo);
                this.state.gainNodes.push(layerGain, lfoGain);
            });

            // Pulsation si configurée (effet stroboscopique sonore)
            if (config.pulseSpeed > 0) {
                this.startPulse(config.pulseSpeed);
            }

            this.state.isPlaying = true;

            // Vibration AGRESSIVE
            this.startVibration();

            // Auto-stop après durée max
            if (this.config.maxDuration > 0) {
                this.state.stopTimeout = setTimeout(() => {
                    this.stop();
                }, this.config.maxDuration);
            }

            console.log(`[AlarmService] 🔊 ALARM STARTED - ${config.name || 'Unknown'} - MAXIMUM VOLUME`);

        } catch (e) {
            console.error('[AlarmService] Failed to play alarm:', e);
        }
    },

    /**
     * Jouer un fichier audio avec fallback
     */
    async playAudioFile(url, fallbackType) {
        if (this.state.audioElement) {
            this.state.audioElement.pause();
        }

        try {
            const audio = new Audio(url);
            audio.volume = 1.0; // MAXIMUM
            audio.loop = true;
            audio.playbackRate = 1.0;

            // Essayer de jouer même en mode silencieux (iOS)
            audio.muted = false;

            await audio.play();

            this.state.audioElement = audio;
            this.state.isPlaying = true;

            // Vibration
            this.startVibration();

            console.log('[AlarmService] Audio file playing:', url);

        } catch (e) {
            console.error('[AlarmService] Failed to play audio file:', e);
            // Fallback sur synthétique
            if (fallbackType && this.alarmTypes[fallbackType]) {
                this.playSyntheticAlarm(this.alarmTypes[fallbackType]);
            } else {
                this.playSyntheticAlarm(this.alarmTypes.siren);
            }
        }
    },

    /**
     * Effet de pulsation (volume qui pulse)
     */
    startPulse(speed) {
        if (!this.state.masterGain) return;

        const ctx = this.state.audioContext;
        const now = ctx.currentTime;

        // Créer un LFO pour le volume
        const pulseLfo = ctx.createOscillator();
        pulseLfo.type = 'sine';
        pulseLfo.frequency.value = speed;

        const pulseGain = ctx.createGain();
        pulseGain.gain.value = this.config.boostGain * 0.3; // Variation de 30%

        pulseLfo.connect(pulseGain);
        pulseGain.connect(this.state.masterGain.gain);

        pulseLfo.start();

        this.state.oscillators.push(pulseLfo);
        this.state.gainNodes.push(pulseGain);
    },

    /**
     * Arrêter l'alarme
     */
    stop() {
        // Arrêter tous les oscillateurs
        this.stopOscillators();

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
     * Arrêter tous les oscillateurs
     */
    stopOscillators() {
        this.state.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
                // Ignore
            }
        });
        this.state.oscillators = [];

        this.state.gainNodes.forEach(gain => {
            try {
                gain.disconnect();
            } catch (e) {
                // Ignore
            }
        });
        this.state.gainNodes = [];
    },

    /**
     * Vibration AGRESSIVE continue
     */
    startVibration() {
        if (!('vibrate' in navigator)) {
            return;
        }

        // Arrêter l'ancienne vibration
        this.stopVibration();

        // Vibration en boucle
        const vibrate = () => {
            if (this.state.isPlaying) {
                navigator.vibrate(this.config.vibrationPattern);
            }
        };

        vibrate();
        const totalDuration = this.config.vibrationPattern.reduce((a, b) => a + b, 0);
        this.state.vibrationInterval = setInterval(vibrate, totalDuration);
    },

    /**
     * Arrêter la vibration
     */
    stopVibration() {
        if (this.state.vibrationInterval) {
            clearInterval(this.state.vibrationInterval);
            this.state.vibrationInterval = null;
        }
        if ('vibrate' in navigator) {
            navigator.vibrate(0);
        }
    },

    /**
     * S'assurer que le contexte audio est actif et au MAXIMUM
     */
    ensureAudioContext() {
        if (!this.state.audioContext) {
            this.init();
        }

        // Reprendre si suspendu (CRUCIAL sur mobile)
        if (this.state.audioContext?.state === 'suspended') {
            this.state.audioContext.resume().then(() => {
                console.log('[AlarmService] AudioContext resumed - READY TO SCREAM');
            });
        }
    },

    /**
     * Créer une courbe de distorsion AGRESSIVE
     * Plus le amount est élevé, plus le son est saturé et agressif
     */
    makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Formule de distorsion agressive
            curve[i] = ((3 + amount) * x * 57 * deg) / (Math.PI + amount * Math.abs(x));
        }

        return curve;
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
    beep(frequency = 1000, duration = 150) {
        this.ensureAudioContext();

        const ctx = this.state.audioContext;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = frequency;
        osc.type = 'square';
        gain.gain.value = 0.5;

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        setTimeout(() => {
            osc.stop();
            osc.disconnect();
        }, duration);
    },

    /**
     * Prévisualiser un son d'alarme (durée limitée, volume réduit)
     * @param {string} alarmType - Type d'alarme
     * @param {number} duration - Durée en ms (défaut 3000)
     */
    previewAlarmSound(alarmType = 'siren', duration = 3000) {
        // Réduire le volume pour la preview (50%)
        const originalBoost = this.config.boostGain;
        this.config.boostGain = 1.5;

        if (this.state.masterGain) {
            this.state.masterGain.gain.value = 1.5;
        }

        this.playAlarm(alarmType);

        // Arrêter et restaurer après la durée
        setTimeout(() => {
            this.stop();
            this.config.boostGain = originalBoost;
            if (this.state.masterGain) {
                this.state.masterGain.gain.value = originalBoost;
            }
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
    },

    /**
     * Forcer le volume système au maximum (si possible)
     * Note: Limité par les navigateurs pour raisons de sécurité
     */
    async tryMaximizeSystemVolume() {
        // Sur certains appareils Android avec Capacitor/Cordova
        if (window.cordova?.plugins?.volume) {
            try {
                window.cordova.plugins.volume.setVolume(1.0);
            } catch (e) {
                console.warn('[AlarmService] Could not set system volume');
            }
        }

        // Essayer l'API Screen Wake Lock pour garder l'écran allumé
        if ('wakeLock' in navigator) {
            try {
                await navigator.wakeLock.request('screen');
                console.log('[AlarmService] Screen wake lock acquired');
            } catch (e) {
                console.warn('[AlarmService] Could not acquire wake lock');
            }
        }
    }
};

// Export global
window.AlarmService = AlarmService;

// Support ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlarmService;
}

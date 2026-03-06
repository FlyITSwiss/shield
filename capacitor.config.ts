import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.shield.app',
    appName: 'SHIELD',
    webDir: 'public',
    bundledWebRuntime: false,

    // Configuration serveur
    server: {
        // En dev, pointer vers le serveur local
        url: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1' : undefined,
        cleartext: process.env.NODE_ENV === 'development',
        androidScheme: 'https',
    },

    // Plugins configuration
    plugins: {
        // Geolocalisation - critique pour SHIELD
        Geolocation: {
            // Demander permission haute precision
            enableHighAccuracy: true,
            // Timeout 10s
            timeout: 10000,
            // Cache 5 minutes max
            maximumAge: 300000,
        },

        // Push Notifications - Firebase
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },

        // Local Notifications - Alarmes
        LocalNotifications: {
            smallIcon: 'ic_stat_shield',
            iconColor: '#8E24AA',
            sound: 'alarm_siren.wav',
        },

        // Splash Screen
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#1A1A2E',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
        },

        // Status Bar
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#1A1A2E',
        },

        // Haptics - Retour tactile SOS
        Haptics: {
            // Utiliser vibrations fortes pour SOS
        },
    },

    // Configuration Android
    android: {
        // Permettre les connexions HTTP en dev
        allowMixedContent: process.env.NODE_ENV === 'development',
        // Capture boutons volume
        captureInput: true,
        // Garder l'app en arriere-plan
        backgroundColor: '#1A1A2E',
        // Build config
        buildOptions: {
            keystorePath: process.env.KEYSTORE_PATH,
            keystorePassword: process.env.KEYSTORE_PASSWORD,
            keystoreAlias: process.env.KEYSTORE_ALIAS,
            keystoreAliasPassword: process.env.KEYSTORE_ALIAS_PASSWORD,
        },
    },

    // Configuration iOS
    ios: {
        contentInset: 'automatic',
        backgroundColor: '#1A1A2E',
        // Scheme pour deep links
        scheme: 'shield',
    },
};

export default config;

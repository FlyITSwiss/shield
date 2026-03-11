/**
 * SHIELD - GeoLocation Service
 * Service de geolocalisation mobile-ready
 * Supporte GPS haute precision et tracking continu
 * Compatible Capacitor pour app native
 */

'use strict';

const GeoLocationService = (function() {
    // Configuration
    const config = {
        // Options pour position unique (haute precision)
        singlePosition: {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        },
        // Options pour tracking continu SOS
        sosTracking: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 3000
        },
        // Options rapides (moins precis)
        quickPosition: {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000
        }
    };

    // Etat
    let watchId = null;
    let lastPosition = null;
    let isWatching = false;
    let permissionState = null;
    let onPositionUpdate = null;

    /**
     * Verifier si la geolocalisation est supportee
     */
    function isSupported() {
        return 'geolocation' in navigator;
    }

    /**
     * Verifier l'etat des permissions
     * @returns {Promise<string>} 'granted', 'denied', 'prompt' ou 'unsupported'
     */
    async function checkPermission() {
        if (!isSupported()) {
            return 'unsupported';
        }

        if ('permissions' in navigator) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                permissionState = result.state;

                result.onchange = () => {
                    permissionState = result.state;
                    console.log('[GeoLocation] Permission changed:', result.state);
                };

                return result.state;
            } catch (e) {
                return 'prompt';
            }
        }

        return 'prompt';
    }

    /**
     * Obtenir la position actuelle
     * @param {Object} options - Options de geolocalisation
     * @returns {Promise<Object>} Position avec lat, lng, accuracy, timestamp
     */
    function getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {
            if (!isSupported()) {
                reject(createError('UNSUPPORTED', 'Geolocalisation non supportee'));
                return;
            }

            const opts = { ...config.singlePosition, ...options };
            console.log('[GeoLocation] Getting current position...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = formatPosition(position);
                    lastPosition = location;
                    console.log('[GeoLocation] Position found:', location.lat, location.lng);
                    resolve(location);
                },
                (error) => {
                    const formattedError = handleGeolocationError(error);
                    console.warn('[GeoLocation] Error:', formattedError.message);
                    reject(formattedError);
                },
                opts
            );
        });
    }

    /**
     * Obtenir la position rapidement (moins precise)
     */
    function getQuickPosition() {
        return getCurrentPosition(config.quickPosition);
    }

    /**
     * Obtenir la position avec haute precision (GPS)
     */
    function getHighAccuracyPosition() {
        return getCurrentPosition(config.singlePosition);
    }

    /**
     * Demarrer le suivi de position pour SOS
     * @param {Function} callback - Appele a chaque mise a jour
     * @returns {number} watchId pour arreter le suivi
     */
    function startSOSTracking(callback) {
        if (!isSupported()) {
            console.warn('[GeoLocation] Not supported');
            return null;
        }

        // Arreter le watch existant
        stopTracking();

        console.log('[GeoLocation] Starting SOS tracking...');
        onPositionUpdate = callback;
        isWatching = true;

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = formatPosition(position);
                lastPosition = location;

                if (onPositionUpdate) {
                    onPositionUpdate(location, null);
                }
            },
            (error) => {
                const formattedError = handleGeolocationError(error);
                if (onPositionUpdate) {
                    onPositionUpdate(null, formattedError);
                }
            },
            config.sosTracking
        );

        return watchId;
    }

    /**
     * Arreter le suivi de position
     */
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            isWatching = false;
            onPositionUpdate = null;
            console.log('[GeoLocation] Tracking stopped');
        }
    }

    /**
     * Obtenir la derniere position connue
     */
    function getLastPosition() {
        return lastPosition;
    }

    /**
     * Verifier si le tracking est actif
     */
    function isTracking() {
        return isWatching;
    }

    /**
     * Reverse geocoding via Nominatim (adresse depuis coordonnees)
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<Object>} Adresse formatee
     */
    async function reverseGeocode(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': document.documentElement.lang || 'fr'
                }
            });

            if (!response.ok) throw new Error('Geocoding failed');

            const data = await response.json();

            return {
                displayName: data.display_name,
                shortName: formatShortAddress(data),
                address: data.address,
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lon)
            };
        } catch (error) {
            console.warn('[GeoLocation] Reverse geocoding error:', error);
            // Fallback: retourner les coordonnees
            return {
                displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                shortName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                address: null,
                lat, lng
            };
        }
    }

    /**
     * Calculer la distance entre deux points (Haversine)
     * @param {Object} pos1 - {lat, lng}
     * @param {Object} pos2 - {lat, lng}
     * @returns {number} Distance en metres
     */
    function calculateDistance(pos1, pos2) {
        const R = 6371000; // Rayon de la Terre en metres
        const lat1Rad = toRadians(pos1.lat);
        const lat2Rad = toRadians(pos2.lat);
        const deltaLat = toRadians(pos2.lat - pos1.lat);
        const deltaLng = toRadians(pos2.lng - pos1.lng);

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // === FONCTIONS UTILITAIRES ===

    function formatPosition(position) {
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp
        };
    }

    function formatShortAddress(data) {
        if (!data.address) return data.display_name;

        const addr = data.address;
        const parts = [];

        if (addr.house_number && addr.road) {
            parts.push(`${addr.house_number} ${addr.road}`);
        } else if (addr.road) {
            parts.push(addr.road);
        } else if (addr.pedestrian || addr.footway) {
            parts.push(addr.pedestrian || addr.footway);
        }

        const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
        if (city) {
            parts.push(city);
        }

        return parts.join(', ') || data.display_name;
    }

    function handleGeolocationError(error) {
        let message, code;

        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Permission de localisation refusee';
                code = 'PERMISSION_DENIED';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Position indisponible';
                code = 'POSITION_UNAVAILABLE';
                break;
            case error.TIMEOUT:
                message = 'Delai de localisation depasse';
                code = 'TIMEOUT';
                break;
            default:
                message = 'Erreur de localisation';
                code = 'UNKNOWN';
        }

        return createError(code, message, error);
    }

    function createError(code, message, originalError = null) {
        return {
            code,
            message,
            originalError,
            timestamp: Date.now()
        };
    }

    function toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // API publique
    return {
        isSupported,
        checkPermission,
        isTracking,
        getCurrentPosition,
        getQuickPosition,
        getHighAccuracyPosition,
        getLastPosition,
        startSOSTracking,
        stopTracking,
        reverseGeocode,
        calculateDistance,
        config
    };
})();

// Rendre disponible globalement
window.GeoLocationService = GeoLocationService;

/**
 * SHIELD - Map Controller
 * Carte Leaflet/OSM pour ecran SOS
 * Dark theme avec style Shield
 */

'use strict';

class ShieldMap {
    // Default center: Paris, France
    static DEFAULT_CENTER = [48.8566, 2.3522];
    static DEFAULT_ZOOM = 15;

    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.userMarker = null;
        this.accuracyCircle = null;
        this.isInitialized = false;
        this.options = {
            center: options.center || ShieldMap.DEFAULT_CENTER,
            zoom: options.zoom || ShieldMap.DEFAULT_ZOOM,
            darkMode: options.darkMode !== false, // Dark mode par defaut
            interactive: options.interactive !== false,
            ...options
        };
    }

    /**
     * Initialiser la carte
     */
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[ShieldMap] Container #${this.containerId} not found`);
            return this;
        }

        // Creer la carte
        this.map = L.map(this.containerId, {
            center: this.options.center,
            zoom: this.options.zoom,
            minZoom: 3,
            maxZoom: 19,
            zoomControl: false,
            attributionControl: false,
            dragging: this.options.interactive,
            touchZoom: this.options.interactive,
            scrollWheelZoom: this.options.interactive,
            doubleClickZoom: this.options.interactive
        });

        // Tile layer dark mode
        const tileUrl = this.options.darkMode
            ? 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
            maxZoom: 19,
            subdomains: this.options.darkMode ? 'abcd' : 'abc'
        }).addTo(this.map);

        this.isInitialized = true;
        console.log('[ShieldMap] Initialized');

        return this;
    }

    /**
     * Centrer sur une position
     */
    centerOn(lat, lng, zoom = null) {
        if (!this.map) return this;
        this.map.setView([lat, lng], zoom || this.map.getZoom());
        return this;
    }

    /**
     * Centrer sur la position actuelle de l'utilisateur
     * @returns {Promise<Object|null>} Location ou null
     */
    async centerOnCurrentLocation() {
        try {
            if (!window.GeoLocationService) {
                console.warn('[ShieldMap] GeoLocationService not available');
                return null;
            }

            const location = await window.GeoLocationService.getCurrentPosition();

            if (location) {
                this.centerOn(location.lat, location.lng, 16);
                this.updateUserMarker(location.lat, location.lng, location.accuracy);
                return location;
            }

            return null;
        } catch (error) {
            console.warn('[ShieldMap] Could not get location:', error.message);
            return null;
        }
    }

    /**
     * Mettre a jour le marqueur utilisateur avec cercle de precision
     */
    updateUserMarker(lat, lng, accuracy = null) {
        if (!this.map) return;

        // Supprimer l'ancien marqueur
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }

        // Icone personnalisee pulsante
        const userIcon = L.divIcon({
            html: `<div class="shield-user-marker">
                <span class="marker-pulse"></span>
                <span class="marker-dot"></span>
            </div>`,
            className: 'shield-marker-container',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        this.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(this.map);

        // Cercle de precision
        if (accuracy && accuracy < 500) {
            this.accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#E91E8C',
                fillColor: '#E91E8C',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(this.map);
        }

        return this;
    }

    /**
     * Animer le marqueur en mode SOS
     */
    setSOSMode(active = true) {
        const markerEl = document.querySelector('.shield-user-marker');
        if (markerEl) {
            if (active) {
                markerEl.classList.add('sos-active');
            } else {
                markerEl.classList.remove('sos-active');
            }
        }
        return this;
    }

    /**
     * Suivre la position en temps reel
     * @param {Function} onUpdate - Callback avec location
     */
    startTracking(onUpdate) {
        if (!window.GeoLocationService) {
            console.warn('[ShieldMap] GeoLocationService not available');
            return;
        }

        window.GeoLocationService.startSOSTracking((location, error) => {
            if (location) {
                this.updateUserMarker(location.lat, location.lng, location.accuracy);
                this.centerOn(location.lat, location.lng);

                if (onUpdate) {
                    onUpdate(location);
                }
            }
        });
    }

    /**
     * Arreter le tracking
     */
    stopTracking() {
        if (window.GeoLocationService) {
            window.GeoLocationService.stopTracking();
        }
    }

    /**
     * Redimensionner la carte (apres changement de taille du conteneur)
     */
    invalidateSize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
        return this;
    }

    /**
     * Obtenir l'instance Leaflet
     */
    getMap() {
        return this.map;
    }

    /**
     * Detruire la carte
     */
    destroy() {
        this.stopTracking();
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.userMarker = null;
            this.accuracyCircle = null;
            this.isInitialized = false;
        }
    }
}

// Export
window.ShieldMap = ShieldMap;

/**
 * SHIELD - Location Share Manager
 *
 * Gestion du partage de position en temps reel (Premium Feature)
 */

class LocationShareManager {
    constructor() {
        this.selectedType = 'realtime';
        this.selectedDuration = 60;
        this.selectedContacts = [];
        this.destination = null;
        this.map = null;
        this.watchId = null;
        this.currentPosition = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.initMap();
        this.startLocationTracking();
        this.updateSelectedContacts();
    }

    bindEvents() {
        // Share type selection
        document.querySelectorAll('.share-type-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectType(btn.dataset.type));
        });

        // Duration selection
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectDuration(parseInt(btn.dataset.duration)));
        });

        // Contact checkboxes
        document.querySelectorAll('input[name="contact_ids[]"]').forEach(cb => {
            cb.addEventListener('change', () => this.updateSelectedContacts());
        });

        // Start share button
        const startBtn = document.getElementById('btn-start-share');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startShare());
        }

        // Home address button
        const homeBtn = document.getElementById('btn-home-address');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.useHomeAddress());
        }

        // Destination search
        const searchInput = document.getElementById('destination-search');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.searchAddress(e.target.value), 500);
            });
        }

        // Share actions (pause/stop)
        document.querySelectorAll('[data-action="pause"]').forEach(btn => {
            btn.addEventListener('click', () => this.pauseShare(btn.dataset.shareId));
        });

        document.querySelectorAll('[data-action="stop"]').forEach(btn => {
            btn.addEventListener('click', () => this.stopShare(btn.dataset.shareId));
        });

        // Copy link button
        const copyBtn = document.getElementById('btn-copy-link');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyShareLink());
        }

        // Close modal button
        const closeBtn = document.getElementById('btn-close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
    }

    selectType(type) {
        this.selectedType = type;

        // Update UI
        document.querySelectorAll('.share-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Show/hide journey options
        const journeyOptions = document.getElementById('journey-options');
        const mapPreview = document.getElementById('map-preview');

        if (type === 'journey') {
            journeyOptions.style.display = 'block';
            mapPreview.style.display = 'block';
            if (this.map) {
                setTimeout(() => this.map.invalidateSize(), 100);
            }
        } else {
            journeyOptions.style.display = 'none';
            mapPreview.style.display = 'none';
        }
    }

    selectDuration(minutes) {
        this.selectedDuration = minutes;

        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.duration) === minutes);
        });
    }

    updateSelectedContacts() {
        const checkboxes = document.querySelectorAll('input[name="contact_ids[]"]:checked');
        this.selectedContacts = Array.from(checkboxes).map(cb => parseInt(cb.value));

        // Update start button state
        const startBtn = document.getElementById('btn-start-share');
        if (startBtn) {
            startBtn.disabled = this.selectedContacts.length === 0;
        }
    }

    initMap() {
        const mapContainer = document.getElementById('share-map');
        if (!mapContainer || typeof L === 'undefined') return;

        this.map = L.map('share-map').setView([46.8182, 8.2275], 8); // Switzerland center

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(this.map);
    }

    startLocationTracking() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.onPositionUpdate(position),
            (error) => console.error('Geolocation error:', error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }

    onPositionUpdate(position) {
        this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading
        };

        // Update map if visible
        if (this.map && this.selectedType === 'journey') {
            if (!this.currentMarker) {
                this.currentMarker = L.marker([position.coords.latitude, position.coords.longitude])
                    .addTo(this.map)
                    .bindPopup('Votre position');
            } else {
                this.currentMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
            }
        }
    }

    async searchAddress(query) {
        if (!query || query.length < 3) return;

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
            );
            const results = await response.json();

            // TODO: Show autocomplete results
            if (results.length > 0) {
                this.setDestination(results[0]);
            }
        } catch (error) {
            console.error('Address search failed:', error);
        }
    }

    setDestination(place) {
        this.destination = {
            name: place.display_name,
            latitude: parseFloat(place.lat),
            longitude: parseFloat(place.lon)
        };

        document.getElementById('destination-lat').value = this.destination.latitude;
        document.getElementById('destination-lng').value = this.destination.longitude;
        document.getElementById('destination-name').value = this.destination.name;
        document.getElementById('destination-search').value = this.destination.name.split(',')[0];

        // Update map
        if (this.map) {
            if (this.destinationMarker) {
                this.destinationMarker.setLatLng([this.destination.latitude, this.destination.longitude]);
            } else {
                this.destinationMarker = L.marker([this.destination.latitude, this.destination.longitude], {
                    icon: L.divIcon({
                        className: 'destination-marker',
                        html: '<div class="marker-pin"></div>',
                        iconSize: [30, 40],
                        iconAnchor: [15, 40]
                    })
                }).addTo(this.map).bindPopup('Destination');
            }

            // Fit bounds to show both markers
            if (this.currentMarker) {
                const group = L.featureGroup([this.currentMarker, this.destinationMarker]);
                this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
            } else {
                this.map.setView([this.destination.latitude, this.destination.longitude], 14);
            }
        }
    }

    useHomeAddress() {
        // Get home address from user settings
        const config = window.ShieldConfig || {};
        if (config.homeAddress) {
            this.setDestination(config.homeAddress);
        } else {
            this.showNotification('Adresse du domicile non configuree', 'warning');
        }
    }

    async startShare() {
        if (this.selectedContacts.length === 0) {
            this.showNotification('Selectionnez au moins un contact', 'warning');
            return;
        }

        if (!this.currentPosition) {
            this.showNotification('Position GPS non disponible', 'error');
            return;
        }

        if (this.selectedType === 'journey' && !this.destination) {
            this.showNotification('Selectionnez une destination', 'warning');
            return;
        }

        const startBtn = document.getElementById('btn-start-share');
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="spinner"></span> Creation...';

        try {
            const data = {
                type: this.selectedType,
                duration: this.selectedDuration,
                contact_ids: this.selectedContacts,
                update_interval: 30
            };

            if (this.selectedType === 'journey' && this.destination) {
                data.destination_name = this.destination.name;
                data.destination_latitude = this.destination.latitude;
                data.destination_longitude = this.destination.longitude;
                const etaMinutes = parseInt(document.getElementById('eta-minutes').value);
                const eta = new Date(Date.now() + etaMinutes * 60000);
                data.expected_arrival_at = eta.toISOString();
            }

            const response = await fetch(`${window.ShieldConfig.apiUrl}/location-share.php?action=create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showShareCreatedModal(result.share);
                this.startLocationUpdates(result.share.id);
            } else {
                this.showNotification(result.error || 'Erreur lors de la creation', 'error');
            }
        } catch (error) {
            console.error('Start share failed:', error);
            this.showNotification('Erreur de connexion', 'error');
        } finally {
            startBtn.disabled = false;
            startBtn.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                <span>Commencer le partage</span>
            `;
        }
    }

    startLocationUpdates(shareId) {
        // Send location updates every 30 seconds
        this.updateInterval = setInterval(async () => {
            if (!this.currentPosition) return;

            try {
                const battery = await this.getBatteryLevel();

                await fetch(`${window.ShieldConfig.apiUrl}/location-share.php?action=update-location`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.getToken()}`
                    },
                    body: JSON.stringify({
                        share_id: shareId,
                        ...this.currentPosition,
                        battery: battery
                    })
                });
            } catch (error) {
                console.error('Location update failed:', error);
            }
        }, 30000);
    }

    async getBatteryLevel() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                return Math.round(battery.level * 100);
            }
        } catch (e) {
            // Silently fail
        }
        return null;
    }

    showShareCreatedModal(share) {
        const modal = document.getElementById('share-created-modal');
        const urlInput = document.getElementById('share-url');

        urlInput.value = share.share_url;
        modal.style.display = 'flex';
    }

    closeModal() {
        document.getElementById('share-created-modal').style.display = 'none';
        window.location.reload(); // Refresh to show active share
    }

    async copyShareLink() {
        const urlInput = document.getElementById('share-url');
        try {
            await navigator.clipboard.writeText(urlInput.value);
            this.showNotification('Lien copie', 'success');
        } catch (e) {
            urlInput.select();
            document.execCommand('copy');
            this.showNotification('Lien copie', 'success');
        }
    }

    async pauseShare(shareId) {
        try {
            const response = await fetch(`${window.ShieldConfig.apiUrl}/location-share.php?action=pause`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify({ share_id: parseInt(shareId) })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Partage en pause', 'success');
                window.location.reload();
            } else {
                this.showNotification(result.error || 'Erreur', 'error');
            }
        } catch (error) {
            console.error('Pause failed:', error);
            this.showNotification('Erreur de connexion', 'error');
        }
    }

    async stopShare(shareId) {
        if (!confirm('Arreter ce partage ?')) return;

        try {
            const response = await fetch(`${window.ShieldConfig.apiUrl}/location-share.php?action=stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify({ share_id: parseInt(shareId) })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Partage arrete', 'success');
                if (this.updateInterval) {
                    clearInterval(this.updateInterval);
                }
                window.location.reload();
            } else {
                this.showNotification(result.error || 'Erreur', 'error');
            }
        } catch (error) {
            console.error('Stop failed:', error);
            this.showNotification('Erreur de connexion', 'error');
        }
    }

    getToken() {
        // Get token from localStorage or cookie
        return localStorage.getItem('shield_token') || '';
    }

    showNotification(message, type = 'info') {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    destroy() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.locationShareManager = new LocationShareManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.locationShareManager) {
        window.locationShareManager.destroy();
    }
});

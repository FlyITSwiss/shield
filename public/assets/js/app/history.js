/**
 * SHIELD History Page Module
 * Historique des incidents
 */

const HistoryPage = {
    /**
     * Elements DOM
     */
    elements: {},

    /**
     * State
     */
    state: {
        incidents: [],
        selectedIncident: null,
        filters: {
            status: '',
            period: '30'
        }
    },

    /**
     * Initialiser
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadIncidents();
    },

    /**
     * Cacher les elements DOM
     */
    cacheElements() {
        this.elements = {
            btnBack: document.getElementById('btn-back'),
            filterStatus: document.getElementById('filter-status'),
            filterPeriod: document.getElementById('filter-period'),
            historyList: document.getElementById('history-list'),
            loadingState: document.getElementById('loading-state'),
            emptyState: document.getElementById('empty-state'),
            // Modal detail
            incidentModal: document.getElementById('incident-modal'),
            btnModalClose: document.getElementById('btn-modal-close'),
            btnCloseModal: document.getElementById('btn-close-modal'),
            incidentStatus: document.getElementById('incident-status'),
            incidentDate: document.getElementById('incident-date'),
            incidentTimeline: document.getElementById('incident-timeline'),
            incidentMap: document.getElementById('incident-map'),
            incidentAddress: document.getElementById('incident-address'),
            contactsNotified: document.getElementById('contacts-notified'),
            notesSection: document.getElementById('notes-section'),
            incidentNotes: document.getElementById('incident-notes'),
            // Templates
            historyItemTemplate: document.getElementById('history-item-template'),
            timelineItemTemplate: document.getElementById('timeline-item-template')
        };
    },

    /**
     * Lier les evenements
     */
    bindEvents() {
        // Navigation
        this.elements.btnBack?.addEventListener('click', () => window.history.back());

        // Filtres
        this.elements.filterStatus?.addEventListener('change', () => this.applyFilters());
        this.elements.filterPeriod?.addEventListener('change', () => this.applyFilters());

        // Fermer modal
        this.elements.btnModalClose?.addEventListener('click', () => this.closeModal());
        this.elements.btnCloseModal?.addEventListener('click', () => this.closeModal());
        this.elements.incidentModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.incidentModal) this.closeModal();
        });
    },

    /**
     * Charger les incidents
     */
    async loadIncidents() {
        this.showLoading(true);

        try {
            const params = new URLSearchParams();
            if (this.state.filters.status) {
                params.append('status', this.state.filters.status);
            }
            if (this.state.filters.period) {
                params.append('days', this.state.filters.period);
            }

            const result = await window.ApiService.incidents.history(params.toString());

            if (result.success) {
                this.state.incidents = result.incidents || [];
                this.renderIncidents();
            } else {
                console.error('[History] Load error:', result.error);
            }
        } catch (error) {
            console.error('[History] Load error:', error);
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Appliquer les filtres
     */
    applyFilters() {
        this.state.filters.status = this.elements.filterStatus?.value || '';
        this.state.filters.period = this.elements.filterPeriod?.value || '';
        this.loadIncidents();
    },

    /**
     * Afficher/masquer le chargement
     */
    showLoading(show) {
        this.elements.loadingState?.classList.toggle('hidden', !show);
    },

    /**
     * Rendre la liste des incidents
     */
    renderIncidents() {
        // Supprimer les items existants
        const existingItems = this.elements.historyList?.querySelectorAll('.history-item');
        existingItems?.forEach(item => item.remove());

        if (this.state.incidents.length === 0) {
            this.elements.emptyState?.classList.remove('hidden');
            return;
        }

        this.elements.emptyState?.classList.add('hidden');

        // Creer les items
        this.state.incidents.forEach(incident => {
            const item = this.createHistoryItem(incident);
            this.elements.historyList?.appendChild(item);
        });
    },

    /**
     * Creer un element historique
     */
    createHistoryItem(incident) {
        const template = this.elements.historyItemTemplate;
        if (!template) {
            return this.createHistoryItemFallback(incident);
        }

        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.history-item');

        item.dataset.id = incident.id;

        // Status
        const statusEl = item.querySelector('.history-item-status');
        statusEl.textContent = this.getStatusLabel(incident.status);
        statusEl.className = `history-item-status status-${incident.status}`;

        // Duration
        const durationEl = item.querySelector('.history-item-duration');
        if (incident.duration_seconds) {
            durationEl.textContent = this.formatDuration(incident.duration_seconds);
        } else {
            durationEl.remove();
        }

        // Date
        const dateEl = item.querySelector('.history-item-date');
        dateEl.textContent = this.formatDate(incident.created_at);

        // Location
        const locationEl = item.querySelector('.history-item-location');
        locationEl.textContent = incident.address || window.__('history.location_unknown');

        // Icon selon status
        const iconEl = item.querySelector('.history-item-icon svg');
        if (incident.status === 'resolved') {
            iconEl.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>';
        } else if (incident.status === 'escalated') {
            iconEl.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>';
        } else if (incident.status === 'cancelled') {
            iconEl.innerHTML = '<path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>';
        }

        // Click
        item.addEventListener('click', () => this.openIncidentModal(incident));

        return item;
    },

    /**
     * Fallback si template absent
     */
    createHistoryItemFallback(incident) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.dataset.id = incident.id;
        div.innerHTML = `
            <div class="history-item-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div class="history-item-content">
                <div class="history-item-header">
                    <span class="history-item-status status-${incident.status}">${this.getStatusLabel(incident.status)}</span>
                    ${incident.duration_seconds ? `<span class="history-item-duration">${this.formatDuration(incident.duration_seconds)}</span>` : ''}
                </div>
                <p class="history-item-date">${this.formatDate(incident.created_at)}</p>
                <p class="history-item-location">${incident.address || window.__('history.location_unknown')}</p>
            </div>
            <div class="history-item-arrow">
                <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;
        div.addEventListener('click', () => this.openIncidentModal(incident));
        return div;
    },

    /**
     * Ouvrir modal detail
     */
    openIncidentModal(incident) {
        this.state.selectedIncident = incident;

        // Status
        if (this.elements.incidentStatus) {
            this.elements.incidentStatus.textContent = this.getStatusLabel(incident.status);
            this.elements.incidentStatus.className = `incident-status status-${incident.status}`;
        }

        // Date
        if (this.elements.incidentDate) {
            this.elements.incidentDate.textContent = this.formatDate(incident.created_at);
        }

        // Timeline
        this.renderTimeline(incident);

        // Address
        if (this.elements.incidentAddress) {
            this.elements.incidentAddress.textContent = incident.address || window.__('history.location_unknown');
        }

        // Contacts notifies
        this.renderContactsNotified(incident.contacts_notified || []);

        // Notes
        if (incident.notes) {
            this.elements.notesSection?.classList.remove('hidden');
            if (this.elements.incidentNotes) {
                this.elements.incidentNotes.textContent = incident.notes;
            }
        } else {
            this.elements.notesSection?.classList.add('hidden');
        }

        this.elements.incidentModal?.classList.remove('hidden');
    },

    /**
     * Rendre la timeline
     */
    renderTimeline(incident) {
        if (!this.elements.incidentTimeline) return;

        this.elements.incidentTimeline.innerHTML = '';

        const events = [
            { time: incident.created_at, text: window.__('history.alert_triggered') },
        ];

        if (incident.contacts_notified_at) {
            events.push({ time: incident.contacts_notified_at, text: window.__('history.contacts_alerted') });
        }

        if (incident.escalated_at) {
            events.push({ time: incident.escalated_at, text: window.__('history.escalated_police') });
        }

        if (incident.resolved_at) {
            events.push({ time: incident.resolved_at, text: window.__('history.confirmed_safe') });
        }

        if (incident.cancelled_at) {
            events.push({ time: incident.cancelled_at, text: window.__('history.alert_cancelled') });
        }

        events.forEach(event => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            item.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <span class="timeline-time">${this.formatTime(event.time)}</span>
                    <p class="timeline-text">${event.text}</p>
                </div>
            `;
            this.elements.incidentTimeline.appendChild(item);
        });
    },

    /**
     * Rendre les contacts notifies
     */
    renderContactsNotified(contacts) {
        if (!this.elements.contactsNotified) return;

        this.elements.contactsNotified.innerHTML = '';

        if (contacts.length === 0) {
            this.elements.contactsNotified.innerHTML = `<li class="no-contacts">${window.__('history.no_contacts_notified')}</li>`;
            return;
        }

        contacts.forEach(contact => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="contact-name">${this.escapeHtml(contact.name)}</span>
                <span class="contact-status ${contact.acknowledged ? 'acknowledged' : ''}">${contact.acknowledged ? window.__('history.acknowledged') : window.__('history.notified')}</span>
            `;
            this.elements.contactsNotified.appendChild(li);
        });
    },

    /**
     * Fermer modal
     */
    closeModal() {
        this.elements.incidentModal?.classList.add('hidden');
        this.state.selectedIncident = null;
    },

    /**
     * Obtenir label de status
     */
    getStatusLabel(status) {
        const labels = {
            active: window.__('history.status_active'),
            resolved: window.__('history.status_resolved'),
            escalated: window.__('history.status_escalated'),
            cancelled: window.__('history.status_cancelled')
        };
        return labels[status] || status;
    },

    /**
     * Formater une duree
     */
    formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins < 60) {
            return `${mins}m ${secs}s`;
        }
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hours}h ${remainingMins}m`;
    },

    /**
     * Formater une date
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString(window.ShieldConfig?.locale || 'fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Formater une heure
     */
    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString(window.ShieldConfig?.locale || 'fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Echapper HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    HistoryPage.init();
});

export default HistoryPage;

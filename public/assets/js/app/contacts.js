/**
 * SHIELD Contacts Page Module
 * Gestion des contacts de confiance
 */

const ContactsPage = {
    /**
     * Elements DOM
     */
    elements: {},

    /**
     * State
     */
    state: {
        contacts: [],
        editingId: null,
        deletingId: null,
        isSubmitting: false
    },

    /**
     * Initialiser
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadContacts();
    },

    /**
     * Cacher les elements DOM
     */
    cacheElements() {
        this.elements = {
            btnBack: document.getElementById('btn-back'),
            btnAddContact: document.getElementById('btn-add-contact'),
            btnAddFirst: document.getElementById('btn-add-first'),
            contactsList: document.getElementById('contacts-list'),
            loadingState: document.getElementById('loading-state'),
            emptyState: document.getElementById('empty-state'),
            // Modal ajout/edit
            contactModal: document.getElementById('contact-modal'),
            modalTitle: document.getElementById('modal-title'),
            contactForm: document.getElementById('contact-form'),
            contactId: document.getElementById('contact-id'),
            contactName: document.getElementById('contact-name'),
            contactPhonePrefix: document.getElementById('contact-phone-prefix'),
            contactPhone: document.getElementById('contact-phone'),
            contactRelationship: document.getElementById('contact-relationship'),
            contactPrimary: document.getElementById('contact-primary'),
            btnModalClose: document.getElementById('btn-modal-close'),
            btnCancel: document.getElementById('btn-cancel'),
            btnSave: document.getElementById('btn-save'),
            // Modal suppression
            deleteModal: document.getElementById('delete-modal'),
            deleteMessage: document.getElementById('delete-message'),
            btnDeleteCancel: document.getElementById('btn-delete-cancel'),
            btnDeleteConfirm: document.getElementById('btn-delete-confirm')
        };
    },

    /**
     * Lier les evenements
     */
    bindEvents() {
        // Navigation
        this.elements.btnBack?.addEventListener('click', () => window.history.back());

        // Ouvrir modal ajout
        this.elements.btnAddContact?.addEventListener('click', () => this.openAddModal());
        this.elements.btnAddFirst?.addEventListener('click', () => this.openAddModal());

        // Fermer modal
        this.elements.btnModalClose?.addEventListener('click', () => this.closeModal());
        this.elements.btnCancel?.addEventListener('click', () => this.closeModal());
        this.elements.contactModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.contactModal) this.closeModal();
        });

        // Soumettre formulaire
        this.elements.contactForm?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Modal suppression
        this.elements.btnDeleteCancel?.addEventListener('click', () => this.closeDeleteModal());
        this.elements.btnDeleteConfirm?.addEventListener('click', () => this.confirmDelete());
        this.elements.deleteModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteModal) this.closeDeleteModal();
        });
    },

    /**
     * Charger les contacts
     */
    async loadContacts() {
        this.showLoading(true);

        try {
            const result = await window.ApiService.contacts.list();

            if (result.success) {
                this.state.contacts = result.contacts || [];
                this.renderContacts();
            } else {
                console.error('[Contacts] Load error:', result.error);
            }
        } catch (error) {
            console.error('[Contacts] Load error:', error);
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Afficher/masquer le chargement
     */
    showLoading(show) {
        this.elements.loadingState?.classList.toggle('hidden', !show);
    },

    /**
     * Rendre la liste des contacts
     */
    renderContacts() {
        // Supprimer les items existants (garder loading et empty)
        const existingItems = this.elements.contactsList?.querySelectorAll('.contact-item');
        existingItems?.forEach(item => item.remove());

        if (this.state.contacts.length === 0) {
            this.elements.emptyState?.classList.remove('hidden');
            return;
        }

        this.elements.emptyState?.classList.add('hidden');

        // Creer les items
        this.state.contacts.forEach(contact => {
            const item = this.createContactItem(contact);
            this.elements.contactsList?.appendChild(item);
        });
    },

    /**
     * Creer un element contact
     */
    createContactItem(contact) {
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.dataset.id = contact.id;

        const relationLabels = {
            family: window.__('contacts.rel_family'),
            friend: window.__('contacts.rel_friend'),
            partner: window.__('contacts.rel_partner'),
            colleague: window.__('contacts.rel_colleague'),
            other: window.__('contacts.rel_other')
        };

        div.innerHTML = `
            <div class="contact-avatar">
                ${contact.name.charAt(0).toUpperCase()}
            </div>
            <div class="contact-info">
                <div class="contact-name">
                    ${this.escapeHtml(contact.name)}
                    ${contact.is_primary ? '<span class="badge-primary">' + window.__('contacts.primary') + '</span>' : ''}
                </div>
                <div class="contact-phone">${this.escapeHtml(contact.phone_number)}</div>
                ${contact.relationship ? '<div class="contact-relationship">' + (relationLabels[contact.relationship] || contact.relationship) + '</div>' : ''}
            </div>
            <div class="contact-actions">
                <button type="button" class="btn-icon btn-edit" data-id="${contact.id}" aria-label="${window.__('ui.edit')}">
                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button type="button" class="btn-icon btn-delete" data-id="${contact.id}" aria-label="${window.__('ui.delete')}">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;

        // Events
        div.querySelector('.btn-edit')?.addEventListener('click', () => this.openEditModal(contact));
        div.querySelector('.btn-delete')?.addEventListener('click', () => this.openDeleteModal(contact));

        return div;
    },

    /**
     * Ouvrir modal ajout
     */
    openAddModal() {
        this.state.editingId = null;
        this.elements.modalTitle.textContent = window.__('contacts.add');
        this.elements.contactForm?.reset();
        this.elements.contactId.value = '';
        this.elements.contactModal?.classList.remove('hidden');
    },

    /**
     * Ouvrir modal edition
     */
    openEditModal(contact) {
        this.state.editingId = contact.id;
        this.elements.modalTitle.textContent = window.__('contacts.edit');

        // Remplir le formulaire
        this.elements.contactId.value = contact.id;
        this.elements.contactName.value = contact.name;

        // Extraire prefix et numero
        const phoneParts = this.parsePhone(contact.phone_number);
        this.elements.contactPhonePrefix.value = phoneParts.prefix;
        this.elements.contactPhone.value = phoneParts.number;

        this.elements.contactRelationship.value = contact.relationship || '';
        this.elements.contactPrimary.checked = !!contact.is_primary;

        this.elements.contactModal?.classList.remove('hidden');
    },

    /**
     * Parser le numero de telephone
     */
    parsePhone(phone) {
        const prefixes = ['+351', '+33', '+41', '+32', '+49', '+34', '+39', '+31', '+46', '+48', '+30'];
        for (const prefix of prefixes) {
            if (phone.startsWith(prefix)) {
                return { prefix, number: phone.substring(prefix.length) };
            }
        }
        return { prefix: '+41', number: phone.replace(/^\+/, '') };
    },

    /**
     * Fermer modal
     */
    closeModal() {
        this.elements.contactModal?.classList.add('hidden');
        this.state.editingId = null;
    },

    /**
     * Gerer la soumission
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.state.isSubmitting) return;

        // Valider
        const name = this.elements.contactName?.value.trim();
        const phone = this.elements.contactPhonePrefix?.value + this.elements.contactPhone?.value.trim();
        const relationship = this.elements.contactRelationship?.value;
        const isPrimary = this.elements.contactPrimary?.checked;

        if (!name) {
            this.showFieldError('name', window.__('validation.name_required'));
            return;
        }

        if (!this.elements.contactPhone?.value.trim()) {
            this.showFieldError('phone', window.__('validation.phone_required'));
            return;
        }

        this.setSubmitting(true);

        try {
            const data = {
                name,
                phone_number: phone,
                relationship: relationship || null,
                is_primary: isPrimary ? 1 : 0
            };

            let result;
            if (this.state.editingId) {
                result = await window.ApiService.contacts.update(this.state.editingId, data);
            } else {
                result = await window.ApiService.contacts.create(data);
            }

            if (result.success) {
                this.closeModal();
                this.loadContacts();
            } else {
                alert(result.error || window.__('error.generic'));
            }
        } catch (error) {
            console.error('[Contacts] Save error:', error);
            alert(window.__('error.network'));
        } finally {
            this.setSubmitting(false);
        }
    },

    /**
     * Afficher erreur de champ
     */
    showFieldError(field, message) {
        const errorEl = document.getElementById(`${field}-error`);
        if (errorEl) {
            errorEl.textContent = message;
        }
    },

    /**
     * Etat soumission
     */
    setSubmitting(submitting) {
        this.state.isSubmitting = submitting;
        this.elements.btnSave.disabled = submitting;
        this.elements.btnSave?.querySelector('.btn-text')?.classList.toggle('hidden', submitting);
        this.elements.btnSave?.querySelector('.btn-loader')?.classList.toggle('hidden', !submitting);
    },

    /**
     * Ouvrir modal suppression
     */
    openDeleteModal(contact) {
        this.state.deletingId = contact.id;
        if (this.elements.deleteMessage) {
            this.elements.deleteMessage.textContent = window.__('contacts.delete_confirm').replace(':name', contact.name);
        }
        this.elements.deleteModal?.classList.remove('hidden');
    },

    /**
     * Fermer modal suppression
     */
    closeDeleteModal() {
        this.elements.deleteModal?.classList.add('hidden');
        this.state.deletingId = null;
    },

    /**
     * Confirmer suppression
     */
    async confirmDelete() {
        if (!this.state.deletingId) return;

        try {
            const result = await window.ApiService.contacts.delete(this.state.deletingId);

            if (result.success) {
                this.closeDeleteModal();
                this.loadContacts();
            } else {
                alert(result.error || window.__('error.generic'));
            }
        } catch (error) {
            console.error('[Contacts] Delete error:', error);
            alert(window.__('error.network'));
        }
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
    ContactsPage.init();
});

export default ContactsPage;

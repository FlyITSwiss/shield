/**
 * SHIELD Profile Edit Page Module
 */

const ProfileEditPage = {
    /**
     * Elements DOM
     */
    elements: {},

    /**
     * Initialiser
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    /**
     * Cacher les elements DOM
     */
    cacheElements() {
        this.elements = {
            btnBack: document.getElementById('btn-back'),
            btnSave: document.getElementById('btn-save'),
            btnChangePhoto: document.getElementById('btn-change-photo'),
            photoInput: document.getElementById('photo-input'),
            profilePhoto: document.getElementById('profile-photo'),
            form: document.getElementById('profile-edit-form'),

            // Champs
            firstName: document.getElementById('first_name'),
            lastName: document.getElementById('last_name'),
            email: document.getElementById('email'),
            phone: document.getElementById('phone'),
            bloodType: document.getElementById('blood_type'),
            allergies: document.getElementById('allergies'),
            medications: document.getElementById('medications'),
            medicalNotes: document.getElementById('medical_notes')
        };
    },

    /**
     * Lier les evenements
     */
    bindEvents() {
        // Navigation
        this.elements.btnBack?.addEventListener('click', () => this.goBack());

        // Photo
        this.elements.btnChangePhoto?.addEventListener('click', () => {
            this.elements.photoInput?.click();
        });

        this.elements.photoInput?.addEventListener('change', (e) => {
            this.handlePhotoChange(e);
        });

        // Form submit
        this.elements.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });
    },

    /**
     * Retour
     */
    goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/app/settings';
        }
    },

    /**
     * Gerer le changement de photo
     */
    handlePhotoChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = this.elements.profilePhoto.querySelector('img');
            if (img) {
                img.src = ev.target.result;
            } else {
                this.elements.profilePhoto.innerHTML = `<img src="${ev.target.result}" alt="Profile">`;
            }
        };
        reader.readAsDataURL(file);
    },

    /**
     * Sauvegarder le profil
     */
    async saveProfile() {
        const btn = this.elements.btnSave;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';

        try {
            const formData = new FormData(this.elements.form);

            const response = await fetch('/api/auth.php?action=profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            const result = await response.json();

            if (result.success) {
                if (window.ShieldNotifications) {
                    ShieldNotifications.success(result.message || 'Profil mis a jour');
                }
                setTimeout(() => this.goBack(), 1000);
            } else {
                if (window.ShieldNotifications) {
                    ShieldNotifications.error(result.error || 'Erreur de sauvegarde');
                }
            }
        } catch (error) {
            console.error('Profile save error:', error);
            if (window.ShieldNotifications) {
                ShieldNotifications.error('Erreur de connexion');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    ProfileEditPage.init();
});

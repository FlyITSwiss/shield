/**
 * SHIELD Toast Notification System
 *
 * Mobile-friendly toast notifications with Design System phi integration
 */

const Toast = {
    /**
     * Configuration
     */
    config: {
        duration: 3000,
        position: 'bottom', // 'top' | 'bottom'
        maxToasts: 3
    },

    /**
     * Container element
     */
    container: null,

    /**
     * Active toasts
     */
    toasts: [],

    /**
     * Initialize toast container
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'shield-toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(this.container);

        // Apply position
        this.setPosition(this.config.position);
    },

    /**
     * Set toast position
     */
    setPosition(position) {
        this.config.position = position;
        if (this.container) {
            this.container.classList.remove('toast-top', 'toast-bottom');
            this.container.classList.add(`toast-${position}`);
        }
    },

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: 'success' | 'error' | 'warning' | 'info'
     * @param {Object} options - Additional options
     * @returns {HTMLElement} Toast element
     */
    show(message, type = 'success', options = {}) {
        this.init();

        const duration = options.duration ?? this.config.duration;
        const icon = this.getIcon(type);

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `shield-toast shield-toast-${type}`;
        toast.setAttribute('role', 'alert');

        toast.innerHTML = `
            <span class="shield-toast-icon">${icon}</span>
            <span class="shield-toast-message">${this.escapeHtml(message)}</span>
            <button class="shield-toast-close" aria-label="Fermer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        // Add close handler
        const closeBtn = toast.querySelector('.shield-toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        // Limit max toasts
        while (this.toasts.length >= this.config.maxToasts) {
            this.dismiss(this.toasts[0]);
        }

        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('shield-toast-show');
        });

        // Auto-dismiss
        if (duration > 0) {
            toast.timeoutId = setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    },

    /**
     * Dismiss a toast
     */
    dismiss(toast) {
        if (!toast || toast.classList.contains('shield-toast-hide')) return;

        // Clear timeout
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }

        // Animate out
        toast.classList.remove('shield-toast-show');
        toast.classList.add('shield-toast-hide');

        // Remove from DOM
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 300);
    },

    /**
     * Clear all toasts
     */
    clear() {
        [...this.toasts].forEach(toast => this.dismiss(toast));
    },

    /**
     * Convenience methods
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    },

    error(message, options = {}) {
        return this.show(message, 'error', { duration: 5000, ...options });
    },

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    },

    info(message, options = {}) {
        return this.show(message, 'info', options);
    },

    /**
     * Get icon SVG for type
     */
    getIcon(type) {
        const icons = {
            success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>`,
            error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>`,
            warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>`,
            info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`
        };
        return icons[type] || icons.info;
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
}

// Expose globally
window.Toast = Toast;

export default Toast;

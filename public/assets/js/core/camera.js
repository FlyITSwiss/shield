/**
 * SHIELD Camera Service
 *
 * Handles photo capture during incidents using Capacitor Camera plugin
 * Falls back to HTML5 file input on web
 */

const CameraService = {
    /**
     * State
     */
    state: {
        initialized: false,
        isNative: false,
        hasPermission: false
    },

    /**
     * Photos captured during current incident
     */
    pendingPhotos: [],

    /**
     * Initialize camera service
     */
    async init() {
        if (this.state.initialized) return;

        this.state.isNative = window.Capacitor?.isNativePlatform() || false;

        if (this.state.isNative) {
            await this.checkNativePermission();
        }

        this.state.initialized = true;
        console.log('[Camera] Initialized', { isNative: this.state.isNative });
    },

    /**
     * Check native camera permission
     */
    async checkNativePermission() {
        const { Camera } = window.Capacitor?.Plugins || {};
        if (!Camera) return;

        try {
            const status = await Camera.checkPermissions();
            this.state.hasPermission = status.camera === 'granted' && status.photos === 'granted';
        } catch (error) {
            console.error('[Camera] Permission check failed:', error);
        }
    },

    /**
     * Request camera permission
     */
    async requestPermission() {
        if (this.state.isNative) {
            const { Camera } = window.Capacitor?.Plugins || {};
            if (!Camera) return false;

            try {
                const status = await Camera.requestPermissions();
                this.state.hasPermission = status.camera === 'granted';
                return this.state.hasPermission;
            } catch (error) {
                console.error('[Camera] Permission request failed:', error);
                return false;
            }
        }

        // Web: permission granted through user action
        return true;
    },

    /**
     * Capture photo
     * @param {Object} options - Capture options
     * @returns {Promise<Object>} Photo data with base64 and metadata
     */
    async capturePhoto(options = {}) {
        const {
            quality = 80,
            width = 1280,
            height = 960,
            source = 'camera', // 'camera' | 'photos' | 'prompt'
            saveToGallery = false
        } = options;

        if (this.state.isNative) {
            return this.captureNative({ quality, width, height, source, saveToGallery });
        }

        return this.captureWeb({ quality, width, height });
    },

    /**
     * Native photo capture using Capacitor
     */
    async captureNative(options) {
        const { Camera, CameraResultType, CameraSource } = window.Capacitor?.Plugins || {};

        if (!Camera) {
            throw new Error('Camera plugin not available');
        }

        // Map source to CameraSource enum
        const sourceMap = {
            'camera': CameraSource?.Camera || 'CAMERA',
            'photos': CameraSource?.Photos || 'PHOTOS',
            'prompt': CameraSource?.Prompt || 'PROMPT'
        };

        try {
            const photo = await Camera.getPhoto({
                quality: options.quality,
                width: options.width,
                height: options.height,
                resultType: CameraResultType?.Base64 || 'base64',
                source: sourceMap[options.source],
                saveToGallery: options.saveToGallery,
                correctOrientation: true
            });

            const photoData = {
                base64: photo.base64String,
                format: photo.format || 'jpeg',
                timestamp: new Date().toISOString(),
                source: options.source
            };

            // Add to pending photos
            this.pendingPhotos.push(photoData);

            return photoData;
        } catch (error) {
            if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
                throw new Error('cancelled');
            }
            throw error;
        }
    },

    /**
     * Web photo capture using file input
     */
    captureWeb(options) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Use back camera on mobile

            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) {
                    reject(new Error('cancelled'));
                    return;
                }

                try {
                    const base64 = await this.fileToBase64(file);
                    const resized = await this.resizeImage(base64, options.width, options.height, options.quality);

                    const photoData = {
                        base64: resized.split(',')[1], // Remove data URL prefix
                        format: file.type.split('/')[1] || 'jpeg',
                        timestamp: new Date().toISOString(),
                        source: 'web'
                    };

                    this.pendingPhotos.push(photoData);
                    resolve(photoData);
                } catch (error) {
                    reject(error);
                }
            };

            input.oncancel = () => {
                reject(new Error('cancelled'));
            };

            input.click();
        });
    },

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Resize image
     */
    resizeImage(dataUrl, maxWidth, maxHeight, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality / 100));
            };
            img.src = dataUrl;
        });
    },

    /**
     * Upload photos to incident
     * @param {string} incidentId - Incident UUID
     * @returns {Promise<Array>} Uploaded photo URLs
     */
    async uploadPhotos(incidentId) {
        if (this.pendingPhotos.length === 0) {
            return [];
        }

        const uploadedUrls = [];

        for (const photo of this.pendingPhotos) {
            try {
                const result = await window.ApiService?.post('incidents.php?action=upload-photo', {
                    incident_id: incidentId,
                    photo_base64: photo.base64,
                    format: photo.format,
                    timestamp: photo.timestamp
                });

                if (result?.success && result?.url) {
                    uploadedUrls.push(result.url);
                }
            } catch (error) {
                console.error('[Camera] Photo upload failed:', error);
            }
        }

        // Clear pending photos after upload
        this.pendingPhotos = [];

        return uploadedUrls;
    },

    /**
     * Get pending photos count
     */
    getPendingCount() {
        return this.pendingPhotos.length;
    },

    /**
     * Get pending photos
     */
    getPendingPhotos() {
        return [...this.pendingPhotos];
    },

    /**
     * Clear pending photos
     */
    clearPending() {
        this.pendingPhotos = [];
    },

    /**
     * Check if camera is supported
     */
    isSupported() {
        if (this.state.isNative) {
            return !!window.Capacitor?.Plugins?.Camera;
        }
        // Web: check for file input support
        return 'FileReader' in window;
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    CameraService.init().catch(console.error);
});

// Export globally
window.CameraService = CameraService;

export default CameraService;

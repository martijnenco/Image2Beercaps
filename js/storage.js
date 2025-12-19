// Storage module for beercap library persistence using LocalStorage

const STORAGE_KEY = 'beercap_library';
const LAYOUT_KEY = 'beercap_layout';
const TARGET_IMAGE_KEY = 'beercap_target_image';

/**
 * Get all beercaps from storage
 * @returns {Array} Array of beercap objects
 */
export function getBeercaps() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        return [];
    }
}

/**
 * Save all beercaps to storage
 * @param {Array} beercaps - Array of beercap objects
 */
export function saveBeercaps(beercaps) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(beercaps));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
        // Handle quota exceeded error
        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Try removing some beercaps or using smaller images.');
        }
    }
}

/**
 * Add a new beercap to storage
 * @param {Object} beercap - Beercap object with id, name, imageData, color, quantity
 */
export function addBeercap(beercap) {
    const beercaps = getBeercaps();
    beercaps.push(beercap);
    saveBeercaps(beercaps);
}

/**
 * Update an existing beercap
 * @param {string} id - Beercap ID
 * @param {Object} updates - Properties to update
 */
export function updateBeercap(id, updates) {
    const beercaps = getBeercaps();
    const index = beercaps.findIndex(b => b.id === id);
    if (index !== -1) {
        beercaps[index] = { ...beercaps[index], ...updates };
        saveBeercaps(beercaps);
    }
}

/**
 * Delete a beercap from storage
 * @param {string} id - Beercap ID to delete
 */
export function deleteBeercap(id) {
    const beercaps = getBeercaps();
    const filtered = beercaps.filter(b => b.id !== id);
    saveBeercaps(filtered);
}

/**
 * Generate a unique ID
 * @returns {string} UUID
 */
export function generateId() {
    return 'bc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Clear all beercaps from storage
 */
export function clearAllBeercaps() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get total available beercaps count
 * @returns {number} Sum of all beercap quantities
 */
export function getTotalBeercapCount() {
    const beercaps = getBeercaps();
    return beercaps.reduce((sum, b) => sum + (b.quantity || 0), 0);
}

/**
 * Save layout setting to storage
 * @param {string} layout - 'square' or 'hex'
 */
export function saveLayout(layout) {
    try {
        localStorage.setItem(LAYOUT_KEY, layout);
    } catch (e) {
        console.error('Error saving layout:', e);
    }
}

/**
 * Get layout setting from storage
 * @returns {string} Layout type ('hex' by default)
 */
export function getLayout() {
    try {
        return localStorage.getItem(LAYOUT_KEY) || 'hex';
    } catch (e) {
        console.error('Error reading layout:', e);
        return 'hex';
    }
}

/**
 * Save target image to storage
 * @param {string} imageData - Base64 data URL of the image
 */
export function saveTargetImage(imageData) {
    try {
        localStorage.setItem(TARGET_IMAGE_KEY, imageData);
    } catch (e) {
        console.error('Error saving target image:', e);
        if (e.name === 'QuotaExceededError') {
            console.warn('Target image too large to save. It will not persist across refreshes.');
        }
    }
}

/**
 * Get target image from storage
 * @returns {string|null} Base64 data URL or null if not set
 */
export function getTargetImage() {
    try {
        return localStorage.getItem(TARGET_IMAGE_KEY);
    } catch (e) {
        console.error('Error reading target image:', e);
        return null;
    }
}

/**
 * Clear target image from storage
 */
export function clearTargetImage() {
    try {
        localStorage.removeItem(TARGET_IMAGE_KEY);
    } catch (e) {
        console.error('Error clearing target image:', e);
    }
}


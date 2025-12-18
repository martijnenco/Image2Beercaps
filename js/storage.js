// Storage module for beercap library persistence using LocalStorage

const STORAGE_KEY = 'beercap_library';

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


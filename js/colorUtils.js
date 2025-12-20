// Color extraction and matching utilities

/**
 * Extract the average color from an image
 * Uses center-weighted sampling for better beercap color representation
 * @param {HTMLImageElement|string} imageSource - Image element or base64 data URL
 * @returns {Promise<{r: number, g: number, b: number}>} Average RGB color
 */
export async function extractAverageColor(imageSource) {
    return new Promise((resolve, reject) => {
        const img = typeof imageSource === 'string' ? new Image() : imageSource;
        
        const processImage = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Use a reasonable size for sampling
            const size = Math.min(img.width, img.height, 100);
            canvas.width = size;
            canvas.height = size;
            
            // Draw image centered and scaled
            ctx.drawImage(img, 0, 0, size, size);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, size, size);
            const pixels = imageData.data;
            
            let r = 0, g = 0, b = 0;
            let totalWeight = 0;
            
            const centerX = size / 2;
            const centerY = size / 2;
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
            
            // Center-weighted average - pixels closer to center have more weight
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4;
                    
                    // Skip transparent pixels
                    if (pixels[i + 3] < 128) continue;
                    
                    // Calculate distance from center for weighting
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Weight: 1 at center, decreasing towards edges
                    const weight = 1 - (dist / maxDist) * 0.5;
                    
                    r += pixels[i] * weight;
                    g += pixels[i + 1] * weight;
                    b += pixels[i + 2] * weight;
                    totalWeight += weight;
                }
            }
            
            if (totalWeight === 0) {
                resolve({ r: 128, g: 128, b: 128 }); // Default gray if no valid pixels
                return;
            }
            
            resolve({
                r: Math.round(r / totalWeight),
                g: Math.round(g / totalWeight),
                b: Math.round(b / totalWeight)
            });
        };
        
        if (typeof imageSource === 'string') {
            img.onload = processImage;
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageSource;
        } else {
            processImage();
        }
    });
}

/**
 * Calculate perceptual color distance between two colors
 * Uses weighted Euclidean distance optimized for human perception
 * @param {Object} c1 - First color {r, g, b}
 * @param {Object} c2 - Second color {r, g, b}
 * @returns {number} Color distance (lower = more similar)
 */
export function colorDistance(c1, c2) {
    const rMean = (c1.r + c2.r) / 2;
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    
    // Weighted for human color perception
    // Red and blue weights vary based on the mean red value
    return Math.sqrt(
        (2 + rMean / 256) * dr * dr +
        4 * dg * dg +
        (2 + (255 - rMean) / 256) * db * db
    );
}

/**
 * Convert RGB to hex color string
 * @param {Object} color - Color object {r, g, b}
 * @returns {string} Hex color string (e.g., "#FF5500")
 */
export function rgbToHex(color) {
    const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Convert hex color string to RGB
 * @param {string} hex - Hex color string
 * @returns {Object} Color object {r, g, b}
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Get average color of a region in an image
 * @param {ImageData} imageData - Canvas ImageData object
 * @param {number} startX - Start X coordinate
 * @param {number} startY - Start Y coordinate
 * @param {number} width - Region width
 * @param {number} height - Region height
 * @returns {Object} Average color {r, g, b}
 */
export function getRegionAverageColor(imageData, startX, startY, width, height) {
    const pixels = imageData.data;
    const imgWidth = imageData.width;
    
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    const endX = Math.min(startX + width, imgWidth);
    const endY = Math.min(startY + height, imageData.height);
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const i = (y * imgWidth + x) * 4;
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
        }
    }
    
    if (count === 0) return { r: 128, g: 128, b: 128 };
    
    return {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count)
    };
}

/**
 * Find the best matching beercap for a target color from available inventory
 * @param {Object} targetColor - Target color {r, g, b}
 * @param {Array} beercaps - Array of beercap objects with color and remaining quantity
 * @returns {Object|null} Best matching beercap or null if none available
 */
export function findBestMatch(targetColor, beercaps) {
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const beercap of beercaps) {
        if (beercap.remaining <= 0) continue;
        
        const distance = colorDistance(targetColor, beercap.color);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = beercap;
        }
    }
    
    return bestMatch;
}

/**
 * Calculate contrast color (black or white) for text on a background
 * @param {Object} bgColor - Background color {r, g, b}
 * @returns {string} "#000000" or "#FFFFFF"
 */
export function getContrastColor(bgColor) {
    // Calculate relative luminance
    const luminance = (0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Maximum size for beercap images in storage
 */
const BEERCAP_MAX_SIZE = 64;

/**
 * Resize and compress an image to a maximum size for efficient storage
 * Uses JPEG compression for photos to minimize storage space
 * @param {string} imageDataUrl - Base64 data URL of the image
 * @param {number} maxSize - Maximum width/height (default: 64)
 * @param {number} quality - JPEG quality 0-1 (default: 0.85)
 * @returns {Promise<string>} Compressed base64 data URL
 */
export function resizeAndCompressImage(imageDataUrl, maxSize = BEERCAP_MAX_SIZE, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate new dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = Math.round(height * (maxSize / width));
                    width = maxSize;
                } else {
                    width = Math.round(width * (maxSize / height));
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Use high quality image smoothing for downscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw resized image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Export as JPEG for smaller file size (photos compress well)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            
            resolve(compressedDataUrl);
        };
        
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = imageDataUrl;
    });
}


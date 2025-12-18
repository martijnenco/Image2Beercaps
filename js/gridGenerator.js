// Grid calculation and mosaic generation logic

import { getRegionAverageColor, findBestMatch } from './colorUtils.js';

/**
 * Calculate optimal grid dimensions based on total caps and image aspect ratio
 * @param {number} totalCaps - Total available beercaps
 * @param {number} imageWidth - Original image width
 * @param {number} imageHeight - Original image height
 * @returns {Object} Grid dimensions {width, height, totalCells}
 */
export function calculateGridDimensions(totalCaps, imageWidth, imageHeight) {
    const aspectRatio = imageWidth / imageHeight;
    
    // Calculate grid dimensions that best fit the aspect ratio
    // gridWidth / gridHeight should approximate imageWidth / imageHeight
    // gridWidth * gridHeight should be <= totalCaps
    
    // From: gridW * gridH = N and gridW/gridH = aspectRatio
    // gridW = sqrt(N * aspectRatio)
    // gridH = sqrt(N / aspectRatio)
    
    let gridWidth = Math.sqrt(totalCaps * aspectRatio);
    let gridHeight = Math.sqrt(totalCaps / aspectRatio);
    
    // Round and ensure we don't exceed total caps
    gridWidth = Math.floor(gridWidth);
    gridHeight = Math.floor(gridHeight);
    
    // Ensure at least 1x1
    gridWidth = Math.max(1, gridWidth);
    gridHeight = Math.max(1, gridHeight);
    
    // Adjust to maximize usage without exceeding
    while ((gridWidth + 1) * gridHeight <= totalCaps) {
        gridWidth++;
    }
    while (gridWidth * (gridHeight + 1) <= totalCaps) {
        gridHeight++;
    }
    
    return {
        width: gridWidth,
        height: gridHeight,
        totalCells: gridWidth * gridHeight
    };
}

/**
 * Generate mosaic grid from target image and beercap inventory
 * @param {HTMLImageElement} targetImage - Target image element
 * @param {Array} beercaps - Array of beercap objects with color and quantity
 * @param {Object} gridDimensions - Grid dimensions {width, height}
 * @returns {Object} Mosaic result {grid, usageStats}
 */
export function generateMosaic(targetImage, beercaps, gridDimensions) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = targetImage.naturalWidth || targetImage.width;
    canvas.height = targetImage.naturalHeight || targetImage.height;
    ctx.drawImage(targetImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const cellWidth = canvas.width / gridDimensions.width;
    const cellHeight = canvas.height / gridDimensions.height;
    
    // Create working copy of beercaps with remaining counts
    const inventory = beercaps.map(b => ({
        ...b,
        remaining: b.quantity,
        used: 0
    }));
    
    // Generate grid - 2D array of beercap assignments
    const grid = [];
    
    for (let row = 0; row < gridDimensions.height; row++) {
        const gridRow = [];
        for (let col = 0; col < gridDimensions.width; col++) {
            // Calculate the region in the source image for this cell
            const startX = Math.floor(col * cellWidth);
            const startY = Math.floor(row * cellHeight);
            const regionWidth = Math.ceil(cellWidth);
            const regionHeight = Math.ceil(cellHeight);
            
            // Get average color of this region
            const targetColor = getRegionAverageColor(
                imageData, 
                startX, 
                startY, 
                regionWidth, 
                regionHeight
            );
            
            // Find best matching beercap
            const bestMatch = findBestMatch(targetColor, inventory);
            
            if (bestMatch) {
                bestMatch.remaining--;
                bestMatch.used++;
                gridRow.push({
                    beercapId: bestMatch.id,
                    beercapName: bestMatch.name,
                    beercapColor: bestMatch.color,
                    beercapImage: bestMatch.imageData,
                    targetColor: targetColor,
                    row: row,
                    col: col
                });
            } else {
                // No beercaps available - shouldn't happen if grid sized correctly
                gridRow.push({
                    beercapId: null,
                    beercapName: 'EMPTY',
                    beercapColor: { r: 200, g: 200, b: 200 },
                    beercapImage: null,
                    targetColor: targetColor,
                    row: row,
                    col: col
                });
            }
        }
        grid.push(gridRow);
    }
    
    // Calculate usage statistics
    const usageStats = {
        totalCells: gridDimensions.width * gridDimensions.height,
        beercapUsage: inventory.map(b => ({
            id: b.id,
            name: b.name,
            color: b.color,
            originalQuantity: b.quantity,
            used: b.used,
            remaining: b.remaining
        })).filter(b => b.used > 0 || b.originalQuantity > 0),
        totalUsed: inventory.reduce((sum, b) => sum + b.used, 0),
        totalRemaining: inventory.reduce((sum, b) => sum + b.remaining, 0)
    };
    
    return { grid, usageStats };
}

/**
 * Create a unique ID to beercap code mapping for the reference grid
 * @param {Array} beercaps - Array of beercap objects
 * @returns {Map} Map of beercap ID to short code
 */
export function createBeercapCodes(beercaps) {
    const codes = new Map();
    
    beercaps.forEach((beercap, index) => {
        // Create a short code like A, B, C... AA, AB, etc.
        let code = '';
        let n = index;
        do {
            code = String.fromCharCode(65 + (n % 26)) + code;
            n = Math.floor(n / 26) - 1;
        } while (n >= 0);
        
        codes.set(beercap.id, code);
    });
    
    return codes;
}

/**
 * Convert grid to CSV format
 * @param {Array} grid - 2D grid of beercap assignments
 * @param {Map} codes - Beercap ID to code mapping
 * @returns {string} CSV string
 */
export function gridToCSV(grid, codes) {
    const rows = grid.map(row => 
        row.map(cell => codes.get(cell.beercapId) || '-').join(',')
    );
    return rows.join('\n');
}

/**
 * Generate legend for beercap codes
 * @param {Array} beercaps - Array of beercap objects
 * @param {Map} codes - Beercap ID to code mapping
 * @returns {Array} Array of {code, name, color} objects
 */
export function generateLegend(beercaps, codes) {
    return beercaps.map(b => ({
        code: codes.get(b.id),
        name: b.name,
        color: b.color,
        imageData: b.imageData
    }));
}


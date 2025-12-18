// Grid calculation and mosaic generation logic

import { getRegionAverageColor, findBestMatch, colorDistance } from './colorUtils.js';

/**
 * Hungarian Algorithm (Kuhn-Munkres) for optimal assignment
 * Finds the minimum cost assignment between workers (cells) and jobs (beercap slots)
 * 
 * @param {number[][]} costMatrix - 2D cost matrix where costMatrix[i][j] is the cost of assigning job j to worker i
 * @returns {number[]} Assignment array where result[i] = j means worker i is assigned to job j
 */
export function hungarianAlgorithm(costMatrix) {
    const n = costMatrix.length;
    const m = costMatrix[0].length;
    
    // We need a square matrix for the algorithm, pad if necessary
    const size = Math.max(n, m);
    const cost = [];
    
    // Create padded cost matrix
    for (let i = 0; i < size; i++) {
        cost[i] = [];
        for (let j = 0; j < size; j++) {
            if (i < n && j < m) {
                cost[i][j] = costMatrix[i][j];
            } else {
                cost[i][j] = 0; // Padding with zeros (dummy assignments)
            }
        }
    }
    
    // u and v are potentials for rows and columns
    const u = new Array(size + 1).fill(0);
    const v = new Array(size + 1).fill(0);
    // p[j] = row assigned to column j (1-indexed, 0 means unassigned)
    const p = new Array(size + 1).fill(0);
    // way[j] = previous column in augmenting path
    const way = new Array(size + 1).fill(0);
    
    for (let i = 1; i <= size; i++) {
        // Start augmenting path from row i
        p[0] = i;
        let j0 = 0; // Current column (0 is virtual)
        
        const minv = new Array(size + 1).fill(Infinity);
        const used = new Array(size + 1).fill(false);
        
        // Find augmenting path
        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity;
            let j1 = 0;
            
            for (let j = 1; j <= size; j++) {
                if (!used[j]) {
                    // cost[i0-1][j-1] because our cost matrix is 0-indexed
                    const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }
            
            // Update potentials
            for (let j = 0; j <= size; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            
            j0 = j1;
        } while (p[j0] !== 0);
        
        // Reconstruct path
        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0 !== 0);
    }
    
    // Build result: assignment[i] = j means row i is assigned to column j
    const assignment = new Array(n).fill(-1);
    for (let j = 1; j <= size; j++) {
        if (p[j] > 0 && p[j] <= n && j <= m) {
            assignment[p[j] - 1] = j - 1;
        }
    }
    
    return assignment;
}

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
 * Generate mosaic using global optimization (Hungarian algorithm)
 * Finds the optimal assignment that minimizes total color distance
 * 
 * @param {HTMLImageElement} targetImage - Target image element
 * @param {Array} beercaps - Array of beercap objects with color and quantity
 * @param {Object} gridDimensions - Grid dimensions {width, height}
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Object} Mosaic result {grid, usageStats}
 */
export function generateMosaicOptimized(targetImage, beercaps, gridDimensions, progressCallback = null) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = targetImage.naturalWidth || targetImage.width;
    canvas.height = targetImage.naturalHeight || targetImage.height;
    ctx.drawImage(targetImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const cellWidth = canvas.width / gridDimensions.width;
    const cellHeight = canvas.height / gridDimensions.height;
    
    const numCells = gridDimensions.width * gridDimensions.height;
    
    // Step 1: Extract target colors for all cells
    if (progressCallback) progressCallback('Analyzing image colors...', 10);
    
    const cellColors = [];
    for (let row = 0; row < gridDimensions.height; row++) {
        for (let col = 0; col < gridDimensions.width; col++) {
            const startX = Math.floor(col * cellWidth);
            const startY = Math.floor(row * cellHeight);
            const regionWidth = Math.ceil(cellWidth);
            const regionHeight = Math.ceil(cellHeight);
            
            const targetColor = getRegionAverageColor(
                imageData, 
                startX, 
                startY, 
                regionWidth, 
                regionHeight
            );
            
            cellColors.push({
                row,
                col,
                color: targetColor
            });
        }
    }
    
    // Step 2: Expand beercap inventory into individual slots
    if (progressCallback) progressCallback('Expanding inventory...', 20);
    
    const capSlots = [];
    beercaps.forEach(beercap => {
        for (let i = 0; i < beercap.quantity; i++) {
            capSlots.push({
                id: beercap.id,
                name: beercap.name,
                color: beercap.color,
                imageData: beercap.imageData
            });
        }
    });
    
    // Ensure we have enough caps
    if (capSlots.length < numCells) {
        console.warn(`Not enough beercaps: ${capSlots.length} available, ${numCells} needed`);
    }
    
    // Step 3: Build cost matrix
    if (progressCallback) progressCallback('Building cost matrix...', 30);
    
    const costMatrix = [];
    for (let i = 0; i < numCells; i++) {
        costMatrix[i] = [];
        for (let j = 0; j < capSlots.length; j++) {
            costMatrix[i][j] = colorDistance(cellColors[i].color, capSlots[j].color);
        }
    }
    
    // Step 4: Run Hungarian algorithm
    if (progressCallback) progressCallback('Optimizing assignments...', 50);
    
    const assignments = hungarianAlgorithm(costMatrix);
    
    // Step 5: Build the grid from assignments
    if (progressCallback) progressCallback('Building mosaic grid...', 80);
    
    // Track usage per beercap
    const usageCount = new Map();
    beercaps.forEach(b => usageCount.set(b.id, 0));
    
    const grid = [];
    for (let row = 0; row < gridDimensions.height; row++) {
        const gridRow = [];
        for (let col = 0; col < gridDimensions.width; col++) {
            const cellIndex = row * gridDimensions.width + col;
            const slotIndex = assignments[cellIndex];
            
            if (slotIndex >= 0 && slotIndex < capSlots.length) {
                const cap = capSlots[slotIndex];
                usageCount.set(cap.id, (usageCount.get(cap.id) || 0) + 1);
                
                gridRow.push({
                    beercapId: cap.id,
                    beercapName: cap.name,
                    beercapColor: cap.color,
                    beercapImage: cap.imageData,
                    targetColor: cellColors[cellIndex].color,
                    row: row,
                    col: col
                });
            } else {
                // Fallback for unassigned cells
                gridRow.push({
                    beercapId: null,
                    beercapName: 'EMPTY',
                    beercapColor: { r: 200, g: 200, b: 200 },
                    beercapImage: null,
                    targetColor: cellColors[cellIndex].color,
                    row: row,
                    col: col
                });
            }
        }
        grid.push(gridRow);
    }
    
    // Step 6: Calculate usage statistics
    if (progressCallback) progressCallback('Calculating statistics...', 95);
    
    const usageStats = {
        totalCells: numCells,
        beercapUsage: beercaps.map(b => ({
            id: b.id,
            name: b.name,
            color: b.color,
            originalQuantity: b.quantity,
            used: usageCount.get(b.id) || 0,
            remaining: b.quantity - (usageCount.get(b.id) || 0)
        })).filter(b => b.used > 0 || b.originalQuantity > 0),
        totalUsed: Array.from(usageCount.values()).reduce((sum, count) => sum + count, 0),
        totalRemaining: beercaps.reduce((sum, b) => sum + b.quantity, 0) - 
                        Array.from(usageCount.values()).reduce((sum, count) => sum + count, 0)
    };
    
    // Calculate total color error for comparison
    let totalError = 0;
    for (let i = 0; i < numCells; i++) {
        const slotIndex = assignments[i];
        if (slotIndex >= 0 && slotIndex < capSlots.length) {
            totalError += costMatrix[i][slotIndex];
        }
    }
    usageStats.totalColorError = totalError;
    usageStats.avgColorError = totalError / numCells;
    
    if (progressCallback) progressCallback('Complete!', 100);
    
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


// WASM module loader for Hungarian algorithm

let wasmModule = null;
let wasmLoadAttempted = false;
let wasmLoadPromise = null;

/**
 * Initialize and load the WASM module
 * @returns {Promise<boolean>} True if WASM loaded successfully, false otherwise
 */
export async function initWasm() {
    if (wasmLoadAttempted) {
        // Already attempted to load, return current state
        if (wasmLoadPromise) {
            await wasmLoadPromise;
        }
        return wasmModule !== null;
    }
    
    wasmLoadAttempted = true;
    
    wasmLoadPromise = (async () => {
        try {
            // Try to load the WASM module
            const module = await import('../wasm/pkg/hungarian_wasm.js');
            await module.default(); // Initialize the WASM module
            wasmModule = module;
            console.log('✓ WASM Hungarian algorithm loaded successfully');
            return true;
        } catch (error) {
            console.warn('WASM Hungarian algorithm not available, using JS fallback:', error.message);
            wasmModule = null;
            return false;
        }
    })();
    
    return wasmLoadPromise;
}

/**
 * Check if WASM module is loaded and ready
 * @returns {boolean}
 */
export function isWasmReady() {
    return wasmModule !== null;
}

/**
 * Run Hungarian algorithm using WASM (if available)
 * @param {number[][]} costMatrix - 2D cost matrix
 * @returns {number[]|null} Assignment array, or null if WASM not available
 */
export function hungarianWasm(costMatrix) {
    if (!wasmModule) {
        return null;
    }
    
    const numRows = costMatrix.length;
    const numCols = costMatrix[0]?.length || 0;
    
    if (numRows === 0 || numCols === 0) {
        return [];
    }
    
    // Flatten the 2D cost matrix to a 1D Float64Array
    const flatMatrix = new Float64Array(numRows * numCols);
    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            flatMatrix[i * numCols + j] = costMatrix[i][j];
        }
    }
    
    // Call the WASM function
    console.log('Calling WASM function with:', flatMatrix, numRows, numCols);
    const result = wasmModule.hungarian_algorithm(flatMatrix, numRows, numCols);
    
    // Convert Int32Array to regular array
    return Array.from(result);
}

/**
 * Get the WASM module status for debugging
 * @returns {Object}
 */
export function getWasmStatus() {
    return {
        loaded: wasmModule !== null,
        attempted: wasmLoadAttempted
    };
}


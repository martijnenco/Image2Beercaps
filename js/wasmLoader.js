// WASM module loader for Hungarian algorithm with multi-threading support

let wasmModule = null;
let wasmLoadAttempted = false;
let wasmLoadPromise = null;
let threadCount = 1;
let threadsEnabled = false;

/**
 * Check if SharedArrayBuffer is available (required for WASM threads)
 * @returns {boolean}
 */
function isSharedArrayBufferAvailable() {
    try {
        // Check if SharedArrayBuffer exists and is usable
        // This requires COOP/COEP headers to be set
        return typeof SharedArrayBuffer !== 'undefined' && 
               crossOriginIsolated === true;
    } catch {
        return false;
    }
}

/**
 * Initialize and load the WASM module with optional multi-threading
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
            
            // Try to initialize thread pool if SharedArrayBuffer is available
            if (isSharedArrayBufferAvailable()) {
                try {
                    // Get the number of logical processors (or default to 4)
                    const numCores = navigator.hardwareConcurrency || 4;
                    // Use most cores but leave one for the main thread
                    const poolSize = Math.max(2, numCores - 1);
                    
                    await module.initThreadPool(poolSize);
                    threadCount = module.get_thread_count();
                    threadsEnabled = module.threads_available();
                    
                    console.log(`✓ WASM Hungarian algorithm loaded with ${threadCount} threads`);
                } catch (threadError) {
                    console.warn('Thread pool initialization failed, using single-threaded mode:', threadError.message);
                    threadCount = 1;
                    threadsEnabled = false;
                }
            } else {
                console.log('✓ WASM Hungarian algorithm loaded (single-threaded, COOP/COEP headers not set)');
                threadCount = 1;
                threadsEnabled = false;
            }
            
            wasmModule = module;
            return true;
        } catch (error) {
            console.warn('WASM Hungarian algorithm not available, using JS fallback:', error.message);
            wasmModule = null;
            threadCount = 0;
            threadsEnabled = false;
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
 * Check if multi-threading is enabled
 * @returns {boolean}
 */
export function isThreaded() {
    return threadsEnabled;
}

/**
 * Get the number of threads being used
 * @returns {number}
 */
export function getThreadCount() {
    return threadCount;
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
        attempted: wasmLoadAttempted,
        threaded: threadsEnabled,
        threadCount: threadCount,
        sharedArrayBufferAvailable: isSharedArrayBufferAvailable()
    };
}

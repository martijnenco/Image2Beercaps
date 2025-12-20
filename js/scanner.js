// Beercap Scanner - Camera/Photo detection and clustering using OpenCV.js

let opencvReady = false;
let opencvLoadPromise = null;

/**
 * Load OpenCV.js for circle detection
 * Hosted locally to work with COEP headers
 */
export async function loadOpenCV() {
    if (opencvReady) return true;
    if (opencvLoadPromise) return opencvLoadPromise;
    
    opencvLoadPromise = new Promise((resolve, reject) => {
        // Check if already loaded
        if (typeof cv !== 'undefined' && cv.Mat) {
            opencvReady = true;
            console.log('✓ OpenCV.js ready');
            resolve(true);
            return;
        }
        
        // Load OpenCV.js from local vendor folder (same-origin works with COEP)
        const script = document.createElement('script');
        script.src = '/js/vendor/opencv.js';
        script.async = true;
        
        script.onload = () => {
            // OpenCV.js uses a callback when WASM is ready
            if (typeof cv !== 'undefined') {
                if (cv.Mat) {
                    // Already initialized
                    opencvReady = true;
                    console.log('✓ OpenCV.js ready');
                    resolve(true);
                } else {
                    cv['onRuntimeInitialized'] = () => {
                        opencvReady = true;
                        console.log('✓ OpenCV.js loaded and ready');
                        resolve(true);
                    };
                }
            } else {
                reject(new Error('OpenCV.js loaded but cv is undefined'));
            }
        };
        
        script.onerror = () => {
            reject(new Error('Failed to load OpenCV.js from /js/vendor/opencv.js'));
        };
        
        document.head.appendChild(script);
    });
    
    return opencvLoadPromise;
}

/**
 * Check if OpenCV is ready
 */
export function isOpenCVReady() {
    return opencvReady && typeof cv !== 'undefined' && cv.Mat;
}

/**
 * Start camera stream
 */
export async function startCamera(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Prefer rear camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        videoElement.srcObject = stream;
        await videoElement.play();
        return stream;
    } catch (error) {
        console.error('Camera access failed:', error);
        throw error;
    }
}

/**
 * Stop camera stream
 */
export function stopCamera(videoElement) {
    if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }
}

/**
 * Capture frame from video element
 */
export function captureFrame(videoElement) {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    return canvas;
}

/**
 * Detect circles using OpenCV.js Hough Circle Transform
 */
export function detectCircles(imageCanvas, options = {}) {
    const {
        minRadius = 20,
        maxRadius = 150,
        minDistance = null, // If null, defaults to minRadius * 2
        cannyThreshold = 100,
        accumulatorThreshold = 30
    } = options;
    
    if (!isOpenCVReady()) {
        throw new Error('OpenCV.js is not loaded. Make sure /js/vendor/opencv.js exists.');
    }
    
    // Read image from canvas
    const src = cv.imread(imageCanvas);
    const gray = new cv.Mat();
    const circles = new cv.Mat();
    
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply Gaussian blur to reduce noise
    cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);
    
    // Detect circles using Hough Circle Transform
    const dp = 1; // Inverse ratio of accumulator resolution
    const minDist = minDistance || minRadius * 2; // Min distance between circle centers
    
    cv.HoughCircles(
        gray,
        circles,
        cv.HOUGH_GRADIENT,
        dp,
        minDist,
        cannyThreshold,     // Upper Canny threshold
        accumulatorThreshold, // Accumulator threshold for circle centers
        minRadius,
        maxRadius
    );
    
    // Convert result to our format
    const result = [];
    for (let i = 0; i < circles.cols; i++) {
        const x = circles.data32F[i * 3];
        const y = circles.data32F[i * 3 + 1];
        const radius = circles.data32F[i * 3 + 2];
        result.push({ x, y, radius, confidence: 1.0 });
    }
    
    // Cleanup OpenCV matrices
    src.delete();
    gray.delete();
    circles.delete();
    
    console.log(`OpenCV detected ${result.length} circles`);
    return result;
}

/**
 * Extract beercap image from detected circle
 */
export function extractCapImage(sourceCanvas, circle, size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Extract the circle region
    const { x, y, radius } = circle;
    const srcSize = radius * 2;
    
    ctx.drawImage(
        sourceCanvas,
        x - radius, y - radius, srcSize, srcSize,
        0, 0, size, size
    );
    
    return canvas;
}

/**
 * Compute detailed color histogram with spatial regions for better cap differentiation
 */
export function computeColorHistogram(canvas, bins = 16) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY);
    
    // Create histogram bins for H, S, V channels (better for color differentiation)
    const histH = new Array(bins).fill(0);
    const histS = new Array(bins).fill(0);
    const histV = new Array(bins).fill(0);
    
    // Also track spatial color distribution (center vs edge)
    const histCenterH = new Array(bins).fill(0);
    const histEdgeH = new Array(bins).fill(0);
    
    const binSize = 256 / bins;
    let totalWeight = 0;
    let centerWeight = 0;
    let edgeWeight = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            
            // Only sample within circular region
            if (dist > radius) continue;
            
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Convert RGB to HSV for better color matching
            const hsv = rgbToHsv(r, g, b);
            
            const weight = 1;
            totalWeight += weight;
            
            histH[Math.min(bins - 1, Math.floor(hsv.h / binSize))] += weight;
            histS[Math.min(bins - 1, Math.floor(hsv.s / binSize))] += weight;
            histV[Math.min(bins - 1, Math.floor(hsv.v / binSize))] += weight;
            
            // Track spatial distribution
            const isCenter = dist < radius * 0.5;
            if (isCenter) {
                histCenterH[Math.min(bins - 1, Math.floor(hsv.h / binSize))] += 1;
                centerWeight += 1;
            } else {
                histEdgeH[Math.min(bins - 1, Math.floor(hsv.h / binSize))] += 1;
                edgeWeight += 1;
            }
        }
    }
    
    // Normalize all histograms
    const normalizeHist = (hist, total) => hist.map(v => total > 0 ? v / total : 0);
    
    const histogram = [
        ...normalizeHist(histH, totalWeight),
        ...normalizeHist(histS, totalWeight),
        ...normalizeHist(histV, totalWeight),
        ...normalizeHist(histCenterH, centerWeight),
        ...normalizeHist(histEdgeH, edgeWeight)
    ];
    
    return histogram;
}

/**
 * Convert RGB to HSV color space
 */
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    if (diff !== 0) {
        if (max === r) {
            h = ((g - b) / diff) % 6;
        } else if (max === g) {
            h = (b - r) / diff + 2;
        } else {
            h = (r - g) / diff + 4;
        }
        h = Math.round(h * 42.5); // Scale to 0-255
        if (h < 0) h += 255;
    }
    
    const s = max === 0 ? 0 : Math.round((diff / max) * 255);
    const v = Math.round(max * 255);
    
    return { h, s, v };
}

/**
 * Compute similarity between two histograms (0-1, 1 = identical)
 * Uses a combination of histogram intersection and chi-squared distance
 */
export function histogramSimilarity(hist1, hist2) {
    if (hist1.length !== hist2.length) return 0;
    
    // Histogram intersection (sum of minimums)
    let intersection = 0;
    let chiSquared = 0;
    
    for (let i = 0; i < hist1.length; i++) {
        intersection += Math.min(hist1[i], hist2[i]);
        
        // Chi-squared distance (penalizes differences more strongly)
        const sum = hist1[i] + hist2[i];
        if (sum > 0) {
            chiSquared += ((hist1[i] - hist2[i]) ** 2) / sum;
        }
    }
    
    // Combine both metrics: high intersection + low chi-squared = similar
    // Chi-squared typically ranges from 0 (identical) to 2 (completely different)
    const chiSimilarity = Math.max(0, 1 - chiSquared / 2);
    
    // Weight intersection more since it's more robust
    return intersection * 0.6 + chiSimilarity * 0.4;
}

/**
 * Compute average color of a cap image
 */
export function computeAverageColor(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    
    let totalR = 0, totalG = 0, totalB = 0;
    let totalWeight = 0;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Only sample within circular region
            const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            if (dist > radius) continue;
            
            // Center-weighted
            const weight = 1 - (dist / radius) * 0.5;
            
            const idx = (y * width + x) * 4;
            totalR += data[idx] * weight;
            totalG += data[idx + 1] * weight;
            totalB += data[idx + 2] * weight;
            totalWeight += weight;
        }
    }
    
    return {
        r: Math.round(totalR / totalWeight),
        g: Math.round(totalG / totalWeight),
        b: Math.round(totalB / totalWeight)
    };
}

/**
 * Cluster similar beercaps together
 * Uses stricter thresholds to avoid grouping different caps together
 */
export function clusterCaps(caps, similarityThreshold = 0.99) {
    if (caps.length === 0) return [];
    
    // Compute histograms and average colors for all caps
    const capsWithFeatures = caps.map(cap => {
        const avgColor = computeAverageColor(cap.image);
        return {
            ...cap,
            histogram: computeColorHistogram(cap.image),
            avgColor
        };
    });
    
    // Greedy clustering with stricter matching
    const clusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < capsWithFeatures.length; i++) {
        if (assigned.has(i)) continue;
        
        const cluster = {
            representative: capsWithFeatures[i],
            members: [capsWithFeatures[i]],
            color: capsWithFeatures[i].avgColor
        };
        assigned.add(i);
        
        // Find similar caps
        for (let j = i + 1; j < capsWithFeatures.length; j++) {
            if (assigned.has(j)) continue;
            
            // Check histogram similarity
            const histSimilarity = histogramSimilarity(
                capsWithFeatures[i].histogram,
                capsWithFeatures[j].histogram
            );
            
            // Also check average color similarity as a secondary filter
            const colorDist = Math.sqrt(
                (capsWithFeatures[i].avgColor.r - capsWithFeatures[j].avgColor.r) ** 2 +
                (capsWithFeatures[i].avgColor.g - capsWithFeatures[j].avgColor.g) ** 2 +
                (capsWithFeatures[i].avgColor.b - capsWithFeatures[j].avgColor.b) ** 2
            );
            const maxColorDist = Math.sqrt(3 * 255 * 255);
            const colorSimilarity = 1 - (colorDist / maxColorDist);
            
            // Both histogram AND color must be similar
            const isSimilar = histSimilarity >= similarityThreshold && colorSimilarity >= similarityThreshold;
            
            if (isSimilar) {
                cluster.members.push(capsWithFeatures[j]);
                assigned.add(j);
            }
        }
        
        clusters.push(cluster);
    }
    
    return clusters;
}

/**
 * Full scan pipeline: detect circles, extract caps, cluster
 */
export async function scanImage(imageSource, options = {}, progressCallback = null) {
    const {
        minRadius,
        maxRadius,
        similarityThreshold // Higher threshold to avoid false groupings
    } = options;
    
    // Try to load OpenCV for better circle detection
    if (progressCallback) progressCallback('Loading OpenCV...', 5);
    await loadOpenCV();
    
    // Get canvas from source
    let canvas;
    if (imageSource instanceof HTMLCanvasElement) {
        canvas = imageSource;
    } else if (imageSource instanceof HTMLImageElement) {
        canvas = document.createElement('canvas');
        canvas.width = imageSource.naturalWidth || imageSource.width;
        canvas.height = imageSource.naturalHeight || imageSource.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageSource, 0, 0);
    } else if (imageSource instanceof HTMLVideoElement) {
        canvas = captureFrame(imageSource);
    } else {
        throw new Error('Invalid image source');
    }
    
    const detectionMethod = isOpenCVReady() ? 'OpenCV Hough Transform' : 'edge detection';
    if (progressCallback) progressCallback(`Detecting circles (${detectionMethod})...`, 10);
    
    // Detect circles
    const circles = detectCircles(canvas, { minRadius, maxRadius });
    
    if (progressCallback) progressCallback(`Found ${circles.length} circles`, 40);
    
    if (circles.length === 0) {
        return { circles: [], caps: [], clusters: [] };
    }
    
    // Extract cap images
    const caps = circles.map((circle, index) => ({
        id: index,
        circle,
        image: extractCapImage(canvas, circle, 64)
    }));
    
    if (progressCallback) progressCallback('Clustering similar caps...', 60);
    
    // Cluster similar caps
    const clusters = clusterCaps(caps, similarityThreshold);
    
    if (progressCallback) progressCallback(`Found ${clusters.length} unique cap types`, 90);
    
    // Create result with image data URLs
    const result = {
        sourceCanvas: canvas,
        circles,
        caps,
        clusters: clusters.map((cluster, idx) => ({
            id: idx,
            count: cluster.members.length,
            color: cluster.color,
            imageDataUrl: cluster.representative.image.toDataURL('image/png'),
            members: cluster.members.map(m => m.id)
        }))
    };
    
    if (progressCallback) progressCallback('Complete!', 100);
    
    return result;
}

/**
 * Draw detection overlay on canvas
 */
export function drawDetectionOverlay(canvas, circles, clusters = null) {
    const ctx = canvas.getContext('2d');
    
    // Create color map for clusters
    const colorMap = new Map();
    if (clusters) {
        clusters.forEach((cluster, idx) => {
            const hue = (idx * 137) % 360; // Golden angle for distinct colors
            cluster.members.forEach(memberId => {
                colorMap.set(memberId, `hsl(${hue}, 70%, 50%)`);
            });
        });
    }
    
    // Draw circles
    circles.forEach((circle, idx) => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        ctx.strokeStyle = colorMap.get(idx) || '#00ff00';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw index number
        ctx.fillStyle = colorMap.get(idx) || '#00ff00';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), circle.x, circle.y);
    });
}


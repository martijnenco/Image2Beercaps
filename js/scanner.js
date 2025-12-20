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
 * Extract ORB features from a cap image using OpenCV
 * ORB is rotation and scale invariant, robust to lighting changes
 */
export function extractORBFeatures(canvas) {
    if (!isOpenCVReady()) {
        throw new Error('OpenCV is required for feature extraction');
    }
    
    // Read canvas into OpenCV Mat
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply circular mask to focus on the cap (ignore corners)
    const mask = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
    const center = new cv.Point(gray.cols / 2, gray.rows / 2);
    const radius = Math.min(gray.cols, gray.rows) / 2 - 2;
    cv.circle(mask, center, radius, new cv.Scalar(255), -1);
    
    // Create ORB detector with more features for better matching
    const orb = new cv.ORB(500); // 500 features max
    
    // Detect keypoints and compute descriptors
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    
    orb.detectAndCompute(gray, mask, keypoints, descriptors);
    
    // Cleanup
    src.delete();
    gray.delete();
    mask.delete();
    orb.delete();
    
    return { keypoints, descriptors };
}

/**
 * Match ORB features between two caps
 * Returns a similarity score based on number of good matches
 */
export function matchORBFeatures(features1, features2) {
    if (!isOpenCVReady()) {
        throw new Error('OpenCV is required for feature matching');
    }
    
    const { descriptors: desc1 } = features1;
    const { descriptors: desc2 } = features2;
    
    // If either has no features, they can't be matched
    if (desc1.rows === 0 || desc2.rows === 0) {
        return 0;
    }
    
    // Use BFMatcher with Hamming distance for ORB (binary descriptors)
    const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
    
    // Find k=2 nearest matches for ratio test
    const matches = new cv.DMatchVectorVector();
    bf.knnMatch(desc1, desc2, matches, 2);
    
    // Apply Lowe's ratio test to filter good matches
    let goodMatches = 0;
    const ratioThreshold = 0.75;
    
    for (let i = 0; i < matches.size(); i++) {
        const match = matches.get(i);
        if (match.size() >= 2) {
            const m = match.get(0);
            const n = match.get(1);
            if (m.distance < ratioThreshold * n.distance) {
                goodMatches++;
            }
        }
    }
    
    // Cleanup
    bf.delete();
    matches.delete();
    
    // Calculate similarity score based on number of good matches
    // Normalize by the minimum number of features (so we compare fairly)
    const minFeatures = Math.min(desc1.rows, desc2.rows);
    const matchRatio = goodMatches / minFeatures;
    
    // Return a score between 0-1, with bonus for having many absolute matches
    // More good matches = higher confidence
    const absoluteScore = Math.min(1, goodMatches / 15); // 15+ matches = perfect
    const ratioScore = matchRatio;
    
    return absoluteScore * 0.6 + ratioScore * 0.4;
}

/**
 * Check if two caps are the same using ORB feature matching
 * Handles rotation and lighting variations
 */
export function areCapsMatching(cap1Features, cap2Features, threshold = 0.35) {
    const similarity = matchORBFeatures(cap1Features, cap2Features);
    return {
        isMatch: similarity >= threshold,
        similarity
    };
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
 * Cluster similar beercaps together using ORB feature matching
 * Robust to rotation and lighting variations
 */
export function clusterCaps(caps, matchThreshold = 0.35) {
    if (caps.length === 0) return [];
    
    if (!isOpenCVReady()) {
        console.error('OpenCV not ready for clustering');
        return caps.map((cap, idx) => ({
            representative: cap,
            members: [cap],
            color: computeAverageColor(cap.image)
        }));
    }
    
    console.log(`Clustering ${caps.length} caps using ORB feature matching...`);
    
    // Extract ORB features for all caps
    const capsWithFeatures = caps.map((cap, idx) => {
        try {
            const features = extractORBFeatures(cap.image);
            const avgColor = computeAverageColor(cap.image);
            console.log(`Cap ${idx}: ${features.descriptors.rows} ORB features extracted`);
            return {
                ...cap,
                features,
                avgColor
            };
        } catch (error) {
            console.warn(`Failed to extract features for cap ${idx}:`, error);
            return {
                ...cap,
                features: null,
                avgColor: computeAverageColor(cap.image)
            };
        }
    });
    
    // Greedy clustering using ORB matching
    const clusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < capsWithFeatures.length; i++) {
        if (assigned.has(i)) continue;
        
        const cap1 = capsWithFeatures[i];
        const cluster = {
            representative: cap1,
            members: [cap1],
            color: cap1.avgColor
        };
        assigned.add(i);
        
        // Skip matching if this cap has no features
        if (!cap1.features || cap1.features.descriptors.rows === 0) {
            clusters.push(cluster);
            continue;
        }
        
        // Find similar caps
        for (let j = i + 1; j < capsWithFeatures.length; j++) {
            if (assigned.has(j)) continue;
            
            const cap2 = capsWithFeatures[j];
            
            // Skip if no features
            if (!cap2.features || cap2.features.descriptors.rows === 0) {
                continue;
            }
            
            // Match using ORB features
            const { isMatch, similarity } = areCapsMatching(cap1.features, cap2.features, matchThreshold);
            
            if (isMatch) {
                console.log(`Caps ${i} and ${j} match with similarity ${similarity.toFixed(2)}`);
                cluster.members.push(cap2);
                assigned.add(j);
            }
        }
        
        clusters.push(cluster);
    }
    
    // Cleanup OpenCV objects
    capsWithFeatures.forEach(cap => {
        if (cap.features) {
            try {
                cap.features.keypoints.delete();
                cap.features.descriptors.delete();
            } catch (e) {
                // Already deleted or invalid
            }
        }
    });
    
    console.log(`Clustering complete: ${caps.length} caps -> ${clusters.length} unique types`);
    
    return clusters;
}

/**
 * Full scan pipeline: detect circles, extract caps, cluster
 */
export async function scanImage(imageSource, options = {}, progressCallback = null) {
    const {
        minRadius = 20,
        maxRadius = 100,
        matchThreshold = 0.35 // ORB feature matching threshold
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
    
    // Cluster similar caps using ORB feature matching
    const clusters = clusterCaps(caps, matchThreshold);
    
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
            imageDataUrl: cluster.representative.image.toDataURL('image/jpeg', 0.85),
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


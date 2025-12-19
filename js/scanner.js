// Beercap Scanner - Camera/Photo detection and clustering

let cocoModel = null;
let isModelLoading = false;
let modelLoadPromise = null;

/**
 * Load COCO-SSD model for object detection
 */
export async function loadModel() {
    if (cocoModel) return cocoModel;
    if (modelLoadPromise) return modelLoadPromise;
    
    isModelLoading = true;
    modelLoadPromise = (async () => {
        try {
            // Check if cocoSsd is available (loaded from CDN)
            if (typeof cocoSsd === 'undefined') {
                throw new Error('COCO-SSD model not loaded. Check script tags.');
            }
            cocoModel = await cocoSsd.load();
            console.log('✓ COCO-SSD model loaded');
            return cocoModel;
        } catch (error) {
            console.error('Failed to load COCO-SSD model:', error);
            throw error;
        } finally {
            isModelLoading = false;
        }
    })();
    
    return modelLoadPromise;
}

/**
 * Check if model is ready
 */
export function isModelReady() {
    return cocoModel !== null;
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
 * Detect circular objects (beercaps) in an image using color-based circle detection
 * This is a simpler approach than full ML - looks for circular regions
 */
export function detectCircles(imageCanvas, options = {}) {
    const {
        minRadius = 20,
        maxRadius = 150,
        sensitivity = 0.3,
        minDistance = 30
    } = options;
    
    const ctx = imageCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const { width, height, data } = imageData;
    
    // Convert to grayscale and detect edges
    const gray = new Uint8Array(width * height);
    const edges = new Uint8Array(width * height);
    
    // Grayscale conversion
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    }
    
    // Simple edge detection (Sobel-like)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const gx = -gray[idx - width - 1] + gray[idx - width + 1]
                     - 2 * gray[idx - 1] + 2 * gray[idx + 1]
                     - gray[idx + width - 1] + gray[idx + width + 1];
            const gy = -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1]
                     + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
            edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        }
    }
    
    // Simple circle detection using accumulator
    const circles = [];
    const step = Math.max(5, Math.floor(minRadius / 3));
    
    // Scan for potential circle centers
    for (let y = maxRadius; y < height - maxRadius; y += step) {
        for (let x = maxRadius; x < width - maxRadius; x += step) {
            // Check various radii
            for (let r = minRadius; r <= maxRadius; r += 5) {
                let edgeCount = 0;
                let totalPoints = 0;
                
                // Sample points on circle circumference
                const numSamples = Math.max(16, Math.floor(2 * Math.PI * r / 8));
                for (let i = 0; i < numSamples; i++) {
                    const angle = (2 * Math.PI * i) / numSamples;
                    const px = Math.round(x + r * Math.cos(angle));
                    const py = Math.round(y + r * Math.sin(angle));
                    
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        totalPoints++;
                        if (edges[py * width + px] > 50) {
                            edgeCount++;
                        }
                    }
                }
                
                const ratio = edgeCount / totalPoints;
                if (ratio > sensitivity) {
                    // Check if too close to existing circle
                    let tooClose = false;
                    for (const c of circles) {
                        const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
                        if (dist < minDistance) {
                            tooClose = true;
                            if (ratio > c.confidence) {
                                c.x = x;
                                c.y = y;
                                c.radius = r;
                                c.confidence = ratio;
                            }
                            break;
                        }
                    }
                    
                    if (!tooClose) {
                        circles.push({ x, y, radius: r, confidence: ratio });
                    }
                }
            }
        }
    }
    
    return circles;
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
 * Compute color histogram for an image
 */
export function computeColorHistogram(canvas, bins = 8) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    
    // Create histogram bins for R, G, B channels
    const histR = new Array(bins).fill(0);
    const histG = new Array(bins).fill(0);
    const histB = new Array(bins).fill(0);
    
    const binSize = 256 / bins;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    let totalWeight = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Center-weighted sampling
            const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const weight = 1 - (dist / maxDist) * 0.5;
            
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            histR[Math.min(bins - 1, Math.floor(r / binSize))] += weight;
            histG[Math.min(bins - 1, Math.floor(g / binSize))] += weight;
            histB[Math.min(bins - 1, Math.floor(b / binSize))] += weight;
            
            totalWeight += weight;
        }
    }
    
    // Normalize
    const histogram = [...histR, ...histG, ...histB].map(v => v / totalWeight);
    return histogram;
}

/**
 * Compute similarity between two histograms (0-1, 1 = identical)
 */
export function histogramSimilarity(hist1, hist2) {
    if (hist1.length !== hist2.length) return 0;
    
    // Bhattacharyya coefficient
    let sum = 0;
    for (let i = 0; i < hist1.length; i++) {
        sum += Math.sqrt(hist1[i] * hist2[i]);
    }
    return sum;
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
 */
export function clusterCaps(caps, similarityThreshold = 0.85) {
    if (caps.length === 0) return [];
    
    // Compute histograms for all caps
    const capsWithHist = caps.map(cap => ({
        ...cap,
        histogram: computeColorHistogram(cap.image)
    }));
    
    // Greedy clustering
    const clusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < capsWithHist.length; i++) {
        if (assigned.has(i)) continue;
        
        const cluster = {
            representative: capsWithHist[i],
            members: [capsWithHist[i]],
            color: computeAverageColor(capsWithHist[i].image)
        };
        assigned.add(i);
        
        // Find similar caps
        for (let j = i + 1; j < capsWithHist.length; j++) {
            if (assigned.has(j)) continue;
            
            const similarity = histogramSimilarity(
                capsWithHist[i].histogram,
                capsWithHist[j].histogram
            );
            
            if (similarity >= similarityThreshold) {
                cluster.members.push(capsWithHist[j]);
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
        minRadius = 20,
        maxRadius = 100,
        similarityThreshold = 0.8
    } = options;
    
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
    
    if (progressCallback) progressCallback('Detecting circles...', 10);
    
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


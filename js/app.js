// Main application logic

import { getBeercaps, saveBeercaps, addBeercap, updateBeercap, deleteBeercap, generateId, getTotalBeercapCount } from './storage.js';
import { extractAverageColor, rgbToHex, getContrastColor, colorDistance } from './colorUtils.js';
import { calculateGridDimensions, generateMosaic, generateMosaicOptimized, createBeercapCodes, gridToCSV, generateLegend, HEX_VERTICAL_FACTOR } from './gridGenerator.js';
import { initWasm, isWasmReady, isThreaded, getThreadCount } from './wasmLoader.js';
import { startCamera, stopCamera, scanImage, drawDetectionOverlay } from './scanner.js';

// Application state
let targetImage = null;
let currentMosaic = null;
let beercapCodes = null;
let currentLayout = 'hex'; // 'square' or 'hex'

// DOM Elements
const beercapList = document.getElementById('beercap-list');
const addBeercapBtn = document.getElementById('add-beercap-btn');
const beercapModal = document.getElementById('beercap-modal');
const beercapForm = document.getElementById('beercap-form');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');

const targetImageInput = document.getElementById('target-image-input');
const targetImagePreview = document.getElementById('target-image-preview');
const targetImagePlaceholder = document.getElementById('target-image-placeholder');
const gridInfo = document.getElementById('grid-info');
const generateBtn = document.getElementById('generate-btn');

const outputTabs = document.querySelectorAll('.tab-btn');
const outputPanels = document.querySelectorAll('.tab-panel');

const visualCanvas = document.getElementById('visual-canvas');
const referenceGrid = document.getElementById('reference-grid');
const legendContainer = document.getElementById('legend-container');
const statsContent = document.getElementById('stats-content');

const downloadPngBtn = document.getElementById('download-png-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');

const totalCapsDisplay = document.getElementById('total-caps');
const clearLibraryBtn = document.getElementById('clear-library-btn');

// LocalStorage keys
const STORAGE_LAYOUT_KEY = 'beercap_layout';
const STORAGE_TARGET_IMAGE_KEY = 'beercap_target_image';

// Initialize application
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadBeercapLibrary();
    loadSavedLayout();
    loadSavedTargetImage();
    setupEventListeners();
    updateTotalCaps();
    updateWasmStatus();
}

// Update WASM status indicator
async function updateWasmStatus() {
    const statusEl = document.getElementById('wasm-status');
    if (!statusEl) return;
    
    const iconEl = statusEl.querySelector('.wasm-icon');
    const textEl = statusEl.querySelector('.wasm-text');
    
    // Wait for WASM to finish loading
    await initWasm();
    
    if (isWasmReady()) {
        statusEl.classList.remove('loading', 'fallback');
        statusEl.classList.add('ready');
        
        if (isThreaded()) {
            const threads = getThreadCount();
            iconEl.textContent = '🚀';
            textEl.textContent = `WASM ${threads} threads`;
        } else {
            iconEl.textContent = '⚡';
            textEl.textContent = 'WASM (single-threaded)';
        }
    } else {
        statusEl.classList.remove('loading', 'ready');
        statusEl.classList.add('fallback');
        iconEl.textContent = '🐢';
        textEl.textContent = 'JavaScript Fallback';
    }
}

// Load saved layout setting
function loadSavedLayout() {
    const savedLayout = localStorage.getItem(STORAGE_LAYOUT_KEY);
    if (savedLayout && (savedLayout === 'square' || savedLayout === 'hex')) {
        currentLayout = savedLayout;
        const radioBtn = document.getElementById(savedLayout === 'hex' ? 'layout-hex' : 'layout-square');
        if (radioBtn) radioBtn.checked = true;
    }
}

// Save layout setting
function saveLayout(layout) {
    localStorage.setItem(STORAGE_LAYOUT_KEY, layout);
}

// Load saved target image
function loadSavedTargetImage() {
    const savedImageData = localStorage.getItem(STORAGE_TARGET_IMAGE_KEY);
    if (savedImageData) {
        const img = new Image();
        img.onload = () => {
            targetImage = img;
            targetImagePreview.src = savedImageData;
            targetImagePreview.classList.remove('hidden');
            targetImagePlaceholder.classList.add('hidden');
            updateGridInfo();
            generateBtn.disabled = false;
        };
        img.onerror = () => {
            // Clear invalid saved image
            localStorage.removeItem(STORAGE_TARGET_IMAGE_KEY);
        };
        img.src = savedImageData;
    }
}

// Save target image
function saveTargetImage(imageDataUrl) {
    try {
        localStorage.setItem(STORAGE_TARGET_IMAGE_KEY, imageDataUrl);
    } catch (e) {
        // Handle quota exceeded - image might be too large
        console.warn('Could not save target image to localStorage:', e.message);
    }
}

function setupEventListeners() {
    // Beercap management
    addBeercapBtn.addEventListener('click', openAddModal);
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    beercapForm.addEventListener('submit', handleBeercapSubmit);
    clearLibraryBtn.addEventListener('click', handleClearLibrary);
    
    // Scan beercaps
    document.getElementById('scan-beercaps-btn').addEventListener('click', openScanModal);
    setupScanModal();
    
    // Close modal on backdrop click
    beercapModal.addEventListener('click', (e) => {
        if (e.target === beercapModal) closeModal();
    });
    
    // Image preview when adding beercap
    document.getElementById('beercap-image').addEventListener('change', handleBeercapImagePreview);
    
    // Target image
    targetImageInput.addEventListener('change', handleTargetImageUpload);
    
    // Drag and drop for target image
    const uploadArea = document.getElementById('target-upload-area');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            targetImageInput.files = e.dataTransfer.files;
            handleTargetImageUpload({ target: targetImageInput });
        }
    });
    
    // Generate mosaic
    generateBtn.addEventListener('click', handleGenerateMosaic);
    
    // Tabs
    outputTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Export buttons
    downloadPngBtn.addEventListener('click', handleDownloadPng);
    downloadCsvBtn.addEventListener('click', handleDownloadCsv);
    
    // Layout toggle
    document.querySelectorAll('input[name="layout"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentLayout = e.target.value;
            saveLayout(currentLayout);
            updateGridInfo();
        });
    });
}

// Get current layout setting
function getLayoutType() {
    const selected = document.querySelector('input[name="layout"]:checked');
    return selected ? selected.value : 'hex';
}

// Beercap Library Functions
function loadBeercapLibrary() {
    const beercaps = getBeercaps();
    renderBeercapList(beercaps);
}

function renderBeercapList(beercaps) {
    if (beercaps.length === 0) {
        beercapList.innerHTML = `
            <div class="empty-library">
                <p>No beercaps added yet.</p>
                <p>Click "Add Beercap" to start building your library.</p>
            </div>
        `;
        return;
    }
    
    beercapList.innerHTML = beercaps.map(beercap => `
        <div class="beercap-item" data-id="${beercap.id}">
            <img src="${beercap.imageData}" alt="${beercap.name}" class="beercap-thumbnail">
            <div class="beercap-info">
                <span class="beercap-name" data-id="${beercap.id}" title="Click to edit">${beercap.name}</span>
                <div class="beercap-details">
                    <span class="beercap-color" style="background-color: ${rgbToHex(beercap.color)}"></span>
                    <span class="beercap-hex">${rgbToHex(beercap.color)}</span>
                </div>
            </div>
            <div class="beercap-quantity">
                <button class="qty-btn qty-minus" data-id="${beercap.id}">−</button>
                <input type="number" class="qty-input" value="${beercap.quantity}" min="0" data-id="${beercap.id}">
                <button class="qty-btn qty-plus" data-id="${beercap.id}">+</button>
            </div>
            <button class="delete-btn" data-id="${beercap.id}" title="Delete beercap">×</button>
        </div>
    `).join('');
    
    // Add event listeners for quantity controls
    beercapList.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => adjustQuantity(btn.dataset.id, -1));
    });
    beercapList.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => adjustQuantity(btn.dataset.id, 1));
    });
    beercapList.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const qty = Math.max(0, parseInt(e.target.value) || 0);
            updateBeercap(input.dataset.id, { quantity: qty });
            e.target.value = qty;
            updateTotalCaps();
            updateGridInfo();
        });
    });
    beercapList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteBeercap(btn.dataset.id));
    });
    
    // Add click-to-edit for names
    beercapList.querySelectorAll('.beercap-name').forEach(nameEl => {
        nameEl.addEventListener('click', () => startEditName(nameEl));
    });
}

function startEditName(nameEl) {
    const id = nameEl.dataset.id;
    const currentName = nameEl.textContent;
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'beercap-name-input';
    input.value = currentName;
    
    // Replace span with input
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    
    // Save on blur or Enter
    const saveName = () => {
        const newName = input.value.trim() || currentName;
        updateBeercap(id, { name: newName });
        loadBeercapLibrary();
    };
    
    input.addEventListener('blur', saveName);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            input.value = currentName;
            input.blur();
        }
    });
}

function adjustQuantity(id, delta) {
    const beercaps = getBeercaps();
    const beercap = beercaps.find(b => b.id === id);
    if (beercap) {
        const newQty = Math.max(0, beercap.quantity + delta);
        updateBeercap(id, { quantity: newQty });
        loadBeercapLibrary();
        updateTotalCaps();
        updateGridInfo();
    }
}

function handleDeleteBeercap(id) {
    if (confirm('Delete this beercap from your library?')) {
        deleteBeercap(id);
        loadBeercapLibrary();
        updateTotalCaps();
        updateGridInfo();
    }
}

function handleClearLibrary() {
    if (confirm('Are you sure you want to clear your entire beercap library? This cannot be undone.')) {
        saveBeercaps([]);
        loadBeercapLibrary();
        updateTotalCaps();
        updateGridInfo();
    }
}

// Modal Functions
function openAddModal() {
    beercapForm.reset();
    document.getElementById('beercap-preview').innerHTML = '';
    document.getElementById('modal-title').textContent = 'Add Beercap';
    beercapModal.classList.add('active');
}

function closeModal() {
    beercapModal.classList.remove('active');
}

function handleBeercapImagePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const preview = document.getElementById('beercap-preview');
        preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
}

async function handleBeercapSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('beercap-name').value.trim();
    const quantity = parseInt(document.getElementById('beercap-quantity').value) || 0;
    const imageFile = document.getElementById('beercap-image').files[0];
    
    if (!name || !imageFile) {
        alert('Please provide a name and image for the beercap.');
        return;
    }
    
    // Show loading state
    const submitBtn = beercapForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;
    
    try {
        // Read image as data URL
        const imageData = await readFileAsDataURL(imageFile);
        
        // Extract average color
        const color = await extractAverageColor(imageData);
        
        // Create beercap object
        const beercap = {
            id: generateId(),
            name,
            imageData,
            color,
            quantity
        };
        
        addBeercap(beercap);
        loadBeercapLibrary();
        updateTotalCaps();
        updateGridInfo();
        closeModal();
    } catch (error) {
        console.error('Error adding beercap:', error);
        alert('Error processing beercap image. Please try again.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Target Image Functions
function handleTargetImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const imageDataUrl = event.target.result;
        const img = new Image();
        img.onload = () => {
            targetImage = img;
            targetImagePreview.src = imageDataUrl;
            targetImagePreview.classList.remove('hidden');
            targetImagePlaceholder.classList.add('hidden');
            updateGridInfo();
            generateBtn.disabled = false;
            // Save to localStorage for persistence
            saveTargetImage(imageDataUrl);
        };
        img.src = imageDataUrl;
    };
    reader.readAsDataURL(file);
}

function updateTotalCaps() {
    const total = getTotalBeercapCount();
    totalCapsDisplay.textContent = total;
}

function updateGridInfo() {
    const totalCaps = getTotalBeercapCount();
    const layout = getLayoutType();
    
    if (!targetImage || totalCaps === 0) {
        gridInfo.textContent = 'Upload an image and add beercaps to see grid dimensions';
        return;
    }
    
    const dimensions = calculateGridDimensions(
        totalCaps,
        targetImage.naturalWidth || targetImage.width,
        targetImage.naturalHeight || targetImage.height,
        layout
    );
    
    const layoutLabel = layout === 'hex' ? 'Hexagonal' : 'Square';
    gridInfo.textContent = `${layoutLabel} Grid: ${dimensions.width} × ${dimensions.height} = ${dimensions.totalCells} caps`;
}

// Mosaic Generation
async function handleGenerateMosaic() {
    const beercaps = getBeercaps();
    
    if (!targetImage) {
        alert('Please upload a target image first.');
        return;
    }
    
    if (beercaps.length === 0) {
        alert('Please add some beercaps to your library first.');
        return;
    }
    
    const totalCaps = getTotalBeercapCount();
    if (totalCaps === 0) {
        alert('You need at least one beercap with quantity > 0.');
        return;
    }
    
    // Get progress modal elements
    const progressModal = document.getElementById('progress-modal');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progress-percent');
    
    // Show loading state
    generateBtn.disabled = true;
    progressModal.classList.add('active');
    progressFill.style.width = '0%';
    progressText.textContent = 'Initializing...';
    progressPercent.textContent = '0%';
    
    // Progress callback to update progress bar
    const updateProgress = (message, percent) => {
        progressFill.style.width = `${percent}%`;
        progressText.textContent = message;
        progressPercent.textContent = `${percent}%`;
    };
    
    // Use setTimeout to allow UI to update, then run async
    const layout = getLayoutType();
    
    setTimeout(async () => {
        try {
            const dimensions = calculateGridDimensions(
                totalCaps,
                targetImage.naturalWidth || targetImage.width,
                targetImage.naturalHeight || targetImage.height,
                layout
            );
            
            // Use optimized algorithm for global color matching
            const result = await generateMosaicOptimized(targetImage, beercaps, dimensions, updateProgress);
            currentMosaic = result;
            beercapCodes = createBeercapCodes(beercaps);
            
            renderVisualPreview(result.grid, dimensions);
            renderReferenceGrid(result.grid, beercapCodes, dimensions);
            renderLegend(beercaps, beercapCodes);
            renderStats(result.usageStats);
            
            // Show output section and switch to visual tab
            document.getElementById('output-section').classList.remove('hidden');
            switchTab('visual');
            
            // Enable export buttons
            downloadPngBtn.disabled = false;
            downloadCsvBtn.disabled = false;
            
            // Hide progress modal
            progressModal.classList.remove('active');
        } catch (error) {
            console.error('Error generating mosaic:', error);
            alert('Error generating mosaic. Please try again.');
        } finally {
            generateBtn.disabled = false;
            progressModal.classList.remove('active');
        }
    }, 50);
}

function renderVisualPreview(grid, dimensions) {
    const canvas = visualCanvas;
    const ctx = canvas.getContext('2d');
    const isHex = dimensions.layout === 'hex';
    
    // Calculate cell size for a reasonable canvas size
    const maxCanvasWidth = 1200;
    const maxCanvasHeight = 800;
    
    const cellSize = Math.min(
        Math.floor(maxCanvasWidth / dimensions.width),
        Math.floor(maxCanvasHeight / (dimensions.height * (isHex ? HEX_VERTICAL_FACTOR : 1))),
        50 // Maximum cell size
    );
    
    // Calculate canvas size based on layout
    if (isHex) {
        // Hex layout: account for offset and vertical packing
        canvas.width = dimensions.width * cellSize + cellSize / 2; // Extra half for offset
        canvas.height = cellSize + (dimensions.height - 1) * cellSize * HEX_VERTICAL_FACTOR;
    } else {
        canvas.width = dimensions.width * cellSize;
        canvas.height = dimensions.height * cellSize;
    }
    
    // Draw each cell
    const imageCache = new Map();
    
    // Pre-load all unique images
    const uniqueImages = [...new Set(grid.flat().filter(cell => cell.beercapImage).map(cell => cell.beercapImage))];
    
    if (uniqueImages.length === 0) {
        // No images, just draw colors
        drawGridWithColors(ctx, grid, cellSize, isHex);
        return;
    }
    
    let loaded = 0;
    uniqueImages.forEach(imgData => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(imgData, img);
            loaded++;
            if (loaded === uniqueImages.length) {
                drawGridWithImages(ctx, grid, cellSize, imageCache, isHex);
            }
        };
        img.src = imgData;
    });
}

function getHexPosition(rowIndex, colIndex, cellSize) {
    // Even rows (0, 2, 4...) are offset by half cell width
    const xOffset = (rowIndex % 2 === 0) ? cellSize / 2 : 0;
    const x = colIndex * cellSize + xOffset;
    const y = rowIndex * cellSize * HEX_VERTICAL_FACTOR;
    return { x, y };
}

function drawGridWithColors(ctx, grid, cellSize, isHex = false) {
    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            let x, y;
            
            if (isHex) {
                const pos = getHexPosition(rowIndex, colIndex, cellSize);
                x = pos.x;
                y = pos.y;
            } else {
                x = colIndex * cellSize;
                y = rowIndex * cellSize;
            }
            
            ctx.fillStyle = rgbToHex(cell.beercapColor);
            
            // Always draw circular caps (beercaps are round!)
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.stroke();
        });
    });
}

function drawGridWithImages(ctx, grid, cellSize, imageCache, isHex = false) {
    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            let x, y;
            
            if (isHex) {
                const pos = getHexPosition(rowIndex, colIndex, cellSize);
                x = pos.x;
                y = pos.y;
            } else {
                x = colIndex * cellSize;
                y = rowIndex * cellSize;
            }
            
            // Always clip to circle (beercaps are round!)
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
            ctx.clip();
            
            if (cell.beercapImage && imageCache.has(cell.beercapImage)) {
                ctx.drawImage(imageCache.get(cell.beercapImage), x, y, cellSize, cellSize);
            } else {
                ctx.fillStyle = rgbToHex(cell.beercapColor);
                ctx.fillRect(x, y, cellSize, cellSize);
            }
            
            ctx.restore();
            
            // Draw circular border
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.stroke();
        });
    });
}

function renderReferenceGrid(grid, codes, dimensions = {}) {
    const table = document.createElement('table');
    const isHex = dimensions.layout === 'hex';
    table.className = isHex ? 'reference-table hex-layout' : 'reference-table';
    
    // Add column numbers header
    const headerRow = document.createElement('tr');
    if (isHex) {
        // For hex, add empty spacer for offset indication
        headerRow.innerHTML = '<th></th><th class="spacer"></th>' + grid[0].map((_, i) => `<th>${i + 1}</th>`).join('');
    } else {
        headerRow.innerHTML = '<th></th>' + grid[0].map((_, i) => `<th>${i + 1}</th>`).join('');
    }
    table.appendChild(headerRow);
    
    grid.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        const isOffsetRow = isHex && (rowIndex % 2 === 0);
        
        if (isOffsetRow) {
            tr.className = 'offset-row';
        }
        
        let rowHtml = `<th>${rowIndex + 1}</th>`;
        
        if (isHex) {
            // Add spacer cell for offset rows
            rowHtml += isOffsetRow ? '<td class="spacer offset"></td>' : '<td class="spacer"></td>';
        }
        
        rowHtml += row.map(cell => {
            const code = codes.get(cell.beercapId) || '-';
            const bgColor = rgbToHex(cell.beercapColor);
            const textColor = getContrastColor(cell.beercapColor);
            return `<td style="background-color: ${bgColor}; color: ${textColor}" title="${cell.beercapName}">${code}</td>`;
        }).join('');
        
        tr.innerHTML = rowHtml;
        table.appendChild(tr);
    });
    
    referenceGrid.innerHTML = '';
    referenceGrid.appendChild(table);
}

function renderLegend(beercaps, codes) {
    const legend = generateLegend(beercaps, codes);
    
    legendContainer.innerHTML = legend.map(item => `
        <div class="legend-item">
            <span class="legend-code">${item.code}</span>
            <span class="legend-color" style="background-color: ${rgbToHex(item.color)}"></span>
            <span class="legend-name">${item.name}</span>
        </div>
    `).join('');
}

function renderStats(stats) {
    const sortedUsage = [...stats.beercapUsage].sort((a, b) => b.used - a.used);
    
    // Color error stats (only available with optimized algorithm)
    const colorErrorHtml = stats.avgColorError !== undefined ? `
        <div class="stat-item">
            <span class="stat-value">${stats.avgColorError.toFixed(1)}</span>
            <span class="stat-label">Avg Color Error</span>
        </div>
    ` : '';
    
    statsContent.innerHTML = `
        <div class="stats-summary">
            <div class="stat-item">
                <span class="stat-value">${stats.totalCells}</span>
                <span class="stat-label">Total Cells</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.totalUsed}</span>
                <span class="stat-label">Caps Used</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.totalRemaining}</span>
                <span class="stat-label">Caps Remaining</span>
            </div>
            ${colorErrorHtml}
        </div>
        ${stats.avgColorError !== undefined ? `
        <p class="optimization-note">
            ✓ Global optimization applied - colors distributed for best overall match
        </p>
        ` : ''}
        <h4>Usage by Beercap</h4>
        <div class="usage-list">
            ${sortedUsage.map(b => `
                <div class="usage-item">
                    <span class="usage-color" style="background-color: ${rgbToHex(b.color)}"></span>
                    <span class="usage-name">${b.name}</span>
                    <span class="usage-count">${b.used} / ${b.originalQuantity}</span>
                    <div class="usage-bar">
                        <div class="usage-fill" style="width: ${(b.used / b.originalQuantity) * 100}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Tab Switching
function switchTab(tabId) {
    outputTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    outputPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });
}

// Export Functions
function handleDownloadPng() {
    if (!currentMosaic) return;
    
    const link = document.createElement('a');
    link.download = 'beercap-mosaic.png';
    link.href = visualCanvas.toDataURL('image/png');
    link.click();
}

function handleDownloadCsv() {
    if (!currentMosaic || !beercapCodes) return;
    
    const csv = gridToCSV(currentMosaic.grid, beercapCodes);
    
    // Add legend to CSV
    const beercaps = getBeercaps();
    const legendCsv = '\n\nLEGEND\nCode,Name,Color\n' + 
        beercaps.map(b => `${beercapCodes.get(b.id)},${b.name},${rgbToHex(b.color)}`).join('\n');
    
    const blob = new Blob([csv + legendCsv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = 'beercap-mosaic.csv';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}

// ============================================
// SCAN MODAL FUNCTIONALITY
// ============================================

let scanStream = null;
let scanResults = null;

function setupScanModal() {
    const modal = document.getElementById('scan-modal');
    const closeBtn = document.getElementById('scan-modal-close');
    const photoBtn = document.getElementById('scan-photo-btn');
    const cameraBtn = document.getElementById('scan-camera-btn');
    const photoInput = document.getElementById('scan-photo-input');
    const captureBtn = document.getElementById('scan-capture-btn');
    const resetBtn = document.getElementById('scan-reset-btn');
    const addBtn = document.getElementById('scan-add-btn');
    
    // Close modal
    closeBtn.addEventListener('click', closeScanModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeScanModal();
    });
    
    // Toggle between photo and camera
    photoBtn.addEventListener('click', () => {
        photoBtn.classList.add('active');
        cameraBtn.classList.remove('active');
        document.getElementById('scan-photo-area').classList.remove('hidden');
        document.getElementById('scan-camera-area').classList.add('hidden');
        stopScanCamera();
    });
    
    cameraBtn.addEventListener('click', async () => {
        cameraBtn.classList.add('active');
        photoBtn.classList.remove('active');
        document.getElementById('scan-photo-area').classList.add('hidden');
        document.getElementById('scan-camera-area').classList.remove('hidden');
        await startScanCamera();
    });
    
    // Photo upload
    photoInput.addEventListener('change', handleScanPhotoUpload);
    
    // Camera capture
    captureBtn.addEventListener('click', handleCameraCapture);
    
    // Reset
    resetBtn.addEventListener('click', resetScanModal);
    
    // Add to library
    addBtn.addEventListener('click', addScannedCapsToLibrary);
}

function openScanModal() {
    const modal = document.getElementById('scan-modal');
    modal.classList.add('active');
    resetScanModal();
}

function closeScanModal() {
    const modal = document.getElementById('scan-modal');
    modal.classList.remove('active');
    stopScanCamera();
    scanResults = null;
}

async function startScanCamera() {
    const video = document.getElementById('scan-video');
    try {
        scanStream = await startCamera(video);
    } catch (error) {
        alert('Could not access camera. Please check permissions.');
    }
}

function stopScanCamera() {
    if (scanStream) {
        const video = document.getElementById('scan-video');
        stopCamera(video);
        scanStream = null;
    }
}

async function handleScanPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const img = new Image();
    img.onload = async () => {
        await processScanImage(img);
    };
    img.src = URL.createObjectURL(file);
}

async function handleCameraCapture() {
    const video = document.getElementById('scan-video');
    if (!video.srcObject) return;
    
    // Create canvas from video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Stop camera
    stopScanCamera();
    
    // Process the captured image
    await processScanImage(canvas);
}

async function processScanImage(imageSource) {
    const progressDiv = document.getElementById('scan-progress');
    const progressFill = document.getElementById('scan-progress-fill');
    const progressText = document.getElementById('scan-progress-text');
    const previewArea = document.getElementById('scan-preview-area');
    const previewCanvas = document.getElementById('scan-canvas');
    const photoArea = document.getElementById('scan-photo-area');
    const cameraArea = document.getElementById('scan-camera-area');
    
    // Show progress
    progressDiv.classList.remove('hidden');
    photoArea.classList.add('hidden');
    cameraArea.classList.add('hidden');
    
    const updateProgress = (message, percent) => {
        progressFill.style.width = `${percent}%`;
        progressText.textContent = message;
    };
    
    try {
        // Scan the image
        scanResults = await scanImage(imageSource, {
            minRadius: 15,
            maxRadius: 40,
            matchThreshold: 0.35 // ORB feature matching threshold (higher = stricter)
        }, updateProgress);
        
        // Show preview with detections
        const ctx = previewCanvas.getContext('2d');
        previewCanvas.width = scanResults.sourceCanvas.width;
        previewCanvas.height = scanResults.sourceCanvas.height;
        ctx.drawImage(scanResults.sourceCanvas, 0, 0);
        
        // Draw detection overlay
        drawDetectionOverlay(previewCanvas, scanResults.circles, scanResults.clusters);
        
        // Update UI
        document.getElementById('scan-circle-count').textContent = scanResults.circles.length;
        previewArea.classList.remove('hidden');
        progressDiv.classList.add('hidden');
        
        // Show clusters
        displayScanClusters(scanResults.clusters);
        
    } catch (error) {
        console.error('Scan error:', error);
        progressText.textContent = 'Error: ' + error.message;
        progressDiv.classList.add('hidden');
        photoArea.classList.remove('hidden');
    }
}

function displayScanClusters(clusters) {
    const resultsDiv = document.getElementById('scan-results');
    const newSection = document.getElementById('scan-new-section');
    const existingSection = document.getElementById('scan-existing-section');
    const newClustersDiv = document.getElementById('scan-new-clusters');
    const existingClustersDiv = document.getElementById('scan-existing-clusters');
    const newCount = document.getElementById('scan-new-count');
    const existingCount = document.getElementById('scan-existing-count');
    const emptyMessage = document.getElementById('scan-empty-message');
    const addBtn = document.getElementById('scan-add-btn');
    
    // Reset
    newClustersDiv.innerHTML = '';
    existingClustersDiv.innerHTML = '';
    newSection.classList.add('hidden');
    existingSection.classList.add('hidden');
    emptyMessage.classList.add('hidden');
    
    if (clusters.length === 0) {
        emptyMessage.classList.remove('hidden');
        resultsDiv.classList.remove('hidden');
        addBtn.disabled = true;
        return;
    }
    
    // Get existing caps for comparison
    const existingCaps = getBeercaps();
    const COLOR_MATCH_THRESHOLD = 30;
    
    const newCaps = [];
    const matchingCaps = [];
    
    // Categorize each cluster
    clusters.forEach((cluster) => {
        let matchingCap = null;
        let bestDistance = Infinity;
        
        for (const existingCap of existingCaps) {
            const distance = colorDistance(cluster.color, existingCap.color);
            if (distance < bestDistance && distance < COLOR_MATCH_THRESHOLD) {
                bestDistance = distance;
                matchingCap = existingCap;
            }
        }
        
        if (matchingCap) {
            matchingCaps.push({ cluster, matchingCap });
        } else {
            newCaps.push(cluster);
        }
    });
    
    // Render new caps
    if (newCaps.length > 0) {
        newCount.textContent = newCaps.length;
        newSection.classList.remove('hidden');
        
        newCaps.forEach((cluster, idx) => {
            const item = createClusterItem(cluster, idx, false, null);
            newClustersDiv.appendChild(item);
        });
    }
    
    // Render matching caps
    if (matchingCaps.length > 0) {
        existingCount.textContent = matchingCaps.length;
        existingSection.classList.remove('hidden');
        
        matchingCaps.forEach(({ cluster, matchingCap }, idx) => {
            const item = createClusterItem(cluster, idx, true, matchingCap);
            existingClustersDiv.appendChild(item);
        });
    }
    
    resultsDiv.classList.remove('hidden');
    addBtn.disabled = false;
    updateAddButtonState();
}

function createClusterItem(cluster, idx, isExisting, matchingCap) {
    const item = document.createElement('div');
    item.className = 'scan-cluster-item selected';
    item.dataset.clusterId = cluster.id;
    
    const colorHex = rgbToHex(cluster.color);
    
    if (isExisting && matchingCap) {
        // Show that it matches an existing cap
        item.innerHTML = `
            <img src="${cluster.imageDataUrl}" alt="Cap ${idx + 1}" class="scan-cluster-image">
            <span class="scan-cluster-count">+${cluster.count}</span>
            <div class="scan-cluster-match" title="Will add to: ${matchingCap.name}">
                → ${matchingCap.name}
            </div>
        `;
    } else {
        item.innerHTML = `
            <img src="${cluster.imageDataUrl}" alt="Cap ${idx + 1}" class="scan-cluster-image">
            <span class="scan-cluster-count">×${cluster.count}</span>
            <div class="scan-cluster-color" style="background: ${colorHex}"></div>
        `;
    }
    
    item.addEventListener('click', () => {
        item.classList.toggle('selected');
        updateAddButtonState();
    });
    
    return item;
}

function updateAddButtonState() {
    const selected = document.querySelectorAll('.scan-cluster-item.selected');
    const addBtn = document.getElementById('scan-add-btn');
    addBtn.disabled = selected.length === 0;
    addBtn.textContent = `Add ${selected.length} to Library`;
}

function resetScanModal() {
    const photoArea = document.getElementById('scan-photo-area');
    const cameraArea = document.getElementById('scan-camera-area');
    const previewArea = document.getElementById('scan-preview-area');
    const progressDiv = document.getElementById('scan-progress');
    const resultsDiv = document.getElementById('scan-results');
    const photoInput = document.getElementById('scan-photo-input');
    const addBtn = document.getElementById('scan-add-btn');
    const photoBtn = document.getElementById('scan-photo-btn');
    const cameraBtn = document.getElementById('scan-camera-btn');
    
    // Reset to photo mode
    photoBtn.classList.add('active');
    cameraBtn.classList.remove('active');
    photoArea.classList.remove('hidden');
    cameraArea.classList.add('hidden');
    previewArea.classList.add('hidden');
    progressDiv.classList.add('hidden');
    resultsDiv.classList.add('hidden');
    
    photoInput.value = '';
    addBtn.disabled = true;
    addBtn.textContent = 'Add All to Library';
    scanResults = null;
    
    stopScanCamera();
}

async function addScannedCapsToLibrary() {
    if (!scanResults) return;
    
    const selectedItems = document.querySelectorAll('.scan-cluster-item.selected');
    const selectedIds = new Set(Array.from(selectedItems).map(el => parseInt(el.dataset.clusterId)));
    
    // Get existing beercaps to check for duplicates
    const existingCaps = getBeercaps();
    const COLOR_MATCH_THRESHOLD = 30; // Color distance threshold for considering caps as same
    
    let addedCount = 0;
    let mergedCount = 0;
    
    for (const cluster of scanResults.clusters) {
        if (!selectedIds.has(cluster.id)) continue;
        
        // Check if a similar color already exists in the library
        let matchingCap = null;
        let bestDistance = Infinity;
        
        for (const existingCap of existingCaps) {
            const distance = colorDistance(cluster.color, existingCap.color);
            if (distance < bestDistance && distance < COLOR_MATCH_THRESHOLD) {
                bestDistance = distance;
                matchingCap = existingCap;
            }
        }
        
        if (matchingCap) {
            // Add quantity to existing cap
            updateBeercap(matchingCap.id, { 
                quantity: matchingCap.quantity + cluster.count 
            });
            // Update local reference for subsequent matches
            matchingCap.quantity += cluster.count;
            mergedCount++;
        } else {
            // Add as new cap
            const beercap = {
                id: generateId(),
                name: `Scanned Cap ${addedCount + 1}`,
                color: cluster.color,
                imageData: cluster.imageDataUrl,
                quantity: cluster.count
            };
            
            addBeercap(beercap);
            // Add to existingCaps for subsequent duplicate checks in this batch
            existingCaps.push(beercap);
            addedCount++;
        }
    }
    
    // Refresh the library display
    loadBeercapLibrary();
    updateTotalCaps();
    updateGridInfo();
    
    // Close modal
    closeScanModal();
    
    // Show success message
    let message = '';
    if (addedCount > 0 && mergedCount > 0) {
        message = `Added ${addedCount} new cap type(s) and merged ${mergedCount} with existing caps.`;
    } else if (addedCount > 0) {
        message = `Added ${addedCount} new beercap type(s) to your library!`;
    } else if (mergedCount > 0) {
        message = `Merged ${mergedCount} cap(s) with existing caps in your library.`;
    } else {
        message = 'No caps were added.';
    }
    alert(message);
}


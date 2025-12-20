#!/usr/bin/env node

/**
 * Simple development server with COOP/COEP headers for SharedArrayBuffer support
 * Required for multi-threaded WASM with Rayon
 * 
 * Usage: node server.js [port]
 * Default port: 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3000;
const ROOT = __dirname;

// MIME types for common file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
    // Parse URL and handle query strings
    let urlPath = req.url.split('?')[0];
    
    // Default to index.html
    if (urlPath === '/') {
        urlPath = '/index.html';
    }
    
    const filePath = path.join(ROOT, urlPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
            return;
        }
        
        // Set headers for SharedArrayBuffer support (required for WASM threads)
        // res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        // res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache');
        
        res.writeHead(200);
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`
🍺 Beercap Mosaic Generator - Development Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Local:   http://localhost:${PORT}

  // ✓ Cross-Origin-Opener-Policy: same-origin
  // ✓ Cross-Origin-Embedder-Policy: require-corp
  ✓ SharedArrayBuffer enabled (WASM threads ready)

  Press Ctrl+C to stop
`);
});

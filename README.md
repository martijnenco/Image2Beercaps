<p align="center">
  <img src="logo.svg" alt="Beercap Mosaic Logo" width="150" height="150">
</p>

<h1 align="center">Beercap Mosaic Generator</h1>

<p align="center">
  <strong>Transform any image into beercap art instructions</strong><br>
  A client-side web application that converts images into mosaic patterns using your beercap collection
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vanilla-JavaScript-yellow?style=flat-square" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/no-dependencies-green?style=flat-square" alt="No Dependencies">
  <img src="https://img.shields.io/badge/runs-offline-blue?style=flat-square" alt="Runs Offline">
</p>

---

## Features

- **Beercap Library Management** — Upload photos of your beercaps, auto-extract their average colors, and track quantities
- **Smart Color Matching** — Uses perceptually-weighted color distance for better human-eye matching
- **Global Optimization** — Hungarian algorithm finds the optimal beercap placement across the entire mosaic
- **Visual Preview** — See your mosaic before you build it
- **Reference Grid** — Coded grid (A, B, C...) with legend for easy assembly
- **Export Options** — Download as PNG or CSV for reference
- **Offline Ready** — Everything runs in your browser, no server needed
- **Persistent Storage** — Your beercap library is saved in localStorage

## Screenshot

![Beercap Mosaic Generator Interface](screenshot.png)

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Your       │     │  Target     │     │  Mosaic     │
│  Beercaps   │ ──▶│  Image      │ ──▶│  Grid       │
│  + Qty      │     │             │     │  Output     │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 1. Build Your Beercap Library
Upload photos of each unique beercap you have. The app automatically extracts the dominant color using center-weighted sampling. Set the quantity you have available for each type.

### 2. Upload Target Image
Choose the image you want to recreate as a beercap mosaic. The app calculates the optimal grid size based on your total available caps and the image's aspect ratio.

### 3. Generate Mosaic
The app uses the **Hungarian Algorithm** to find the globally optimal assignment of beercaps to grid positions. This ensures the best possible color match across the entire image, not just locally.

### 4. Build Your Art
Use the reference grid with letter codes (A, B, C...) to know exactly which beercap goes where. Export as PNG for visual reference or CSV for a spreadsheet view.

## The Algorithm

Unlike simple greedy approaches that pick the best available cap for each position sequentially (leading to poor matches at the end), this app uses **global optimization**:

```
Cost Matrix: For each grid cell × each beercap slot
┌────────────────────────────────────────┐
│ Cell 1:  Cap A=12.3  Cap B=45.6  ...   │
│ Cell 2:  Cap A=67.8  Cap B=23.1  ...   │
│ ...                                    │
└────────────────────────────────────────┘
           ↓
    Hungarian Algorithm (O(n³))
           ↓
    Optimal Assignment
    (Minimizes total color error)
```

This means a cell might get a slightly worse match so that another cell can get a much better one, improving overall quality.

## Getting Started

### Option 1: Direct File Open
Simply open `index.html` in any modern browser. That's it!

```bash
# Clone or download the project
cd image2beercaps

# Open in browser (Linux)
xdg-open index.html

# Open in browser (macOS)
open index.html

# Open in browser (Windows)
start index.html
```

### Option 2: Local Development Server
For a better development experience:

```bash
# Using Python (built-in)
python3 -m http.server 3000

# Using Node.js
npx serve .

# Then open http://localhost:3000
```

## Project Structure

```
image2beercaps/
├── index.html          # Main application
├── css/
│   └── styles.css      # Dark theme styling
├── js/
│   ├── app.js          # UI logic and event handling
│   ├── colorUtils.js   # Color extraction & matching
│   ├── gridGenerator.js # Hungarian algorithm & mosaic generation
│   └── storage.js      # LocalStorage persistence
├── logo.svg            # Project logo
├── screenshot.png      # App screenshot
└── README.md           # This file
```

## Usage Tips

- **Photo Quality**: Take beercap photos on a neutral background with good lighting
- **Crop Tightly**: Crop your beercap images to show mainly the cap, not surrounding area
- **Quantity Accuracy**: Enter accurate quantities — the algorithm respects your inventory limits
- **Grid Size**: More caps = higher resolution mosaic. ~500 caps works well for recognizable images
- **Color Variety**: A diverse color palette gives better results than many caps of similar colors

## Browser Compatibility

Works in all modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Technical Details

| Feature | Implementation |
|---------|----------------|
| Color Extraction | Canvas API with center-weighted averaging |
| Color Distance | Weighted Euclidean (perceptual) |
| Optimization | Hungarian/Kuhn-Munkres Algorithm |
| Storage | Browser LocalStorage |
| Styling | CSS Custom Properties (variables) |

## Performance

For mosaics under 500 caps, the Hungarian algorithm completes in under 1 second on modern hardware. Larger mosaics may take longer due to the O(n³) complexity.

## License

**Non-Commercial Use Only**

This project is free to use, modify for personal and non-commercial purposes. Commercial use is not permitted without explicit permission from the author.

---

<p align="center">
  Made with 🍺 for beercap art enthusiasts
</p>


# Beercap Mosaic Generator — Feature Roadmap

A list of potential features and improvements for future development.

---

## 🎨 Image & Color Improvements

- [ ] **Image cropping tool** — Crop/zoom target image before generating
- [ ] **Color palette analysis** — Show which colors you're missing for better results
- [ ] **Suggested caps to buy** — Analyze target image and suggest cap colors that would improve quality
- [ ] **Dithering options** — Floyd-Steinberg dithering for smoother color gradients
- [ ] **Preview slider** — Adjust grid size with a slider to see quality vs. cap count tradeoff
- [ ] **Brightness/contrast adjustment** — Tweak target image before processing

---

## 📦 Library Management

- [ ] **Search & filter** — Find caps by name or filter by color range
- [ ] **Bulk editing** — Select multiple caps to delete or adjust quantities
- [ ] **Cap templates** — Pre-defined popular beercap colors (Heineken green, Corona yellow, etc.)
- [ ] **Import/Export library** — Save library as JSON, share between devices
- [ ] **Drag & drop reorder** — Organize caps manually in the library

---

## 📤 Export & Sharing

- [ ] **PDF export** — Full instructions document with grid, legend, and stats
- [ ] **Print-optimized layout** — Reference sheet formatted for A4/Letter printing
- [ ] **Save/Load projects** — Export entire project (library + target + settings) as JSON
- [ ] **Share link** — Generate URL to share mosaic preview
- [ ] **Build order animation** — Animated GIF showing suggested assembly order

---

## 📷 Scanner Improvements

- [ ] **Real-time detection** — Show detected circles live as you point camera
- [ ] **Manual selection** — Draw circles around caps the auto-detect missed
- [ ] **Adjustable threshold** — Slider to tune detection sensitivity
- [ ] **Scan multiple photos** — Combine caps from several photos into one session
- [ ] **Better ML detection** — Use TensorFlow.js model for more accurate cap detection

---

## 📱 Quality of Life

- [ ] **PWA support** — Install as app, work fully offline with service worker
- [ ] **Statistics dashboard** — Cap usage stats, most common colors, coverage %
- [ ] **Undo/Redo** — Recover from accidental changes
- [ ] **Dark/Light theme toggle** — Some users prefer light mode
- [ ] **Keyboard shortcuts** — Power user features (Delete, +/-, navigation)
- [ ] **Mobile-optimized UI** — Better touch support for phones and tablets
- [ ] **Tutorial/onboarding** — First-time user guide with tooltips

---

## 🚀 Advanced Features

- [ ] **3D preview** — Show mosaic with shadows/depth effect
- [ ] **Multiple target comparison** — Try different images with same inventory
- [ ] **Region locking** — Lock certain grid cells to specific caps
- [ ] **Color zones** — Define regions that should use specific cap types
- [ ] **Symmetry mode** — Mirror patterns for symmetric designs

---

## ✅ Completed Features

- [x] Beercap library management (add, edit, delete, quantities)
- [x] Auto-color extraction from cap images
- [x] Target image upload with drag & drop
- [x] Hungarian algorithm for optimal placement
- [x] Multi-threaded WASM acceleration
- [x] Square and hexagonal grid layouts
- [x] Visual preview with circular caps
- [x] Reference grid with letter codes
- [x] Export as PNG and CSV
- [x] LocalStorage persistence
- [x] Progress bar for generation
- [x] Beercap scanner with circle detection
- [x] Similarity clustering for duplicate detection
- [x] Merge scanned caps with existing library
- [x] Inline name editing in library

---

## 🏆 Priority Recommendations

These features would have the highest impact:

1. **Image cropping** — Frequently needed for better results
2. **Color gap analysis** — Helps users understand what caps to collect
3. **Import/Export project** — Essential for not losing work
4. **Print-friendly PDF** — Makes building the actual mosaic easier
5. **Search & filter library** — Becomes essential with large collections

---

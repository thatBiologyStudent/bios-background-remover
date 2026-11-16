================================================================================
Bios Background Remover - Tips for Best Background Removal Results
================================================================================

Bios Background Remover removes solid-color backgrounds directly in your browser using
color-distance matching, edge trimming, and halo decontamination. Because it
works by comparing pixel colors rather than AI guessing, the quality of your
source image makes a huge difference.

--------------------------------------------------------------------------------
1. HOW TO PREPARE YOUR SOURCE IMAGE FOR BEST RESULTS
--------------------------------------------------------------------------------

* Use a High-Contrast Background
  Choose a background color that does NOT appear in your character or portrait.
  - Good examples: bright green (#00FF00), pure blue (#0000FF), magenta, or a
    clean studio backdrop that contrasts strongly with skin, hair, and clothes.
  - Avoid: white backgrounds if your character has white eyes, teeth, shirts,
    or bright highlights; black backgrounds if your character has dark hair or
    black outlines.

* Keep the Background Solid & Evenly Lit
  PureEraser matches a single target color within a tolerance range.
  - Avoid heavy gradients, strong shadows cast onto the backdrop, or textured
    walls.
  - Flat, evenly lit backdrops let you use a much lower Tolerance, keeping your
    subject sharp and solid.

* Use Uncompressed / Lossless Formats (PNG) When Possible
  - Heavy JPEG compression creates blocky "mosquito noise" around edges,
    which blends background colors into the character's outline.
  - Exporting or rendering your portrait as a PNG gives clean, predictable edges.

* Avoid Soft Drop Shadows or Glows Against the Background
  - Semi-transparent glows or soft shadows baked into the background will either
    leave a colored halo or get partially erased.

* Keep the Top-Left Corner Clean (Optional Convenience)
  - PureEraser automatically samples the top-left pixel (0, 0) as the initial
    Target Color when you upload an image. If your background is in that corner,
    it works immediately; otherwise, use "Pick Color" to sample the backdrop.

--------------------------------------------------------------------------------
2. RECOMMENDED WORKFLOW IN PUREERASER
--------------------------------------------------------------------------------

1. Upload your portrait (drag & drop or click to upload).
2. If the top-left pixel wasn't the background, click "Pick Color" and click
   a clean area of the background near your character (zoom in on Source Image
   if needed for precision).
3. Adjust TOLERANCE:
   - Start low and raise it just until the main background disappears.
   - Use the - / + buttons (0.5 steps) to fine-tune without eating into the
     character.
4. Remove Outline Halos (Recommended before Feathering):
   - EDGE CHOKE (TRIM): Set to 0.5 - 2.0 px to shave off the thin
     anti-aliased fringe around the outline without making the character
     transparent.
   - DEFRINGE HALO: Set to 40% - 85% to replace remaining background-tinted
     edge pixels with the character's nearby solid colors.
5. EDGE FEATHER (Optional):
   - Add a small amount (e.g. 1 - 5) only if edges look too harsh or pixelated.
   - Keep it low or at 0 if you want crisp, solid edges.
6. Zoom in (up to 600%) on PREVIEW RESULT to inspect hair, ears, and shoulders,
   then click "Export PNG" to save your transparent image.

--------------------------------------------------------------------------------
3. STARTING THE APP
--------------------------------------------------------------------------------

Double-click "Start PureEraser.bat" in this folder to start the local server
and open PureEraser in a new browser tab.

--------------------------------------------------------------------------------
4. DEPENDENCIES & SETUP
--------------------------------------------------------------------------------

System Requirements:
- Node.js (v18 or newer recommended) & npm
- A modern web browser (Chrome, Edge, Firefox, Safari)

If "node_modules" is not included in your copy, double-click
"Install Dependencies.bat" (or open a terminal in this folder and run
"npm install" / "npm.cmd install") once before starting.

Runtime Dependencies:
- react (^18.3.1)
- react-dom (^18.3.1)
- lucide-react (^0.460.0)

Development / Build Dependencies:
- vite (^6.0.0)
- @vitejs/plugin-react (^4.3.4)
- tailwindcss (^4.0.0)
- @tailwindcss/vite (^4.0.0)
================================================================================

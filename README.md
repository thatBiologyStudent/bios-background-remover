# Bios Background Remover

A client-side React + Tailwind CSS tool for removing solid-color backgrounds from portraits and illustrations with fine-tuned tolerance, edge choke, defringe halo cleanup, edge feathering, and independent source/preview zoom.

![Bios Background Remover Screenshot](screenshots/app-preview.png)

## Features

- **100% Client-Side Processing**: Uses the HTML5 Canvas API—your images never leave your computer.
- **Auto-Sample & Eyedropper**: Automatically samples the top-left pixel `(0, 0)` on upload, with a **Pick Color** eyedropper for sampling any pixel.
- **Fine-Grained Controls**:
  - **Tolerance (`0–255`, `0.5` step)**: Euclidean RGB color distance matching.
  - **Edge Choke (`0–5 px`, `0.5 px` step)**: Trims the outer anti-aliased fringe inward without making the subject transparent.
  - **Defringe Halo (`0–100%`)**: Decontaminates remaining edge pixels by blending nearby interior foreground colors.
  - **Edge Feather (`0–60`, `0.5` step)**: Smoothly softens transitions.
- **Independent Source & Preview Zoom (`100%–600%`)**: Zoom and pan Source and Preview independently to inspect fine portrait details like hair and edges.
- **Native Save As Export**: Opens a native Windows Save As dialog when running locally via Vite (works in Brave, Firefox, Chrome, and Edge), with automatic browser download fallback.

## Quick Start (Windows)

1. Double-click **`Install Dependencies.bat`** (automatically installs Node.js LTS via `winget` if needed, then runs `npm install`).
2. Double-click **`Start Background Remover.bat`** to start the local server and open the app in your browser.

## Manual Setup

```bash
npm install
npm run dev
```

## Tech Stack

- React 18
- Vite 6
- Tailwind CSS 4
- Lucide React

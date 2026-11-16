import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Zap,
  Pipette,
  CheckCircle2,
  Download,
  Trash2,
  Image as ImageIcon,
  Layers,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Minus,
  Plus,
} from 'lucide-react';

const DEFAULT_TOLERANCE = 35;
const DEFAULT_FEATHER = 0;
const DEFAULT_EDGE_CHOKE = 0;
const DEFAULT_DEFRINGE = 0;
const DEFAULT_COLOR = { r: 255, g: 255, b: 255 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const CHECKERBOARD_STYLE = {
  backgroundColor: '#1a120c',
  backgroundImage:
    'linear-gradient(45deg, #2a1d15 25%, transparent 25%), ' +
    'linear-gradient(-45deg, #2a1d15 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, #2a1d15 75%), ' +
    'linear-gradient(-45deg, transparent 75%, #2a1d15 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
};

function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export default function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageName, setImageName] = useState('image');
  const [imageDimensions, setImageDimensions] = useState(null);
  const [targetColor, setTargetColor] = useState(DEFAULT_COLOR);
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [feather, setFeather] = useState(DEFAULT_FEATHER);
  const [edgeChoke, setEdgeChoke] = useState(DEFAULT_EDGE_CHOKE);
  const [defringe, setDefringe] = useState(DEFAULT_DEFRINGE);
  const [sourceZoom, setSourceZoom] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [sourcePanelSize, setSourcePanelSize] = useState({ width: 0, height: 0 });
  const [previewPanelSize, setPreviewPanelSize] = useState({ width: 0, height: 0 });
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const sourceImgRef = useRef(null);
  const sourceScrollRef = useRef(null);
  const previewScrollRef = useRef(null);
  const panStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    container: null,
  });

  const processImage = useCallback(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!sourceCanvas || !previewCanvas || !imageDimensions) return;

    const { width, height } = imageDimensions;
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const previewCtx = previewCanvas.getContext('2d');
    if (!sourceCtx || !previewCtx) return;

    previewCanvas.width = width;
    previewCanvas.height = height;

    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const { r: tr, g: tg, b: tb } = targetColor;
    const pixelCount = width * height;

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - tr;
      const dg = data[i + 1] - tg;
      const db = data[i + 2] - tb;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      if (distance <= tolerance) {
        data[i + 3] = 0;
      } else if (feather > 0 && distance < tolerance + feather) {
        const ratio = (distance - tolerance) / feather;
        data[i + 3] = Math.round(data[i + 3] * ratio);
      }
    }

    // Fast 2-pass distance-from-transparency transform for Edge Choke & Defringe
    if (edgeChoke > 0 || defringe > 0) {
      const INF = 1e6;
      const distMap = new Float32Array(pixelCount);

      for (let idx = 0; idx < pixelCount; idx++) {
        distMap[idx] = data[idx * 4 + 3] === 0 ? 0 : INF;
      }

      // Forward pass
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const idx = row + x;
          let d = distMap[idx];
          if (d === 0) continue;
          if (x > 0) d = Math.min(d, distMap[idx - 1] + 1);
          if (y > 0) {
            d = Math.min(d, distMap[idx - width] + 1);
            if (x > 0) d = Math.min(d, distMap[idx - width - 1] + 1.414);
            if (x < width - 1) d = Math.min(d, distMap[idx - width + 1] + 1.414);
          }
          distMap[idx] = d;
        }
      }

      // Backward pass
      for (let y = height - 1; y >= 0; y--) {
        const row = y * width;
        for (let x = width - 1; x >= 0; x--) {
          const idx = row + x;
          let d = distMap[idx];
          if (d === 0) continue;
          if (x < width - 1) d = Math.min(d, distMap[idx + 1] + 1);
          if (y < height - 1) {
            d = Math.min(d, distMap[idx + width] + 1);
            if (x > 0) d = Math.min(d, distMap[idx + width - 1] + 1.414);
            if (x < width - 1) d = Math.min(d, distMap[idx + width + 1] + 1.414);
          }
          distMap[idx] = d;
        }
      }

      // 1) Edge Choke: shave inward from transparent edges without affecting character interior
      if (edgeChoke > 0) {
        for (let idx = 0; idx < pixelCount; idx++) {
          const d = distMap[idx];
          if (d === 0) continue;
          if (d <= edgeChoke) {
            data[idx * 4 + 3] = 0;
            distMap[idx] = 0;
          } else if (d < edgeChoke + 1) {
            const keepRatio = d - edgeChoke;
            data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * keepRatio);
          }
        }
      }

      // 2) Defringe Halo: replace background-tinted edge RGB with nearby solid interior RGB
      if (defringe > 0) {
        const strength = defringe / 100;
        const origCopy = new Uint8ClampedArray(data);
        const searchRadius = 3;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const d = distMap[idx];
            if (d === 0 || d > 2.5) continue;

            let sumR = 0;
            let sumG = 0;
            let sumB = 0;
            let weightSum = 0;

            const yMin = Math.max(0, y - searchRadius);
            const yMax = Math.min(height - 1, y + searchRadius);
            const xMin = Math.max(0, x - searchRadius);
            const xMax = Math.min(width - 1, x + searchRadius);

            for (let ny = yMin; ny <= yMax; ny++) {
              for (let nx = xMin; nx <= xMax; nx++) {
                const nIdx = ny * width + nx;
                const nd = distMap[nIdx];
                if (nd > 2.5 && origCopy[nIdx * 4 + 3] >= 240) {
                  const w = nd;
                  const nOff = nIdx * 4;
                  sumR += origCopy[nOff] * w;
                  sumG += origCopy[nOff + 1] * w;
                  sumB += origCopy[nOff + 2] * w;
                  weightSum += w;
                }
              }
            }

            if (weightSum > 0) {
              const off = idx * 4;
              const edgeFalloff = Math.max(0, Math.min(1, (2.6 - d) / 1.6));
              const blend = strength * edgeFalloff;
              data[off] = Math.round(origCopy[off] * (1 - blend) + (sumR / weightSum) * blend);
              data[off + 1] = Math.round(
                origCopy[off + 1] * (1 - blend) + (sumG / weightSum) * blend
              );
              data[off + 2] = Math.round(
                origCopy[off + 2] * (1 - blend) + (sumB / weightSum) * blend
              );
            }
          }
        }
      }
    }

    previewCtx.putImageData(imageData, 0, 0);
    setIsReady(true);
  }, [imageDimensions, targetColor, tolerance, feather, edgeChoke, defringe]);

  useEffect(() => {
    if (imageSrc && imageDimensions) {
      processImage();
    }
  }, [imageSrc, imageDimensions, processImage]);

  useEffect(() => {
    const srcEl = sourceScrollRef.current;
    const prevEl = previewScrollRef.current;
    if (!srcEl && !prevEl) return;

    const updateSizes = () => {
      if (srcEl) setSourcePanelSize({ width: srcEl.clientWidth, height: srcEl.clientHeight });
      if (prevEl) setPreviewPanelSize({ width: prevEl.clientWidth, height: prevEl.clientHeight });
    };
    updateSizes();

    const observer = new ResizeObserver(updateSizes);
    if (srcEl) observer.observe(srcEl);
    if (prevEl) observer.observe(prevEl);
    return () => observer.disconnect();
  }, []);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'image';
    setImageName(baseName);
    setIsReady(false);
    setIsPickingColor(false);
    setSourceZoom(1);
    setPreviewZoom(1);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== 'string') return;

      const img = new Image();
      img.onload = () => {
        const sourceCanvas = sourceCanvasRef.current;
        if (!sourceCanvas) return;

        sourceCanvas.width = img.naturalWidth;
        sourceCanvas.height = img.naturalHeight;

        const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, 0, 0);

        // Automatically sample top-left pixel (0, 0) as the initial target color
        const topLeft = ctx.getImageData(0, 0, 1, 1).data;
        setTargetColor({ r: topLeft[0], g: topLeft[1], b: topLeft[2] });
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageSrc(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSourceImageClick = (e) => {
    if (!isPickingColor || !sourceImgRef.current || !sourceCanvasRef.current) return;

    const rect = sourceImgRef.current.getBoundingClientRect();
    const scaleX = sourceCanvasRef.current.width / rect.width;
    const scaleY = sourceCanvasRef.current.height / rect.height;

    const x = Math.max(
      0,
      Math.min(sourceCanvasRef.current.width - 1, Math.floor((e.clientX - rect.left) * scaleX))
    );
    const y = Math.max(
      0,
      Math.min(sourceCanvasRef.current.height - 1, Math.floor((e.clientY - rect.top) * scaleY))
    );

    const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    setTargetColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
    setIsPickingColor(false);
  };

  const handleExportPng = async () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !isReady) return;

    const fileName = `${imageName}-nobg.png`;
    const dataUrl = previewCanvas.toDataURL('image/png');

    try {
      const response = await fetch('/api/save-png', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName, dataUrl }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.status === 'saved' || result?.status === 'cancelled') {
          return;
        }
      }
    } catch {
      // Fall back to browser Save As / download if local endpoint is unavailable
    }

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PNG Image',
              accept: { 'image/png': ['.png'] },
            },
          ],
        });

        const blob = await new Promise((resolve) =>
          previewCanvas.toBlob((result) => resolve(result), 'image/png')
        );
        if (!blob) return;

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  const handleClearAll = () => {
    setImageSrc(null);
    setImageName('image');
    setImageDimensions(null);
    setTargetColor(DEFAULT_COLOR);
    setTolerance(DEFAULT_TOLERANCE);
    setFeather(DEFAULT_FEATHER);
    setEdgeChoke(DEFAULT_EDGE_CHOKE);
    setDefringe(DEFAULT_DEFRINGE);
    setSourceZoom(1);
    setPreviewZoom(1);
    setIsPickingColor(false);
    setIsReady(false);

    if (sourceCanvasRef.current) {
      const ctx = sourceCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, sourceCanvasRef.current.width, sourceCanvasRef.current.height);
    }
    if (previewCanvasRef.current) {
      const ctx = previewCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    }
  };

  const clampZoom = (val) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(val.toFixed(2))));

  const handleWheelZoom = (e, currentZoom, setZoomFn) => {
    if (!imageSrc) return;
    if (e.ctrlKey || e.metaKey || currentZoom === 1) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setZoomFn((prev) => clampZoom(prev + delta));
    }
  };

  const handlePanStart = (e, containerRef, currentZoom, blockPick = false) => {
    if (currentZoom <= 1 || (blockPick && isPickingColor) || e.button !== 0 || !containerRef.current) {
      return;
    }
    panStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
      container: containerRef.current,
    };
    setIsPanning(true);
  };

  const handlePanMove = (e) => {
    const pan = panStateRef.current;
    if (!pan.active || !pan.container) return;
    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;
    pan.container.scrollLeft = pan.scrollLeft - dx;
    pan.container.scrollTop = pan.scrollTop - dy;
  };

  const handlePanEnd = () => {
    if (panStateRef.current.active) {
      panStateRef.current.active = false;
      panStateRef.current.container = null;
      setIsPanning(false);
    }
  };

  const getDisplaySize = (panel, z) => {
    if (!imageDimensions || panel.width === 0 || panel.height === 0) return null;
    const availW = Math.max(100, panel.width - 32);
    const availH = Math.max(100, panel.height - 32);
    const baseScale = Math.min(availW / imageDimensions.width, availH / imageDimensions.height);
    return {
      width: Math.round(imageDimensions.width * baseScale * z),
      height: Math.round(imageDimensions.height * baseScale * z),
    };
  };

  const sourceDisplaySize = getDisplaySize(sourcePanelSize, sourceZoom);
  const previewDisplaySize = getDisplaySize(previewPanelSize, previewZoom);

  const hexColor = rgbToHex(targetColor);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row bg-[#140e0a] text-white select-none">
      {/* Hidden offscreen canvas storing the unmodified source pixels */}
      <canvas ref={sourceCanvasRef} className="hidden" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Left Sidebar */}
      <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-[#1e150f] border-b lg:border-b-0 lg:border-r border-[#342419] flex flex-col justify-between p-6 gap-5 lg:overflow-y-auto">
        <div className="flex flex-col gap-6">
          {/* App Header */}
          <header className="flex items-center gap-3 pb-5 border-b border-[#342419]">
            <div className="w-10 h-10 rounded-xl bg-amber-700/20 border border-amber-600/40 flex items-center justify-center shadow-inner">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Bios Background Remover</h1>
              <p className="text-xs text-stone-400">Solid Background Remover</p>
            </div>
          </header>

          {/* TARGET COLOR Section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                TARGET COLOR
              </h2>
              <span className="text-xs font-mono text-stone-400">{hexColor}</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#140e0a] border border-[#342419]">
              <div
                className="w-11 h-11 rounded-lg border border-[#573d2b] shadow-sm shrink-0 transition-colors"
                style={{
                  backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`,
                }}
                title={`RGB(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-400">Selected RGB</p>
                <p className="text-sm font-mono text-amber-50 truncate">
                  {targetColor.r}, {targetColor.g}, {targetColor.b}
                </p>
              </div>
              <button
                type="button"
                onClick={() => imageSrc && setIsPickingColor((prev) => !prev)}
                disabled={!imageSrc}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPickingColor
                    ? 'bg-amber-700 text-white ring-2 ring-amber-500/50 shadow-lg shadow-amber-900/30'
                    : 'bg-[#281c14] hover:bg-[#342419] text-amber-50 border border-[#453022]'
                }`}
              >
                <Pipette className="w-4 h-4" />
                <span>Pick Color</span>
              </button>
            </div>

            {isPickingColor && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Click any pixel on the Source Image to sample
              </p>
            )}
          </section>

          {/* TOLERANCE Section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                TOLERANCE
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTolerance((v) => Math.max(0, Number((v - 0.5).toFixed(1))))}
                  disabled={!imageSrc || tolerance <= 0}
                  aria-label="Decrease tolerance"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={255}
                  step={0.5}
                  value={tolerance}
                  disabled={!imageSrc}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) {
                      setTolerance(Math.min(255, Math.max(0, val)));
                    }
                  }}
                  aria-label="Tolerance value"
                  className="w-14 text-center px-1.5 py-0.5 rounded-md bg-amber-700/20 border border-amber-600/40 text-amber-300 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setTolerance((v) => Math.min(255, Number((v + 0.5).toFixed(1))))}
                  disabled={!imageSrc || tolerance >= 255}
                  aria-label="Increase tolerance"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#140e0a] border border-[#342419] flex flex-col gap-2.5">
              <input
                type="range"
                min={0}
                max={255}
                step={0.5}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                disabled={!imageSrc}
                aria-label="Color tolerance"
                className="w-full h-2 bg-[#281c14] rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-stone-500">
                <span>STRICT</span>
                <span>LOOSE</span>
              </div>
            </div>
          </section>

          {/* EDGE FEATHER Section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                EDGE FEATHER
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFeather((v) => Math.max(0, Number((v - 0.5).toFixed(1))))}
                  disabled={!imageSrc || feather <= 0}
                  aria-label="Decrease edge feather"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={feather}
                  disabled={!imageSrc}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) {
                      setFeather(Math.min(60, Math.max(0, val)));
                    }
                  }}
                  aria-label="Edge feather value"
                  className="w-14 text-center px-1.5 py-0.5 rounded-md bg-amber-700/20 border border-amber-600/40 text-amber-300 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setFeather((v) => Math.min(60, Number((v + 0.5).toFixed(1))))}
                  disabled={!imageSrc || feather >= 60}
                  aria-label="Increase edge feather"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#140e0a] border border-[#342419] flex flex-col gap-2.5">
              <input
                type="range"
                min={0}
                max={60}
                step={0.5}
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                disabled={!imageSrc}
                aria-label="Edge feather"
                className="w-full h-2 bg-[#281c14] rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-stone-500">
                <span>SHARP</span>
                <span>SOFT</span>
              </div>
            </div>
          </section>

          {/* EDGE CHOKE Section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                EDGE CHOKE (TRIM)
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEdgeChoke((v) => Math.max(0, Number((v - 0.5).toFixed(1))))}
                  disabled={!imageSrc || edgeChoke <= 0}
                  aria-label="Decrease edge choke"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={edgeChoke}
                  disabled={!imageSrc}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) {
                      setEdgeChoke(Math.min(5, Math.max(0, val)));
                    }
                  }}
                  aria-label="Edge choke value"
                  className="w-14 text-center px-1.5 py-0.5 rounded-md bg-amber-700/20 border border-amber-600/40 text-amber-300 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setEdgeChoke((v) => Math.min(5, Number((v + 0.5).toFixed(1))))}
                  disabled={!imageSrc || edgeChoke >= 5}
                  aria-label="Increase edge choke"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#140e0a] border border-[#342419] flex flex-col gap-2.5">
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={edgeChoke}
                onChange={(e) => setEdgeChoke(Number(e.target.value))}
                disabled={!imageSrc}
                aria-label="Edge choke"
                className="w-full h-2 bg-[#281c14] rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-stone-500">
                <span>0 PX</span>
                <span>5 PX</span>
              </div>
            </div>
          </section>

          {/* DEFRINGE HALO Section */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                DEFRINGE HALO
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDefringe((v) => Math.max(0, v - 5))}
                  disabled={!imageSrc || defringe <= 0}
                  aria-label="Decrease defringe"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={defringe}
                  disabled={!imageSrc}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) {
                      setDefringe(Math.min(100, Math.max(0, val)));
                    }
                  }}
                  aria-label="Defringe value"
                  className="w-14 text-center px-1.5 py-0.5 rounded-md bg-amber-700/20 border border-amber-600/40 text-amber-300 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setDefringe((v) => Math.min(100, v + 5))}
                  disabled={!imageSrc || defringe >= 100}
                  aria-label="Increase defringe"
                  className="p-1 rounded bg-[#281c14] hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#140e0a] border border-[#342419] flex flex-col gap-2.5">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={defringe}
                onChange={(e) => setDefringe(Number(e.target.value))}
                disabled={!imageSrc}
                aria-label="Defringe halo"
                className="w-full h-2 bg-[#281c14] rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-stone-500">
                <span>OFF</span>
                <span>100%</span>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Status & Action Buttons */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[#342419]">
          {/* Status Indicator */}
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              isReady
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : 'bg-[#281c14]/40 border-[#342419] text-stone-400'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${isReady ? 'text-emerald-400' : 'text-stone-500'}`}
            />
            <span>{isReady ? 'Ready to export' : 'Upload an image to begin'}</span>
          </div>

          {/* Export PNG Button */}
          <button
            type="button"
            onClick={handleExportPng}
            disabled={!isReady}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-600 active:bg-amber-800 text-white font-semibold text-sm shadow-lg shadow-amber-900/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Download className="w-4 h-4" />
            <span>Export PNG</span>
          </button>

          {/* Clear All Button */}
          <button
            type="button"
            onClick={handleClearAll}
            disabled={!imageSrc}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#281c14]/70 hover:bg-[#342419] border border-[#453022] text-stone-300 hover:text-white font-medium text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>
      </aside>

      {/* Right Workspace: Equal Left & Right Sections */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 p-4 lg:p-6 gap-4 lg:gap-5">
        {/* Left Section: SOURCE IMAGE */}
        <section className="min-h-[320px] md:min-h-0 flex flex-col rounded-2xl bg-[#1e150f] border border-[#342419] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#342419] bg-[#18100b] gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-300">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>SOURCE IMAGE</span>
            </div>

            <div className="flex items-center gap-3">
              {imageSrc && (
                <div className="flex items-center gap-1 bg-[#140e0a] border border-[#342419] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setSourceZoom((z) => clampZoom(z - 0.5))}
                    disabled={sourceZoom <= MIN_ZOOM}
                    title="Zoom out source"
                    aria-label="Zoom out source"
                    className="p-1 rounded hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 text-[11px] font-mono text-stone-300 min-w-[3.2rem] text-center">
                    {Math.round(sourceZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setSourceZoom((z) => clampZoom(z + 0.5))}
                    disabled={sourceZoom >= MAX_ZOOM}
                    title="Zoom in source"
                    aria-label="Zoom in source"
                    className="p-1 rounded hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {sourceZoom > 1 && (
                    <button
                      type="button"
                      onClick={() => setSourceZoom(1)}
                      title="Reset source zoom"
                      aria-label="Reset source zoom"
                      className="p-1 rounded hover:bg-[#342419] text-amber-400 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {imageSrc && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Change Image
                </button>
              )}
            </div>
          </div>

          <div
            ref={sourceScrollRef}
            onWheel={(e) => handleWheelZoom(e, sourceZoom, setSourceZoom)}
            onMouseDown={(e) => handlePanStart(e, sourceScrollRef, sourceZoom, true)}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex-1 min-h-0 overflow-auto flex p-4 transition-colors ${
              isDragging ? 'bg-amber-700/15' : 'bg-[#140e0a]/50'
            } ${
              sourceZoom > 1 && !isPickingColor
                ? isPanning
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : ''
            }`}
          >
            {imageSrc ? (
              <div className="m-auto">
                <div
                  className={`relative flex items-center justify-center rounded-lg overflow-hidden ${
                    isPickingColor
                      ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-900/30 cursor-crosshair'
                      : ''
                  }`}
                >
                  <img
                    ref={sourceImgRef}
                    src={imageSrc}
                    alt="Source"
                    onClick={handleSourceImageClick}
                    draggable={false}
                    className="block max-w-none shrink-0 object-contain"
                    style={
                      sourceDisplaySize
                        ? {
                            width: `${sourceDisplaySize.width}px`,
                            height: `${sourceDisplaySize.height}px`,
                            maxWidth: 'none',
                            maxHeight: 'none',
                          }
                        : { maxWidth: '100%', maxHeight: 'calc(100vh - 8.5rem)' }
                    }
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`m-auto w-full h-full max-w-md max-h-56 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 transition-all cursor-pointer ${
                  isDragging
                    ? 'border-amber-500 bg-amber-700/15 text-amber-300'
                    : 'border-[#453022] hover:border-amber-500/60 hover:bg-[#281c14]/30 text-stone-400'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-700/15 border border-amber-600/30 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-stone-200">
                    Click to upload or drag &amp; drop
                  </p>
                  <p className="text-xs text-stone-500 mt-1">PNG, JPG, WebP supported</p>
                </div>
              </button>
            )}
          </div>
        </section>

        {/* Right Section: PREVIEW RESULT */}
        <section className="min-h-[320px] md:min-h-0 flex flex-col rounded-2xl bg-[#1e150f] border border-[#342419] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#342419] bg-[#18100b] gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-300">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>PREVIEW RESULT</span>
            </div>

            <div className="flex items-center gap-3">
              {imageSrc && (
                <div className="flex items-center gap-1 bg-[#140e0a] border border-[#342419] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => clampZoom(z - 0.5))}
                    disabled={previewZoom <= MIN_ZOOM}
                    title="Zoom out preview"
                    aria-label="Zoom out preview"
                    className="p-1 rounded hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 text-[11px] font-mono text-stone-300 min-w-[3.2rem] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => clampZoom(z + 0.5))}
                    disabled={previewZoom >= MAX_ZOOM}
                    title="Zoom in preview"
                    aria-label="Zoom in preview"
                    className="p-1 rounded hover:bg-[#342419] text-stone-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {previewZoom > 1 && (
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(1)}
                      title="Reset preview zoom"
                      aria-label="Reset preview zoom"
                      className="p-1 rounded hover:bg-[#342419] text-amber-400 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {imageDimensions && (
                <span className="hidden sm:inline text-xs font-mono text-stone-500">
                  {imageDimensions.width} &times; {imageDimensions.height} px
                </span>
              )}
            </div>
          </div>

          <div
            ref={previewScrollRef}
            onWheel={(e) => handleWheelZoom(e, previewZoom, setPreviewZoom)}
            onMouseDown={(e) => handlePanStart(e, previewScrollRef, previewZoom)}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            className={`flex-1 min-h-0 overflow-auto flex p-4 ${
              previewZoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            style={CHECKERBOARD_STYLE}
          >
            {imageSrc ? (
              <div className="m-auto">
                <canvas
                  ref={previewCanvasRef}
                  className="block max-w-none shrink-0 object-contain rounded"
                  style={
                    previewDisplaySize
                      ? {
                          width: `${previewDisplaySize.width}px`,
                          height: `${previewDisplaySize.height}px`,
                          maxWidth: 'none',
                          maxHeight: 'none',
                        }
                      : { maxWidth: '100%', maxHeight: 'calc(100vh - 8.5rem)' }
                  }
                />
              </div>
            ) : (
              <div className="m-auto text-center px-4 py-3 rounded-xl bg-[#140e0a]/80 border border-[#342419] backdrop-blur-sm">
                <p className="text-sm text-stone-400">
                  Transparent preview will appear here
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  FileCode,
  Loader2,
  Layers,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crop,
  Pipette,
  RotateCcw,
  Grid,
  Play,
  Pause,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Film,
} from 'lucide-react';
import type { ExtractedFrame } from '../../server/types';
import {
  generateSpritesheet,
  detectAutoCropAcrossFrames,
  hexToRgb,
  type SpritesheetResult,
  type SpritesheetBg,
} from '../services/spritesheetGenerator';
import { generateSpritesheetJson } from '../services/galleryUtils';
import { formatBytes } from '../services/formatters';

interface Props {
  frames: ExtractedFrame[];
  isOpen: boolean;
  onClose: () => void;
  onToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

const COLUMN_OPTIONS = [
  { label: 'Single Row (1 Row Strip - Default)', value: 0 },
  { label: 'Auto Grid', value: -1 },
  { label: '2 Columns', value: 2 },
  { label: '3 Columns', value: 3 },
  { label: '4 Columns', value: 4 },
  { label: '5 Columns', value: 5 },
  { label: '6 Columns', value: 6 },
  { label: '8 Columns', value: 8 },
];

export const SpritesheetModal: React.FC<Props> = ({
  frames,
  isOpen,
  onClose,
  onToast,
}) => {
  const [columns, setColumns] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [background, setBackground] = useState<SpritesheetBg>('transparent');
  const [includeTimestamps, setIncludeTimestamps] = useState<boolean>(false);
  const [enableCrop, setEnableCrop] = useState<boolean>(false);
  const [cropWidth, setCropWidth] = useState<number>(50);
  const [cropOffsetX, setCropOffsetX] = useState<number>(0);
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [contiguousBg, setContiguousBg] = useState<boolean>(true);
  const [keyColorType, setKeyColorType] = useState<string>('auto');
  const [customKeyColor, setCustomKeyColor] = useState<string>('#48494b');
  const [tolerance, setTolerance] = useState<number>(15);
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAutoCropping, setIsAutoCropping] = useState<boolean>(false);
  const [result, setResult] = useState<SpritesheetResult | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [previewMode, setPreviewMode] = useState<'sheet' | 'animate'>('sheet');
  const [animIndex, setAnimIndex] = useState<number>(0);
  const [isAnimPlaying, setIsAnimPlaying] = useState<boolean>(true);
  const [animFps, setAnimFps] = useState<number>(10);
  const [isAnimLooping, setIsAnimLooping] = useState<boolean>(true);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const animCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (previewMode !== 'animate' || !isAnimPlaying || !result || result.framesMeta.length <= 1) return;
    const intervalMs = Math.round(1000 / animFps);
    const timer = setInterval(() => {
      setAnimIndex((prev) => {
        if (prev + 1 >= result.framesMeta.length) {
          if (!isAnimLooping) {
            setIsAnimPlaying(false);
            return prev;
          }
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [previewMode, isAnimPlaying, result, animFps, isAnimLooping]);

  useEffect(() => {
    if (previewMode !== 'animate' || !result || result.framesMeta.length === 0) return;
    const canvas = animCanvasRef.current;
    if (!canvas) return;
    const meta = result.framesMeta[animIndex] || result.framesMeta[0];
    if (!meta) return;

    canvas.width = meta.width;
    canvas.height = meta.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      result.canvas,
      meta.x,
      meta.y,
      meta.width,
      meta.height,
      0,
      0,
      meta.width,
      meta.height
    );
  }, [previewMode, result, animIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewMode !== 'animate' || !result) return;
      if (e.key === ' ') {
        e.preventDefault();
        setIsAnimPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setAnimIndex((prev) => (prev > 0 ? prev - 1 : result.framesMeta.length - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setAnimIndex((prev) => (prev + 1) % result.framesMeta.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewMode, result]);

  const handleBuildSheet = async () => {
    if (!isOpen || frames.length === 0) return;
    setIsGenerating(true);
    try {
      const activeKey = keyColorType === 'custom' ? customKeyColor : keyColorType;
      const data = await generateSpritesheet(frames, {
        columns: columns !== 0 ? columns : undefined,
        scale,
        includeTimestamps,
        background,
        crop: {
          enabled: enableCrop,
          cropWidthPercent: cropWidth,
          offsetXPercent: cropOffsetX,
        },
        bgRemoval: {
          enabled: removeBg,
          keyColor: activeKey,
          tolerance,
          contiguous: contiguousBg,
        },
      });
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to build spritesheet';
      onToast?.('error', 'Spritesheet Error', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFitView = () => {
    if (!result || !previewContainerRef.current) return;
    const padding = 48;
    const cw = previewContainerRef.current.clientWidth - padding;
    const ch = previewContainerRef.current.clientHeight - padding;
    if (cw <= 0 || ch <= 0) return;
    const fit = Math.min(cw / result.width, ch / result.height, 1);
    setPreviewZoom(Number(Math.max(0.1, fit).toFixed(2)));
  };

  const handleAutoCrop = async () => {
    if (frames.length === 0 || isAutoCropping) return;
    setIsAutoCropping(true);
    try {
      const activeKey = keyColorType === 'custom' ? customKeyColor : keyColorType;
      const key = activeKey && activeKey !== 'auto' ? hexToRgb(activeKey) : undefined;
      const cropResult = await detectAutoCropAcrossFrames(frames, key, tolerance);
      setCropWidth(cropResult.cropWidthPercent);
      setCropOffsetX(cropResult.offsetXPercent);
      setEnableCrop(true);
      onToast?.('info', 'Auto Crop Applied', `Cropped to ${cropResult.cropWidthPercent}% width (offset ${cropResult.offsetXPercent}%)`);
    } catch {
      onToast?.('error', 'Auto Crop Failed', 'Could not detect character bounds');
    } finally {
      setIsAutoCropping(false);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPickingColor || !result) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * result.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * result.height);
    const sourceCanvas = result.rawCanvas ?? result.canvas;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    setKeyColorType('custom');
    setCustomKeyColor(hex);
    setIsPickingColor(false);
    setRemoveBg(true);
  };

  const handleDownloadPng = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.dataUrl;
    a.download = `spritesheet_${frames.length}frames_${result.width}x${result.height}.png`;
    a.click();
    onToast?.('success', 'Spritesheet downloaded', a.download);
  };

  const handleResetCrop = () => {
    setCropWidth(100);
    setCropOffsetX(0);
  };

  const handleDownloadJson = () => {
    if (!result) return;
    const jsonStr = generateSpritesheetJson(result.framesMeta, result.width, result.height);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spritesheet_${frames.length}frames.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.('success', 'Spritesheet JSON coordinates saved', a.download);
  };

  useEffect(() => {
    if (isOpen && frames.length > 0) handleBuildSheet();
  }, [
    isOpen,
    columns,
    scale,
    background,
    includeTimestamps,
    enableCrop,
    cropWidth,
    cropOffsetX,
    removeBg,
    contiguousBg,
    keyColorType,
    customKeyColor,
    tolerance,
    frames.length,
  ]);

  useEffect(() => {
    if (isOpen) {
      setPreviewZoom(1);
    }
  }, [isOpen]);

  if (!isOpen || frames.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative max-w-5xl w-full h-[88vh] max-h-[850px] min-h-[620px] bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cinema-accent" />
            <h3 className="font-heading font-bold text-sm text-white">Spritesheet Generator</h3>
            <span className="text-xs text-slate-400">({frames.length} frames)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode((m) => (m === 'animate' ? 'sheet' : 'animate'))}
              disabled={!result || isGenerating}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                previewMode === 'animate'
                  ? 'bg-cinema-accent border-cinema-accent text-white shadow-md shadow-cinema-accent/25'
                  : 'bg-surface border-border-subtle hover:border-cinema-accent/60 text-slate-200 hover:text-white'
              }`}
              title="Preview animation of processed spritesheet frames"
            >
              {previewMode === 'animate' ? (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>View Sheet</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-cinema-accent fill-cinema-accent" />
                  <span>Animate</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!result || isGenerating}
              className="px-3.5 py-1.5 rounded-lg bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-cinema-accent/25 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.PNG)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={!result || isGenerating}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle hover:border-slate-500 disabled:opacity-40 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-cinema-accent" />
              <span>JSON Metadata</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3.5 bg-surface border-b border-border-subtle/80 space-y-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Layout:</span>
                <select
                  value={columns}
                  onChange={(e) => setColumns(Number(e.target.value))}
                  className="bg-surface-elevated border border-border-subtle rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-cinema-accent cursor-pointer"
                >
                  {COLUMN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Scale:</span>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(0.1, Number((s - 0.05).toFixed(2))))}
                  className="w-5 h-5 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-xs select-none cursor-pointer transition-colors"
                  title="Decrease scale by 5%"
                >
                  -
                </button>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(scale * 100)}
                  onChange={(e) => setScale(Number(e.target.value) / 100)}
                  className="w-16 accent-cinema-accent cursor-pointer h-1.5 bg-surface-elevated rounded"
                />
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(1.0, Number((s + 0.05).toFixed(2))))}
                  className="w-5 h-5 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-xs select-none cursor-pointer transition-colors"
                  title="Increase scale by 5%"
                >
                  +
                </button>
                <span className="font-mono text-[11px] text-white w-9">
                  {Math.round(scale * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Background:</span>
                <select
                  value={background}
                  onChange={(e) => setBackground(e.target.value as SpritesheetBg)}
                  className="bg-surface-elevated border border-border-subtle rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-cinema-accent cursor-pointer font-medium"
                >
                  <option value="transparent">Transparent (Alpha)</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                  <option value="dark">Cinema Dark</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={includeTimestamps}
                  onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  className="accent-cinema-accent rounded"
                />
                <span>Timestamps</span>
              </label>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg bg-surface-elevated p-0.5 border border-border-subtle mr-1">
                <button
                  type="button"
                  onClick={() => setPreviewMode('sheet')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    previewMode === 'sheet'
                      ? 'bg-cinema-accent text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="View full spritesheet"
                >
                  <Layers className="w-3 h-3" />
                  <span>Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('animate')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    previewMode === 'animate'
                      ? 'bg-cinema-accent text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Preview looping animation of frames"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Animate</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(0.1, Number((z - 0.15).toFixed(2))))}
                className="p-1 rounded bg-surface-elevated border border-border-subtle text-slate-400 hover:text-white cursor-pointer"
                title="Zoom out preview"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(1)}
                className="font-mono text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-surface-elevated border border-border-subtle cursor-pointer"
                title="Reset 100% zoom"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                className="p-1 rounded bg-surface-elevated border border-border-subtle text-slate-400 hover:text-white cursor-pointer"
                title="Zoom in preview"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleFitView}
                className="p-1 rounded bg-surface-elevated border border-border-subtle text-slate-400 hover:text-white cursor-pointer flex items-center gap-1 px-1.5"
                title="Fit spritesheet to preview window"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-sans">Fit</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGrid((g) => !g)}
                className={`p-1 rounded border cursor-pointer flex items-center gap-1 px-1.5 transition-colors ${
                  showGrid
                    ? 'bg-cinema-accent/20 border-cinema-accent text-cinema-accent font-semibold'
                    : 'bg-surface-elevated border-border-subtle text-slate-400 hover:text-white'
                }`}
                title="Toggle frame cell grid borders"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="text-[10px] font-sans">Grid</span>
              </button>
              {result && (
                <div
                  className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[11px] font-mono text-slate-300 flex items-center gap-1.5"
                  title={`Cell dimensions: each square/frame in the grid is ${result.frameWidth ?? result.framesMeta[0]?.width}px × ${result.frameHeight ?? result.framesMeta[0]?.height}px`}
                >
                  <span className="text-slate-400 text-[10px]">Cell:</span>
                  <span className="text-cinema-accent font-semibold">
                    {result.frameWidth ?? result.framesMeta[0]?.width} × {result.frameHeight ?? result.framesMeta[0]?.height} px
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={removeBg}
                    onChange={(e) => setRemoveBg(e.target.checked)}
                    className="accent-cinema-accent rounded"
                  />
                  <span className="font-semibold text-cinema-accent">Remove Frame BG</span>
                </label>

                {removeBg && (
                  <>
                    <select
                      value={keyColorType}
                      onChange={(e) => setKeyColorType(e.target.value)}
                      className="bg-surface-elevated border border-border-subtle rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-cinema-accent cursor-pointer"
                    >
                      <option value="auto">Auto (Corner Sample)</option>
                      <option value="#48494b">Dark Gray (#48494b)</option>
                      <option value="#00ff00">Green Screen</option>
                      <option value="#0000ff">Blue Screen</option>
                      <option value="#000000">Black Backdrop</option>
                      <option value="#ffffff">White Backdrop</option>
                      <option value="custom">Custom Color...</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsPickingColor((p) => !p)}
                      title={
                        isPickingColor
                          ? 'Click on the preview to sample background color'
                          : 'Eyedropper: click to sample background color from preview'
                      }
                      className={`p-1.5 rounded border text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                        isPickingColor
                          ? 'bg-cinema-accent border-cinema-accent text-white animate-pulse'
                          : 'bg-surface-elevated border-border-subtle text-slate-300 hover:text-white'
                      }`}
                    >
                      <Pipette className="w-3.5 h-3.5" />
                    </button>

                    {keyColorType === 'custom' && (
                      <input
                        type="color"
                        value={customKeyColor}
                        onChange={(e) => setCustomKeyColor(e.target.value)}
                        className="w-6 h-6 rounded border border-border-subtle cursor-pointer bg-transparent"
                        title="Pick custom key color"
                      />
                    )}

                    <div className="flex items-center gap-1" title="Color removal tolerance (lower = safer, preserves more details)">
                      <span className="text-[11px] text-slate-400">Tol:</span>
                      <button
                        type="button"
                        onClick={() => setTolerance((t) => Math.max(1, t - 1))}
                        className="w-4 h-4 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-[11px] select-none cursor-pointer transition-colors"
                        title="Decrease tolerance"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={1}
                        max={80}
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        className="w-14 accent-cinema-accent cursor-pointer h-1.5 bg-surface-elevated rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setTolerance((t) => Math.min(80, t + 1))}
                        className="w-4 h-4 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-[11px] select-none cursor-pointer transition-colors"
                        title="Increase tolerance"
                      >
                        +
                      </button>
                      <span className="font-mono text-[10px] text-slate-400 w-5">{tolerance}%</span>
                    </div>

                    <label
                      className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer select-none"
                      title="Contiguous: only remove background connected to frame edges (protects internal character details with similar colors)"
                    >
                      <input
                        type="checkbox"
                        checked={contiguousBg}
                        onChange={(e) => setContiguousBg(e.target.checked)}
                        className="accent-cinema-accent rounded"
                      />
                      <span>Contiguous</span>
                    </label>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 pl-3 border-l border-border-subtle">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={enableCrop}
                    onChange={(e) => setEnableCrop(e.target.checked)}
                    className="accent-cinema-accent rounded"
                  />
                  <span className="font-semibold text-cinema-accent flex items-center gap-1">
                    <Crop className="w-3.5 h-3.5" />
                    <span>Crop Sides</span>
                  </span>
                </label>

                {enableCrop && (
                  <>
                    <div className="flex items-center gap-1" title="Tighten horizontal width (remove space between subjects)">
                      <span className="text-[11px] text-slate-400">Width:</span>
                      <button
                        type="button"
                        onClick={() => setCropWidth((w) => Math.max(15, w - 2))}
                        className="w-4 h-4 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-[11px] select-none cursor-pointer transition-colors"
                        title="Decrease crop width by 2%"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={15}
                        max={100}
                        step={2}
                        value={cropWidth}
                        onChange={(e) => setCropWidth(Number(e.target.value))}
                        className="w-14 accent-cinema-accent cursor-pointer h-1.5 bg-surface-elevated rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setCropWidth((w) => Math.min(100, w + 2))}
                        className="w-4 h-4 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-[11px] select-none cursor-pointer transition-colors"
                        title="Increase crop width by 2%"
                      >
                        +
                      </button>
                      <span className="font-mono text-[11px] text-white w-7">{cropWidth}%</span>
                    </div>

                    <div className="flex items-center gap-1" title="Pan horizontal center offset">
                      <span className="text-[11px] text-slate-400">Pan:</span>
                      <button
                        type="button"
                        onClick={() => setCropOffsetX((p) => Math.max(-40, p - 2))}
                        className="w-4 h-4 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-[11px] select-none cursor-pointer transition-colors"
                        title="Pan left by 2%"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        step={2}
                        value={cropOffsetX}
                        onChange={(e) => setCropOffsetX(Number(e.target.value))}
                        className="w-12 accent-cinema-accent cursor-pointer h-1.5 bg-surface-elevated rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setCropOffsetX((p) => Math.min(40, p + 2))}
                        className="w-4 h-4 flex items-center justify-center rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white font-mono text-[11px] select-none cursor-pointer transition-colors"
                        title="Pan right by 2%"
                      >
                        +
                      </button>
                      <span className="font-mono text-[11px] text-slate-400 w-7">{cropOffsetX}%</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoCrop}
                      disabled={isAutoCropping}
                      title="Automatically crop width to fit character across all frames with padding"
                      className="px-2 py-0.5 rounded bg-cinema-accent/15 hover:bg-cinema-accent/25 border border-cinema-accent/40 text-cinema-accent text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isAutoCropping ? (
                        <Loader2 className="w-3 h-3 animate-spin text-cinema-accent" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-cinema-accent" />
                      )}
                      <span>Auto Crop</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCrop}
                      title="Reset crop to full frame (100% width, 0% pan)"
                      className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3 text-cinema-accent" />
                      <span>Reset</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {isPickingColor && (
              <span className="text-xs text-cinema-accent font-semibold animate-pulse">
                Click background on the preview image to sample color
              </span>
            )}
          </div>
        </div>

        <div
          ref={previewContainerRef}
          style={
            background === 'transparent'
              ? {
                  backgroundImage: `linear-gradient(45deg, #181829 25%, transparent 25%),
                    linear-gradient(-45deg, #181829 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #181829 75%),
                    linear-gradient(-45deg, transparent 75%, #181829 75%)`,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  backgroundColor: '#0c0c16',
                }
              : undefined
          }
          className="relative flex-1 min-h-0 bg-black/90 overflow-auto p-4 select-none flex"
        >
          {isGenerating ? (
            <div className="m-auto text-center space-y-2">
              <Loader2 className="w-8 h-8 text-cinema-accent animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Stitching frames into spritesheet...</p>
            </div>
          ) : result && previewMode === 'animate' ? (
            <div className="m-auto flex flex-col items-center justify-center p-4 max-w-full">
              <div
                style={{
                  width: `${Math.round((result.frameWidth ?? result.framesMeta[0]?.width ?? 200) * previewZoom)}px`,
                  height: `${Math.round((result.frameHeight ?? result.framesMeta[0]?.height ?? 200) * previewZoom)}px`,
                }}
                className="relative m-auto shrink-0 shadow-2xl rounded border border-cinema-accent/40 bg-surface/30 flex items-center justify-center overflow-hidden transition-all duration-75"
              >
                <canvas
                  ref={animCanvasRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    imageRendering: 'pixelated',
                  }}
                  className="block object-contain"
                />
              </div>

              <div className="mt-4 bg-surface/95 border border-border-subtle rounded-xl p-3 max-w-md w-full shadow-2xl backdrop-blur-md space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-cinema-accent" />
                    Frame {animIndex + 1} / {result.framesMeta.length}
                  </span>
                  <span className="text-cinema-accent text-[11px] font-semibold">
                    {result.framesMeta[animIndex]?.timestampFormatted}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={result.framesMeta.length - 1}
                  value={animIndex}
                  onChange={(e) => {
                    setAnimIndex(Number(e.target.value));
                    setIsAnimPlaying(false);
                  }}
                  className="w-full accent-cinema-accent cursor-pointer h-1.5 bg-surface-elevated rounded"
                />

                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAnimIndex((prev) => (prev > 0 ? prev - 1 : result.framesMeta.length - 1))}
                      className="p-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-slate-300 hover:text-white cursor-pointer transition-colors"
                      title="Previous Frame (Left Arrow)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAnimPlaying((p) => !p)}
                      className="px-3.5 py-1.5 rounded-lg bg-cinema-accent text-white font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-cinema-accentHover shadow-sm transition-all"
                      title={isAnimPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                      {isAnimPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isAnimPlaying ? 'Pause' : 'Play'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnimIndex((prev) => (prev + 1) % result.framesMeta.length)}
                      className="p-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-slate-300 hover:text-white cursor-pointer transition-colors"
                      title="Next Frame (Right Arrow)"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAnimLooping((l) => !l)}
                      className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                        isAnimLooping
                          ? 'bg-cinema-accent/20 border-cinema-accent text-cinema-accent font-semibold'
                          : 'bg-surface-elevated border-border-subtle text-slate-400 hover:text-white'
                      }`}
                      title={isAnimLooping ? 'Looping enabled' : 'Looping disabled'}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-slate-400">Speed:</span>
                    <button
                      type="button"
                      onClick={() => setAnimFps((f) => Math.max(1, f - 2))}
                      className="w-5 h-5 flex items-center justify-center rounded bg-surface-elevated border border-border-subtle text-slate-300 hover:text-white cursor-pointer"
                      title="Decrease FPS"
                    >
                      -
                    </button>
                    <span className="text-white font-semibold w-12 text-center">{animFps} FPS</span>
                    <button
                      type="button"
                      onClick={() => setAnimFps((f) => Math.min(60, f + 2))}
                      className="w-5 h-5 flex items-center justify-center rounded bg-surface-elevated border border-border-subtle text-slate-300 hover:text-white cursor-pointer"
                      title="Increase FPS"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : result ? (
            <div className="m-auto flex items-center justify-start min-w-full min-h-full p-2">
              {(() => {
                const totalW = Math.round(result.width * previewZoom);
                const totalH = Math.round(result.height * previewZoom);

                return (
                  <div
                    style={{
                      width: `${totalW}px`,
                      height: `${totalH}px`,
                    }}
                    className={`relative m-auto shrink-0 shadow-2xl transition-all duration-75 ${
                      showGrid ? '' : 'border border-white/10 rounded-sm overflow-hidden'
                    }`}
                  >
                    <img
                      src={result.dataUrl}
                      alt="Spritesheet preview"
                      onClick={handlePreviewClick}
                      className={`w-full h-full block ${isPickingColor ? 'cursor-crosshair' : ''}`}
                    />

                    {showGrid && (
                      <div className="absolute inset-0 pointer-events-none select-none border border-cinema-accent">
                        {result.framesMeta.map((meta) => {
                          const left = Math.round(meta.x * previewZoom);
                          const top = Math.round(meta.y * previewZoom);
                          const nextX = Math.round((meta.x + meta.width) * previewZoom);
                          const nextY = Math.round((meta.y + meta.height) * previewZoom);
                          const width = Math.min(nextX - left, totalW - left);
                          const height = Math.min(nextY - top, totalH - top);

                          return (
                            <div
                              key={meta.index}
                              style={{
                                left: `${left}px`,
                                top: `${top}px`,
                                width: `${width}px`,
                                height: `${height}px`,
                              }}
                              className="absolute border border-cinema-accent/70"
                            >
                              <span className="absolute top-1 left-1 bg-black/85 text-cinema-accent font-mono text-[9px] px-1.5 py-0.5 rounded border border-cinema-accent/30 leading-none whitespace-nowrap">
                                #{meta.index}
                                {meta.index === 1 && ` • ${result.frameWidth ?? meta.width}×${result.frameHeight ?? meta.height}px`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="m-auto text-center text-slate-500">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Generating spritesheet preview...</p>
            </div>
          )}
        </div>

        {result && (
          <div className="px-4 py-2.5 bg-surface border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold">
                Sheet: {result.width} × {result.height} px
              </span>
              <span>•</span>
              <span className="text-cinema-accent font-semibold">
                Frame: {result.frameWidth ?? result.framesMeta[0]?.width} × {result.frameHeight ?? result.framesMeta[0]?.height} px
              </span>
              <span>•</span>
              <span>
                {result.columns} cols × {result.rows} rows
              </span>
              <span>•</span>
              <span>{formatBytes(result.blob.size)}</span>
              {enableCrop && (
                <span className="text-cinema-accent">
                  (Cropped {cropWidth}%)
                </span>
              )}
            </div>
            <span className="text-slate-500 text-[11px]">Ready for game engines, CSS sprites, & flipbooks</span>
          </div>
        )}
      </div>
    </div>
  );
};

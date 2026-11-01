import type { ExtractedFrame } from '../../server/types';
import {
  calculateGridDimensions,
  computeCropRect,
  calculateAutoCropPercentages,
  type CropRect,
  type SpritesheetFrameMeta,
  type AutoCropResult,
} from './galleryUtils';

export type SpritesheetBg = 'transparent' | 'black' | 'white' | 'dark';

export interface BgRemovalOptions {
  enabled: boolean;
  keyColor?: string; // hex color or 'auto'
  tolerance?: number; // 0 to 100
  feather?: number; // 0 to 50
  contiguous?: boolean; // only remove background connected to borders
}

export interface FrameCropOptions {
  enabled: boolean;
  cropWidthPercent?: number; // 20 to 100
  cropHeightPercent?: number; // 20 to 100
  offsetXPercent?: number; // -40 to 40
}

export interface SpritesheetOptions {
  columns?: number;
  scale?: number;
  spacing?: number;
  includeTimestamps?: boolean;
  background?: SpritesheetBg;
  bgRemoval?: BgRemovalOptions;
  crop?: FrameCropOptions;
}

export interface SpritesheetResult {
  canvas: HTMLCanvasElement;
  rawCanvas?: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  framesMeta: SpritesheetFrameMeta[];
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const isDataOrBlob = url.startsWith('data:') || url.startsWith('blob:');
    if (!isDataOrBlob) img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => {
      if (img.crossOrigin) {
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.onerror = () => reject(new Error(`Failed to load image: ${url.split('/').pop() || url}`));
        fallback.src = url;
        return;
      }
      reject(new Error(`Failed to load image: ${url.split('/').pop() || url}`));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create canvas blob'));
    }, type);
  });
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

export function detectCornerColor(
  data: Uint8ClampedArray,
  w: number,
  h: number
): { r: number; g: number; b: number } {
  const ix = Math.min(10, Math.floor(w / 10));
  const iy = Math.min(10, Math.floor(h / 10));
  const corners = [
    (iy * w + ix) * 4,
    (iy * w + (w - 1 - ix)) * 4,
    ((h - 1 - iy) * w + ix) * 4,
    ((h - 1 - iy) * w + (w - 1 - ix)) * 4,
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of corners) {
    r += data[c] ?? 0;
    g += data[c + 1] ?? 0;
    b += data[c + 2] ?? 0;
  }
  return { r: Math.round(r / 4), g: Math.round(g / 4), b: Math.round(b / 4) };
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function getColorDistance(r: number, g: number, b: number, key: RGBColor): number {
  const dr = r - key.r;
  const dg = g - key.g;
  const db = b - key.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function computeAlpha(dist: number, tol: number, fth: number, currentAlpha: number): number {
  if (dist <= tol) return 0;
  if (fth <= 0) return currentAlpha;
  const factor = Math.min(1, Math.max(0, (dist - tol) / fth));
  return Math.round(currentAlpha * factor);
}

function getBorderIndices(w: number, h: number): number[] {
  const indices: number[] = [];
  for (let x = 0; x < w; x++) {
    indices.push(x);
    indices.push((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    indices.push(y * w);
    indices.push(y * w + (w - 1));
  }
  return indices;
}

function seedBorderQueue(
  d: Uint8ClampedArray,
  borders: number[],
  key: RGBColor,
  maxDist: number,
  mask: Uint8Array,
  queue: Int32Array
): number {
  let tail = 0;
  for (const idx of borders) {
    if (mask[idx]) continue;
    const p = idx * 4;
    if (getColorDistance(d[p], d[p + 1], d[p + 2], key) <= maxDist) {
      mask[idx] = 1;
      queue[tail++] = idx;
    }
  }
  return tail;
}

function runBfsFloodFill(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  key: RGBColor,
  maxDist: number,
  mask: Uint8Array,
  queue: Int32Array,
  tail: number
): void {
  let head = 0;
  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);
    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];
    for (const n of neighbors) {
      if (n === -1 || mask[n]) continue;
      const p = n * 4;
      if (getColorDistance(d[p], d[p + 1], d[p + 2], key) <= maxDist) {
        mask[n] = 1;
        queue[tail++] = n;
      }
    }
  }
}

function applyContiguousRemoval(
  imgData: ImageData,
  key: RGBColor,
  tol: number,
  fth: number
): void {
  const w = imgData.width ?? 0;
  const h = imgData.height ?? 0;
  if (w <= 0 || h <= 0) {
    applyGlobalRemoval(imgData, key, tol, fth);
    return;
  }
  const d = imgData.data;
  const mask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const borders = getBorderIndices(w, h);
  const tail = seedBorderQueue(d, borders, key, tol + fth, mask, queue);
  runBfsFloodFill(d, w, h, key, tol + fth, mask, queue, tail);

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4;
    const dist = getColorDistance(d[p], d[p + 1], d[p + 2], key);
    d[p + 3] = computeAlpha(dist, tol, fth, d[p + 3]);
  }
}

function applyGlobalRemoval(
  imgData: ImageData,
  key: RGBColor,
  tol: number,
  fth: number
): void {
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const dist = getColorDistance(d[i], d[i + 1], d[i + 2], key);
    if (dist <= tol + fth) {
      d[i + 3] = computeAlpha(dist, tol, fth, d[i + 3]);
    }
  }
}

export function applyChromaKey(
  imgData: ImageData,
  keyColor: RGBColor,
  tolerance = 15,
  feather = 4,
  contiguous = true
): void {
  const tol = Math.max(1, tolerance * 1.5);
  const fth = Math.max(0, feather * 0.8);
  if (contiguous) {
    applyContiguousRemoval(imgData, keyColor, tol, fth);
    return;
  }
  applyGlobalRemoval(imgData, keyColor, tol, fth);
}

function drawProcessedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  fw: number,
  fh: number,
  cropRect: CropRect,
  bgRemoval?: BgRemovalOptions
): void {
  const offscreen = document.createElement('canvas');
  offscreen.width = fw;
  offscreen.height = fh;
  const octx = offscreen.getContext('2d');
  if (!octx) {
    ctx.drawImage(img, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, x, y, fw, fh);
    return;
  }
  octx.drawImage(img, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, fw, fh);

  if (bgRemoval?.enabled) {
    const imgData = octx.getImageData(0, 0, fw, fh);
    const key = bgRemoval.keyColor && bgRemoval.keyColor !== 'auto'
      ? hexToRgb(bgRemoval.keyColor)
      : detectCornerColor(imgData.data, fw, fh);
    applyChromaKey(
      imgData,
      key,
      bgRemoval.tolerance ?? 15,
      bgRemoval.feather ?? 4,
      bgRemoval.contiguous ?? true
    );
    octx.putImageData(imgData, 0, 0);
  }

  ctx.drawImage(offscreen, x, y);
}

function drawTimestampOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const fontSize = Math.max(10, Math.floor(h / 14));
  ctx.font = `${fontSize}px monospace`;
  const textWidth = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x + w - textWidth - 8, y + h - fontSize - 6, textWidth + 8, fontSize + 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x + w - textWidth - 4, y + h - 4);
}

function renderFramesToCanvas(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  frames: ExtractedFrame[],
  config: {
    cols: number;
    fw: number;
    fh: number;
    spacing: number;
    cropRect: CropRect;
    withTimestamps?: boolean;
    bgRemoval?: BgRemovalOptions;
  }
): SpritesheetFrameMeta[] {
  const { cols, fw, fh, spacing, cropRect, withTimestamps, bgRemoval } = config;
  const meta: SpritesheetFrameMeta[] = [];

  for (let i = 0; i < images.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (fw + spacing);
    const y = row * (fh + spacing);
    drawProcessedImage(ctx, images[i], x, y, fw, fh, cropRect, bgRemoval);
    if (withTimestamps) drawTimestampOverlay(ctx, frames[i].timestampFormatted, x, y, fw, fh);
    meta.push({
      index: i + 1,
      filename: frames[i].filename,
      timestamp: frames[i].timestamp,
      timestampFormatted: frames[i].timestampFormatted,
      x,
      y,
      width: fw,
      height: fh,
    });
  }
  return meta;
}

function applyBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: SpritesheetBg = 'transparent'
): void {
  if (bg === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (bg === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (bg === 'dark') {
    ctx.fillStyle = '#090910';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.clearRect(0, 0, w, h);
}

function computeSpritesheetDimensions(
  baseW: number,
  baseH: number,
  columns: number,
  rows: number,
  opts: SpritesheetOptions
): { fw: number; fh: number; totalW: number; totalH: number; cropRect: CropRect } {
  const scale = opts.scale ?? 1;
  const spacing = opts.spacing ?? 0;
  const crop = opts.crop;
  const cropRect = crop?.enabled
    ? computeCropRect(baseW, baseH, crop.cropWidthPercent, crop.cropHeightPercent, crop.offsetXPercent)
    : { sx: 0, sy: 0, sw: baseW, sh: baseH };
  const fw = Math.max(1, Math.round(cropRect.sw * scale));
  const fh = Math.max(1, Math.round(cropRect.sh * scale));
  const totalW = columns * fw + (columns - 1) * spacing;
  const totalH = rows * fh + (rows - 1) * spacing;
  return { fw, fh, totalW, totalH, cropRect };
}

function createRawCanvas(
  images: HTMLImageElement[],
  frames: ExtractedFrame[],
  totalW: number,
  totalH: number,
  config: { cols: number; fw: number; fh: number; spacing: number; cropRect: CropRect }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  renderFramesToCanvas(ctx, images, frames, { ...config, bgRemoval: undefined });
  return canvas;
}

export async function generateSpritesheet(
  frames: ExtractedFrame[],
  opts: SpritesheetOptions = {}
): Promise<SpritesheetResult> {
  if (frames.length === 0) throw new Error('No frames provided for spritesheet');
  const images = await Promise.all(frames.map((f) => loadImage(f.url)));
  const { columns, rows } = calculateGridDimensions(frames.length, opts.columns);
  const dims = computeSpritesheetDimensions(images[0].naturalWidth, images[0].naturalHeight, columns, rows, opts);

  const canvas = document.createElement('canvas');
  canvas.width = dims.totalW;
  canvas.height = dims.totalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  applyBackground(ctx, dims.totalW, dims.totalH, opts.background);
  const cfg = { cols: columns, fw: dims.fw, fh: dims.fh, spacing: opts.spacing ?? 0, cropRect: dims.cropRect };
  const framesMeta = renderFramesToCanvas(ctx, images, frames, {
    ...cfg,
    withTimestamps: opts.includeTimestamps,
    bgRemoval: opts.bgRemoval,
  });
  const rawCanvas = opts.bgRemoval?.enabled
    ? createRawCanvas(images, frames, dims.totalW, dims.totalH, cfg)
    : canvas;
  const blob = await canvasToBlob(canvas, 'image/png');

  return {
    canvas,
    rawCanvas,
    dataUrl: canvas.toDataURL('image/png'),
    blob,
    width: dims.totalW,
    height: dims.totalH,
    frameWidth: dims.fw,
    frameHeight: dims.fh,
    columns,
    rows,
    framesMeta,
  };
}

function isForegroundPixel(
  d: Uint8ClampedArray,
  idx: number,
  key: RGBColor,
  tol: number
): boolean {
  if (d[idx + 3] < 20) return false;
  return getColorDistance(d[idx], d[idx + 1], d[idx + 2], key) > tol;
}

function findFrameHorizontalBounds(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  key: RGBColor,
  tol: number
): { minX: number; maxX: number } | null {
  let minX = -1;
  let maxX = -1;
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y += 3) {
      if (isForegroundPixel(d, (y * w + x) * 4, key, tol)) {
        minX = x;
        break;
      }
    }
    if (minX !== -1) break;
  }
  if (minX === -1) return null;

  for (let x = w - 1; x >= minX; x -= 2) {
    for (let y = 0; y < h; y += 3) {
      if (isForegroundPixel(d, (y * w + x) * 4, key, tol)) {
        maxX = x;
        break;
      }
    }
    if (maxX !== -1) break;
  }
  return { minX, maxX };
}

export async function detectAutoCropAcrossFrames(
  frames: ExtractedFrame[],
  keyColor?: RGBColor,
  tolerance = 15
): Promise<AutoCropResult> {
  if (frames.length === 0) return { cropWidthPercent: 100, offsetXPercent: 0 };
  const images = await Promise.all(frames.map((f) => loadImage(f.url)));
  const w = images[0].naturalWidth;
  const h = images[0].naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { cropWidthPercent: 100, offsetXPercent: 0 };

  const tol = Math.max(10, tolerance * 1.5);
  let globalMinX = w;
  let globalMaxX = 0;

  for (const img of images) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    const activeKey = keyColor ?? detectCornerColor(data, w, h);
    const bounds = findFrameHorizontalBounds(data, w, h, activeKey, tol);
    if (!bounds) continue;
    if (bounds.minX < globalMinX) globalMinX = bounds.minX;
    if (bounds.maxX > globalMaxX) globalMaxX = bounds.maxX;
  }
  return calculateAutoCropPercentages({ globalMinX, globalMaxX, frameWidth: w });
}

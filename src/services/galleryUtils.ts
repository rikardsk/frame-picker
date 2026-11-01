import type { ExtractedFrame } from '../../server/types';

export type SortOrder = 'asc' | 'desc';

export interface SpritesheetFrameMeta {
  index: number;
  filename: string;
  timestamp: number;
  timestampFormatted: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function sortFramesByTimestamp(
  frames: ExtractedFrame[],
  order: SortOrder = 'asc'
): ExtractedFrame[] {
  if (!frames || frames.length <= 1) return frames ? [...frames] : [];
  return [...frames].sort((a, b) => {
    return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });
}

export function calculateGridDimensions(
  frameCount: number,
  customCols?: number
): { columns: number; rows: number } {
  if (frameCount <= 0) return { columns: 0, rows: 0 };
  if (customCols === -1) {
    const cols = Math.ceil(Math.sqrt(frameCount));
    const rows = Math.ceil(frameCount / cols);
    return { columns: Math.max(1, cols), rows: Math.max(1, rows) };
  }
  if (customCols && customCols > 0) {
    const cols = Math.min(customCols, frameCount);
    return { columns: cols, rows: Math.ceil(frameCount / cols) };
  }
  return { columns: frameCount, rows: 1 };
}

export function filterActiveFrames(
  frames: ExtractedFrame[],
  disabledIds?: Set<string>
): ExtractedFrame[] {
  if (!frames || frames.length === 0) return [];
  return frames.filter((f) => {
    if (f.disabled) return false;
    if (disabledIds && disabledIds.has(f.id)) return false;
    return true;
  });
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface AutoCropParams {
  globalMinX: number;
  globalMaxX: number;
  frameWidth: number;
  paddingPercent?: number;
}

export interface AutoCropResult {
  cropWidthPercent: number;
  offsetXPercent: number;
}

export function calculateAutoCropPercentages(params: AutoCropParams): AutoCropResult {
  const { globalMinX, globalMaxX, frameWidth, paddingPercent = 4 } = params;
  if (frameWidth <= 0 || globalMaxX <= globalMinX) {
    return { cropWidthPercent: 100, offsetXPercent: 0 };
  }
  const pad = Math.round(frameWidth * (paddingPercent / 100));
  const left = Math.max(0, globalMinX - pad);
  const right = Math.min(frameWidth, globalMaxX + pad);
  const cropW = right - left;

  const cropWidthPercent = Math.min(100, Math.max(15, Math.round((cropW / frameWidth) * 100)));
  const cropCenter = (left + right) / 2;
  const frameCenter = frameWidth / 2;
  const offsetPercent = Math.round(((cropCenter - frameCenter) / frameWidth) * 100);
  const offsetXPercent = Math.min(40, Math.max(-40, offsetPercent));

  return { cropWidthPercent, offsetXPercent };
}

export function computeCropRect(
  originalW: number,
  originalH: number,
  cropWidthPercent = 100,
  cropHeightPercent = 100,
  offsetXPercent = 0
): CropRect {
  const cw = Math.max(0.1, Math.min(1, cropWidthPercent / 100));
  const ch = Math.max(0.1, Math.min(1, cropHeightPercent / 100));
  const sw = Math.round(originalW * cw);
  const sh = Math.round(originalH * ch);

  const cx = (originalW - sw) / 2;
  const offX = Math.round(originalW * (offsetXPercent / 100));
  const sx = Math.max(0, Math.min(originalW - sw, cx + offX));
  const sy = Math.max(0, Math.min(originalH - sh, (originalH - sh) / 2));

  return { sx, sy, sw, sh };
}

export function generateSpritesheetJson(
  meta: SpritesheetFrameMeta[],
  totalWidth: number,
  totalHeight: number
): string {
  const data = {
    meta: {
      app: 'FramePicker',
      version: '1.0.0',
      size: { w: totalWidth, h: totalHeight },
      totalFrames: meta.length,
    },
    frames: meta.map((f) => ({
      filename: f.filename,
      timestamp: f.timestamp,
      timestampFormatted: f.timestampFormatted,
      frame: { x: f.x, y: f.y, w: f.width, h: f.height },
    })),
  };
  return JSON.stringify(data, null, 2);
}

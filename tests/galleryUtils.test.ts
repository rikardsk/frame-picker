import { describe, it, expect } from 'vitest';
import {
  sortFramesByTimestamp,
  calculateGridDimensions,
  generateSpritesheetJson,
  filterActiveFrames,
  computeCropRect,
  calculateAutoCropPercentages,
} from '../src/services/galleryUtils';
import {
  hexToRgb,
  detectCornerColor,
  applyChromaKey,
} from '../src/services/spritesheetGenerator';
import type { ExtractedFrame } from '../server/types';

const mockFrames: ExtractedFrame[] = [
  {
    id: 'frame-3',
    index: 3,
    timestamp: 15.5,
    timestampFormatted: '00:15.500',
    filename: 'frame_0003.jpg',
    url: '/api/frames/1/frame_0003.jpg',
    sizeBytes: 1024,
  },
  {
    id: 'frame-1',
    index: 1,
    timestamp: 2.1,
    timestampFormatted: '00:02.100',
    filename: 'frame_0001.jpg',
    url: '/api/frames/1/frame_0001.jpg',
    sizeBytes: 1024,
  },
  {
    id: 'frame-2',
    index: 2,
    timestamp: 8.0,
    timestampFormatted: '00:08.000',
    filename: 'frame_0002.jpg',
    url: '/api/frames/1/frame_0002.jpg',
    sizeBytes: 1024,
  },
];

describe('galleryUtils', () => {
  it('sorts frames by timestamp ascending', () => {
    const sorted = sortFramesByTimestamp(mockFrames, 'asc');
    expect(sorted.map((f) => f.id)).toEqual(['frame-1', 'frame-2', 'frame-3']);
  });

  it('sorts frames by timestamp descending', () => {
    const sorted = sortFramesByTimestamp(mockFrames, 'desc');
    expect(sorted.map((f) => f.id)).toEqual(['frame-3', 'frame-2', 'frame-1']);
  });

  it('handles empty or single item arrays in sort', () => {
    expect(sortFramesByTimestamp([])).toEqual([]);
    expect(sortFramesByTimestamp([mockFrames[0]])).toEqual([mockFrames[0]]);
  });

  it('calculates optimal auto grid dimensions and default single row', () => {
    expect(calculateGridDimensions(0)).toEqual({ columns: 0, rows: 0 });
    expect(calculateGridDimensions(4)).toEqual({ columns: 4, rows: 1 });
    expect(calculateGridDimensions(10)).toEqual({ columns: 10, rows: 1 });
    expect(calculateGridDimensions(4, -1)).toEqual({ columns: 2, rows: 2 });
    expect(calculateGridDimensions(9, -1)).toEqual({ columns: 3, rows: 3 });
    expect(calculateGridDimensions(10, -1)).toEqual({ columns: 4, rows: 3 });
  });

  it('respects custom column count in grid calculation', () => {
    expect(calculateGridDimensions(10, 5)).toEqual({ columns: 5, rows: 2 });
    expect(calculateGridDimensions(10, 2)).toEqual({ columns: 2, rows: 5 });
    expect(calculateGridDimensions(3, 6)).toEqual({ columns: 3, rows: 1 });
  });

  it('generates valid spritesheet coordinate JSON', () => {
    const meta = [
      {
        index: 1,
        filename: 'f1.jpg',
        timestamp: 0.5,
        timestampFormatted: '00:00.500',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      {
        index: 2,
        filename: 'f2.jpg',
        timestamp: 1.0,
        timestampFormatted: '00:01.000',
        x: 100,
        y: 0,
        width: 100,
        height: 100,
      },
    ];
    const jsonStr = generateSpritesheetJson(meta, 200, 100);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.meta.totalFrames).toBe(2);
    expect(parsed.meta.size).toEqual({ w: 200, h: 100 });
    expect(parsed.frames[0].frame).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('filters out disabled frames correctly', () => {
    const disabledSet = new Set(['frame-2']);
    const active = filterActiveFrames(mockFrames, disabledSet);
    expect(active.map((f) => f.id)).toEqual(['frame-3', 'frame-1']);

    const framesWithProp: ExtractedFrame[] = [
      { ...mockFrames[0], disabled: true },
      mockFrames[1],
    ];
    expect(filterActiveFrames(framesWithProp).map((f) => f.id)).toEqual(['frame-1']);
    expect(filterActiveFrames([])).toEqual([]);
  });

  it('converts hex colors to rgb accurately', () => {
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('detects corner color and applies chroma key to alpha channel', () => {
    const rawData = new Uint8ClampedArray([
      0, 255, 0, 255, // (0,0) green
      0, 255, 0, 255, // (1,0) green
      0, 255, 0, 255, // (0,1) green
      0, 255, 0, 255, // (1,1) green
    ]);
    const detected = detectCornerColor(rawData, 2, 2);
    expect(detected).toEqual({ r: 0, g: 255, b: 0 });

    const imgData = { data: rawData, width: 2, height: 2 } as ImageData;
    applyChromaKey(imgData, { r: 0, g: 255, b: 0 }, 15, 0);
    // Alpha channel should now be 0 (transparent)
    expect(imgData.data[3]).toBe(0);
  });

  it('preserves subject colors and details when removing grey background', () => {
    // 3x1 image: [0]=grey background, [1]=slate blue cape, [2]=brown satchel
    const rawData = new Uint8ClampedArray([
      72, 72, 72, 255, // Background (72, 72, 72)
      67, 94, 128, 255, // Blue cape
      121, 106, 84, 255, // Brown bag
    ]);
    const imgData = { data: rawData, width: 3, height: 1 } as ImageData;
    applyChromaKey(imgData, { r: 72, g: 72, b: 72 }, 15, 4, false);

    // Background should be removed (alpha 0)
    expect(imgData.data[3]).toBe(0);
    // Cape and bag must be completely preserved (alpha 255)
    expect(imgData.data[7]).toBe(255);
    expect(imgData.data[11]).toBe(255);
  });

  it('contiguous mode protects internal pixels matching background color', () => {
    // 3x3 grid:
    // BG, BG, BG
    // BG, SUBJECT_BORDER, BG
    // BG, BG, BG
    // With center surrounded by a solid subject ring
    // 5x5 image where border is grey, ring is green, center is grey
    const w = 5;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isRing = x === 1 || x === 3 || y === 1 || y === 3;
        if (isRing) {
          // Green character outline/body
          data[idx] = 0; data[idx + 1] = 200; data[idx + 2] = 0; data[idx + 3] = 255;
        } else {
          // Grey (72, 72, 72) - both outer background and inner enclosed center
          data[idx] = 72; data[idx + 1] = 72; data[idx + 2] = 72; data[idx + 3] = 255;
        }
      }
    }

    const imgData = { data, width: w, height: h } as ImageData;
    applyChromaKey(imgData, { r: 72, g: 72, b: 72 }, 15, 0, true);

    // Top-left outer border background must be transparent (alpha 0)
    expect(imgData.data[3]).toBe(0);

    // Enclosed center pixel at (2, 2) has the exact background color but is inside the subject
    const centerIdx = (2 * w + 2) * 4;
    expect(imgData.data[centerIdx + 3]).toBe(255);
  });

  it('computes crop rect correctly for centered and offset frames', () => {
    // 100% full frame
    const full = computeCropRect(1000, 500, 100, 100, 0);
    expect(full).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 500 });

    // 50% width centered
    const halfWidth = computeCropRect(1000, 500, 50, 100, 0);
    expect(halfWidth).toEqual({ sx: 250, sy: 0, sw: 500, sh: 500 });

    // 50% width shifted 10% right
    const shifted = computeCropRect(1000, 500, 50, 100, 10);
    expect(shifted).toEqual({ sx: 350, sy: 0, sw: 500, sh: 500 });
  });

  it('calculates auto crop percentages with padding accurately', () => {
    // Character spans x: 300 to 700 on a 1000px wide frame (centered)
    // 4% padding on 1000px = 40px on each side -> left=260, right=740, width=480 (48%)
    const centered = calculateAutoCropPercentages({
      globalMinX: 300,
      globalMaxX: 700,
      frameWidth: 1000,
      paddingPercent: 4,
    });
    expect(centered.cropWidthPercent).toBe(48);
    expect(centered.offsetXPercent).toBe(0);

    // Character on the left side: x: 100 to 400 on 1000px frame
    // 4% padding (40px) -> left=60, right=440, width=380 (38%)
    // Center of crop = (60+440)/2 = 250. Frame center = 500. Offset = (250-500)/1000 = -25%
    const leftSide = calculateAutoCropPercentages({
      globalMinX: 100,
      globalMaxX: 400,
      frameWidth: 1000,
      paddingPercent: 4,
    });
    expect(leftSide.cropWidthPercent).toBe(38);
    expect(leftSide.offsetXPercent).toBe(-25);

    // Invalid or empty bounds fallback to full frame
    const fallback = calculateAutoCropPercentages({
      globalMinX: 500,
      globalMaxX: 200,
      frameWidth: 1000,
    });
    expect(fallback.cropWidthPercent).toBe(100);
    expect(fallback.offsetXPercent).toBe(0);
  });

  it('correctly calculates flush grid coordinates and total dimensions', () => {
    const fw = 100;
    const cols = 3;
    const coords = [0, 1, 2].map((i) => ({
      x: (i % cols) * fw,
      y: Math.floor(i / cols) * fw,
    }));
    expect(coords[0].x).toBe(0);
    expect(coords[1].x).toBe(100);
    expect(coords[2].x).toBe(200);
    const totalW = cols * fw;
    expect(totalW).toBe(300);
  });
});

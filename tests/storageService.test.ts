import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import {
  BASE_OUTPUT_DIR,
  BASE_SAVED_DIR,
  BASE_UPLOADS_DIR,
  getAllSavedFrames,
  createZipFromFrames,
  resolveFrameFilePath,
} from '../server/services/storageService';

describe('storageService paths and directory locations', () => {
  it('defines correct paths for output, uploads, and saved frames', () => {
    expect(BASE_OUTPUT_DIR).toContain(path.join('output', 'frames'));
    expect(BASE_UPLOADS_DIR).toContain(path.join('output', 'uploads'));
    expect(BASE_SAVED_DIR).toContain('saved_frames');
  });

  it('can scan saved frames and generate a zip archive', async () => {
    const frames = await getAllSavedFrames();
    expect(Array.isArray(frames)).toBe(true);

    if (frames.length > 0) {
      const zipPath = await createZipFromFrames(frames.slice(0, 2));
      expect(existsSync(zipPath)).toBe(true);
      await fs.unlink(zipPath);
    }
  });

  it('resolves existing frame paths and falls back correctly', () => {
    const resolved = resolveFrameFilePath({
      sessionId: 'nonexistent-session',
      filename: 'frame_0001_960ms.jpg',
    });
    expect(resolved).not.toBeNull();
    expect(existsSync(resolved!)).toBe(true);

    const missing = resolveFrameFilePath({
      sessionId: 'nonexistent-session',
      filename: 'definitely_does_not_exist_9999.jpg',
    });
    expect(missing).toBeNull();
  });
});

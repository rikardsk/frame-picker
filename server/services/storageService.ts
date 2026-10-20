import fs from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
// @ts-ignore
import archiver from 'archiver';
import type { ExtractedFrame } from '../types';

const BASE_OUTPUT_DIR = path.resolve(process.cwd(), 'output', 'frames');

export async function ensureOutputDir(sessionId: string): Promise<string> {
  const sessionDir = path.join(BASE_OUTPUT_DIR, sessionId);
  if (!existsSync(sessionDir)) {
    await fs.mkdir(sessionDir, { recursive: true });
  }
  return sessionDir;
}

export function getSessionDirPath(sessionId: string): string {
  return path.join(BASE_OUTPUT_DIR, sessionId);
}

export async function deleteFrameFile(sessionId: string, filename: string): Promise<boolean> {
  const cleanSessionId = path.basename(sessionId);
  const cleanFilename = path.basename(filename);
  const filePath = path.join(BASE_OUTPUT_DIR, cleanSessionId, cleanFilename);
  if (!existsSync(filePath)) return false;
  await fs.unlink(filePath);
  return true;
}

export async function createZipArchive(
  sessionId: string,
  frames: ExtractedFrame[]
): Promise<string> {
  const sessionDir = getSessionDirPath(sessionId);
  const zipPath = path.join(sessionDir, `frames_${sessionId}.zip`);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);

    for (const frame of frames) {
      const filePath = path.join(sessionDir, frame.filename);
      if (existsSync(filePath)) {
        archive.file(filePath, { name: frame.filename });
      }
    }

    archive.finalize();
  });
}

export async function cleanupOldSessions(maxAgeMs = 2 * 60 * 60 * 1000): Promise<void> {
  if (!existsSync(BASE_OUTPUT_DIR)) return;

  const entries = await fs.readdir(BASE_OUTPUT_DIR, { withFileTypes: true });
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const itemPath = path.join(BASE_OUTPUT_DIR, entry.name);
    try {
      const stats = await fs.stat(itemPath);
      if (now - stats.mtimeMs > maxAgeMs) {
        await fs.rm(itemPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error for in-use sessions
    }
  }
}

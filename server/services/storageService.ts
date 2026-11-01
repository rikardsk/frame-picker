import fs from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import crypto from 'crypto';
// @ts-ignore
import archiver from 'archiver';
import type { ExtractedFrame } from '../types';

export const BASE_OUTPUT_DIR = path.resolve(process.cwd(), 'output', 'frames');
export const BASE_UPLOADS_DIR = path.resolve(process.cwd(), 'output', 'uploads');
export const BASE_SAVED_DIR = path.resolve(process.cwd(), 'saved_frames');

export async function ensureOutputDir(sessionId: string): Promise<string> {
  const sessionDir = path.join(BASE_OUTPUT_DIR, sessionId);
  if (!existsSync(sessionDir)) {
    await fs.mkdir(sessionDir, { recursive: true });
  }
  return sessionDir;
}

export async function ensureUploadDir(uploadId: string): Promise<string> {
  const uploadDir = path.join(BASE_UPLOADS_DIR, uploadId);
  if (!existsSync(uploadDir)) {
    await fs.mkdir(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export async function saveUploadedFile(
  stream: NodeJS.ReadableStream,
  originalFilename: string
): Promise<{ uploadId: string; filePath: string; filename: string; sizeBytes: number }> {
  const uploadId = crypto.randomUUID();
  const uploadDir = await ensureUploadDir(uploadId);
  const cleanName = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_') || 'video.mp4';
  const filePath = path.join(uploadDir, cleanName);

  await pipeline(stream, createWriteStream(filePath));
  const stat = await fs.stat(filePath);

  return { uploadId, filePath, filename: cleanName, sizeBytes: stat.size };
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

export function resolveFrameFilePath(frame: { sessionId?: string; filename: string }): string | null {
  const cleanFilename = path.basename(frame.filename);
  if (frame.sessionId) {
    const cleanSession = path.basename(frame.sessionId);
    const p = path.join(BASE_OUTPUT_DIR, cleanSession, cleanFilename);
    if (existsSync(p)) return p;
  }
  const inSavedFrames = path.join(BASE_SAVED_DIR, cleanFilename);
  if (existsSync(inSavedFrames)) return inSavedFrames;

  const inOutputSaved = path.join(BASE_OUTPUT_DIR, 'saved', cleanFilename);
  if (existsSync(inOutputSaved)) return inOutputSaved;

  const inBaseOutput = path.join(BASE_OUTPUT_DIR, cleanFilename);
  if (existsSync(inBaseOutput)) return inBaseOutput;

  return null;
}

export async function createZipFromFrames(frames: ExtractedFrame[]): Promise<string> {
  const zipDir = path.join(BASE_OUTPUT_DIR, 'zips');
  if (!existsSync(zipDir)) await fs.mkdir(zipDir, { recursive: true });
  const zipPath = path.join(zipDir, `frames_export_${Date.now()}.zip`);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(zipPath));
    archive.on('error', (err: Error) => reject(err));
    archive.pipe(output);

    frames.forEach((frame, idx) => {
      const filePath = resolveFrameFilePath(frame);
      if (!filePath) return;
      const num = String(idx + 1).padStart(4, '0');
      archive.file(filePath, { name: `frame_${num}_${path.basename(frame.filename)}` });
    });

    archive.finalize();
  });
}

async function cleanDirectory(dir: string, maxAgeMs: number): Promise<void> {
  if (!existsSync(dir)) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'saved' || entry.name === 'zips') continue;
    const itemPath = path.join(dir, entry.name);
    try {
      const stats = await fs.stat(itemPath);
      if (now - stats.mtimeMs > maxAgeMs) {
        await fs.rm(itemPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error for in-use folders
    }
  }
}

export async function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  await cleanDirectory(BASE_OUTPUT_DIR, maxAgeMs);
  await cleanDirectory(BASE_UPLOADS_DIR, maxAgeMs);
}

function parseFrameEntry(entryName: string, fileName: string, sizeBytes: number): ExtractedFrame {
  const match = fileName.match(/_(\d+)ms\.(jpg|png|webp)$/i);
  const timestamp = match ? parseInt(match[1], 10) / 1000 : 0;
  const mins = Math.floor(timestamp / 60);
  const secs = (timestamp % 60).toFixed(3);
  const timestampFormatted = `${mins.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
  return {
    id: `${entryName}-${fileName}`,
    sessionId: entryName,
    index: 1,
    timestamp,
    timestampFormatted,
    filename: fileName,
    url: `/api/frames/${entryName}/${fileName}`,
    sizeBytes,
  };
}

export async function getAllSavedFrames(): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  if (existsSync(BASE_OUTPUT_DIR)) {
    const entries = await fs.readdir(BASE_OUTPUT_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'zips') continue;
      const sessionDir = path.join(BASE_OUTPUT_DIR, entry.name);
      const files = await fs.readdir(sessionDir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) continue;
        const stat = await fs.stat(path.join(sessionDir, file.name));
        frames.push(parseFrameEntry(entry.name, file.name, stat.size));
      }
    }
  }

  if (existsSync(BASE_SAVED_DIR)) {
    const savedFiles = await fs.readdir(BASE_SAVED_DIR, { withFileTypes: true });
    for (const file of savedFiles) {
      if (!file.isFile() || frames.some((f) => f.filename === file.name)) continue;
      const stat = await fs.stat(path.join(BASE_SAVED_DIR, file.name));
      frames.push(parseFrameEntry('saved', file.name, stat.size));
    }
  }

  return frames.sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearAllFrameFiles(): Promise<number> {
  let count = 0;
  if (existsSync(BASE_OUTPUT_DIR)) {
    const entries = await fs.readdir(BASE_OUTPUT_DIR, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(BASE_OUTPUT_DIR, entry.name);
      await fs.rm(fullPath, { recursive: true, force: true });
      count++;
    }
  }
  if (existsSync(BASE_SAVED_DIR)) {
    const savedEntries = await fs.readdir(BASE_SAVED_DIR, { withFileTypes: true });
    for (const file of savedEntries) {
      await fs.rm(path.join(BASE_SAVED_DIR, file.name), { force: true });
      count++;
    }
  }
  return count;
}

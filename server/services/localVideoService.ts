import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import type { VideoMetadata } from '../types';
import { formatDuration } from '../../src/services/formatters';
import { BASE_UPLOADS_DIR } from './storageService';

const execFileAsync = promisify(execFile);

function getExecEnv() {
  const machinePath = process.env.Path || '';
  return {
    ...process.env,
    Path: `${machinePath};C:\\Users\\rikar\\AppData\\Local\\Microsoft\\WinGet\\Links`,
  };
}

export function parseFps(fpsStr?: string): number | undefined {
  if (!fpsStr || typeof fpsStr !== 'string') return undefined;
  const parts = fpsStr.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0 && num > 0) return Math.round((num / den) * 100) / 100;
  }
  const val = parseFloat(fpsStr);
  return isNaN(val) || val <= 0 ? undefined : Math.round(val * 100) / 100;
}

export function parseDuration(data: any): number {
  if (!data) return 0;
  const fromFormat = parseFloat(data.format?.duration);
  if (!isNaN(fromFormat) && fromFormat > 0) return fromFormat;

  const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
  const fromStream = parseFloat(videoStream?.duration);
  if (!isNaN(fromStream) && fromStream > 0) return fromStream;

  return 0;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(1);
  return `${val} ${units[i] || 'MB'}`;
}

export async function generateThumbnail(
  filePath: string,
  destPath: string,
  timestamp = 0.5
): Promise<boolean> {
  try {
    const args = ['-ss', timestamp.toFixed(2), '-i', filePath, '-frames:v', '1', '-q:v', '3', '-y', destPath];
    await execFileAsync('ffmpeg', args, { env: getExecEnv() });
    return fs.existsSync(destPath);
  } catch {
    return false;
  }
}

export function isLocalVideoPath(targetUrlOrPath: string): boolean {
  if (!targetUrlOrPath || typeof targetUrlOrPath !== 'string') return false;
  if (targetUrlOrPath.startsWith('/api/uploads/')) return true;
  if (targetUrlOrPath.startsWith('file:///')) return true;
  const isAbsWindows = /^[a-zA-Z]:[\\/]/.test(targetUrlOrPath);
  const isAbsUnix = targetUrlOrPath.startsWith('/');
  return isAbsWindows || isAbsUnix;
}

export function resolveLocalVideoPath(targetUrlOrPath: string): string | null {
  if (!targetUrlOrPath) return null;
  if (targetUrlOrPath.startsWith('/api/uploads/')) {
    const parts = targetUrlOrPath.replace(/^\/api\/uploads\//, '').split('/');
    if (parts.length < 2) return null;
    const [uploadId, ...rest] = parts;
    const filename = decodeURIComponent(rest.join('/'));
    const full = path.join(BASE_UPLOADS_DIR, uploadId, filename);
    return fs.existsSync(full) ? full : null;
  }
  const cleanPath = targetUrlOrPath.replace(/^file:\/\/\/?/, '');
  const normalized = path.normalize(cleanPath);
  return fs.existsSync(normalized) ? normalized : null;
}

async function runFfprobe(filePath: string): Promise<any> {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=width,height,r_frame_rate,duration,codec_type',
    '-of', 'json',
    filePath,
  ];
  const { stdout } = await execFileAsync('ffprobe', args, { env: getExecEnv() });
  return JSON.parse(stdout);
}

export async function probeLocalVideo(
  filePath: string,
  originalName?: string,
  uploadId?: string
): Promise<VideoMetadata> {
  const data = await runFfprobe(filePath);
  const duration = parseDuration(data);
  const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
  const sizeBytes = parseInt(data.format?.size || '0', 10);
  const sizeLabel = formatFileSize(sizeBytes);
  const title = originalName || path.basename(filePath);
  const id = uploadId || `local_${path.basename(filePath)}`;
  const thumbPath = path.join(path.dirname(filePath), `thumb_${id}.jpg`);

  const thumbOk = await generateThumbnail(filePath, thumbPath, Math.min(0.5, duration / 2));
  const thumbUrl = thumbOk && uploadId ? `/api/uploads/${uploadId}/thumb_${id}.jpg` : '';
  const fileUrl = uploadId ? `/api/uploads/${uploadId}/${encodeURIComponent(path.basename(filePath))}` : filePath;

  return {
    id,
    title,
    author: sizeLabel ? `Local Video • ${sizeLabel}` : 'Local Video',
    duration,
    durationFormatted: formatDuration(duration),
    thumbnail: thumbUrl,
    url: fileUrl,
    sourceType: 'local',
    fps: parseFps(videoStream?.r_frame_rate),
    width: videoStream?.width,
    height: videoStream?.height,
  };
}

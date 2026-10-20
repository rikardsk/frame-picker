import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { ExtractedFrame } from '../types';
import { formatDuration } from '../../src/services/formatters';

const execFileAsync = promisify(execFile);

function getExecEnv() {
  const machinePath = process.env.Path || '';
  return {
    ...process.env,
    Path: `${machinePath};C:\\Users\\rikar\\AppData\\Local\\Microsoft\\WinGet\\Links`,
  };
}

export function buildVideoFilters(timestamp: number, quality?: string, includeTimestamp?: boolean): string[] {
  const filters: string[] = [];
  if (quality === '360p') filters.push('scale=-2:min(ih\\,360)');
  else if (quality === '480p') filters.push('scale=-2:min(ih\\,480)');
  else if (quality === '720p') filters.push('scale=-2:min(ih\\,720)');
  else if (quality === '1080p') filters.push('scale=-2:min(ih\\,1080)');

  if (includeTimestamp) {
    const text = formatDuration(timestamp, true).replace(/:/g, '\\:');
    const font = process.platform === 'win32' ? "fontfile='C\\:/Windows/Fonts/arial.ttf':" : '';
    filters.push(`drawtext=${font}text='${text}':fontcolor=white:fontsize=max(14\\,h/24):box=1:boxcolor=black@0.65:boxborderw=6:x=w-tw-16:y=h-th-16`);
  }
  return filters;
}

export interface ExtractFrameOptions {
  index?: number;
  format?: 'jpg' | 'jpeg' | 'png' | 'webp';
  quality?: string;
  includeTimestamp?: boolean;
  signal?: AbortSignal;
}

export async function extractSingleFrame(
  streamUrl: string,
  timestamp: number,
  outputDir: string,
  opts: ExtractFrameOptions = {}
): Promise<ExtractedFrame> {
  const index = opts.index ?? 1;
  const ext = (opts.format === 'jpeg' ? 'jpg' : opts.format) || 'jpg';
  const filename = `frame_${index.toString().padStart(4, '0')}_${Math.floor(timestamp * 1000)}ms.${ext}`;
  const outputPath = path.join(outputDir, filename);

  const args = ['-ss', timestamp.toFixed(3), '-i', streamUrl];
  const filters = buildVideoFilters(timestamp, opts.quality, opts.includeTimestamp);
  if (filters.length > 0) args.push('-vf', filters.join(','));
  args.push('-frames:v', '1', '-q:v', '2', '-y', outputPath);

  await execFileAsync('ffmpeg', args, { env: getExecEnv(), signal: opts.signal });
  const stat = await fs.stat(outputPath);
  const sessionId = path.basename(outputDir);

  return {
    id: `${sessionId}_${index}`,
    sessionId,
    index,
    timestamp,
    timestampFormatted: formatDuration(timestamp, true),
    filename,
    url: `/api/frames/${sessionId}/${filename}`,
    sizeBytes: stat.size,
  };
}

export async function extractFrameSeries(
  streamUrl: string,
  timestamps: number[],
  outputDir: string,
  opts: ExtractFrameOptions = {},
  onProgress?: (completed: number, total: number, current: ExtractedFrame) => void
): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (opts.signal?.aborted) throw new Error('Extraction cancelled');
    const frame = await extractSingleFrame(streamUrl, timestamps[i], outputDir, { ...opts, index: i + 1 });
    frames.push(frame);
    if (onProgress) onProgress(i + 1, timestamps.length, frame);
  }
  return frames;
}

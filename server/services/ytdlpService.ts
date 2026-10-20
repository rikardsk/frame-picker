import { execFile } from 'child_process';
import { promisify } from 'util';
import type { VideoMetadata } from '../types';
import { extractYouTubeId, formatDuration } from '../../src/services/formatters';

const execFileAsync = promisify(execFile);

export function resolveFormatArg(quality: string): string {
  if (quality === '1080p') return 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
  if (quality === '720p') return 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
  if (quality === '480p') return 'bestvideo[height<=480]+bestaudio/best[height<=480]/best';
  if (quality === '360p') return 'bestvideo[height<=360]+bestaudio/best[height<=360]/best';
  return 'bestvideo+bestaudio/best';
}

export async function fetchVideoInfo(url: string): Promise<VideoMetadata> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube video URL or ID');
  }

  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const args = [
    '-m',
    'yt_dlp',
    '--js-runtimes',
    'node',
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    cleanUrl,
  ];

  const { stdout } = await execFileAsync('python', args, {
    maxBuffer: 10 * 1024 * 1024,
  });

  const data = JSON.parse(stdout);
  const duration = typeof data.duration === 'number' ? data.duration : 0;

  return {
    id: videoId,
    title: data.title || 'Untitled Video',
    author: data.uploader || data.channel || 'Unknown Channel',
    duration,
    durationFormatted: formatDuration(duration),
    thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: cleanUrl,
    viewCount: data.view_count,
    description: data.description ? data.description.slice(0, 300) : '',
    fps: typeof data.fps === 'number' ? data.fps : undefined,
  };
}

export async function resolveStreamUrl(url: string, quality = 'best'): Promise<string> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube video URL or ID');
  }

  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const formatStr = resolveFormatArg(quality);
  const args = [
    '-m',
    'yt_dlp',
    '--js-runtimes',
    'node',
    '-g',
    '-f',
    formatStr,
    cleanUrl,
  ];

  const { stdout } = await execFileAsync('python', args, {
    maxBuffer: 5 * 1024 * 1024,
  });

  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    throw new Error('Could not resolve stream URL from yt-dlp');
  }

  // First line is typically video stream
  return lines[0];
}

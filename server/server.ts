import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { fetchVideoInfo, resolveStreamUrl } from './services/ytdlpService';
import { extractSingleFrame, extractFrameSeries } from './services/ffmpegService';
import {
  ensureOutputDir,
  createZipArchive,
  createZipFromFrames,
  cleanupOldSessions,
  deleteFrameFile,
  BASE_UPLOADS_DIR,
  BASE_SAVED_DIR,
  resolveFrameFilePath,
  saveUploadedFile,
  getAllSavedFrames,
  clearAllFrameFiles,
} from './services/storageService';
import {
  isLocalVideoPath,
  resolveLocalVideoPath,
  probeLocalVideo,
} from './services/localVideoService';
import type { ExtractionProgress, SingleFrameRequest, SeriesFrameRequest } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const taskRegistry = new Map<string, ExtractionProgress>();
const abortControllers = new Map<string, AbortController>();

const outputDir = path.resolve(process.cwd(), 'output', 'frames');
app.use('/api/frames', express.static(outputDir));
app.use('/api/frames', express.static(BASE_SAVED_DIR));
app.use('/api/uploads', express.static(BASE_UPLOADS_DIR));

app.get('/api/frames/:sessionId/:filename', (req: Request, res: Response): void => {
  const filePath = resolveFrameFilePath({
    sessionId: req.params.sessionId,
    filename: req.params.filename,
  });
  if (filePath && existsSync(filePath)) {
    res.sendFile(filePath);
    return;
  }
  res.status(404).json({ error: 'Frame image not found' });
});

app.get('/api/frames/:filename', (req: Request, res: Response): void => {
  const filePath = resolveFrameFilePath({
    filename: req.params.filename,
  });
  if (filePath && existsSync(filePath)) {
    res.sendFile(filePath);
    return;
  }
  res.status(404).json({ error: 'Frame image not found' });
});

export async function resolveVideoSource(url: string, quality = 'best'): Promise<string> {
  if (isLocalVideoPath(url)) {
    const localPath = resolveLocalVideoPath(url);
    if (localPath) return localPath;
  }
  return await resolveStreamUrl(url, quality);
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'FramePicker Server', timestamp: Date.now() });
});

app.get('/api/frames', async (_req: Request, res: Response): Promise<void> => {
  try {
    const frames = await getAllSavedFrames();
    res.json({ success: true, frames });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve saved frames';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawName = String(req.query.filename || req.headers['x-filename'] || 'video.mp4');
    const filename = decodeURIComponent(rawName);
    const { uploadId, filePath } = await saveUploadedFile(req, filename);
    const metadata = await probeLocalVideo(filePath, filename, uploadId);
    res.json(metadata);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Video upload failed';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Video URL or path is required' });
      return;
    }
    if (isLocalVideoPath(url)) {
      const localPath = resolveLocalVideoPath(url);
      if (!localPath) {
        res.status(404).json({ error: 'Local video file not found' });
        return;
      }
      const info = await probeLocalVideo(localPath, path.basename(localPath));
      res.json(info);
      return;
    }
    const info = await fetchVideoInfo(url);
    res.json(info);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch video information';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/extract/single', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, timestamp, format = 'jpg', quality = 'best', includeTimestamp = false } = req.body as SingleFrameRequest;
    if (!url || timestamp === undefined || isNaN(Number(timestamp))) {
      res.status(400).json({ error: 'Valid URL and timestamp are required' });
      return;
    }

    const sessionId = crypto.randomUUID();
    const sessionDir = await ensureOutputDir(sessionId);
    const streamUrl = await resolveVideoSource(url, quality);
    const frame = await extractSingleFrame(streamUrl, Number(timestamp), sessionDir, {
      index: 1,
      format,
      quality,
      includeTimestamp,
    });

    taskRegistry.set(sessionId, {
      taskId: sessionId,
      status: 'completed',
      total: 1,
      completed: 1,
      percent: 100,
      frames: [frame],
    });

    res.json({ success: true, sessionId, frame });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Single frame extraction failed';
    res.status(500).json({ error: msg });
  }
});

export function calculateTimestamps(
  startTime: number,
  endTime: number,
  mode: 'interval' | 'count',
  intervalSeconds?: number,
  count?: number
): number[] {
  const timestamps: number[] = [];
  const duration = endTime - startTime;
  if (duration <= 0) return [startTime];

  if (mode === 'count') {
    const frameCount = Math.min(Math.max(count || 5, 2), 100);
    const step = duration / (frameCount - 1);
    for (let i = 0; i < frameCount; i++) {
      timestamps.push(Number((startTime + i * step).toFixed(2)));
    }
    return timestamps;
  }

  const interval = Math.max(intervalSeconds || 1, 0.2);
  const maxFrames = count ? Math.min(count, 150) : 150;
  let current = startTime;
  while (current <= endTime + 0.001 && timestamps.length < maxFrames) {
    timestamps.push(Number(current.toFixed(2)));
    current += interval;
  }
  return timestamps;
}

async function runSeriesExtraction(
  taskId: string,
  url: string,
  timestamps: number[],
  sessionDir: string,
  opts: { format: any; quality: any; includeTimestamp: boolean },
  controller: AbortController,
  progress: ExtractionProgress
): Promise<void> {
  try {
    progress.status = 'extracting';
    const streamUrl = await resolveVideoSource(url, opts.quality);
    await extractFrameSeries(
      streamUrl,
      timestamps,
      sessionDir,
      { ...opts, signal: controller.signal },
      (completed, total, frame) => {
        progress.completed = completed;
        progress.percent = Math.round((completed / total) * 100);
        progress.currentTimestamp = frame.timestampFormatted;
        progress.frames.push(frame);
      }
    );
    progress.status = 'completed';
  } catch (err) {
    if (controller.signal.aborted) {
      progress.status = 'cancelled';
      return;
    }
    progress.status = 'error';
    progress.error = err instanceof Error ? err.message : 'Batch extraction failed';
  } finally {
    abortControllers.delete(taskId);
  }
}

app.post('/api/extract/series', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as SeriesFrameRequest;
    const { url, startTime, endTime, mode, intervalSeconds, count, format = 'jpg', quality = 'best', includeTimestamp = false } = body;
    if (!url || startTime === undefined || endTime === undefined || endTime <= startTime) {
      res.status(400).json({ error: 'Invalid time range specified' });
      return;
    }

    const timestamps = calculateTimestamps(startTime, endTime, mode, intervalSeconds, count);
    const taskId = crypto.randomUUID();
    const sessionDir = await ensureOutputDir(taskId);
    const controller = new AbortController();
    abortControllers.set(taskId, controller);

    const progress: ExtractionProgress = {
      taskId,
      status: 'pending',
      total: timestamps.length,
      completed: 0,
      percent: 0,
      frames: [],
    };
    taskRegistry.set(taskId, progress);

    res.json({ success: true, taskId, totalFrames: timestamps.length });

    runSeriesExtraction(
      taskId,
      url,
      timestamps,
      sessionDir,
      { format, quality, includeTimestamp },
      controller,
      progress
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to initialize batch extraction';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/extract/cancel/:taskId', (req: Request, res: Response): void => {
  const taskId = String(req.params.taskId);
  const controller = abortControllers.get(taskId);
  const progress = taskRegistry.get(taskId);

  if (controller) {
    controller.abort();
    abortControllers.delete(taskId);
  }
  if (progress && progress.status === 'extracting') {
    progress.status = 'cancelled';
  }
  res.json({ success: true, message: 'Extraction cancelled' });
});

app.get('/api/extract/status/:taskId', (req: Request, res: Response): void => {
  const taskId = String(req.params.taskId);
  const progress = taskRegistry.get(taskId);
  if (!progress) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(progress);
});

app.delete('/api/frames/:sessionId/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = String(req.params.sessionId || '');
    const filename = String(req.params.filename || '');
    if (!sessionId || !filename) {
      res.status(400).json({ error: 'Session ID and filename are required' });
      return;
    }
    await deleteFrameFile(sessionId, filename);
    const progress = taskRegistry.get(sessionId);
    if (progress) {
      progress.frames = progress.frames.filter((f) => f.filename !== filename);
      progress.completed = progress.frames.length;
    }
    res.json({ success: true, message: 'Frame deleted successfully' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete frame';
    res.status(500).json({ error: msg });
  }
});

app.delete('/api/frames', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await clearAllFrameFiles();
    taskRegistry.clear();
    res.json({ success: true, count, message: 'All frame files deleted successfully' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to clear frame files';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/download-zip/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = String(req.params.sessionId);
    const progress = taskRegistry.get(sessionId);
    const frames = progress?.frames || [];
    if (!frames.length) {
      res.status(400).json({ error: 'No frames found for this session' });
      return;
    }

    const zipPath = await createZipArchive(sessionId, frames);
    res.download(zipPath, `FramePicker_${sessionId.slice(0, 8)}.zip`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate ZIP';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/download-zip', async (req: Request, res: Response): Promise<void> => {
  try {
    let frames: ExtractedFrame[] = req.body?.frames || [];
    if (!frames.length) frames = await getAllSavedFrames();
    if (!frames.length) {
      res.status(400).json({ error: 'No frames available to download' });
      return;
    }
    const zipPath = await createZipFromFrames(frames);
    res.download(zipPath, `FramePicker_${frames.length}_frames.zip`, async () => {
      try { await fs.unlink(zipPath); } catch {}
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate ZIP';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/download-zip/all', async (_req: Request, res: Response): Promise<void> => {
  try {
    const frames = await getAllSavedFrames();
    if (!frames.length) {
      res.status(400).json({ error: 'No frames found to download' });
      return;
    }
    const zipPath = await createZipFromFrames(frames);
    res.download(zipPath, `FramePicker_${frames.length}_frames.zip`, async () => {
      try { await fs.unlink(zipPath); } catch {}
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate ZIP';
    res.status(500).json({ error: msg });
  }
});

setInterval(() => {
  cleanupOldSessions().catch(() => {});
}, 60 * 60 * 1000);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`FramePicker backend running at http://localhost:${PORT}`);
  });
}

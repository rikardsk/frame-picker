import type {
  VideoMetadata,
  SingleFrameRequest,
  SeriesFrameRequest,
  ExtractedFrame,
  ExtractionProgress,
} from '../../server/types';

export async function getVideoInfo(url: string): Promise<VideoMetadata> {
  const res = await fetch('/api/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch video: ${res.statusText}`);
  }

  return await res.json();
}

export async function extractSingleFrameApi(
  req: SingleFrameRequest
): Promise<{ success: boolean; sessionId: string; frame: ExtractedFrame }> {
  const res = await fetch('/api/extract/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to extract single frame');
  }

  return await res.json();
}

export async function startSeriesExtractionApi(
  req: SeriesFrameRequest
): Promise<{ success: boolean; taskId: string; totalFrames: number }> {
  const res = await fetch('/api/extract/series', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to start batch extraction');
  }

  return await res.json();
}

export async function pollExtractionStatusApi(taskId: string): Promise<ExtractionProgress> {
  const res = await fetch(`/api/extract/status/${encodeURIComponent(taskId)}`);
  if (!res.ok) {
    throw new Error(`Failed to check progress: ${res.statusText}`);
  }
  return await res.json();
}

export async function cancelExtractionApi(taskId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/extract/cancel/${encodeURIComponent(taskId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to cancel extraction');
  }
  return await res.json();
}

export async function deleteFrameApi(
  sessionId: string,
  filename: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `/api/frames/${encodeURIComponent(sessionId)}/${encodeURIComponent(filename)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete frame');
  }
  return await res.json();
}

export function getDownloadZipUrl(sessionId: string): string {
  return `/api/download-zip/${encodeURIComponent(sessionId)}`;
}

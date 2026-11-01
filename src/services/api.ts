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

export async function getSavedFramesApi(): Promise<ExtractedFrame[]> {
  const res = await fetch('/api/frames');
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.frames || [];
}

export async function clearAllFramesApi(): Promise<{ success: boolean; count: number; message: string }> {
  const res = await fetch('/api/frames', { method: 'DELETE' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to clear frame files from disk');
  }
  return await res.json();
}

export async function downloadAllFramesZipApi(frames?: ExtractedFrame[]): Promise<void> {
  const res = await fetch('/api/download-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames: frames || [] }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate zip file');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FramePicker_${frames?.length || 'all'}_frames.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function uploadLocalVideoApi(
  file: File,
  onProgress?: (percent: number) => void
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `/api/upload?filename=${encodeURIComponent(file.name)}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed'));
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during video upload'));
    xhr.send(file);
  });
}

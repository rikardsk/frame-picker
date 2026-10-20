import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { VideoInput } from './components/VideoInput';
import { VideoPlayer } from './components/VideoPlayer';
import { ExtractionControls } from './components/ExtractionControls';
import { ProgressIndicator } from './components/ProgressIndicator';
import { FrameGallery } from './components/FrameGallery';
import { FramePreviewModal } from './components/FramePreviewModal';
import { ToastNotification, type ToastMessage } from './components/ToastNotification';
import {
  getVideoInfo,
  extractSingleFrameApi,
  startSeriesExtractionApi,
  pollExtractionStatusApi,
  cancelExtractionApi,
  deleteFrameApi,
  getDownloadZipUrl,
} from './services/api';
import type { VideoMetadata, ExtractedFrame, ExtractionProgress, VideoQuality } from '../server/types';

export const App: React.FC = () => {
  const [url, setUrl] = useState<string>('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(15);
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [activeTask, setActiveTask] = useState<ExtractionProgress | null>(null);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<ExtractedFrame | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const readVideoTimeRef = useRef<(() => number | null) | null>(null);

  const handleGetVideoTime = (): number => {
    const fromPlayer = readVideoTimeRef.current ? readVideoTimeRef.current() : null;
    if (fromPlayer !== null && !isNaN(fromPlayer)) return fromPlayer;
    return currentTime;
  };

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), type, title, description }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoadVideo = async () => {
    if (!url.trim()) return;
    setIsLoadingVideo(true);
    try {
      const data = await getVideoInfo(url.trim());
      setVideo(data);
      setCurrentTime(Math.min(15, data.duration));
      addToast('success', 'Video stream ready', data.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load video';
      addToast('error', 'Error loading video', msg);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const handleExtractSingle = async (
    format: 'jpg' | 'png' | 'webp',
    quality: VideoQuality,
    includeTimestamp: boolean
  ) => {
    if (!video) return;
    setIsExtracting(true);
    try {
      const result = await extractSingleFrameApi({
        url: video.url,
        timestamp: currentTime,
        format,
        quality,
        includeTimestamp,
      });
      setFrames((prev) => [result.frame, ...prev]);
      setActiveSessionId(result.sessionId);
      addToast('success', 'Frame extracted', `Captured at ${result.frame.timestampFormatted}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      addToast('error', 'Extraction Failed', msg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractSeries = async (config: {
    startTime: number;
    endTime: number;
    mode: 'interval' | 'count';
    intervalSeconds?: number;
    count?: number;
    format: 'jpg' | 'png' | 'webp';
    quality: VideoQuality;
    includeTimestamp: boolean;
  }) => {
    if (!video) return;
    setIsExtracting(true);
    try {
      const init = await startSeriesExtractionApi({ url: video.url, ...config });
      setActiveSessionId(init.taskId);
      addToast('info', 'Batch extraction started', `Extracting ${init.totalFrames} frames...`);
      pollProgress(init.taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start series extraction';
      addToast('error', 'Batch Failed', msg);
      setIsExtracting(false);
    }
  };

  const handleCancelExtraction = async () => {
    if (!activeTask?.taskId) return;
    setIsCancelling(true);
    try {
      await cancelExtractionApi(activeTask.taskId);
      addToast('info', 'Cancelling extraction...', 'Stopping ffmpeg processes');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel';
      addToast('error', 'Cancel Failed', msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const pollProgress = (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await pollExtractionStatusApi(taskId);
        setActiveTask(status);

        if (status.status === 'completed') {
          clearInterval(interval);
          setIsExtracting(false);
          setFrames((prev) => [...status.frames, ...prev]);
          addToast('success', 'Batch extraction complete', `Extracted ${status.frames.length} frames.`);
        } else if (status.status === 'cancelled') {
          clearInterval(interval);
          setIsExtracting(false);
          if (status.frames.length > 0) {
            setFrames((prev) => [...status.frames, ...prev]);
          }
          addToast('info', 'Extraction cancelled', `Kept ${status.frames.length} frame(s) extracted prior to cancel.`);
        } else if (status.status === 'error') {
          clearInterval(interval);
          setIsExtracting(false);
          addToast('error', 'Batch extraction failed', status.error);
        }
      } catch {
        clearInterval(interval);
        setIsExtracting(false);
      }
    }, 1000);
  };

  const handleDeleteFrame = async (frame: ExtractedFrame) => {
    try {
      const sessionId = frame.sessionId || frame.url.split('/')[3];
      await deleteFrameApi(sessionId, frame.filename);
      setFrames((prev) => prev.filter((f) => f.id !== frame.id));
      if (selectedFrame?.id === frame.id) setSelectedFrame(null);
      addToast('info', 'Frame deleted', frame.filename);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete frame';
      addToast('error', 'Delete failed', msg);
    }
  };

  const handleCopyFrame = async (frame: ExtractedFrame) => {
    try {
      const res = await fetch(frame.url);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopiedId(frame.id);
      addToast('success', 'Copied to clipboard', 'Frame image copied');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast('info', 'Image URL copied', frame.url);
      await navigator.clipboard.writeText(window.location.origin + frame.url);
    }
  };

  const handleDownloadZip = () => {
    if (!activeSessionId) {
      addToast('info', 'Download single images below or run a series first');
      return;
    }
    window.open(getDownloadZipUrl(activeSessionId), '_blank');
  };

  useEffect(() => {
    handleLoadVideo();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <VideoInput
          url={url}
          onChange={setUrl}
          onSubmit={handleLoadVideo}
          isLoading={isLoadingVideo}
        />

        {video && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              <VideoPlayer
                video={video}
                currentTime={currentTime}
                onTimeChange={setCurrentTime}
                onToast={addToast}
                onRegisterGetTime={(getter) => {
                  readVideoTimeRef.current = getter;
                }}
              />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <ExtractionControls
                video={video}
                currentTime={currentTime}
                onCurrentTimeChange={setCurrentTime}
                onExtractSingle={handleExtractSingle}
                onExtractSeries={handleExtractSeries}
                isExtracting={isExtracting}
                onGetVideoTime={handleGetVideoTime}
                onToast={addToast}
              />

              {activeTask && activeTask.status === 'extracting' && (
                <ProgressIndicator
                  progress={activeTask}
                  onCancel={handleCancelExtraction}
                  isCancelling={isCancelling}
                />
              )}
            </div>
          </div>
        )}

        <FrameGallery
          frames={frames}
          onSelectFrame={setSelectedFrame}
          onDownloadZip={handleDownloadZip}
          onClear={() => setFrames([])}
          onCopyFrame={handleCopyFrame}
          onDeleteFrame={handleDeleteFrame}
          copiedId={copiedId}
        />
      </main>

      <FramePreviewModal
        frame={selectedFrame}
        onClose={() => setSelectedFrame(null)}
        onCopy={handleCopyFrame}
        onDelete={handleDeleteFrame}
        isCopied={copiedId === selectedFrame?.id}
      />

      <ToastNotification toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;

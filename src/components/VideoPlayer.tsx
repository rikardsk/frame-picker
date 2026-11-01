import React, { useState, useEffect, useRef } from 'react';
import { Eye, Clock, User, Crosshair, RotateCcw, ChevronLeft, ChevronRight, FileVideo, Film } from 'lucide-react';
import type { VideoMetadata } from '../../server/types';
import { formatDuration } from '../services/formatters';

interface Props {
  video: VideoMetadata;
  currentTime: number;
  onTimeChange: (time: number) => void;
  onRegisterGetTime?: (getter: () => number | null) => void;
  onToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const VideoPlayer: React.FC<Props> = ({
  video,
  currentTime,
  onTimeChange,
  onRegisterGetTime,
  onToast,
}) => {
  const [stepInput, setStepInput] = useState<string>('1');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const lastTimeRef = useRef<number | null>(null);

  const parsedStep = parseInt(stepInput, 10);
  const effectiveStep = !isNaN(parsedStep) && parsedStep >= 1 ? Math.min(300, parsedStep) : 1;

  const isLocal = video.sourceType === 'local' || video.url.startsWith('/api/uploads/');

  const readPlayerTime = (): number | null => {
    if (isLocal && videoElRef.current) {
      return Number(videoElRef.current.currentTime.toFixed(3));
    }
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        const t = playerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && t >= 0) return Number(t.toFixed(3));
      } catch {}
    }
    if (lastTimeRef.current !== null && !isNaN(lastTimeRef.current)) {
      return Number(lastTimeRef.current.toFixed(3));
    }
    return null;
  };

  const handleStepInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setStepInput(raw);
  };

  const handleStepInputBlur = () => {
    const parsed = parseInt(stepInput, 10);
    const clamped = isNaN(parsed) || parsed < 1 ? 1 : Math.min(300, parsed);
    setStepInput(String(clamped));
  };

  const handleSyncFromPlayer = () => {
    if (!isLocal) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'getCurrentTime' }),
        '*'
      );
    }
    const t = readPlayerTime();
    if (t !== null) {
      onTimeChange(t);
      onToast?.('success', 'Time synced from video', `Set to ${formatDuration(t, true)}`);
      return;
    }
    onTimeChange(currentTime);
    onToast?.('info', 'Active time used', `Current time: ${formatDuration(currentTime, true)}`);
  };

  const handleStepFrame = (deltaFrames: number) => {
    const fps = video.fps && video.fps > 0 ? video.fps : 30;
    const currentFrame = Math.round(currentTime * fps);
    const targetFrame = Math.max(0, Math.min(totalFrames, currentFrame + deltaFrames));
    const newTime = targetFrame / fps;

    if (isLocal && videoElRef.current) {
      videoElRef.current.currentTime = newTime;
    } else if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(newTime, true);
    } else {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [newTime, true] }),
        '*'
      );
    }
    lastTimeRef.current = newTime;
    onTimeChange(Number(newTime.toFixed(3)));
  };

  useEffect(() => {
    if (onRegisterGetTime) onRegisterGetTime(readPlayerTime);
  }, [onRegisterGetTime, isLocal]);

  useEffect(() => {
    if (isLocal && videoElRef.current) {
      if (Math.abs(videoElRef.current.currentTime - currentTime) > 0.001) {
        videoElRef.current.currentTime = currentTime;
      }
      return;
    }
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(currentTime, true);
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [currentTime, true] }),
      '*'
    );
  }, [currentTime, isLocal]);

  useEffect(() => {
    if (isLocal) return;
    let pollInterval: any = null;
    const init = () => {
      if (!window.YT?.Player || !iframeRef.current) return;
      try {
        playerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
            },
            onStateChange: () => {
              const t = readPlayerTime();
              if (t !== null) lastTimeRef.current = t;
            },
          },
        });
      } catch {}
    };

    if (!document.getElementById('yt-iframe-api')) {
      const script = document.createElement('script');
      script.id = 'yt-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }

    if (window.YT?.Player) init();
    else window.onYouTubeIframeAPIReady = init;

    pollInterval = setInterval(() => {
      const t = readPlayerTime();
      if (t !== null) lastTimeRef.current = t;
    }, 500);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [video.id, isLocal]);

  useEffect(() => {
    if (isLocal) return;
    const handleMsg = (e: MessageEvent) => {
      let data = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (data && typeof data === 'object') {
        const ct = data.info?.currentTime ?? data.currentTime;
        if (typeof ct === 'number' && !isNaN(ct)) lastTimeRef.current = ct;
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [isLocal]);

  const embedOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = `https://www.youtube.com/embed/${video.id}?enablejsapi=1&rel=0&origin=${encodeURIComponent(embedOrigin)}`;

  const fps = video.fps && video.fps > 0 ? video.fps : 30;
  const totalFrames = Math.max(1, Math.round(video.duration * fps));
  const currentFrameNum = Math.min(totalFrames, Math.max(1, Math.round(currentTime * fps)));

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xl shadow-black/40">
      <div className="relative aspect-video w-full bg-black">
        {isLocal ? (
          <video
            ref={videoElRef}
            src={video.url}
            controls
            playsInline
            className="w-full h-full object-contain"
            onTimeUpdate={() => {
              if (videoElRef.current) {
                lastTimeRef.current = videoElRef.current.currentTime;
              }
            }}
          />
        ) : (
          <iframe
            ref={iframeRef}
            id={`yt-player-${video.id}`}
            src={embedUrl}
            title={video.title}
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        )}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-lg text-white leading-snug line-clamp-2">
              {video.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                {isLocal ? (
                  <FileVideo className="w-3.5 h-3.5 text-cinema-accent" />
                ) : (
                  <User className="w-3.5 h-3.5 text-cinema-accent" />
                )}
                {video.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {video.durationFormatted} ({Math.round(video.duration)}s)
              </span>
              {typeof video.fps === 'number' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-cinema-accent/30 text-cinema-accent font-mono text-[11px] font-bold">
                  {video.fps} FPS
                </span>
              )}
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border-subtle text-slate-300 font-mono text-[11px]"
                title={`Current frame ${currentFrameNum.toLocaleString()} of ~${totalFrames.toLocaleString()} total frames`}
              >
                <Film className="w-3 h-3 text-cinema-accent" />
                <span>
                  Frame {currentFrameNum.toLocaleString()} / {totalFrames.toLocaleString()}
                </span>
              </span>
              {typeof video.viewCount === 'number' && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  {video.viewCount.toLocaleString()} views
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-xl bg-slate-950 border border-slate-700/90 hover:border-slate-600 px-2.5 py-1.5 mx-2 shadow-lg shadow-black/60 transition-colors"
                title="Step backward or forward by frame count"
              >
                <button
                  type="button"
                  onClick={() => handleStepFrame(-effectiveStep)}
                  title={`Step backward ${effectiveStep} frame(s)`}
                  className="p-1 text-slate-200 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center bg-black border border-slate-700/80 focus-within:border-cinema-accent rounded-md px-2 py-0.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={stepInput}
                    onChange={handleStepInputChange}
                    onBlur={handleStepInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleStepInputBlur();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="1"
                    style={{ backgroundColor: '#000000', color: '#ffffff' }}
                    className="w-8 text-center bg-transparent text-white font-mono font-bold text-xs focus:outline-none border-0 p-0 m-0"
                    title="Number of frames to step per click (1-300)"
                  />
                  <span className="text-[11px] font-mono text-cinema-accent font-bold select-none ml-0.5">f</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStepFrame(effectiveStep)}
                  title={`Step forward ${effectiveStep} frame(s)`}
                  className="p-1 text-slate-200 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleSyncFromPlayer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs font-semibold shadow-md shadow-cinema-accent/25 transition-all cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Read Time from Video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLocal && videoElRef.current) videoElRef.current.currentTime = 0;
                  onTimeChange(0);
                }}
                title="Reset time to 00:00"
                className="p-1.5 rounded-lg bg-surface border border-border-subtle hover:border-slate-500 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Active Timestamp:</span>
              <span className="font-mono text-cinema-accent font-semibold">
                {formatDuration(currentTime, true)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

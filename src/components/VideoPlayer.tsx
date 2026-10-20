import React, { useEffect, useRef } from 'react';
import { Eye, Clock, User, Crosshair, RotateCcw } from 'lucide-react';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const lastTimeRef = useRef<number | null>(null);

  const readPlayerTime = (): number | null => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        const t = playerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && t >= 0) return Number(t.toFixed(2));
      } catch {}
    }
    if (lastTimeRef.current !== null && !isNaN(lastTimeRef.current)) {
      return Number(lastTimeRef.current.toFixed(2));
    }
    return null;
  };

  const handleSyncFromPlayer = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'getCurrentTime' }),
      '*'
    );
    const t = readPlayerTime();
    if (t !== null) {
      onTimeChange(t);
      onToast?.('success', 'Time synced from video', `Set to ${formatDuration(t, true)}`);
      return;
    }
    onTimeChange(currentTime);
    onToast?.('info', 'Active time used', `Current time: ${formatDuration(currentTime, true)}`);
  };

  useEffect(() => {
    if (onRegisterGetTime) onRegisterGetTime(readPlayerTime);
  }, [onRegisterGetTime]);

  useEffect(() => {
    let pollInterval: any = null;
    const init = () => {
      if (!window.YT?.Player || !iframeRef.current) return;
      try {
        playerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'listening' }),
                '*'
              );
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
  }, [video.id]);

  useEffect(() => {
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
  }, []);

  const embedOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = `https://www.youtube.com/embed/${video.id}?enablejsapi=1&rel=0&origin=${encodeURIComponent(embedOrigin)}`;

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xl shadow-black/40">
      <div className="relative aspect-video w-full bg-black">
        <iframe
          ref={iframeRef}
          id={`yt-player-${video.id}`}
          src={embedUrl}
          title={video.title}
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'listening' }),
              '*'
            );
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-lg text-white leading-snug line-clamp-2">
              {video.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <User className="w-3.5 h-3.5 text-cinema-accent" />
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
                onClick={() => onTimeChange(0)}
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

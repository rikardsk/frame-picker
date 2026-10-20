import React, { useState, useEffect, useId } from 'react';
import { Layers, Timer, Hash, Clock, Crosshair, RotateCcw, Film } from 'lucide-react';
import { formatDuration, parseTimestampToSeconds } from '../services/formatters';
import type { VideoQuality } from '../../server/types';

interface Props {
  duration: number;
  currentTime?: number;
  fps?: number;
  onExtract: (config: {
    startTime: number;
    endTime: number;
    mode: 'interval' | 'count';
    intervalSeconds?: number;
    count?: number;
    format: 'jpg' | 'png' | 'webp';
    quality: VideoQuality;
    includeTimestamp: boolean;
  }) => void;
  isExtracting: boolean;
  onGetVideoTime?: () => number;
  onToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

const QUALITIES: VideoQuality[] = ['best', '1080p', '720p', '480p', '360p'];

export const SeriesFramePicker: React.FC<Props> = ({
  duration,
  currentTime,
  fps,
  onExtract,
  isExtracting,
  onGetVideoTime,
  onToast,
}) => {
  const startInputId = useId();
  const endInputId = useId();
  const [startTime, setStartTime] = useState<number>(currentTime ?? 0);
  const [endTime, setEndTime] = useState<number>(Math.min(duration || 30, 30));
  const [startStr, setStartStr] = useState<string>(formatDuration(currentTime ?? 0));
  const [endStr, setEndStr] = useState<string>(formatDuration(Math.min(duration || 30, 30)));
  const [mode, setMode] = useState<'interval' | 'count' | 'consecutive'>('interval');
  const [intervalSec, setIntervalSec] = useState<number>(2);
  const [count, setCount] = useState<number>(10);
  const [format, setFormat] = useState<'jpg' | 'png' | 'webp'>('jpg');
  const [quality, setQuality] = useState<VideoQuality>('best');
  const [includeTimestamp, setIncludeTimestamp] = useState<boolean>(false);

  useEffect(() => {
    if (currentTime !== undefined && !isNaN(currentTime) && currentTime >= 0) {
      setStartTime(currentTime);
      setStartStr(formatDuration(currentTime, true));
    }
  }, [currentTime]);

  const videoFps = fps || 30;
  const intervalSpan = count > 1 ? (count - 1) * intervalSec : 0;
  const intervalEnd = Math.min(duration, Number((startTime + intervalSpan).toFixed(2)));

  const consecutiveSpan = count > 1 ? (count - 1) / videoFps : 0;
  const consecutiveEnd = Math.min(duration, Number((startTime + consecutiveSpan).toFixed(3)));

  const effectiveEnd = mode === 'interval'
    ? intervalEnd
    : mode === 'consecutive'
    ? consecutiveEnd
    : endTime;

  const handleStartText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartStr(e.target.value);
    const val = parseTimestampToSeconds(e.target.value);
    if (val === null || val < 0) return;
    setStartTime(val);
    if (val >= endTime) {
      const nextEnd = Math.min(duration, Number((val + 30).toFixed(2)));
      setEndTime(nextEnd);
      setEndStr(formatDuration(nextEnd, true));
    }
  };

  const handleEndText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndStr(e.target.value);
    const val = parseTimestampToSeconds(e.target.value);
    if (val === null || val > duration) return;
    setEndTime(val);
    if (val <= startTime) {
      const nextStart = Math.max(0, Number((val - 30).toFixed(2)));
      setStartTime(nextStart);
      setStartStr(formatDuration(nextStart, true));
    }
  };

  const syncStartTimeFromVideo = () => {
    const raw = onGetVideoTime ? onGetVideoTime() : (currentTime ?? 0);
    const t = Math.max(0, Math.min(duration, raw));
    setStartTime(t);
    setStartStr(formatDuration(t, true));
    if (t >= endTime) {
      const nextEnd = Math.min(duration, Number((t + 30).toFixed(2)));
      setEndTime(nextEnd);
      setEndStr(formatDuration(nextEnd, true));
    }
    onToast?.('success', 'Start time updated', `Set to ${formatDuration(t, true)}`);
  };

  const syncEndTimeFromVideo = () => {
    const raw = onGetVideoTime ? onGetVideoTime() : (currentTime ?? duration);
    const t = Math.max(0, Math.min(duration, raw));
    setEndTime(t);
    setEndStr(formatDuration(t, true));
    if (t <= startTime) {
      const nextStart = Math.max(0, Number((t - 30).toFixed(2)));
      setStartTime(nextStart);
      setStartStr(formatDuration(nextStart, true));
    }
    onToast?.('success', 'End time updated', `Set to ${formatDuration(t, true)}`);
  };

  const setRangePreset = (start: number, end: number) => {
    setStartTime(start);
    setEndTime(end);
    setStartStr(formatDuration(start));
    setEndStr(formatDuration(end));
  };

  const handleReset = () => {
    const defaultEnd = Math.min(duration || 30, 30);
    setRangePreset(0, defaultEnd);
  };

  const handleSubmit = () => {
    onExtract({
      startTime,
      endTime: effectiveEnd,
      mode: mode === 'interval' ? 'interval' : 'count',
      intervalSeconds: mode === 'interval' ? intervalSec : undefined,
      count,
      format,
      quality,
      includeTimestamp,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <div className="flex items-center justify-between mb-1.5 h-6">
            <label htmlFor={startInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Start Time
            </label>
            <button
              type="button"
              onClick={syncStartTimeFromVideo}
              className="text-[11px] text-cinema-accent hover:text-white flex items-center gap-1 cursor-pointer font-medium whitespace-nowrap transition-colors"
              title="Read playhead time from video"
            >
              <Crosshair className="w-3 h-3" />
              <span>Read Video</span>
            </button>
          </div>
          <input
            id={startInputId}
            type="text"
            value={startStr}
            onChange={handleStartText}
            className="w-full px-3.5 py-2.5 bg-surface border border-border-subtle rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cinema-accent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5 h-6">
            <label htmlFor={endInputId} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              <span>End Time</span>
              {mode !== 'count' && (
                <span className="text-[10px] font-mono normal-case px-1.5 py-0.5 rounded bg-cinema-accent/15 text-cinema-accent border border-cinema-accent/30 leading-none">
                  auto
                </span>
              )}
            </label>
            {mode === 'count' ? (
              <button
                type="button"
                onClick={syncEndTimeFromVideo}
                className="text-[11px] text-cinema-accent hover:text-white flex items-center gap-1 cursor-pointer font-medium whitespace-nowrap transition-colors"
                title="Read playhead time from video"
              >
                <Crosshair className="w-3 h-3" />
                <span>Read Video</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                {mode === 'interval' ? `${count} × ${intervalSec}s` : `${count} frames`}
              </span>
            )}
          </div>
          <input
            id={endInputId}
            type="text"
            disabled={mode !== 'count'}
            value={mode !== 'count' ? formatDuration(effectiveEnd, true) : endStr}
            onChange={handleEndText}
            className="w-full px-3.5 py-2.5 bg-surface border border-border-subtle rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cinema-accent disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRangePreset(0, Math.min(duration, 30))}
            className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-white cursor-pointer"
          >
            First 30s
          </button>
          <button
            type="button"
            onClick={() => setRangePreset(0, Math.min(duration, 60))}
            className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-white cursor-pointer"
          >
            First 60s
          </button>
          <button
            type="button"
            onClick={() => setRangePreset(0, duration)}
            className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-white cursor-pointer"
          >
            Full Video
          </button>
        </div>

        <button
          type="button"
          onClick={handleReset}
          title="Reset time range to default"
          className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-border-subtle text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Extraction Pattern
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMode('interval')}
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer transition-all ${
              mode === 'interval'
                ? 'bg-cinema-accent/15 border-cinema-accent text-white'
                : 'bg-surface border-border-subtle text-slate-400 hover:text-white'
            }`}
          >
            <Timer className="w-4 h-4 text-cinema-accent" />
            <span>By Interval</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('count')}
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer transition-all ${
              mode === 'count'
                ? 'bg-cinema-accent/15 border-cinema-accent text-white'
                : 'bg-surface border-border-subtle text-slate-400 hover:text-white'
            }`}
          >
            <Hash className="w-4 h-4 text-cinema-accent" />
            <span>Distributed</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('consecutive')}
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer transition-all ${
              mode === 'consecutive'
                ? 'bg-cinema-accent/15 border-cinema-accent text-white'
                : 'bg-surface border-border-subtle text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-4 h-4 text-cinema-accent" />
            <span>Next N Frames</span>
          </button>
        </div>

        {mode === 'interval' && (
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Every:</span>
              {[0.5, 1, 2, 5, 10].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setIntervalSec(sec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                    intervalSec === sec
                      ? 'bg-cinema-accent text-white'
                      : 'bg-surface border border-border-subtle text-slate-300 hover:text-white'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Total frames:</span>
              {[5, 10, 15, 25, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                    count === num
                      ? 'bg-cinema-accent text-white'
                      : 'bg-surface border border-border-subtle text-slate-300 hover:text-white'
                  }`}
                >
                  {num} frames
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              Auto-calculating end time: extracting {count} frames every {intervalSec}s ({((count - 1) * intervalSec).toFixed(1)}s total span, ending at {formatDuration(effectiveEnd, true)}).
            </p>
          </div>
        )}

        {mode === 'count' && (
          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs text-slate-400">Total frames:</span>
            {[5, 10, 15, 25, 50].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCount(num)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  count === num
                    ? 'bg-cinema-accent text-white'
                    : 'bg-surface border border-border-subtle text-slate-300 hover:text-white'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        )}

        {mode === 'consecutive' && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Next frames:</span>
              {[10, 25, 50, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                    count === num
                      ? 'bg-cinema-accent text-white'
                      : 'bg-surface border border-border-subtle text-slate-300 hover:text-white'
                  }`}
                >
                  {num} frames
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Extracts the next {count} consecutive frames frame-by-frame starting at {formatDuration(startTime, true)} (~{((count - 1) / videoFps).toFixed(2)}s at {videoFps} FPS). End time is automatically managed.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Format
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface rounded-xl border border-border-subtle text-xs">
              {(['jpg', 'png', 'webp'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`py-1.5 font-medium rounded-lg uppercase cursor-pointer ${
                    format === fmt ? 'bg-cinema-accent text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Quality / Size
            </label>
            <div className="grid grid-cols-5 gap-1 p-1 bg-surface rounded-xl border border-border-subtle text-xs">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`py-1.5 font-medium rounded-lg text-center cursor-pointer ${
                    quality === q ? 'bg-cinema-accent text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {q === 'best' ? 'Best' : q.replace('p', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border-subtle cursor-pointer hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-cinema-accent" />
            <div>
              <span className="text-xs font-semibold text-white block">Burn Timestamp Overlay</span>
              <span className="text-[11px] text-slate-400 block">Print visible timecode onto image</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={includeTimestamp}
            onChange={(e) => setIncludeTimestamp(e.target.checked)}
            className="w-4 h-4 rounded text-cinema-accent accent-cinema-accent cursor-pointer"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={isExtracting || count <= 0}
        onClick={handleSubmit}
        className="w-full py-3.5 px-4 rounded-xl font-heading font-semibold text-sm text-white bg-cinema-accent hover:bg-cinema-accentHover active:scale-99 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cinema-accent/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Layers className="w-4 h-4" />
        <span>Extract Series ({count} Frames)</span>
      </button>
    </div>
  );
};

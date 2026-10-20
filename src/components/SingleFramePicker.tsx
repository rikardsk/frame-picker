import React, { useState, useEffect } from 'react';
import { Camera, Clock, Crosshair, RotateCcw } from 'lucide-react';
import { formatDuration, parseTimestampToSeconds } from '../services/formatters';
import type { VideoQuality } from '../../server/types';

interface Props {
  duration: number;
  timestamp: number;
  onTimestampChange: (time: number) => void;
  onExtract: (format: 'jpg' | 'png' | 'webp', quality: VideoQuality, includeTimestamp: boolean) => void;
  isExtracting: boolean;
  onGetVideoTime?: () => number;
}

const QUALITIES: VideoQuality[] = ['best', '1080p', '720p', '480p', '360p'];

export const SingleFramePicker: React.FC<Props> = ({
  duration,
  timestamp,
  onTimestampChange,
  onExtract,
  isExtracting,
  onGetVideoTime,
}) => {
  const [inputStr, setInputStr] = useState<string>(formatDuration(timestamp, true));
  const [format, setFormat] = useState<'jpg' | 'png' | 'webp'>('jpg');
  const [quality, setQuality] = useState<VideoQuality>('best');
  const [includeTimestamp, setIncludeTimestamp] = useState<boolean>(false);

  useEffect(() => {
    setInputStr(formatDuration(timestamp, true));
  }, [timestamp]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onTimestampChange(val);
    setInputStr(formatDuration(val, true));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputStr(e.target.value);
    const parsed = parseTimestampToSeconds(e.target.value);
    if (parsed !== null && parsed <= duration) onTimestampChange(parsed);
  };

  const nudge = (delta: number) => {
    const next = Math.max(0, Math.min(duration, timestamp + delta));
    onTimestampChange(next);
    setInputStr(formatDuration(next, true));
  };

  const handleSyncVideo = () => {
    if (!onGetVideoTime) return;
    const t = onGetVideoTime();
    onTimestampChange(t);
  };

  const handleReset = () => {
    onTimestampChange(0);
    setInputStr(formatDuration(0, true));
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Timestamp Position
          </label>
          <div className="flex items-center gap-2.5">
            {onGetVideoTime && (
              <button
                type="button"
                onClick={handleSyncVideo}
                className="text-xs text-cinema-accent hover:text-cinema-accentHover flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Use Video Time</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              title="Reset timestamp to 00:00"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputStr}
            onChange={handleTextChange}
            placeholder="00:00.000"
            className="w-36 px-3.5 py-2.5 bg-surface border border-border-subtle rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cinema-accent focus:ring-1 focus:ring-cinema-accent"
          />
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.05"
              value={timestamp}
              onChange={handleSliderChange}
              className="w-full accent-cinema-accent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
              <span>00:00.000</span>
              <span>{formatDuration(duration, true)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400 mr-1">Fine Scrub:</span>
        {[-5, -1, -0.1, 0.1, 1, 5].map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => nudge(delta)}
            className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
          >
            {delta > 0 ? `+${delta}s` : `${delta}s`}
          </button>
        ))}
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
                  className={`py-1.5 font-medium rounded-lg uppercase transition-all cursor-pointer ${
                    format === fmt ? 'bg-cinema-accent text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
                  className={`py-1.5 font-medium rounded-lg text-center transition-all cursor-pointer ${
                    quality === q ? 'bg-cinema-accent text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
        disabled={isExtracting}
        onClick={() => onExtract(format, quality, includeTimestamp)}
        className="w-full py-3.5 px-4 rounded-xl font-heading font-semibold text-sm text-white bg-cinema-accent hover:bg-cinema-accentHover active:scale-99 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cinema-accent/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Camera className="w-4 h-4" />
        <span>Capture Single Frame ({formatDuration(timestamp, true)})</span>
      </button>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Film,
  Layers,
} from 'lucide-react';
import type { ExtractedFrame } from '../../server/types';

interface Props {
  frames: ExtractedFrame[];
  isOpen: boolean;
  onClose: () => void;
  onOpenSpritesheet?: () => void;
}

const FPS_PRESETS = [2, 5, 10, 15, 24, 30];

export const FrameAnimationModal: React.FC<Props> = ({
  frames,
  isOpen,
  onClose,
  onOpenSpritesheet,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(10);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const timerRef = useRef<any>(null);

  const stepFrame = (delta: number) => {
    setCurrentIndex((prev) => {
      const next = prev + delta;
      if (next >= frames.length) return isLooping ? 0 : prev;
      if (next < 0) return isLooping ? frames.length - 1 : 0;
      return next;
    });
  };

  const handleTogglePlay = () => setIsPlaying((p) => !p);

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isOpen || !isPlaying || frames.length <= 1) return;
    const intervalMs = Math.round(1000 / fps);

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev + 1 >= frames.length) {
          if (!isLooping) {
            setIsPlaying(false);
            return prev;
          }
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPlaying, fps, isLooping, frames.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft') stepFrame(-1);
      else if (e.key === 'ArrowRight') stepFrame(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || frames.length === 0) return null;
  const currentFrame = frames[currentIndex] || frames[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative max-w-4xl w-full bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-cinema-accent" />
            <h3 className="font-heading font-bold text-sm text-white">Frame Sequence Animator</h3>
            <span className="text-xs text-slate-400">
              ({frames.length} frames • {fps} FPS)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSpritesheet && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSpritesheet();
                }}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle hover:border-cinema-accent/50 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-cinema-accent" />
                <span>Create Spritesheet</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] max-h-[58vh] overflow-hidden p-2 select-none">
          <img
            src={currentFrame.url}
            alt={currentFrame.filename}
            className="w-full h-full max-h-[56vh] object-contain rounded-lg"
          />

          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-lg bg-black/75 border border-white/10 backdrop-blur-md text-xs font-mono text-white">
            <span className="text-cinema-accent font-bold">
              {currentIndex + 1} / {frames.length}
            </span>
            <span className="text-slate-400">•</span>
            <span>{currentFrame.timestampFormatted}</span>
          </div>
        </div>

        <div className="p-4 bg-surface border-t border-border-subtle space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 w-10 text-right">
              {currentIndex + 1}
            </span>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="flex-1 accent-cinema-accent cursor-pointer h-1.5 bg-surface-elevated rounded-lg"
            />
            <span className="text-xs font-mono text-slate-400 w-10">
              {frames.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestart}
                title="Restart from beginning"
                className="p-2 rounded-lg bg-surface-card border border-border-subtle hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stepFrame(-1);
                  setIsPlaying(false);
                }}
                title="Previous Frame"
                className="p-2 rounded-lg bg-surface-card border border-border-subtle hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                className="px-4 py-2 rounded-xl bg-cinema-accent hover:bg-cinema-accentHover text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-cinema-accent/30 cursor-pointer transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stepFrame(1);
                  setIsPlaying(false);
                }}
                title="Next Frame"
                className="p-2 rounded-lg bg-surface-card border border-border-subtle hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsLooping((l) => !l)}
                title={isLooping ? 'Looping enabled' : 'Looping disabled'}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  isLooping
                    ? 'bg-cinema-accent/20 border-cinema-accent text-cinema-accent'
                    : 'bg-surface-card border-border-subtle text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Gauge className="w-3.5 h-3.5 text-slate-500" />
                <span>Speed:</span>
              </div>
              <div className="flex items-center gap-1 bg-surface-card p-1 rounded-lg border border-border-subtle">
                {FPS_PRESETS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                      fps === rate
                        ? 'bg-cinema-accent text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}fps
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

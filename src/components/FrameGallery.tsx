import React, { useState, useMemo } from 'react';
import {
  Download,
  Maximize2,
  Copy,
  Trash2,
  Film,
  Check,
  ArrowUpDown,
  Play,
  Layers,
  Video,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { ExtractedFrame } from '../../server/types';
import { formatBytes } from '../services/formatters';
import {
  sortFramesByTimestamp,
  filterActiveFrames,
  type SortOrder,
} from '../services/galleryUtils';
import { FrameAnimationModal } from './FrameAnimationModal';
import { SpritesheetModal } from './SpritesheetModal';

interface Props {
  frames: ExtractedFrame[];
  onSelectFrame: (frame: ExtractedFrame) => void;
  onDownloadZip: () => void;
  onClear: () => void;
  onCopyFrame: (frame: ExtractedFrame) => void;
  onDeleteFrame: (frame: ExtractedFrame) => void;
  onLoadInVideo?: (frame: ExtractedFrame) => void;
  copiedId: string | null;
  onToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const FrameGallery: React.FC<Props> = ({
  frames,
  onSelectFrame,
  onDownloadZip,
  onClear,
  onCopyFrame,
  onDeleteFrame,
  onLoadInVideo,
  copiedId,
  onToast,
}) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [brokenImgIds, setBrokenImgIds] = useState<Set<string>>(new Set());
  const [isAnimationOpen, setIsAnimationOpen] = useState<boolean>(false);
  const [isSpritesheetOpen, setIsSpritesheetOpen] = useState<boolean>(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const sortedFrames = useMemo(() => {
    return sortFramesByTimestamp(frames, sortOrder);
  }, [frames, sortOrder]);

  const activeFrames = useMemo(() => {
    return filterActiveFrames(sortedFrames, disabledIds);
  }, [sortedFrames, disabledIds]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await onClear();
    } finally {
      setIsClearing(false);
      setIsConfirmClearOpen(false);
    }
  };

  const handleToggleDisable = (frame: ExtractedFrame) => {
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(frame.id)) next.delete(frame.id);
      else next.add(frame.id);
      return next;
    });
  };

  const handleEnableAll = () => {
    setDisabledIds(new Set());
  };

  if (frames.length === 0) {
    return (
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-12 text-center shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border-subtle mx-auto flex items-center justify-center text-slate-500 mb-4">
          <Film className="w-8 h-8 opacity-40" />
        </div>
        <h3 className="font-heading font-semibold text-lg text-white mb-1">No Frames Extracted Yet</h3>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Choose a timestamp or define a series range above, then click capture to extract frames.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-lg text-white">
              Extracted Gallery ({frames.length})
            </h3>
            {disabledIds.size > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cinema-accent/15 border border-cinema-accent/30 text-cinema-accent font-mono">
                {activeFrames.length} active • {disabledIds.size} excluded
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">Lossless frames ready to copy, animate, download, or compile</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {disabledIds.size > 0 && (
            <button
              type="button"
              onClick={handleEnableAll}
              className="px-2.5 py-1.5 rounded-xl bg-surface border border-cinema-accent/40 text-cinema-accent hover:bg-cinema-accent hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Enable All
            </button>
          )}

          <button
            type="button"
            onClick={toggleSortOrder}
            title={`Sort by timestamp: currently ${sortOrder === 'asc' ? 'ascending (earliest first)' : 'descending (latest first)'}`}
            className="px-3 py-2 rounded-xl bg-surface border border-border-subtle text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-cinema-accent" />
            <span>{sortOrder === 'asc' ? 'Timestamp ↑ (Asc)' : 'Timestamp ↓ (Desc)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAnimationOpen(true)}
            title="Animate active frames in flipbook viewer"
            className="px-3.5 py-2 rounded-xl bg-surface border border-border-subtle hover:border-cinema-accent/60 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-cinema-accent fill-cinema-accent" />
            <span>Animate ({activeFrames.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSpritesheetOpen(true)}
            title="Stitch active frames into a sprite sheet"
            className="px-3.5 py-2 rounded-xl bg-surface border border-border-subtle hover:border-cinema-accent/60 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-cinema-accent" />
            <span>Spritesheet ({activeFrames.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmClearOpen(true)}
            className="px-3 py-2 rounded-xl bg-surface border border-border-subtle text-xs text-slate-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={onDownloadZip}
            className="px-4 py-2 rounded-xl font-heading font-semibold text-xs text-white bg-cinema-accent hover:bg-cinema-accentHover transition-all shadow-md shadow-cinema-accent/20 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download All (.ZIP)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedFrames.map((frame) => {
          const isDisabled = disabledIds.has(frame.id);

          return (
            <div
              key={frame.id}
              className={`group bg-surface-card border rounded-xl overflow-hidden shadow-lg transition-all relative ${
                isDisabled
                  ? 'border-dashed border-border-subtle/80 opacity-65'
                  : 'border-border-subtle hover:border-cinema-accent/50'
              }`}
            >
              <div
                className="relative aspect-video bg-black overflow-hidden cursor-pointer"
                onClick={() => onSelectFrame(frame)}
              >
                {brokenImgIds.has(frame.id) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-surface text-slate-400">
                    <AlertTriangle className="w-5 h-5 text-amber-400/80 mb-1" />
                    <span className="text-[11px] font-medium text-slate-300">File not found</span>
                    <span className="text-[9px] text-slate-500 font-mono truncate max-w-[90%]">{frame.filename}</span>
                  </div>
                ) : (
                  <img
                    src={frame.url}
                    alt={frame.filename}
                    onError={() => setBrokenImgIds((prev) => new Set(prev).add(frame.id))}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                      isDisabled ? 'grayscale-[60%]' : ''
                    }`}
                    loading="lazy"
                  />
                )}

                {isDisabled && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/85 text-[10px] font-mono text-cinema-accent border border-cinema-accent/30 flex items-center gap-1 backdrop-blur-sm z-10">
                    <EyeOff className="w-3 h-3" />
                    <span>Excluded</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    title="Inspect"
                    className="p-2 rounded-lg bg-surface/90 text-white hover:bg-cinema-accent transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[11px] font-mono text-white backdrop-blur-sm">
                  {frame.timestampFormatted}
                </div>

                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[11px] font-mono text-slate-300 backdrop-blur-sm">
                  {formatBytes(frame.sizeBytes)}
                </div>
              </div>

              <div className="p-3 flex items-center justify-between gap-2 border-t border-border-subtle/50 text-xs">
                <span className="font-mono text-slate-400 truncate text-[11px]">{frame.filename}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onLoadInVideo && (
                    <button
                      type="button"
                      onClick={() => onLoadInVideo(frame)}
                      title="Load frame in video player"
                      className="p-1.5 rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-cinema-accent hover:border-cinema-accent/50 cursor-pointer transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleDisable(frame)}
                    title={
                      isDisabled
                        ? 'Enable frame (include in animation & spritesheet)'
                        : 'Disable frame (exclude from animation & spritesheet)'
                    }
                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                      isDisabled
                        ? 'bg-cinema-accent/20 border-cinema-accent text-cinema-accent'
                        : 'bg-surface border-border-subtle text-slate-400 hover:text-white hover:border-slate-500'
                    }`}
                  >
                    {isDisabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onCopyFrame(frame)}
                    title="Copy Image"
                    className="p-1.5 rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
                  >
                    {copiedId === frame.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <a
                    href={frame.url}
                    download={frame.filename}
                    title="Download Frame"
                    className="p-1.5 rounded-lg bg-surface border border-border-subtle text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => onDeleteFrame(frame)}
                    title="Delete Frame"
                    className="p-1.5 rounded-lg bg-surface border border-border-subtle text-slate-400 hover:text-rose-400 hover:border-rose-800/50 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FrameAnimationModal
        frames={activeFrames}
        isOpen={isAnimationOpen}
        onClose={() => setIsAnimationOpen(false)}
        onOpenSpritesheet={() => setIsSpritesheetOpen(true)}
      />

      <SpritesheetModal
        frames={activeFrames}
        isOpen={isSpritesheetOpen}
        onClose={() => setIsSpritesheetOpen(false)}
        onToast={onToast}
      />

      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative max-w-md w-full bg-surface-card border border-rose-500/30 rounded-2xl p-6 shadow-2xl shadow-rose-950/50 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-heading font-bold text-lg text-white">
                Delete All Extracted Frames?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                This will permanently delete all{' '}
                <span className="font-semibold text-rose-400 font-mono">
                  {frames.length} frame{frames.length !== 1 ? 's' : ''}
                </span>{' '}
                from your gallery and erase their image files from your computer's disk (`output/frames` & `saved_frames`).
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                This action is destructive and cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                disabled={isClearing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border-subtle hover:border-slate-500 text-slate-300 hover:text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete All Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

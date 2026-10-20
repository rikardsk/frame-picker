import React, { useEffect } from 'react';
import { X, Download, Copy, ChevronLeft, ChevronRight, Check, Trash2 } from 'lucide-react';
import type { ExtractedFrame } from '../../server/types';
import { formatBytes } from '../services/formatters';

interface Props {
  frame: ExtractedFrame | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onCopy: (frame: ExtractedFrame) => void;
  onDelete?: (frame: ExtractedFrame) => void;
  isCopied: boolean;
}

export const FramePreviewModal: React.FC<Props> = ({
  frame,
  onClose,
  onPrev,
  onNext,
  onCopy,
  onDelete,
  isCopied,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);

  if (!frame) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative max-w-5xl w-full bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-cinema-accent/20 text-cinema-accent font-semibold">
              {frame.timestampFormatted}
            </span>
            <span className="text-xs text-slate-300 font-mono hidden sm:inline">{frame.filename}</span>
            <span className="text-xs text-slate-500">({formatBytes(frame.sizeBytes)})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCopy(frame)}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(frame);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-slate-400 hover:text-rose-400 hover:border-rose-900/50 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <a
              href={frame.url}
              download={frame.filename}
              className="px-3 py-1.5 rounded-lg bg-cinema-accent text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-cinema-accentHover cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-black flex items-center justify-center overflow-auto min-h-[300px] p-2">
          <img
            src={frame.url}
            alt={frame.filename}
            className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg select-none"
          />

          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-4 p-2 rounded-full bg-black/60 text-white hover:bg-cinema-accent transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-4 p-2 rounded-full bg-black/60 text-white hover:bg-cinema-accent transition-colors cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

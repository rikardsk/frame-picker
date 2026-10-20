import React from 'react';
import { Download, Maximize2, Copy, Trash2, Film, Check } from 'lucide-react';
import type { ExtractedFrame } from '../../server/types';
import { formatBytes } from '../services/formatters';

interface Props {
  frames: ExtractedFrame[];
  onSelectFrame: (frame: ExtractedFrame) => void;
  onDownloadZip: () => void;
  onClear: () => void;
  onCopyFrame: (frame: ExtractedFrame) => void;
  onDeleteFrame: (frame: ExtractedFrame) => void;
  copiedId: string | null;
}

export const FrameGallery: React.FC<Props> = ({
  frames,
  onSelectFrame,
  onDownloadZip,
  onClear,
  onCopyFrame,
  onDeleteFrame,
  copiedId,
}) => {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-heading font-bold text-lg text-white">
            Extracted Gallery ({frames.length})
          </h3>
          <p className="text-xs text-slate-400">Lossless frames ready to copy, download or manage</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-2 rounded-xl bg-surface border border-border-subtle text-xs text-slate-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
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
        {frames.map((frame) => (
          <div
            key={frame.id}
            className="group bg-surface-card border border-border-subtle hover:border-cinema-accent/50 rounded-xl overflow-hidden shadow-lg transition-all"
          >
            <div className="relative aspect-video bg-black overflow-hidden cursor-pointer" onClick={() => onSelectFrame(frame)}>
              <img
                src={frame.url}
                alt={frame.filename}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
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
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { Loader2, XCircle } from 'lucide-react';
import type { ExtractionProgress } from '../../server/types';

interface Props {
  progress: ExtractionProgress;
  onCancel?: () => void;
  isCancelling?: boolean;
}

export const ProgressIndicator: React.FC<Props> = ({ progress, onCancel, isCancelling }) => {
  return (
    <div className="bg-surface-card border border-cinema-accent/30 rounded-2xl p-5 shadow-xl shadow-black/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cinema-accent/20 flex items-center justify-center text-cinema-accent">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Extracting Frames</h4>
            <p className="text-xs text-slate-400">
              Processing frame {progress.completed} of {progress.total}
              {progress.currentTimestamp && ` (${progress.currentTimestamp})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-cinema-accent">
            {progress.percent}%
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{isCancelling ? 'Stopping...' : 'Cancel'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden border border-border-subtle">
        <div
          className="bg-gradient-to-r from-cinema-accent to-rose-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(5, progress.percent)}%` }}
        />
      </div>
    </div>
  );
};

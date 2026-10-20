import React, { KeyboardEvent } from 'react';
import { Search, Loader2, X, Play } from 'lucide-react';

interface Props {
  url: string;
  onChange: (url: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const PRESETS = [
  { label: 'Big Buck Bunny (4K 60fps)', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  { label: 'Tears of Steel (Sci-Fi)', url: 'https://www.youtube.com/watch?v=R6MlUcmOul8' },
];

export const VideoInput: React.FC<Props> = ({ url, onChange, onSubmit, isLoading }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && url.trim()) {
      onSubmit();
    }
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-6 shadow-xl shadow-black/40">
      <label htmlFor="yt-url" className="block text-sm font-semibold text-slate-200 mb-2">
        YouTube Video URL or Video ID
      </label>

      <div className="relative flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="yt-url"
            type="text"
            value={url}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste URL (e.g. https://www.youtube.com/watch?v=aqz-KE-bpKQ)"
            className="w-full pl-11 pr-10 py-3.5 bg-surface border border-border-subtle rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cinema-accent focus:ring-2 focus:ring-cinema-accent/30 transition-all text-sm"
          />
          {url && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading || !url.trim()}
          className="px-6 py-3.5 rounded-xl font-heading font-semibold text-sm text-white bg-cinema-accent hover:bg-cinema-accentHover active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cinema-accent/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching Stream...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Load Video</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-slate-400">Try demo:</span>
        {PRESETS.map((p) => (
          <button
            key={p.url}
            type="button"
            onClick={() => {
              onChange(p.url);
            }}
            className="px-2.5 py-1 rounded-md bg-surface border border-border-subtle text-slate-300 hover:text-white hover:border-cinema-accent/50 transition-colors cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};

import { Film, Sparkles } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cinema-accent to-rose-700 flex items-center justify-center shadow-lg shadow-cinema-accent/25">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-lg text-white tracking-tight">FramePicker</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cinema-accent/15 text-cinema-accent border border-cinema-accent/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Extract lossless frames directly from YouTube streams</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card border border-border-subtle text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Direct Stream Engine</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card border border-border-subtle text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Up to 4K 60fps</span>
          </div>
        </div>
      </div>
    </header>
  );
};

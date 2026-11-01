import React, { KeyboardEvent, useState, useRef } from 'react';
import { Search, Loader2, X, Play, UploadCloud, Film, HardDrive, CheckCircle2 } from 'lucide-react';
import type { VideoMetadata } from '../../server/types';
import { uploadLocalVideoApi, getVideoInfo } from '../services/api';

interface Props {
  url: string;
  onChange: (url: string) => void;
  onSubmit: () => void;
  onVideoLoaded: (video: VideoMetadata) => void;
  isLoading: boolean;
  onToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

const PRESETS = [
  { label: 'Big Buck Bunny (4K 60fps)', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  { label: 'Tears of Steel (Sci-Fi)', url: 'https://www.youtube.com/watch?v=R6MlUcmOul8' },
];

export const VideoInput: React.FC<Props> = ({
  url,
  onChange,
  onSubmit,
  onVideoLoaded,
  isLoading,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'local'>('youtube');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isProcessingLocal, setIsProcessingLocal] = useState<boolean>(false);
  const [localPathInput, setLocalPathInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && url.trim()) onSubmit();
  };

  const processFile = async (file: File) => {
    if (!file) return;
    setIsProcessingLocal(true);
    setUploadPercent(0);
    try {
      const metadata = await uploadLocalVideoApi(file, (percent) => {
        setUploadPercent(percent);
      });
      onVideoLoaded(metadata);
      onToast?.('success', 'Local video loaded', `${metadata.title} ready for frame extraction`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload video';
      onToast?.('error', 'Upload Error', msg);
    } finally {
      setIsProcessingLocal(false);
      setUploadPercent(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLocalPathSubmit = async () => {
    if (!localPathInput.trim()) return;
    setIsProcessingLocal(true);
    try {
      const metadata = await getVideoInfo(localPathInput.trim());
      onVideoLoaded(metadata);
      onToast?.('success', 'Local video file loaded', metadata.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not read local video file';
      onToast?.('error', 'File Read Error', msg);
    } finally {
      setIsProcessingLocal(false);
    }
  };

  return (
    <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-4 sm:p-6 shadow-xl shadow-black/40">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-3 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('youtube')}
          className={`flex items-center gap-2 pb-1.5 text-sm font-heading font-semibold transition-colors cursor-pointer relative ${
            activeTab === 'youtube' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-4 h-4 text-cinema-accent" />
          <span>YouTube Video</span>
          {activeTab === 'youtube' && (
            <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-cinema-accent rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('local')}
          className={`flex items-center gap-2 pb-1.5 text-sm font-heading font-semibold transition-colors cursor-pointer relative ${
            activeTab === 'local' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-cinema-accent" />
          <span>Your Own Video</span>
          {activeTab === 'local' && (
            <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-cinema-accent rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'youtube' ? (
        <div>
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
                  onClick={() => onChange('')}
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
                onClick={() => onChange(p.url)}
                className="px-2.5 py-1 rounded-md bg-surface border border-border-subtle text-slate-300 hover:text-white hover:border-cinema-accent/50 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessingLocal && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-cinema-accent bg-cinema-accent/10 shadow-lg shadow-cinema-accent/20'
                : 'border-border-subtle bg-surface hover:border-cinema-accent/50 hover:bg-surface-elevated'
            } ${isProcessingLocal ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isProcessingLocal ? (
              <div className="w-full max-w-xs space-y-2">
                <Loader2 className="w-8 h-8 text-cinema-accent animate-spin mx-auto" />
                <p className="text-sm font-semibold text-white">
                  {uploadPercent !== null && uploadPercent < 100
                    ? `Uploading video... ${uploadPercent}%`
                    : 'Probing video details with FFmpeg...'}
                </p>
                {uploadPercent !== null && (
                  <div className="w-full bg-surface-card h-2 rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="bg-cinema-accent h-full transition-all duration-200"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-cinema-accent/15 flex items-center justify-center text-cinema-accent">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    Drop your video here, or <span className="text-cinema-accent underline">browse files</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports MP4, WebM, MOV, MKV, AVI (processed directly with native FFmpeg speed)
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-border-subtle/60">
            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <HardDrive className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={localPathInput}
                  onChange={(e) => setLocalPathInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isProcessingLocal) handleLocalPathSubmit();
                  }}
                  placeholder="Or paste absolute disk path (e.g. C:\Videos\my_clip.mp4)"
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-border-subtle rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cinema-accent transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleLocalPathSubmit}
                disabled={isProcessingLocal || !localPathInput.trim()}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-cinema-accent hover:text-white border border-border-subtle transition-all cursor-pointer text-slate-200 disabled:opacity-40 shrink-0"
              >
                Load Path
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

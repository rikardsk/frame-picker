import React, { useState } from 'react';
import { Camera, Layers } from 'lucide-react';
import { SingleFramePicker } from './SingleFramePicker';
import { SeriesFramePicker } from './SeriesFramePicker';
import type { VideoMetadata, VideoQuality } from '../../server/types';

interface Props {
  video: VideoMetadata;
  currentTime: number;
  onCurrentTimeChange: (time: number) => void;
  onExtractSingle: (format: 'jpg' | 'png' | 'webp', quality: VideoQuality, includeTimestamp: boolean) => void;
  onExtractSeries: (config: {
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

export const ExtractionControls: React.FC<Props> = ({
  video,
  currentTime,
  onCurrentTimeChange,
  onExtractSingle,
  onExtractSeries,
  isExtracting,
  onGetVideoTime,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'series'>('single');

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/40">
      <div className="flex border-b border-border-subtle pb-4 mb-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className={`flex items-center gap-2 pb-2 text-sm font-heading font-semibold transition-all cursor-pointer relative ${
            activeTab === 'single' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4 text-cinema-accent" />
          <span>Single Frame</span>
          {activeTab === 'single' && (
            <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-cinema-accent rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('series')}
          className={`flex items-center gap-2 pb-2 text-sm font-heading font-semibold transition-all cursor-pointer relative ${
            activeTab === 'series' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-cinema-accent" />
          <span>Series / Batch Frames</span>
          {activeTab === 'series' && (
            <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-cinema-accent rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'single' ? (
        <SingleFramePicker
          duration={video.duration}
          timestamp={currentTime}
          onTimestampChange={onCurrentTimeChange}
          onExtract={onExtractSingle}
          isExtracting={isExtracting}
          onGetVideoTime={onGetVideoTime}
        />
      ) : (
        <SeriesFramePicker
          duration={video.duration}
          currentTime={currentTime}
          fps={video.fps}
          onExtract={onExtractSeries}
          isExtracting={isExtracting}
          onGetVideoTime={onGetVideoTime}
          onToast={onToast}
        />
      )}
    </div>
  );
};

export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  duration: number; // in seconds
  durationFormatted: string;
  thumbnail: string;
  url: string;
  sourceType?: 'youtube' | 'local';
  viewCount?: number;
  description?: string;
  fps?: number;
  width?: number;
  height?: number;
}

export interface ExtractedFrame {
  id: string;
  sessionId?: string;
  index: number;
  timestamp: number; // in seconds
  timestampFormatted: string;
  filename: string;
  url: string;
  sizeBytes: number;
  disabled?: boolean;
  width?: number;
  height?: number;
}

export type VideoQuality = 'best' | '1080p' | '720p' | '480p' | '360p';

export interface SingleFrameRequest {
  url: string;
  timestamp: number; // seconds
  format?: 'jpg' | 'png' | 'webp';
  quality?: VideoQuality;
  includeTimestamp?: boolean;
}

export interface SeriesFrameRequest {
  url: string;
  startTime: number;
  endTime: number;
  mode: 'interval' | 'count';
  intervalSeconds?: number;
  count?: number;
  format?: 'jpg' | 'png' | 'webp';
  quality?: VideoQuality;
  includeTimestamp?: boolean;
}

export interface ExtractionProgress {
  taskId: string;
  status: 'pending' | 'extracting' | 'completed' | 'cancelled' | 'error';
  total: number;
  completed: number;
  percent: number;
  currentTimestamp?: string;
  error?: string;
  frames: ExtractedFrame[];
}

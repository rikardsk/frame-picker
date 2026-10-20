import { describe, it, expect } from 'vitest';
import {
  extractYouTubeId,
  formatDuration,
  parseTimestampToSeconds,
  formatBytes,
} from '../src/services/formatters';

describe('formatters', () => {
  describe('extractYouTubeId', () => {
    it('extracts ID from standard watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
      expect(extractYouTubeId(url)).toBe('aqz-KE-bpKQ');
    });

    it('extracts ID from youtu.be short URL', () => {
      const url = 'https://youtu.be/aqz-KE-bpKQ?t=15';
      expect(extractYouTubeId(url)).toBe('aqz-KE-bpKQ');
    });

    it('extracts ID from YouTube Shorts URL', () => {
      const url = 'https://www.youtube.com/shorts/aqz-KE-bpKQ';
      expect(extractYouTubeId(url)).toBe('aqz-KE-bpKQ');
    });

    it('returns null for invalid strings', () => {
      expect(extractYouTubeId('invalid-url-string')).toBeNull();
      expect(extractYouTubeId('')).toBeNull();
    });
  });

  describe('formatDuration', () => {
    it('formats MM:SS correctly', () => {
      expect(formatDuration(95)).toBe('01:35');
      expect(formatDuration(0)).toBe('00:00');
    });

    it('formats HH:MM:SS when duration exceeds 1 hour', () => {
      expect(formatDuration(3665)).toBe('01:01:05');
    });

    it('formats milliseconds when requested', () => {
      expect(formatDuration(15.42, true)).toBe('00:15.420');
    });
  });

  describe('parseTimestampToSeconds', () => {
    it('parses raw numbers', () => {
      expect(parseTimestampToSeconds('45')).toBe(45);
      expect(parseTimestampToSeconds('12.5')).toBe(12.5);
    });

    it('parses MM:SS format', () => {
      expect(parseTimestampToSeconds('02:15')).toBe(135);
    });

    it('parses HH:MM:SS.mmm format', () => {
      expect(parseTimestampToSeconds('01:00:10.500')).toBe(3610.5);
    });

    it('returns null for invalid timestamps', () => {
      expect(parseTimestampToSeconds('invalid')).toBeNull();
      expect(parseTimestampToSeconds('')).toBeNull();
    });
  });

  describe('formatBytes', () => {
    it('formats zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats KB and MB properly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576 * 2.5)).toBe('2.5 MB');
    });
  });
});

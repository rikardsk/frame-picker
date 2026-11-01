import { describe, it, expect } from 'vitest';
import {
  parseFps,
  parseDuration,
  formatFileSize,
  isLocalVideoPath,
  resolveLocalVideoPath,
} from '../server/services/localVideoService';

describe('localVideoService parsing and helpers', () => {
  it('correctly parses frame rates from ffprobe strings', () => {
    expect(parseFps('30/1')).toBe(30);
    expect(parseFps('60/1')).toBe(60);
    expect(parseFps('24000/1001')).toBe(23.98);
    expect(parseFps('30000/1001')).toBe(29.97);
    expect(parseFps('60000/1001')).toBe(59.94);
    expect(parseFps('25')).toBe(25);
    expect(parseFps('0/0')).toBeUndefined();
    expect(parseFps('')).toBeUndefined();
    expect(parseFps(undefined)).toBeUndefined();
  });

  it('correctly extracts duration from format or video stream data', () => {
    expect(parseDuration({ format: { duration: '124.55' } })).toBe(124.55);
    expect(parseDuration({
      format: {},
      streams: [{ codec_type: 'audio', duration: '50' }, { codec_type: 'video', duration: '98.2' }]
    })).toBe(98.2);
    expect(parseDuration({})).toBe(0);
    expect(parseDuration(null)).toBe(0);
  });

  it('formats file sizes accurately into human-readable units', () => {
    expect(formatFileSize(500)).toBe('500.0 B');
    expect(formatFileSize(1024 * 50)).toBe('50.0 KB');
    expect(formatFileSize(1024 * 1024 * 25.5)).toBe('25.5 MB');
    expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
    expect(formatFileSize(0)).toBe('');
  });

  it('identifies local video paths vs external URLs', () => {
    expect(isLocalVideoPath('/api/uploads/123-abc/clip.mp4')).toBe(true);
    expect(isLocalVideoPath('C:\\Videos\\presentation.mov')).toBe(true);
    expect(isLocalVideoPath('D:/Clips/screen-recording.mp4')).toBe(true);
    expect(isLocalVideoPath('file:///C:/Users/rikar/Videos/test.mp4')).toBe(true);
    expect(isLocalVideoPath('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe(false);
    expect(isLocalVideoPath('https://youtu.be/aqz-KE-bpKQ')).toBe(false);
    expect(isLocalVideoPath('')).toBe(false);
  });

  it('handles resolveLocalVideoPath safely for non-existent paths', () => {
    expect(resolveLocalVideoPath('')).toBeNull();
    expect(resolveLocalVideoPath('/api/uploads/invalid-session/video.mp4')).toBeNull();
    expect(resolveLocalVideoPath('Z:\\non_existent_drive\\video.mp4')).toBeNull();
  });
});

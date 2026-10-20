import { describe, it, expect } from 'vitest';
import { resolveFormatArg } from '../server/services/ytdlpService';
import { calculateTimestamps } from '../server/server';
import { buildVideoFilters } from '../server/services/ffmpegService';

describe('Video format resolution (resolveFormatArg)', () => {
  it('resolves 360p stream selector', () => {
    expect(resolveFormatArg('360p')).toBe('bestvideo[height<=360]+bestaudio/best[height<=360]/best');
  });

  it('resolves 480p stream selector', () => {
    expect(resolveFormatArg('480p')).toBe('bestvideo[height<=480]+bestaudio/best[height<=480]/best');
  });

  it('resolves 720p and 1080p selectors', () => {
    expect(resolveFormatArg('720p')).toBe('bestvideo[height<=720]+bestaudio/best[height<=720]/best');
    expect(resolveFormatArg('1080p')).toBe('bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
  });

  it('falls back to best for unspecified quality', () => {
    expect(resolveFormatArg('best')).toBe('bestvideo+bestaudio/best');
  });
});

describe('Timestamp Calculation (calculateTimestamps)', () => {
  it('distributes 10 frames evenly across time range', () => {
    const timestamps = calculateTimestamps(0, 90, 'count', undefined, 10);
    expect(timestamps).toHaveLength(10);
    expect(timestamps[0]).toBe(0);
    expect(timestamps[1]).toBe(10);
    expect(timestamps[timestamps.length - 1]).toBe(90);
  });

  it('handles custom interval extraction', () => {
    const timestamps = calculateTimestamps(0, 10, 'interval', 2);
    expect(timestamps).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('limits frames to count in interval mode when auto-calculated', () => {
    // 5 frames every 2 seconds starting at 10s: 10, 12, 14, 16, 18
    const timestamps = calculateTimestamps(10, 18, 'interval', 2, 5);
    expect(timestamps).toEqual([10, 12, 14, 16, 18]);
    expect(timestamps).toHaveLength(5);
  });

  it('safely handles non-positive durations', () => {
    const timestamps = calculateTimestamps(15, 10, 'count', undefined, 5);
    expect(timestamps).toEqual([15]);
  });
});

describe('Video Filter Building (buildVideoFilters)', () => {
  it('generates scale filter for 360p and 480p', () => {
    const filters360 = buildVideoFilters(12, '360p', false);
    expect(filters360).toContain('scale=-2:min(ih\\,360)');

    const filters480 = buildVideoFilters(12, '480p', false);
    expect(filters480).toContain('scale=-2:min(ih\\,480)');
  });

  it('generates drawtext filter with properly escaped colons when includeTimestamp is true', () => {
    const filters = buildVideoFilters(65.5, 'best', true);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('drawtext=');
    expect(filters[0]).toContain('01\\:05.500');
  });

  it('combines scaling and timestamp overlay filters together', () => {
    const filters = buildVideoFilters(10, '360p', true);
    expect(filters).toHaveLength(2);
    expect(filters[0]).toContain('scale=-2:min(ih\\,360)');
    expect(filters[1]).toContain('drawtext=');
  });
});

import { describe, it, expect } from 'vitest';
import { extractYouTubeId } from '../src/services/formatters';

describe('ytdlpService URL handling', () => {
  it('parses diverse valid YouTube URL shapes', () => {
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'dQw4w9WgXcQ',
    ];

    for (const u of urls) {
      expect(extractYouTubeId(u)).toBe('dQw4w9WgXcQ');
    }
  });

  it('rejects invalid non-YouTube URLs', () => {
    expect(extractYouTubeId('https://vimeo.com/12345')).toBeNull();
    expect(extractYouTubeId('not-a-valid-url')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
  });
});

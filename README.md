# FramePicker — High-Precision YouTube Frame Extractor

A high-performance full-stack web application designed to extract individual frames or series of frames in lossless/native resolution (up to 4K 60fps) directly from YouTube video streams.

Built with **Vite + React 19 (TypeScript)**, **Tailwind CSS**, **Node.js / Express**, **`yt-dlp`**, and **`ffmpeg`**.

---

## Key Features

### 🎬 Direct Remote Seeking (No Full Video Download)
- The backend resolves direct video stream URLs via `yt-dlp`.
- `ffmpeg` seeks directly into remote streams (`-ss <timestamp> -i <stream_url> -frames:v 1`), extracting frames in seconds without downloading multi-gigabyte video files to disk.

### ⏱️ One-Click Playhead Sync ("Read Time from Video")
- Integrated with the YouTube IFrame API to read the player's exact playback position down to the millisecond.
- One-click sync in the video player and next to Start/End inputs in extraction controls.
- Displays video framerate (e.g. `24 FPS`, `30 FPS`, `60 FPS`).

### 📸 Single Frame Extraction
- Interactive timeline scrubber with millisecond text input (`MM:SS.mmm`).
- Fine-scrub nudge buttons (`-5s`, `-1s`, `-0.1s`, `+0.1s`, `+1s`, `+5s`).
- Formats: `JPG`, `PNG`, `WebP`.
- Resolutions: `Best Native`, `1080p`, `720p`, `480p`, `360p`.
- **Burn Timestamp Overlay**: Optionally stamp timecode onto image corners via FFmpeg's `drawtext` filter.

### 🎞️ Series & Batch Extraction Modes
- **By Interval**: Extract a frame every $X$ seconds (e.g., every 0.5s, 1s, 2s, 5s, 10s) with auto-calculated End Time based on desired frame count.
- **Distributed Count**: Evenly distribute $N$ frames across a specified Start and End time range.
- **Next N Frames (Consecutive)**: Extract $N$ consecutive video frames frame-by-frame from a starting point at native video FPS, with zero end-time setup required.
- **Cancellation**: Stop long-running extractions mid-flight with the **Cancel** button while preserving all frames captured up to that point.

### 🖼️ Extracted Frames Gallery
- Thumbnail grid with timestamp labels and file sizes.
- **Direct Clipboard Copy**: Copies image binary blob directly to the OS clipboard.
- **Individual Frame Deletion**: Delete single unwanted frames with one click (removes from gallery, session ZIP archive, and server disk).
- **Full-Screen Preview Modal**: Inspect high-res frames with keyboard navigation (`ArrowLeft`, `ArrowRight`, `Esc`).
- **ZIP Download**: Package and download all captured session frames as a single `.zip` file.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Express, Node.js, `child_process`
- **Video Engine**: `ffmpeg` (frame capture & drawtext filtering) & `yt-dlp` (stream resolution)
- **Design System**: Cinema Dark palette (`#090910`, `#12121F`, `#E11D48` crimson accent)
- **Testing**: Vitest unit test suite

---

## Prerequisites

1. **Node.js** (v18+)
2. **Python 3** with `yt-dlp` installed:
   ```bash
   pip install yt-dlp
   ```
3. **FFmpeg** installed and accessible in your system `PATH`:
   ```bash
   ffmpeg -version
   ```

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
Run frontend and backend concurrently:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

*(On Windows, you can also double-click `Start.bat`)*

### 3. Run Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

# SYS.DWN // Media Acquisition Terminal

A premium, local, open-source media downloader. Built with a robust Python backend (`yt-dlp` + `ffmpeg`) and a sleek, brutalist tech-wear frontend interface.

## Features
* **Brutalist UI:** A distraction-free, high-contrast, cyberpunk-inspired terminal aesthetic.
* **Universal Support:** Powered by hardened `yt-dlp` heuristics to seamlessly download from YouTube, Twitch, Twitter, TikTok, and thousands of other sites.
* **Format Control:** Download Video (`.mp4`, `.mkv`) with resolution caps up to `1080p`, or rip Lossless Audio (`.flac`) and dynamic bitrates (`.mp3`).
* **Task Queue Engine:** Concurrent download threading (via ThreadPoolExecutor) with "Halt All", "Retry", and dynamic task highlighting in Windows Explorer.
* **Live Telemetry:** Real-time speed, ETA, indeterminate "LIVE" stream handling, and animated CSS processing states.
* **Auto-Updates:** `start.bat` automatically handles environment provisioning and silently upgrades `yt-dlp` to outpace DRM updates.

## File Architecture
* `app.py`: Core backend API server utilizing Flask and yt-dlp.
* `templates/index.html`: Brutalist tech-wear UI structure.
* `static/css/style.css`: Cyberpunk styling, variables, and structural grid components.
* `static/js/main.js`: Asynchronous polling, UI state management, and server communication.
* `start.bat`: Windows launch script for easy environment initialization and server booting.

## Prerequisites
1. **Python 3.10+**
2. **FFmpeg**: Must be installed and accessible in your system `$PATH` (e.g., run `winget install Gyan.FFmpeg` on Windows).

## Quick Start (Windows)
1. Clone the repository.
2. Double-click `start.bat`. This script will automatically boot the local server and open the interface in your browser.
3. Your downloaded media is automatically saved to the `downloads/` directory.

## Manual Setup
If you prefer setting it up manually via terminal:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

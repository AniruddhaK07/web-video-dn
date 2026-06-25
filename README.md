# SYS.DWN // Media Acquisition Terminal

A premium, local, open-source media downloader. Built with a robust Python backend (`yt-dlp` + `ffmpeg`) and a sleek, brutalist tech-wear frontend interface.

## Features
* **Brutalist UI:** A distraction-free, high-contrast, cyberpunk-inspired terminal aesthetic.
* **Format Control:** Download in `.mp4`, `.mkv` (video), or `.mp3` (audio extract).
* **Resolution Caps:** Pull the absolute best quality, or cap at `1080p` / `720p` to save space.
* **Async Backend:** Downloads run in background threads without blocking the server.
* **Live Telemetry:** Real-time speed, ETA, and progress updates via the frontend API.

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

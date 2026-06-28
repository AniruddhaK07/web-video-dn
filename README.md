# SYS.DWN // Media Acquisition Terminal

**SYS.DWN** is a premium, local, open-source media downloading web application. Instead of relying on ad-riddled, rate-limited online video downloaders, this project provides a self-hosted, lightweight local server that you can run on your own machine. It is powered by a robust Python backend (`yt-dlp` + `ffmpeg`) and features a sleek, brutalist tech-wear frontend interface accessible right from your web browser.

With SYS.DWN, you can download high-quality videos and extract audio from thousands of platforms (including YouTube, Twitch, TikTok, Twitter/X) directly to your local drive without any limitations.

## Features
* **Brutalist UI:** A distraction-free, high-contrast, cyberpunk-inspired terminal aesthetic.
* **Universal Support:** Powered by hardened `yt-dlp` heuristics to seamlessly download from YouTube, Twitch, Twitter, TikTok, and thousands of other sites.
* **Format Control:** Download Video (`.mp4`, `.mkv`) with resolution caps up to `1080p`, or rip Lossless Audio (`.flac`) and dynamic bitrates (`.mp3`).
* **Task Queue Engine:** Concurrent download threading (via ThreadPoolExecutor) with "Halt All", "Retry", and dynamic task highlighting in Windows Explorer.
* **Live Telemetry:** Real-time speed, ETA, indeterminate "LIVE" stream handling, and animated CSS processing states.
* **Auto-Updates:** `start.bat` automatically handles environment provisioning and silently upgrades `yt-dlp` to outpace DRM updates.

## Prerequisites
To run this project, you will need the following installed on your system:
1. **Python 3.10+**: Core backend runtime. Make sure it is added to your system `$PATH`.
2. **FFmpeg**: Required for media processing (merging video and audio tracks, extracting mp3/flac). 
   - *Windows users can install it via winget:* `winget install Gyan.FFmpeg`
3. **Node.js**: Required by `yt-dlp` for solving complex JavaScript challenges and ciphers used by platforms to protect their media.

## Quick Start (Windows)
1. Clone the repository to your local machine.
2. Double-click the `start.bat` file. This script will automatically create a virtual environment, install the necessary dependencies, boot the local server, and open the interface in your default browser.
3. Paste a link into the terminal UI and click download. Your downloaded media is automatically saved to the `downloads/` directory.

## Manual Setup (Mac/Linux/Windows Terminal)
If you prefer setting it up manually via your terminal:
```bash
# 1. Create a virtual environment
python -m venv venv

# 2. Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the server
python app.py
```
Then navigate to `http://localhost:5000` in your web browser.

## ⚠️ IMPORTANT - Handling Bot Verification & Age-Restricted Content ⚠️
If you encounter bot verification errors (e.g., "Sign in to confirm you're not a bot") or are trying to download age-restricted or members-only content, you need to provide your browser cookies to the application so it can authenticate on your behalf.

**How to set up cookie ingestion:**
1. Install a "Get cookies.txt LOCALLY" extension in your web browser (available for Chrome/Firefox).
2. Go to the website you are trying to download from (e.g., YouTube) and make sure you are logged in.
3. Click the extension and export your cookies in the Netscape format.
4. Save or rename the exported file exactly as `cookies.txt`.
5. Place the `cookies.txt` file directly into the root folder of this project (the same folder as `app.py` and `start.bat`).

The application will automatically detect the `cookies.txt` file on the next download attempt and use it to bypass the verification block!

## File Architecture
* `app.py`: Core backend API server utilizing Flask and yt-dlp.
* `templates/index.html`: Brutalist tech-wear UI structure.
* `static/css/style.css`: Cyberpunk styling, variables, and structural grid components.
* `static/js/main.js`: Asynchronous polling, UI state management, and server communication.
* `start.bat`: Windows launch script for easy environment initialization and server booting.

Python

```
md_content = r"""# MASTER PROMPT: PRODUCTION-GRADE YOUTUBE CLI DOWNLOADER

## INSTRUCTIONAL OVERVIEW
Act as a Principal Software Engineer specializing in systems architecture and CLI tooling. Your objective is to generate a complete, production-ready, highly resilient Command-Line Interface (CLI) application in Python that downloads and processes YouTube videos. The application must utilize `yt-dlp` as the core extraction engine and `ffmpeg` for stream muxing and container transcoding.

Do not provide conceptual snippets or placeholder logic. Output the complete, runnable Python script adhering strictly to the specifications below, followed by a standard `README.md` documentation block.

---

## 1. ARCHITECTURAL & RUNTIME CONTRACT

* **Runtime Target:** Python 3.10+
* **Core Dependency Contract:** * `yt-dlp` (invoked natively via its Python API `yt_dlp.YoutubeDL`; direct shell `subprocess` calls to the `yt-dlp` binary are strictly prohibited).
  * `ffmpeg` (invoked implicitly via `yt-dlp` post-processors or explicitly via `subprocess.run` with strict `stdout`/`stderr` piping).
* **CLI Argument Framework:** `argparse` (Standard Library), structured with explicit type casting, required positional targets, and declarative help strings.
* **Type Hinting:** Strict PEP 484 compliance across all functions, classes, and return signatures.

### Pre-Flight System Validation
On application startup—prior to parsing target network URLs—the script must execute a binary check for `ffmpeg`. If `ffmpeg` is not resolved in the system `$PATH`:
1. Emit a categorized error to `sys.stderr`.
2. Print platform-specific remediation commands (`brew install ffmpeg`, `sudo apt install ffmpeg`, `winget install Gyan.FFmpeg`).
3. Terminate execution immediately with exit code `127`.

---

## 2. CORE FUNCTIONAL SPECIFICATIONS

### A. Input Ingestion & Validation
* Accept exactly one positional argument: `url` (type: `str`).
* Execute a pre-flight validation check using `urllib.parse` to ensure the network scheme is `http` or `https` and the netloc targets a valid YouTube domain architecture (`youtube.com`, `youtu.be`).

### B. Stream Quality Selection Matrix
Implement a mutually exclusive selection flag `--quality` accepting three deterministic tier parameters:

1. `best` (Default):
   * Strategy: Request highest bitrate video stream merged with highest bitrate audio stream.
   * `yt-dlp` format string: `'bv*+ba/b'`

2. `1080p`:
   * Strategy: Cap vertical resolution at <= 1080p, select maximum bitrate within that ceiling, merge with best available audio.
   * `yt-dlp` format string: `'bv*[height<=1080]+ba/b[height<=1080]'`

3. `720p`:
   * Strategy: Cap vertical resolution at <= 720p for constrained-bandwidth environments.
   * `yt-dlp` format string: `'bv*[height<=720]+ba/b[height<=720]'`

### C. Container Muxing & Audio Transcoding
Implement an explicit container target flag `--format` accepting: `[mp4 | mkv | mp3]`.

* **Target `mp4`:**
  * Apply `FFmpegVideoConvertor` post-processor targeting `mp4`.
  * Force audio stream codec to `aac` if the source audio stream is incompatible with standard MP4 hardware decoders.

* **Target `mkv`:**
  * Apply `FFmpegVideoConvertor` targeting `mkv`. Preserve raw source codecs (`copy` mode) to eliminate unnecessary encoding overhead.

* **Target `mp3`:**
  * Suppress video stream extraction entirely (`'format': 'bestaudio/best'`).
  * Apply `FFmpegExtractAudio` post-processor.
  * Set `preferredcodec` to `mp3` and `preferredquality` to `256` (256 kbps Continuous Bitrate).

### D. Filesystem & Output Management
* Implement `--output-dir` (defaulting to the current working directory `./`).
* Resolve all paths to absolute system paths via `pathlib.Path.resolve()`.
* Automatically construct the destination directory tree if non-existent (`parents=True, exist_ok=True`).
* Set `outtmpl` dictionary key to: `'%(title)s.%(ext)s'`, automatically stripped of restricted OS filesystem characters.

---

## 3. FAULT TOLERANCE & ERROR INTERCEPTION

Wrap the core execution pipeline in a structured `try...except` block. Map exceptions to deterministic system exit codes:

| Exception Trigger | Root Cause | System Response | Exit Code |
| :--- | :--- | :--- | :--- |
| `yt_dlp.utils.DownloadError` | Geoblock, Private Video, Age Gate, Dead Link | Extract exact failure substring; print clean single-line error to `stderr`. | `1` |
| `urllib.error.URLError` / `TimeoutError` | Socket drop / DNS resolution failure | Trigger automated 3x retry loop with exponential backoff (2^n seconds). Abort on 3rd failure. | `2` |
| `PermissionError` | Write access denied on target `--output-dir` | Print: `"FATAL: Write permission denied for destination directory [dir]"`. | `13` |
| `KeyboardInterrupt` (`Ctrl+C`) | User SIGINT | Trap signal, suppress Python traceback stack, purge temporary `.part` / `.ytdl` lockfiles, exit cleanly. | `130` |

---

## 4. TELEMETRY & TERMINAL UI

* Suppress standard `yt-dlp` console output (`'quiet': True`, `'no_warnings': True`).
* Inject a custom `progress_hook` callback function into the `YoutubeDL` configuration dictionary.
* The hook must render an ANSI-escaped single line updating via carriage return (`\r`) displaying:
  `[Downloading] 45.2% of ~142.5MiB at 12.4MiB/s ETA 00:06`
* Upon post-processing completion, clear the dynamic line and emit a single absolute artifact verification string:
  `[SUCCESS] Artifact generated: /absolute/path/to/Video_Title.mp4`

---

## 5. MANDATORY CODE ARCHITECTURE

The generated script must strictly follow this structural blueprint:
```

Code output

```
File generated: youtube_cli_master_prompt.md

```python
# 1. Imports (Standard Library -> Third-Party)

class ConfigurationError(Exception): ...

class SystemValidator:
    @staticmethod
    def verify_ffmpeg() -> None: ...

class ProgressRenderer:
    def __call__(self, d: dict) -> None: ...

class YouTubeDownloader:
    def __init__(self, url: str, quality: str, fmt: str, out_dir: Path): ...
    def _build_ydl_opts(self) -> dict: ...
    def execute(self) -> Path: ...

def parse_arguments() -> argparse.Namespace: ...

def main() -> int: ...

if __name__ == "__main__":
    sys.exit(main())
```

## 6. VERIFICATION TEST VECTORS

Append documentation instructing the user to validate the script against these three standard vectors:

1. **Standard Video Mux Vector:**
   `python ytdl_cli.py "https://www.youtube.com/watch?v=BaW_jenozKc" --quality 1080p --format mp4`
2. **Audio Extraction Vector:**
   `python ytdl_cli.py "https://www.youtube.com/watch?v=BaW_jenozKc" --format mp3 --output-dir ./audio_test`
3. **Trap Exception Vector:**
   `python ytdl_cli.py "https://youtube.com/watch?v=invalid_id_999"` (Must verify return code `1`).
   """

file\_name = "youtube\_cli\_master\_prompt.md"

with open(file\_name, "w", encoding="utf-8") as f:

f.write(md\_content.strip())

print(f"File generated: {file\_name}")

```
Your Markdown file is ready [file-tag: code-generated-file-0-1782420080474566977]

### Document Manifest
* **Artifact:** `youtube_cli_master_prompt.md`
* **Target Specification:** Production-Grade YouTube CLI Downloader (Python 3.10+ / `yt-dlp` / `ffmpeg`)
* **Structural Attributes:**
  * **Section 1:** Runtime dependencies & mandatory pre-flight `ffmpeg` binary validation.
  * **Section 2:** Declarative specifications for URL sanitization, video stream ceiling matrices (`best`, `1080p`, `720p`), and container transcoding targets (`mp4`, `mkv`, `mp3`).
  * **Section 3:** Complete fault tolerance table mapping runtime exceptions to deterministic system exit codes (`1`, `2`, `13`, `127`, `130`).
  * **Section 4 & 5:** ANSI terminal UI telemetry constraints and strict Object-Oriented architectural boilerplate.
  * **Section 6:** Baseline CLI test vectors for downstream verification.
```


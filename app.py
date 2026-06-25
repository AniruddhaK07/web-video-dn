"""
SYS.DWN // Backend Server
Core API server utilizing Flask and yt-dlp for async media acquisition and multiplexing.
"""
import os
import sys
import threading
import uuid
import subprocess
from flask import Flask, request, jsonify, render_template, send_from_directory
import yt_dlp

app = Flask(__name__)

# Verify FFmpeg on startup
def verify_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        print("FATAL: ffmpeg is not installed or not in PATH.", file=sys.stderr)
        print("Please install ffmpeg (e.g. winget install Gyan.FFmpeg) and restart.", file=sys.stderr)
        sys.exit(127)

verify_ffmpeg()

downloads = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url')
    quality = data.get('quality', 'best')
    fmt = data.get('format', 'mp4')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    task_id = str(uuid.uuid4())
    downloads[task_id] = {'status': 'starting', 'progress': '0%', 'eta': '...', 'speed': '...', 'filename': ''}
    
    thread = threading.Thread(target=download_worker, args=(task_id, url, quality, fmt))
    thread.daemon = True
    thread.start()
    
    return jsonify({'task_id': task_id})

def download_worker(task_id, url, quality, fmt):
    out_dir = os.path.join(os.getcwd(), 'downloads')
    os.makedirs(out_dir, exist_ok=True)
    
    ydl_opts = {
        'outtmpl': os.path.join(out_dir, '%(title)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'restrictfilenames': True,
    }
    
    if quality == '1080p':
        ydl_opts['format'] = 'bv*[height<=1080]+ba/b[height<=1080]'
    elif quality == '720p':
        ydl_opts['format'] = 'bv*[height<=720]+ba/b[height<=720]'
    else:
        ydl_opts['format'] = 'bv*+ba/b'
        
    if fmt == 'mp3':
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '256',
        }]
    elif fmt == 'mp4':
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }]
    elif fmt == 'mkv':
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mkv',
        }]
        
    def progress_hook(d):
        if d['status'] == 'downloading':
            try:
                percent_str = d.get('_percent_str', '0%').strip()
                speed_str = d.get('_speed_str', 'N/A').strip()
                eta_str = d.get('_eta_str', 'N/A').strip()
                downloads[task_id].update({
                    'status': 'downloading',
                    'progress': percent_str,
                    'speed': speed_str,
                    'eta': eta_str
                })
            except Exception:
                pass
        elif d['status'] == 'finished':
            downloads[task_id].update({
                'status': 'processing',
                'progress': '100%',
                'filename': d.get('filename', 'Unknown')
            })

    ydl_opts['progress_hooks'] = [progress_hook]
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        downloads[task_id]['status'] = 'completed'
    except Exception as e:
        downloads[task_id]['status'] = 'error'
        downloads[task_id]['error_message'] = str(e)

@app.route('/api/status/<task_id>')
def check_status(task_id):
    if task_id in downloads:
        return jsonify(downloads[task_id])
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    import os, time, threading
    # Schedule exit after response is sent
    def delayed_exit():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=delayed_exit).start()
    return jsonify({'status': 'shutting down'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

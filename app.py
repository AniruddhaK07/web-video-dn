import os
import sys
import threading
import time
import uuid
import subprocess
import re
import logging
import shutil
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify, render_template

# Ensure Node.js is in PATH for yt-dlp JS cipher solving
if not shutil.which('node'):
    node_path = r'C:\Program Files\nodejs'
    if os.path.exists(node_path) and node_path not in os.environ.get('PATH', ''):
        os.environ['PATH'] += os.pathsep + node_path

ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

def clean_str(s):
    if not isinstance(s, str): return str(s)
    return ansi_escape.sub('', s).strip()

app = Flask(__name__)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def verify_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        print("FATAL: ffmpeg is not installed or not in PATH.", file=sys.stderr)
        sys.exit(127)

verify_ffmpeg()

import yt_dlp

downloads = {}
executor = ThreadPoolExecutor(max_workers=3)

class DownloadCancelled(Exception):
    pass

def get_base_ydl_opts():
    opts = {
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 30,
    }
    if os.path.exists('cookies.txt'):
        opts['cookiefile'] = 'cookies.txt'
    return opts

# Background cleanup task
def cleanup_tasks():
    while True:
        time.sleep(300)
        now = time.time()
        to_delete = []
        for tid, data in downloads.items():
            if data.get('status') in ['completed', 'error', 'cancelled']:
                if now - data.get('end_time', now) > 3600:
                    to_delete.append(tid)
        for tid in to_delete:
            del downloads[tid]

threading.Thread(target=cleanup_tasks, daemon=True).start()

def format_size(bytes_num):
    if not bytes_num: return "Unknown"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_num < 1024.0:
            return f"{bytes_num:.1f}{unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.1f}TB"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/fetch', methods=['POST'])
def fetch_metadata():
    url = request.json.get('url', '').strip()
    if not url.startswith('http'):
        return jsonify({'error': 'Invalid URL. Must start with http or https.'}), 400
        
    try:
        # Optimize fetch by stripping heavy DRM and runtime components
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'skip_download': True,
            'socket_timeout': 20,
        }
        if os.path.exists('cookies.txt'):
            ydl_opts['cookiefile'] = 'cookies.txt'
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if 'entries' in info:
                entries = []
                for e in info.get('entries', []):
                    v_url = e.get('url') or e.get('webpage_url') or e.get('id')
                    
                    if v_url and not v_url.startswith('http') and info.get('extractor_key') == 'YoutubeTab':
                        v_url = f"https://www.youtube.com/watch?v={v_url}"
                        
                    if v_url:
                        entries.append({'title': e.get('title', 'Unknown'), 'url': v_url})
                        
                return jsonify({
                    'is_playlist': True,
                    'title': info.get('title', 'Unknown Playlist'),
                    'thumbnail': '',
                    'duration': 0,
                    'entries': entries
                })
            else:
                return jsonify({
                    'is_playlist': False,
                    'title': info.get('title', 'Unknown'),
                    'thumbnail': info.get('thumbnail', ''),
                    'duration': info.get('duration', 0)
                })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url', '').strip()
    if not url.startswith('http'):
        return jsonify({'error': 'Invalid URL format.'}), 400
        
    quality = data.get('quality', 'best')
    fmt = data.get('format', 'mp4')
    subfolder = data.get('subfolder', '').strip()
    
    if subfolder:
        # Strip invalid Windows path characters, keeping slashes for nested folders
        subfolder = re.sub(r'[<>:"|?*]', '', subfolder)
        # Enforce MAX_PATH safeguard (truncate to 50 chars)
        subfolder = subfolder[:50]
        
    title = data.get('title', 'Unknown')
    thumbnail = data.get('thumbnail', '')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    task_id = str(uuid.uuid4())
    downloads[task_id] = {
        'status': 'queued', 
        'progress': '0%', 
        'eta': '...', 
        'speed': '...', 
        'filename': '', 
        'size': '...',
        'cancelled': False,
        'title': title,
        'thumbnail': thumbnail,
        'start_time': time.time(),
        'url': url,
        'quality': quality,
        'format': fmt,
        'subfolder': subfolder
    }
    
    executor.submit(download_worker, task_id, url, quality, fmt, subfolder)
    
    return jsonify({'task_id': task_id})

@app.route('/api/cancel/<task_id>', methods=['POST'])
def cancel_download(task_id):
    if task_id in downloads:
        downloads[task_id]['cancelled'] = True
        return jsonify({'status': 'cancelled'})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/cancel_all', methods=['POST'])
def cancel_all():
    for tid, data in downloads.items():
        if data.get('status') in ['queued', 'starting', 'downloading', 'processing']:
            data['cancelled'] = True
    return jsonify({'status': 'cancelled_all'})

def download_worker(task_id, url, quality, fmt, subfolder):
    if downloads[task_id].get('cancelled'):
        downloads[task_id]['status'] = 'cancelled'
        return
        
    downloads[task_id]['status'] = 'starting'
    
    base_out_dir = os.path.abspath(os.path.join(os.getcwd(), 'downloads'))
    out_dir = base_out_dir
    
    if subfolder:
        requested_path = os.path.abspath(os.path.join(base_out_dir, subfolder))
        if requested_path.startswith(base_out_dir):
            out_dir = requested_path
        else:
            downloads[task_id]['status'] = 'error'
            downloads[task_id]['error_message'] = 'Invalid subfolder path.'
            return
            
    try:
        os.makedirs(out_dir, exist_ok=True)
    except OSError as e:
        downloads[task_id]['status'] = 'error'
        downloads[task_id]['error_message'] = f'Cannot create output directory: {e}'
        return
    
    downloads[task_id]['out_dir'] = out_dir
    
    # Check if we have at least 100MB free before even initiating
    usage = shutil.disk_usage(out_dir)
    if usage.free < 104857600:
        downloads[task_id]['status'] = 'error'
        downloads[task_id]['error_message'] = 'Insufficient disk space (< 100MB free).'
        return
    
    ydl_opts = get_base_ydl_opts()
    ydl_opts.update({
        'outtmpl': os.path.join(out_dir, '%(title)s [%(id)s].%(ext)s'),
        'restrictfilenames': True,
    })
    
    if fmt == 'audio':
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['writethumbnail'] = True
        if quality == 'flac':
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'flac',
            }]
        elif quality == 'mp3_320':
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '320',
            }]
        else:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        
        ydl_opts['postprocessors'].extend([
            {'key': 'FFmpegMetadata'},
            {'key': 'EmbedThumbnail'},
        ])
    else:
        if quality == '1080p':
            ydl_opts['format'] = 'bv*[height<=1080]+ba/b[height<=1080]/best'
        elif quality == '720p':
            ydl_opts['format'] = 'bv*[height<=720]+ba/b[height<=720]/best'
        else:
            ydl_opts['format'] = 'bv*+ba/b'
            
        if fmt in ['mp4', 'mkv']:
            ydl_opts['merge_output_format'] = fmt
        
    def progress_hook(d):
        if downloads[task_id].get('cancelled'):
            raise DownloadCancelled("Download cancelled by user")
            
        if d['status'] == 'downloading':
            try:
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate')
                if total_bytes and not downloads[task_id].get('space_checked'):
                    usage = shutil.disk_usage(out_dir)
                    if usage.free < (total_bytes + 52428800): # Video size + 50MB buffer
                        raise Exception(f"Insufficient space. Need {format_size(total_bytes)}, only {format_size(usage.free)} free.")
                    downloads[task_id]['space_checked'] = True
                    
                percent_str = clean_str(d.get('_percent_str', '0%'))
                speed_str = clean_str(d.get('_speed_str', 'N/A'))
                eta_str = clean_str(d.get('_eta_str', 'N/A'))
                
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate')
                
                if total_bytes:
                    size_str = format_size(total_bytes)
                else:
                    downloaded_bytes = d.get('downloaded_bytes')
                    size_str = format_size(downloaded_bytes) + " (Live/Indet.)" if downloaded_bytes else "Unknown"
                    percent_str = "LIVE" if not d.get('total_bytes') and not d.get('total_bytes_estimate') else percent_str
                    eta_str = "LIVE" if percent_str == "LIVE" else eta_str
                
                downloads[task_id].update({
                    'status': 'downloading',
                    'progress': percent_str,
                    'speed': speed_str,
                    'eta': eta_str,
                    'size': size_str
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
        if downloads[task_id].get('cancelled'):
            downloads[task_id]['status'] = 'cancelled'
        else:
            downloads[task_id]['status'] = 'completed'
    except DownloadCancelled:
        downloads[task_id]['status'] = 'cancelled'
    except Exception as e:
        if downloads[task_id].get('cancelled'):
            downloads[task_id]['status'] = 'cancelled'
        else:
            downloads[task_id]['status'] = 'error'
            downloads[task_id]['error_message'] = str(e)
            
    downloads[task_id]['end_time'] = time.time()

@app.route('/api/status')
def all_status():
    return jsonify(downloads)

@app.route('/api/status/<task_id>')
def check_status(task_id):
    if task_id in downloads: return jsonify(downloads[task_id])
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/dismiss/<task_id>', methods=['POST'])
def dismiss_task(task_id):
    if task_id in downloads:
        del downloads[task_id]
        return jsonify({'status': 'ok'})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/open/<task_id>', methods=['POST'])
def open_folder(task_id):
    if task_id in downloads:
        import platform
        file_path = downloads[task_id].get('filename')
        folder = downloads[task_id].get('out_dir')
        
        if file_path and os.path.exists(file_path):
            if platform.system() == "Windows":
                subprocess.Popen(f'explorer /select,"{file_path}"')
                return jsonify({'status': 'ok'})
        elif folder and os.path.exists(folder):
            if platform.system() == "Windows":
                os.startfile(folder)
            elif platform.system() == "Darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
            return jsonify({'status': 'ok'})
    return jsonify({'error': 'Folder/File not found'}), 404

@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    import os, time, threading
    def delayed_exit():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=delayed_exit).start()
    return jsonify({'status': 'shutting down'})

if __name__ == '__main__':
    app.run(debug=False, threaded=True, port=5000)
 
document.addEventListener('DOMContentLoaded', () => {
    const fetchForm = document.getElementById('fetch-form');
    const fetchBtn = document.getElementById('fetch-btn');
    const urlInput = document.getElementById('url');
    
    const metaPanel = document.getElementById('metadata-panel');
    const metaThumb = document.getElementById('meta-thumb');
    const metaTitle = document.getElementById('meta-title');
    const metaDuration = document.getElementById('meta-duration');
    
    const startBtn = document.getElementById('start-btn');
    const cancelMetaBtn = document.getElementById('cancel-meta-btn');
    
    const taskList = document.getElementById('task-list');
    const taskCount = document.getElementById('task-count');
    const template = document.getElementById('task-template');
    const powerOffBtn = document.getElementById('power-off-btn');
    
    let currentMeta = null;
    let pollInterval = null;
    let tasks = {}; // track DOM elements

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    const formatSelect = document.getElementById('format');
    const qualitySelect = document.getElementById('quality');
    const qualityLabel = document.querySelector('label[for="quality"]');

    function updateQualityOptions() {
        const format = formatSelect.value;
        const currentVal = qualitySelect.value;
        qualitySelect.innerHTML = '';
        
        if (format === 'audio') {
            qualityLabel.textContent = 'AUD.BITRATE';
            qualitySelect.innerHTML = `
                <option value="flac">FLAC (LOSSLESS)</option>
                <option value="mp3_320">MP3_320KBPS</option>
                <option value="mp3_192">MP3_192KBPS</option>
            `;
        } else {
            qualityLabel.textContent = 'RES.MATRIX';
            qualitySelect.innerHTML = `
                <option value="best">MAX_AVAILABLE</option>
                <option value="1080p">1080P_CAP</option>
                <option value="720p">720P_CAP</option>
            `;
        }
        
        if (Array.from(qualitySelect.options).some(o => o.value === currentVal)) {
            qualitySelect.value = currentVal;
        }
    }
    
    formatSelect.addEventListener('change', updateQualityOptions);

    // Load preferences
    if (localStorage.getItem('vdwn_format')) formatSelect.value = localStorage.getItem('vdwn_format');
    updateQualityOptions();
    if (localStorage.getItem('vdwn_quality')) {
        const savedQ = localStorage.getItem('vdwn_quality');
        if (Array.from(qualitySelect.options).some(o => o.value === savedQ)) {
            qualitySelect.value = savedQ;
        }
    }
    if (localStorage.getItem('vdwn_subfolder')) document.getElementById('subfolder').value = localStorage.getItem('vdwn_subfolder');
    
    // Auto-trigger fetch on paste
    urlInput.addEventListener('paste', () => {
        setTimeout(() => {
            const pastedUrl = urlInput.value.trim();
            urlInput.value = pastedUrl; // Sanitize input box
            if (pastedUrl.startsWith('http')) {
                fetchBtn.click();
            }
        }, 50);
    });

    // Fetch Metadata
    fetchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value;
        
        fetchBtn.innerHTML = '<span>FETCHING...</span>';
        fetchBtn.disabled = true;
        
        try {
            const res = await fetch('/api/fetch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.title && !data.error) {
                    currentMeta = data;
                    currentMeta.url = url;
            
                    if (data.is_playlist) {
                        metaTitle.textContent = `[PLAYLIST] ${data.title}`;
                        metaDuration.textContent = `${data.entries.length} Videos`;
                        metaThumb.style.display = 'none';
                    } else {
                        metaTitle.textContent = data.title;
                        
                        if (data.duration) {
                            const d = Number(data.duration);
                            const h = Math.floor(d / 3600);
                            const m = Math.floor(d % 3600 / 60);
                            const s = Math.floor(d % 3600 % 60);
                            metaDuration.textContent = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
                        } else {
                            metaDuration.textContent = 'UNKNOWN / LIVE';
                        }
                        
                        if (data.thumbnail) {
                            metaThumb.src = data.thumbnail;
                            metaThumb.style.display = 'block';
                        } else {
                            metaThumb.style.display = 'none';
                        }
                    }
            
                    fetchForm.classList.add('hidden');
                    metaPanel.classList.remove('hidden');
                } else {
                    showToast('[ERR] ' + (data.error || 'Failed to fetch'));
                }
            } else {
                showToast('[ERR] ' + (data.error || 'Server returned an error status.'));
            }
        } catch (err) {
            showToast('[ERR] Network error connecting to server');
        }
        
        fetchBtn.innerHTML = '<span>FETCH_METADATA</span>';
        fetchBtn.disabled = false;
    });
    
    // Abort Fetch
    cancelMetaBtn.addEventListener('click', () => {
        metaPanel.classList.add('hidden');
        fetchForm.classList.remove('hidden');
        currentMeta = null;
    });
    
    // Press Enter to submit
    document.getElementById('subfolder').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startBtn.click();
    });
    
    // Start Download
    startBtn.addEventListener('click', async () => {
        const quality = document.getElementById('quality').value;
        const format = document.getElementById('format').value;
        const subfolder = document.getElementById('subfolder').value.trim();
        
        if (subfolder.startsWith('http')) {
            showToast('[ERR] URL pasted into subfolder box!');
            return;
        }
        
        startBtn.textContent = 'INITIATING...';
        startBtn.disabled = true;
        
        
        try {
            localStorage.setItem('vdwn_quality', quality);
            localStorage.setItem('vdwn_format', format);
            localStorage.setItem('vdwn_subfolder', subfolder);

            if (currentMeta.is_playlist && currentMeta.entries && currentMeta.entries.length > 0) {
                // Handle Playlist: queue each video individually
                for (let i = 0; i < currentMeta.entries.length; i++) {
                    const entry = currentMeta.entries[i];
                    const entryPayload = {
                        url: entry.url,
                        title: entry.title,
                        thumbnail: '', // Avoid massive thumbnail loading overhead
                        quality, format, subfolder
                    };
                    
                    const res = await fetch('/api/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entryPayload)
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        if (data.task_id) {
                            createTaskCard(data.task_id, entryPayload);
                        }
                    }
                    
                    // Add a tiny delay to prevent slamming the backend
                    await new Promise(r => setTimeout(r, 100));
                }
                showToast(`[SYS] Queued ${currentMeta.entries.length} tasks from playlist.`);
            } else {
                // Handle Single Video
                const payload = {
                    ...currentMeta, quality, format, subfolder
                };
                
                const res = await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await res.json();
                if (data.task_id) {
                    createTaskCard(data.task_id, payload);
                } else {
                    showToast('[ERR] ' + data.error);
                }
            }
            
            // Reset UI
            metaPanel.classList.add('hidden');
            fetchForm.classList.remove('hidden');
            urlInput.value = '';
            urlInput.focus();
            if(!pollInterval) startPolling();
            
        } catch (err) {
            showToast('[ERR] Network error');
        }
        
        startBtn.textContent = 'START_ACQUIRE';
        startBtn.disabled = false;
    });
    
    function createTaskCard(id, data) {
        if(tasks[id]) return;
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.task-card');
        card.id = `task-${id}`;
        
        const titleEl = card.querySelector('.task-title');
        titleEl.textContent = data.title;
        titleEl.title = data.title; // Native tooltip for truncated titles
        
        card.querySelector('.task-thumb').src = data.thumbnail || '';
        
        card.querySelector('.task-cancel').addEventListener('click', () => cancelTask(id));
        card.querySelector('.task-open').addEventListener('click', async () => {
            try { await fetch(`/api/open/${id}`, { method: 'POST' }); } catch (e) {}
        });
        
        card.querySelector('.task-retry').addEventListener('click', async () => {
            const payload = {
                url: data.url, title: data.title, thumbnail: data.thumbnail,
                quality: data.quality, format: data.format, subfolder: data.subfolder
            };
            try {
                await fetch(`/api/dismiss/${id}`, { method: 'POST' });
                card.remove(); delete tasks[id]; updateCount();
                
                const res = await fetch('/api/download', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const resData = await res.json();
                if (resData.task_id) {
                    createTaskCard(resData.task_id, payload);
                    if(!pollInterval) startPolling();
                }
            } catch(e) {}
        });
        
        taskList.prepend(card);
        tasks[id] = card;
        updateCount();
    }
    
    async function cancelTask(id) {
        const card = tasks[id];
        const isActive = card.classList.contains('status-downloading') || card.classList.contains('status-starting') || card.classList.contains('status-processing');
        
        if (isActive) {
            if(!confirm('Abort this task?')) return;
            try { await fetch(`/api/cancel/${id}`, { method: 'POST' }); } catch (e) {}
        } else {
            // Dismiss completed/errored task from UI
            try { await fetch(`/api/dismiss/${id}`, { method: 'POST' }); } catch (e) {}
            card.remove();
            delete tasks[id];
            updateCount();
        }
    }
    
    function startPolling() {
        pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/status');
                if(!res.ok) return;
                const activeTasks = await res.json();
                
                let anyActive = false;
                
                for (const [id, data] of Object.entries(activeTasks)) {
                    if (!tasks[id]) createTaskCard(id, data);
                    
                    const card = tasks[id];
                    card.className = `task-card status-${data.status}`;
                    
                    card.querySelector('.task-status').textContent = data.status.toUpperCase();
                    
                    if (['queued', 'starting', 'downloading', 'processing'].includes(data.status)) {
                        anyActive = true;
                    }
                    
                    if (data.status === 'downloading') {
                        if (data.progress === 'LIVE') {
                            card.querySelector('.progress-bar-fill').style.width = '100%';
                            card.querySelector('.progress-bar-fill').style.background = 'var(--accent-blue)';
                            card.querySelector('.progress-bar-fill').style.animation = 'blink 2s step-end infinite';
                        } else {
                            card.querySelector('.progress-bar-fill').style.width = (data.progress || '0%').replace('%', '') + '%';
                            card.querySelector('.progress-bar-fill').style.background = '';
                            card.querySelector('.progress-bar-fill').style.animation = '';
                        }
                        card.querySelector('.t-spd').textContent = data.speed || '--';
                        card.querySelector('.t-eta').textContent = data.eta || '--';
                        card.querySelector('.t-size').textContent = data.size || '--';
                        card.querySelector('.t-prg').textContent = data.progress || '0%';
                    } else if (data.status === 'processing') {
                        card.querySelector('.progress-bar-fill').style.width = '100%';
                        card.querySelector('.task-retry').classList.add('hidden');
                        card.querySelector('.t-spd').textContent = '';
                        card.querySelector('.t-eta').textContent = '';
                        card.querySelector('.t-size').textContent = '';
                        card.querySelector('.t-prg').textContent = '100%';
                    } else if (data.status === 'completed') {
                        card.querySelector('.progress-bar-fill').style.width = '100%';
                        card.querySelector('.task-open').classList.remove('hidden');
                        card.querySelector('.task-retry').classList.add('hidden');
                        card.querySelector('.t-spd').textContent = '';
                        card.querySelector('.t-eta').textContent = '';
                        card.querySelector('.t-size').textContent = '';
                        card.querySelector('.t-prg').textContent = '100%';
                    } else if (data.status === 'error' || data.status === 'cancelled') {
                        card.querySelector('.task-open').classList.add('hidden');
                        card.querySelector('.task-retry').classList.remove('hidden');
                        card.querySelector('.t-spd').textContent = '';
                        card.querySelector('.t-eta').textContent = '';
                        card.querySelector('.t-size').textContent = '';
                        card.querySelector('.t-prg').textContent = data.status.toUpperCase();
                    } else if (data.status === 'starting' || data.status === 'queued') {
                        card.querySelector('.task-retry').classList.add('hidden');
                        card.querySelector('.t-spd').textContent = '--';
                        card.querySelector('.t-eta').textContent = '--';
                        card.querySelector('.t-size').textContent = '--';
                        card.querySelector('.t-prg').textContent = '0%';
                    }
                }
                updateCount();
                
                if (!anyActive) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            } catch (err) {}
        }, 1000);
    }
    
    function updateCount() {
        taskCount.textContent = Object.keys(tasks).length;
    }
    
    // Initial fetch to restore state if refreshed
    fetch('/api/status').then(res => res.json()).then(data => {
        if(Object.keys(data).length > 0) {
            for (const [id, taskData] of Object.entries(data)) {
                createTaskCard(id, taskData);
            }
            startPolling();
        }
    }).catch(e=>{});
    
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        for (const [id, card] of Object.entries(tasks)) {
            const isActive = card.classList.contains('status-downloading') || card.classList.contains('status-starting') || card.classList.contains('status-processing') || card.classList.contains('status-queued');
            if (!isActive) {
                try { fetch(`/api/dismiss/${id}`, { method: 'POST' }); } catch (e) {}
                card.remove();
                delete tasks[id];
            }
        }
        updateCount();
    });

    document.getElementById('cancel-all-btn').addEventListener('click', async () => {
        if(confirm('HALT ALL active and queued tasks?')) {
            try { await fetch('/api/cancel_all', { method: 'POST' }); } catch(e) {}
        }
    });

    powerOffBtn.addEventListener('click', async () => {
        if(confirm('INITIATE SYSTEM SHUTDOWN?')) {
            try { await fetch('/api/shutdown', { method: 'POST' }); } catch (e) {}
            
            // Attempt to close the tab
            window.close();
            
            // Fallback UI in case the browser blocks the window.close() command
            document.querySelector('.main-layout').classList.add('hidden');
            document.getElementById('offline-container').classList.remove('hidden');
            powerOffBtn.style.display = 'none';
            if(pollInterval) clearInterval(pollInterval);
        }
    });
});

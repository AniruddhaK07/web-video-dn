document.addEventListener('DOMContentLoaded', () => {
    const fetchForm    = document.getElementById('fetch-form');
    const fetchBtn     = document.getElementById('fetch-btn');
    const urlInput     = document.getElementById('url');

    const metaPanel    = document.getElementById('metadata-panel');
    const metaThumb    = document.getElementById('meta-thumb');
    const metaTitle    = document.getElementById('meta-title');
    const metaDuration = document.getElementById('meta-duration');

    const startBtn      = document.getElementById('start-btn');
    const cancelMetaBtn = document.getElementById('cancel-meta-btn');

    const taskList   = document.getElementById('task-list');
    const taskCount  = document.getElementById('task-count');
    const template   = document.getElementById('task-template');
    const powerOffBtn = document.getElementById('power-off-btn');
    const emptyState = document.getElementById('empty-state');

    let currentMeta = null;
    let pollTimeout  = null;  // setTimeout-based, so we can adapt the interval
    let tasks        = {};
    const originalTitle = document.title;

    // ── Custom Confirm Modal ──────────────────────────────────────────────────
    function showConfirm(message) {
        return new Promise(resolve => {
            const overlay = document.getElementById('confirm-modal');
            document.getElementById('modal-message').textContent = message;
            overlay.classList.remove('hidden');

            // Clone nodes to remove any previous event listeners
            const oldConfirm = document.getElementById('modal-confirm-btn');
            const oldCancel  = document.getElementById('modal-cancel-btn');
            const newConfirm = oldConfirm.cloneNode(true);
            const newCancel  = oldCancel.cloneNode(true);
            oldConfirm.replaceWith(newConfirm);
            oldCancel.replaceWith(newCancel);

            function cleanup(result) {
                overlay.classList.add('hidden');
                resolve(result);
            }

            document.getElementById('modal-confirm-btn').addEventListener('click', () => cleanup(true));
            document.getElementById('modal-cancel-btn').addEventListener('click',  () => cleanup(false));
        });
    }

    // ── Toast (color-coded) ───────────────────────────────────────────────────
    // type: 'error' (red, default) | 'success' (green) | 'info' (blue)
    function showToast(msg, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    }

    // ── Human-readable error parser ───────────────────────────────────────────
    function cleanError(raw) {
        if (!raw) return 'UNKNOWN ERROR';
        if (/sign in|bot|verify/i.test(raw))          return 'BOT BLOCK: Place cookies.txt in project root to authenticate.';
        if (/private/i.test(raw))                     return 'ACCESS DENIED: Video is set to private.';
        if (/copyright|blocked/i.test(raw))           return 'CONTENT BLOCKED: Copyright restriction in your region.';
        if (/not available|unavailable/i.test(raw))   return 'TARGET UNAVAILABLE: Content may have been removed.';
        if (/disk|no space|insufficient/i.test(raw))  return 'DISK FULL: Not enough space for this download.';
        if (/network|connection|timeout/i.test(raw))  return 'NETWORK ERROR: Connection lost or timed out.';
        if (/cannot create|output directory/i.test(raw)) return 'DIR ERROR: Cannot create output folder. Check permissions.';
        // Strip ugly yt-dlp prefix like "ERROR: [youtube] videoId:"
        return raw.replace(/ERROR:\s*\[.*?\]\s*[\w-]+:\s*/i, '').substring(0, 120);
    }

    // ── API Helper (includes CSRF header) ─────────────────────────────────────
    function apiPost(url, body = null) {
        const opts = {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        return fetch(url, opts);
    }

    // ── Format / Quality selects ──────────────────────────────────────────────
    const formatSelect  = document.getElementById('format');
    const qualitySelect = document.getElementById('quality');
    const qualityLabel  = document.querySelector('label[for="quality"]');

    function updateQualityOptions() {
        const format     = formatSelect.value;
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

    // Restore saved preferences
    if (localStorage.getItem('vdwn_format')) formatSelect.value = localStorage.getItem('vdwn_format');
    updateQualityOptions();
    if (localStorage.getItem('vdwn_quality')) {
        const savedQ = localStorage.getItem('vdwn_quality');
        if (Array.from(qualitySelect.options).some(o => o.value === savedQ)) qualitySelect.value = savedQ;
    }
    if (localStorage.getItem('vdwn_subfolder')) document.getElementById('subfolder').value = localStorage.getItem('vdwn_subfolder');

    // Auto-trigger fetch on paste
    urlInput.addEventListener('paste', () => {
        setTimeout(() => {
            const pastedUrl = urlInput.value.trim();
            urlInput.value = pastedUrl;
            if (pastedUrl.startsWith('http') && urlInput.validity.valid) fetchBtn.click();
        }, 50);
    });

    // ── Fetch Metadata ────────────────────────────────────────────────────────
    fetchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value;

        fetchBtn.innerHTML = '<span>FETCHING...</span>';
        fetchBtn.disabled  = true;

        try {
            const res  = await apiPost('/api/fetch', { url });
            const data = await res.json();

            if (res.ok && data.title && !data.error) {
                currentMeta     = data;
                currentMeta.url = url;

                if (data.is_playlist) {
                    metaTitle.textContent    = `[PLAYLIST] ${data.title}`;
                    metaDuration.textContent = `${data.entries.length} Videos`;
                    metaThumb.style.display  = 'none';
                } else {
                    metaTitle.textContent = data.title;

                    if (data.duration) {
                        const d = Number(data.duration);
                        const h = Math.floor(d / 3600);
                        const m = Math.floor((d % 3600) / 60);
                        const s = Math.floor(d % 60);
                        metaDuration.textContent = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
                    } else {
                        metaDuration.textContent = 'UNKNOWN / LIVE';
                    }

                    if (data.thumbnail) {
                        metaThumb.src           = data.thumbnail;
                        metaThumb.style.display = 'block';
                    } else {
                        metaThumb.style.display = 'none';
                    }
                }

                fetchForm.classList.add('hidden');
                metaPanel.classList.remove('hidden');
            } else {
                showToast('[ERR] ' + cleanError(data.error || 'Failed to fetch'));
            }
        } catch (err) {
            showToast('[ERR] Network error connecting to server');
        }

        fetchBtn.innerHTML = '<span>FETCH_METADATA</span>';
        fetchBtn.disabled  = false;
    });

    // ── Abort metadata panel ──────────────────────────────────────────────────
    cancelMetaBtn.addEventListener('click', () => {
        metaPanel.classList.add('hidden');
        fetchForm.classList.remove('hidden');
        urlInput.value = '';  // Clear input on abort
        currentMeta    = null;
    });

    // Press Enter in subfolder to submit
    document.getElementById('subfolder').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startBtn.click();
    });

    // ── Start Download ────────────────────────────────────────────────────────
    startBtn.addEventListener('click', async () => {
        const quality   = document.getElementById('quality').value;
        const format    = document.getElementById('format').value;
        const subfolder = document.getElementById('subfolder').value.trim();

        if (subfolder.startsWith('http')) {
            showToast('[ERR] URL pasted into subfolder box!');
            return;
        }

        startBtn.textContent = 'INITIATING...';
        startBtn.disabled    = true;

        try {
            localStorage.setItem('vdwn_quality',   quality);
            localStorage.setItem('vdwn_format',    format);
            localStorage.setItem('vdwn_subfolder', subfolder);

            if (currentMeta.is_playlist && currentMeta.entries?.length > 0) {
                // Batch-submit playlist in groups of 10 for speed without overwhelming backend
                const BATCH = 10;
                let queued  = 0;
                let failed  = 0;

                for (let i = 0; i < currentMeta.entries.length; i += BATCH) {
                    const batch = currentMeta.entries.slice(i, i + BATCH);

                    await Promise.all(batch.map(async (entry) => {
                        const payload = { url: entry.url, title: entry.title, thumbnail: '', quality, format, subfolder };
                        try {
                            const res = await apiPost('/api/download', payload);
                            if (res.ok) {
                                const data = await res.json();
                                if (data.task_id) { createTaskCard(data.task_id, payload); queued++; }
                                else { failed++; }
                            } else { failed++; }
                        } catch(e) { failed++; }
                    }));

                    // Brief pause between batches
                    if (i + BATCH < currentMeta.entries.length) {
                        await new Promise(r => setTimeout(r, 150));
                    }
                }

                showToast(`[SYS] Queued ${queued} tasks from playlist.` + (failed ? ` ${failed} failed.` : ''), failed ? 'info' : 'success');
            } else {
                // Single video
                const payload = { ...currentMeta, quality, format, subfolder };
                const res     = await apiPost('/api/download', payload);
                const data = await res.json();

                if (data.task_id) {
                    createTaskCard(data.task_id, payload);
                    showToast('[SYS] Download queued.', 'success');
                } else {
                    showToast('[ERR] ' + cleanError(data.error));
                }
            }

            // Reset UI
            metaPanel.classList.add('hidden');
            fetchForm.classList.remove('hidden');
            urlInput.value = '';
            urlInput.focus();
            if (!pollTimeout) startPolling();

        } catch (err) {
            showToast('[ERR] Network error');
        }

        startBtn.textContent = 'START_ACQUIRE';
        startBtn.disabled    = false;
    });

    // ── Task Card Creation ────────────────────────────────────────────────────
    function createTaskCard(id, data) {
        if (tasks[id]) return;

        // Hide empty state as soon as first task arrives
        if (emptyState) emptyState.style.display = 'none';

        const clone = template.content.cloneNode(true);
        const card  = clone.querySelector('.task-card');
        card.id     = `task-${id}`;

        const titleEl      = card.querySelector('.task-title');
        titleEl.textContent = data.title;
        titleEl.title       = data.title;  // native tooltip for long titles

        const thumbEl = card.querySelector('.task-thumb');
        if (data.thumbnail) { thumbEl.src = data.thumbnail; }
        else { thumbEl.style.display = 'none'; }

        card.querySelector('.task-cancel').addEventListener('click', () => cancelTask(id));

        card.querySelector('.task-open').addEventListener('click', async () => {
            try { await apiPost(`/api/open/${id}`); } catch (e) {}
        });

        card.querySelector('.task-retry').addEventListener('click', async () => {
            const payload = {
                url: data.url, title: data.title, thumbnail: data.thumbnail,
                quality: data.quality, format: data.format, subfolder: data.subfolder
            };
            try {
                await apiPost(`/api/dismiss/${id}`);
                card.remove(); delete tasks[id]; updateCount(); checkEmptyState();

                const res    = await apiPost('/api/download', payload);
                const resData = await res.json();
                if (resData.task_id) {
                    createTaskCard(resData.task_id, payload);
                    if (!pollTimeout) startPolling();
                }
            } catch(e) {}
        });

        taskList.prepend(card);
        tasks[id] = card;
        updateCount();
    }

    async function cancelTask(id) {
        const card     = tasks[id];
        const isActive = ['status-downloading', 'status-starting', 'status-processing']
            .some(cls => card.classList.contains(cls));

        if (isActive) {
            const confirmed = await showConfirm('ABORT THIS TASK?');
            if (!confirmed) return;
            try { await apiPost(`/api/cancel/${id}`); } catch (e) {}
        } else {
            try { await apiPost(`/api/dismiss/${id}`); } catch (e) {}
            card.remove();
            delete tasks[id];
            updateCount();
            checkEmptyState();
        }
    }

    // ── Adaptive Polling (setTimeout-based, not setInterval) ─────────────────
    // Uses 1000ms when any task is actively downloading/processing.
    // Slows to 2000ms when all tasks are idle (queued/starting).
    function startPolling() {
        function schedulePoll() {
            const hasActive = Object.values(tasks).some(card =>
                card.classList.contains('status-downloading') || card.classList.contains('status-processing')
            );
            const delay = hasActive ? 1000 : 2000;

            pollTimeout = setTimeout(async () => {
                try {
                    const res = await fetch('/api/status');
                    if (!res.ok) { schedulePoll(); return; }
                    const serverTasks = await res.json();

                    let anyActive = false;

                    for (const [id, data] of Object.entries(serverTasks)) {
                        if (!tasks[id]) createTaskCard(id, data);

                        const card = tasks[id];
                        const newClass = `task-card status-${data.status}`;
                        if (card.className !== newClass) card.className = newClass;
                        card.querySelector('.task-status').textContent = data.status.toUpperCase();

                        if (['queued', 'starting', 'downloading', 'processing'].includes(data.status)) {
                            anyActive = true;
                        }

                        if (data.status === 'downloading') {
                            if (data.progress === 'LIVE') {
                                card.querySelector('.progress-bar-fill').style.cssText =
                                    'width:100%;background:var(--accent-blue);animation:blink 2s step-end infinite;';
                            } else {
                                card.querySelector('.progress-bar-fill').style.cssText =
                                    `width:${(data.progress || '0%').replace('%', '')}%;background:'';animation:'';`;
                            }
                            card.querySelector('.t-spd').textContent  = data.speed    || '--';
                            card.querySelector('.t-eta').textContent  = data.eta      || '--';
                            card.querySelector('.t-size').textContent = data.size     || '--';
                            card.querySelector('.t-prg').textContent  = data.progress || '0%';

                        } else if (data.status === 'processing') {
                            card.querySelector('.progress-bar-fill').style.width = '100%';
                            card.querySelector('.task-retry').classList.add('hidden');
                            card.querySelector('.t-spd').textContent  = '';
                            card.querySelector('.t-eta').textContent  = '';
                            card.querySelector('.t-size').textContent = '';
                            card.querySelector('.t-prg').textContent  = '100%';

                        } else if (data.status === 'completed') {
                            card.querySelector('.progress-bar-fill').style.width = '100%';
                            card.querySelector('.task-open').classList.remove('hidden');
                            card.querySelector('.task-retry').classList.add('hidden');
                            card.querySelector('.task-status').textContent = data.out_dir
                                ? `SAVED → ${data.out_dir.split(/[\/\\]/).slice(-2).join('/')}`
                                : 'COMPLETED';
                            card.querySelector('.t-spd').textContent  = '';
                            card.querySelector('.t-eta').textContent  = '';
                            card.querySelector('.t-size').textContent = '';
                            card.querySelector('.t-prg').textContent  = '100%';

                        } else if (data.status === 'error' || data.status === 'cancelled') {
                            card.querySelector('.task-open').classList.add('hidden');
                            card.querySelector('.task-retry').classList.remove('hidden');
                            card.querySelector('.t-spd').textContent  = '';
                            card.querySelector('.t-eta').textContent  = '';
                            card.querySelector('.t-size').textContent = '';
                            card.querySelector('.t-prg').textContent  = data.status.toUpperCase();
                            // Show cleaned error in the status line
                            if (data.error_message) {
                                card.querySelector('.task-status').textContent = cleanError(data.error_message);
                            }

                        } else if (data.status === 'starting' || data.status === 'queued') {
                            card.querySelector('.task-retry').classList.add('hidden');
                            card.querySelector('.t-spd').textContent  = '--';
                            card.querySelector('.t-eta').textContent  = '--';
                            card.querySelector('.t-size').textContent = '--';
                            card.querySelector('.t-prg').textContent  = '0%';
                        }
                    }

                    updateCount();

                    if (anyActive) {
                        schedulePoll();  // Keep polling while there's work to do
                    } else {
                        pollTimeout = null;  // Stop polling — all done
                    }
                } catch (err) {
                    schedulePoll();  // Retry on network hiccup
                }
            }, delay);
        }

        schedulePoll();
    }

    function updateCount() {
        const total = Object.keys(tasks).length;
        taskCount.textContent = total;
        updateTitle();
    }

    function updateTitle() {
        const activeCount = Object.values(tasks).filter(card =>
            ['status-downloading', 'status-processing', 'status-queued', 'status-starting']
                .some(cls => card.classList.contains(cls))
        ).length;
        document.title = activeCount > 0
            ? `(${activeCount}\u2193) ${originalTitle}`
            : originalTitle;
    }

    function checkEmptyState() {
        if (emptyState && Object.keys(tasks).length === 0) {
            emptyState.style.display = 'flex';
        }
    }

    // Restore state if page is refreshed while downloads are running
    fetch('/api/status').then(res => res.json()).then(data => {
        if (Object.keys(data).length > 0) {
            for (const [id, taskData] of Object.entries(data)) createTaskCard(id, taskData);
            startPolling();
        }
    }).catch(() => {});

    // ── Keyboard Shortcuts ────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Escape: close metadata panel or modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('confirm-modal');
            if (!modal.classList.contains('hidden')) {
                document.getElementById('modal-cancel-btn').click();
            } else if (!metaPanel.classList.contains('hidden')) {
                cancelMetaBtn.click();
            }
        }
        // Ctrl+V: focus URL input when not already in an input
        if (e.ctrlKey && e.key === 'v' && document.activeElement.tagName !== 'INPUT') {
            urlInput.focus();
        }
    });

    // ── Global Controls ───────────────────────────────────────────────────────
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        for (const [id, card] of Object.entries(tasks)) {
            const isActive = ['status-downloading', 'status-starting', 'status-processing', 'status-queued']
                .some(cls => card.classList.contains(cls));
            if (!isActive) {
                try { apiPost(`/api/dismiss/${id}`); } catch (e) {}
                card.remove();
                delete tasks[id];
            }
        }
        updateCount();
        checkEmptyState();
    });

    document.getElementById('cancel-all-btn').addEventListener('click', async () => {
        const confirmed = await showConfirm('HALT ALL ACTIVE AND QUEUED TASKS?');
        if (confirmed) {
            try { await apiPost('/api/cancel_all'); } catch(e) {}
        }
    });

    powerOffBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm('INITIATE SYSTEM SHUTDOWN?');
        if (confirmed) {
            try { await apiPost('/api/shutdown'); } catch (e) {}
            document.querySelector('.main-layout').classList.add('hidden');
            document.getElementById('offline-container').classList.remove('hidden');
            if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
        }
    });
});

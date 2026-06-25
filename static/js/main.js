/**
 * SYS.DWN // Frontend Logic
 * Handles asynchronous polling, UI state management, and server communication.
 */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const formContainer = document.querySelector('.download-form');
    const progressContainer = document.getElementById('progress-container');
    const successContainer = document.getElementById('success-container');
    const errorContainer = document.getElementById('error-container');
    
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const speedEl = document.getElementById('speed');
    const etaEl = document.getElementById('eta');
    const percentEl = document.getElementById('percent');
    
    const resetBtn = document.getElementById('reset-btn');
    const retryBtn = document.getElementById('retry-btn');
    const powerOffBtn = document.getElementById('power-off-btn');
    const offlineContainer = document.getElementById('offline-container');
    
    let pollInterval = null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const url = document.getElementById('url').value;
        const quality = document.getElementById('quality').value;
        const format = document.getElementById('format').value;
        
        // UI transitions
        formContainer.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        statusText.textContent = 'Initializing...';
        
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, quality, format })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                pollStatus(data.task_id);
            } else {
                showError(data.error || 'Failed to start download');
            }
        } catch (err) {
            showError('Network error connecting to server');
        }
    });
    
    function pollStatus(taskId) {
        pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/status/${taskId}`);
                const data = await response.json();
                
                if (response.ok) {
                    updateProgressUI(data);
                    
                    if (data.status === 'completed') {
                        clearInterval(pollInterval);
                        showSuccess(data.filename);
                    } else if (data.status === 'error') {
                        clearInterval(pollInterval);
                        showError(data.error_message);
                    }
                }
            } catch (err) {
                console.error('Error polling status:', err);
            }
        }, 1000);
    }
    
    function updateProgressUI(data) {
        if (data.status === 'downloading') {
            statusText.textContent = 'Downloading...';
            progressBar.style.width = data.progress.replace('%', '') + '%';
            percentEl.textContent = data.progress;
            speedEl.textContent = data.speed;
            etaEl.textContent = data.eta;
        } else if (data.status === 'processing') {
            statusText.textContent = 'MULTIPLEXING...';
            progressBar.style.width = '100%';
            speedEl.textContent = '--';
            etaEl.textContent = '--';
        }
    }
    
    function showSuccess(filename) {
        progressContainer.classList.add('hidden');
        successContainer.classList.remove('hidden');
        document.getElementById('success-filename').textContent = filename ? filename.split('/').pop().split('\\').pop() : 'Download completed';
    }
    
    function showError(msg) {
        progressContainer.classList.add('hidden');
        errorContainer.classList.remove('hidden');
        document.getElementById('error-message').textContent = msg;
    }
    
    function resetUI() {
        successContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        progressContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        form.reset();
    }
    
    resetBtn.addEventListener('click', resetUI);
    retryBtn.addEventListener('click', resetUI);

    powerOffBtn.addEventListener('click', async () => {
        if(confirm('INITIATE SYSTEM SHUTDOWN?')) {
            try {
                await fetch('/api/shutdown', { method: 'POST' });
            } catch (e) {} // Ignore connection drop error
            
            formContainer.classList.add('hidden');
            progressContainer.classList.add('hidden');
            successContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
            offlineContainer.classList.remove('hidden');
            
            powerOffBtn.style.display = 'none';
        }
    });
});

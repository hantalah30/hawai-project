// DOM Elements
const dropZone = document.getElementById('drop-zone');
const btnSelectPath = document.getElementById('btn-select-path');
const pathDisplay = document.getElementById('steam-path-display');
const btnRestartSteam = document.getElementById('btn-restart-steam');
const btnClearCache = document.getElementById('btn-clear-depotcache');
const btnClearMods = document.getElementById('btn-clear-mods');
const steamIndicator = document.getElementById('steam-indicator');
const steamStatusText = document.getElementById('steam-status-text');
const modCounterText = document.getElementById('mod-counter-text');
const statusBubble = document.getElementById('status-bubble');
const overlay = document.getElementById('setup-overlay');
const btnSetupPath = document.getElementById('btn-setup-path');
const historyList = document.getElementById('history-list');
const btnCheckUpdate = document.getElementById('btn-check-update');
const toggleRestart = document.getElementById('toggle-autorestart');

// Loading Sequence
setTimeout(() => {
    document.getElementById('boot-sequence').classList.add('done');
}, 1000);

// Auto Updater Listeners
btnCheckUpdate.addEventListener('click', () => {
    showToast('Mengecek versi terbaru...');
    window.electronAPI.checkUpdate();
});

window.electronAPI.onUpdateAvailable(() => {
    showToast('Update ditemukan! Sedang mengunduh di latar belakang...');
});

window.electronAPI.onUpdateDownloaded(() => {
    showToast('Update siap! Silakan Install sekarang.');
    const btnInstall = document.createElement('button');
    btnInstall.className = 'btn success w-full';
    btnInstall.style.backgroundColor = '#00e676';
    btnInstall.style.color = '#000';
    btnInstall.style.marginTop = '0.5rem';
    btnInstall.innerHTML = 'Install Update & Restart';
    btnInstall.onclick = () => window.electronAPI.installUpdate();
    document.querySelector('.action-list').appendChild(btnInstall);
});

// Toast Utility
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Bubble Utility
function updateBubble(type, message) {
    statusBubble.className = `status-bubble ${type}`;
    let icon = '';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '✕';
    else if (type === 'loading') icon = '↻';
    
    statusBubble.innerHTML = `<span>${icon}</span> ${message}`;
}

// Config Load
async function loadConfig() {
    const path = await window.electronAPI.getSteamPath();
    if (path) {
        pathDisplay.textContent = path;
        overlay.classList.remove('active');
    } else {
        pathDisplay.textContent = 'Belum diatur';
        overlay.classList.add('active');
    }
}
loadConfig();

// Setup paths
async function handlePathSelection() {
    const newPath = await window.electronAPI.selectSteamPath();
    if (newPath) {
        pathDisplay.textContent = newPath;
        overlay.classList.remove('active');
        showToast('Folder Steam berhasil disimpan');
    }
}
btnSelectPath.addEventListener('click', handlePathSelection);
btnSetupPath.addEventListener('click', handlePathSelection);

// Drop Zone Logic
dropZone.addEventListener('click', async () => {
    try {
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths && filePaths.length > 0) handleRawPaths(filePaths);
    } catch(err) { updateBubble('error', 'Gagal membuka dialog file: ' + err.message); }
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('active'); });

// 3D Tilt Logic
dropZone.addEventListener('mousemove', (e) => {
    const rect = dropZone.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xc = rect.width / 2;
    const yc = rect.height / 2;
    const rx = ((y - yc) / yc) * -5;
    const ry = ((x - xc) / xc) * 5;
    
    dropZone.style.setProperty('--rx', `${rx}deg`);
    dropZone.style.setProperty('--ry', `${ry}deg`);
    dropZone.style.setProperty('--px', `${x}px`);
    dropZone.style.setProperty('--py', `${y}px`);
});

dropZone.addEventListener('mouseleave', () => {
    dropZone.style.setProperty('--rx', `0deg`);
    dropZone.style.setProperty('--ry', `0deg`);
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    
    if (e.dataTransfer.files.length > 0) {
        const paths = Array.from(e.dataTransfer.files).map(f => window.electronAPI.getPathForFile(f)).filter(Boolean);
        if (paths.length > 0) handleRawPaths(paths);
        else updateBubble('error', 'Gagal membaca path file. Coba klik area drop ini.');
    }
});

function addHistoryItem(file) {
    const emptyMsg = document.querySelector('.history-empty');
    if (emptyMsg) emptyMsg.remove();

    const item = document.createElement('div');
    item.className = 'history-item';
    
    const iconStr = file.type === 'lua' 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;

    item.innerHTML = `
        <div class="file-name">${iconStr} ${file.name}</div>
        <div class="tag ${file.type}">${file.type}</div>
    `;
    historyList.prepend(item);
}

async function handleRawPaths(files) {
    if (!files || files.length === 0) return;
    try {
        updateBubble('loading', `Menginjeksi ${files.length} file...`);
        
        const result = await window.electronAPI.injectFiles(files);
        if (result.success) {
            updateBubble('success', `Berhasil (${result.files.length})`);
            result.files.forEach(f => addHistoryItem(f));
            showToast('File berhasil masuk!');

            // Auto-restart if toggle is on
            if (toggleRestart.checked) {
                showToast('Auto-Restarting Steam...');
                window.electronAPI.restartSteam();
            } else {
                showToast('Jangan lupa Restart Steam Anda.');
            }
        } else {
            updateBubble('error', 'Injeksi sebagian gagal');
            showToast(result.message);
        }
    } catch (err) {
        updateBubble('error', 'Fatal Error');
        showToast(err.message);
    }
}

// Steam Polling
setInterval(async () => {
    try {
        const isRunning = await window.electronAPI.checkSteamStatus();
        if (isRunning) {
            steamIndicator.className = 'status-indicator online';
            steamStatusText.textContent = 'Berjalan';
        } else {
            steamIndicator.className = 'status-indicator offline';
            steamStatusText.textContent = 'Mati';
        }

        // Poll Mod Counter
        const totalMods = await window.electronAPI.countActiveMods();
        modCounterText.textContent = `${totalMods} Mod Aktif`;
    } catch(e) {}
}, 3000);

// Utilities
btnRestartSteam.addEventListener('click', async () => {
    const originalContent = btnRestartSteam.innerHTML;
    btnRestartSteam.innerHTML = 'Memproses...';
    try {
        const res = await window.electronAPI.restartSteam();
        showToast(res.message);
    } catch(e) { showToast('Gagal restart: ' + e.message); }
    btnRestartSteam.innerHTML = originalContent;
});

btnClearCache.addEventListener('click', async () => {
    try {
        const res = await window.electronAPI.clearDepotcache();
        showToast(res.message);
    } catch(e) { showToast('Gagal bersihkan depotcache: ' + e.message); }
});

btnClearMods.addEventListener('click', async () => {
    try {
        const res = await window.electronAPI.clearMods();
        showToast(res.message);
    } catch(e) { showToast('Gagal hapus mods: ' + e.message); }
});

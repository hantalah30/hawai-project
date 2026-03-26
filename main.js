const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'steam-injector-config.json');

function getConfig() {
    try { if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
    catch (e) { console.error('Failed to read config', e); }
    return { steamPath: null };
}

function saveConfig(config) {
    try { fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8'); }
    catch (e) { console.error('Failed to save config', e); }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        autoHideMenuBar: true,
        resizable: true,
        backgroundColor: '#0a0a0c'
    });
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    
    // Check for updates natively
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        if (mainWindow) mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
        if (mainWindow) mainWindow.webContents.send('update-downloaded');
    });

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-steam-path', () => getConfig().steamPath);

ipcMain.handle('select-steam-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Pilih Folder Instalasi Steam' });
    if (!result.canceled && result.filePaths.length > 0) {
        const steamPath = result.filePaths[0];
        const config = getConfig();
        config.steamPath = steamPath;
        saveConfig(config);
        return steamPath;
    }
    return null;
});

ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Mod Files', extensions: ['lua', 'manifest'] }],
        title: 'Pilih file .lua atau .manifest'
    });
    return !result.canceled ? result.filePaths : [];
});

ipcMain.handle('inject-files', async (event, filePaths) => {
    const steamPath = getConfig().steamPath;
    if (!steamPath) return { success: false, message: 'Folder Steam belum diatur!' };

    const luaDestDir = path.join(steamPath, 'config', 'stplug-in');
    const manifestDestDir = path.join(steamPath, 'depotcache');
    let processedFiles = [];
    let ObjectFiles = [];
    let errors = [];

    if (!fs.existsSync(luaDestDir)) fs.mkdirSync(luaDestDir, { recursive: true });
    if (!fs.existsSync(manifestDestDir)) fs.mkdirSync(manifestDestDir, { recursive: true });

    for (const filePath of filePaths) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);
            if (ext === '.lua') {
                fs.copyFileSync(filePath, path.join(luaDestDir, fileName));
                processedFiles.push(fileName);
                ObjectFiles.push({ name: fileName, type: 'lua' });
            } else if (ext === '.manifest') {
                fs.copyFileSync(filePath, path.join(manifestDestDir, fileName));
                processedFiles.push(fileName);
                ObjectFiles.push({ name: fileName, type: 'manifest' });
            } else errors.push(`${fileName}: Ekstensi tidak valid.`);
        } catch (error) { errors.push(`${path.basename(filePath)}: ${error.message}`); }
    }

    if (errors.length > 0) return { success: false, message: `Injeksi error:\n` + errors.join('\n'), files: [] };
    return { success: true, message: `Injeksi berhasil (${processedFiles.length} file).`, files: ObjectFiles };
});

ipcMain.handle('restart-steam', async () => {
    const steamPath = getConfig().steamPath;
    if (!steamPath) return { success: false, message: 'Folder Steam belum diatur.' };
    return new Promise((resolve) => {
        exec('taskkill /F /IM steam.exe', (killErr) => {
            exec(`start "" "${path.join(steamPath, 'steam.exe')}"`, (startErr) => {
                if (startErr) resolve({ success: false, message: startErr.message });
                else resolve({ success: true, message: 'Steam berhasil direstart!' });
            });
        });
    });
});

ipcMain.handle('check-steam-status', async () => {
    return new Promise((resolve) => {
        exec('tasklist /FI "IMAGENAME eq steam.exe" /NH', (err, stdout) => {
            resolve(stdout.toLowerCase().includes('steam.exe'));
        });
    });
});

ipcMain.handle('clear-depotcache', async () => {
    const steamPath = getConfig().steamPath;
    if (!steamPath) return { success: false, message: 'Folder Steam belum diatur.' };
    try {
        const dest = path.join(steamPath, 'depotcache');
        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
        fs.mkdirSync(dest, { recursive: true });
        return { success: true, message: 'Depotcache berhasil dibersihkan!' };
    } catch(err) { return { success: false, message: err.message }; }
});

ipcMain.handle('clear-mods', async () => {
    const steamPath = getConfig().steamPath;
    if (!steamPath) return { success: false, message: 'Folder Steam belum diatur.' };
    try {
        const dest = path.join(steamPath, 'config', 'stplug-in');
        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
        fs.mkdirSync(dest, { recursive: true });
        return { success: true, message: 'Lua Mods berhasil dibersihkan!' };
    } catch(err) { return { success: false, message: err.message }; }
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('check-update', () => {
    autoUpdater.checkForUpdates();
});

ipcMain.handle('count-active-mods', () => {
    try {
        if (!fs.existsSync(configPath)) return 0;
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const stpluginPath = path.join(configData.steamPath, 'config', 'stplug-in');
        if (!fs.existsSync(stpluginPath)) return 0;
        const files = fs.readdirSync(stpluginPath);
        return files.filter(f => f.endsWith('.lua')).length;
    } catch(err) {
        return 0;
    }
});

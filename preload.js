const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSteamPath: () => ipcRenderer.invoke('get-steam-path'),
    selectSteamPath: () => ipcRenderer.invoke('select-steam-path'),
    selectFiles: () => ipcRenderer.invoke('select-files'),
    injectFiles: (filePaths) => ipcRenderer.invoke('inject-files', filePaths),
    restartSteam: () => ipcRenderer.invoke('restart-steam'),
    checkSteamStatus: () => ipcRenderer.invoke('check-steam-status'),
    clearDepotcache: () => ipcRenderer.invoke('clear-depotcache'),
    clearMods: () => ipcRenderer.invoke('clear-mods'),
    getPathForFile: (file) => webUtils ? webUtils.getPathForFile(file) : file.path,
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
    installUpdate: () => ipcRenderer.invoke('install-update')
});

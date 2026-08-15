const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { execFile } = require('node:child_process');
const path = require('node:path');
const cleaner = require('./cleaner');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#0b111c',
    title: 'Rice2k Computer Cleaner',
    icon: path.join(__dirname, '..', 'assets', 'rice2k-cleaner-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('health:scan', () => cleaner.healthScan());
ipcMain.handle('cleaner:scan', () => cleaner.scanCleanableLocations());
ipcMain.handle('cleaner:clean', (_event, locationIds) => cleaner.cleanLocations(locationIds));
ipcMain.handle('processes:list', () => cleaner.listBackgroundProcesses());
ipcMain.handle('processes:sleep', (_event, pid) => cleaner.sleepProcess(pid));
ipcMain.handle('startup:list', () => cleaner.listStartupItems());
ipcMain.handle('startup:open-settings', () => shell.openExternal('ms-settings:startupapps'));
ipcMain.handle('software:list-updates', () => cleaner.listAvailableUpdates());
ipcMain.handle('software:update', (_event, packageId) => cleaner.updateSoftwarePackage(packageId));
ipcMain.handle('drivers:list', () => cleaner.listDriverAges());
ipcMain.handle('apps:list-installed', () => cleaner.listInstalledApps());
ipcMain.handle('cloud:scan', () => cleaner.scanCloudDrives());
ipcMain.handle('folder:pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder to scan',
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});
ipcMain.handle('duplicates:scan', (_event, folderPath) => cleaner.scanDuplicates(folderPath));
ipcMain.handle('path:reveal', (_event, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('external:open', (_event, target) => {
  if (typeof target !== 'string') {
    return false;
  }

  if (target.startsWith('ms-settings:') || target.startsWith('ms-windows-store:')) {
    shell.openExternal(target);
    return true;
  }

  if (target === 'devmgmt.msc') {
    execFile('mmc.exe', ['devmgmt.msc'], { windowsHide: true });
    return true;
  }

  if (/^https?:\/\//i.test(target)) {
    shell.openExternal(target);
    return true;
  }

  shell.openPath(target);
  return true;
});

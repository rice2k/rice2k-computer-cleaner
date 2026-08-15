const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'screenshots');

const demoCleanable = {
  scannedAt: new Date().toISOString(),
  totalSize: 742 * 1024 * 1024,
  totalFiles: 1428,
  issueCount: 5,
  locations: [
    { id: 'user-temp', name: 'User temp files', group: 'System', icon: 'sparkles', fileCount: 420, scanned: 820, skipped: 4, size: 214 * 1024 * 1024, impact: 'Medium', paths: ['C:\\Users\\Rice2k\\AppData\\Local\\Temp'], files: [] },
    { id: 'windows-temp', name: 'Windows temp files', group: 'Windows', icon: 'windows', fileCount: 180, scanned: 330, skipped: 2, size: 96 * 1024 * 1024, impact: 'Low', paths: ['C:\\Windows\\Temp'], files: [] },
    { id: 'edge-cache', name: 'Microsoft Edge cache', group: 'Browser', icon: 'browser', fileCount: 310, scanned: 410, skipped: 0, size: 182 * 1024 * 1024, impact: 'Medium', paths: ['C:\\Users\\Rice2k\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache'], files: [] },
    { id: 'chrome-cache', name: 'Google Chrome cache', group: 'Browser', icon: 'browser', fileCount: 268, scanned: 392, skipped: 1, size: 140 * 1024 * 1024, impact: 'Medium', paths: ['C:\\Users\\Rice2k\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache'], files: [] },
    { id: 'thumbnail-cache', name: 'Thumbnail cache', group: 'Windows', icon: 'image', fileCount: 250, scanned: 294, skipped: 0, size: 110 * 1024 * 1024, impact: 'Low', paths: ['C:\\Users\\Rice2k\\AppData\\Local\\Microsoft\\Windows\\Explorer'], files: [] }
  ]
};

const demoProcesses = [
  { pid: 1201, name: 'Google Drive', path: 'C:\\Program Files\\Google\\Drive File Stream\\GoogleDriveFS.exe', command: '', memory: 420 * 1024 * 1024, impact: 'High' },
  { pid: 1202, name: 'Microsoft Office Click-to-Run', path: 'C:\\Program Files\\Common Files\\Microsoft Shared\\ClickToRun\\OfficeClickToRun.exe', command: '', memory: 330 * 1024 * 1024, impact: 'High' },
  { pid: 1203, name: 'Bonjour Service', path: 'C:\\Program Files\\Bonjour\\mDNSResponder.exe', command: '', memory: 132 * 1024 * 1024, impact: 'Medium' },
  { pid: 1204, name: 'Copilot', path: 'C:\\Program Files\\WindowsApps\\Microsoft.Copilot\\Copilot.exe', command: '', memory: 86 * 1024 * 1024, impact: 'Low' },
  { pid: 1205, name: 'Visual Studio Installer', path: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\setup.exe', command: '', memory: 74 * 1024 * 1024, impact: 'Low' },
  { pid: 1206, name: 'Zoom', path: 'C:\\Users\\Rice2k\\AppData\\Roaming\\Zoom\\bin\\Zoom.exe', command: '', memory: 68 * 1024 * 1024, impact: 'Low' }
];

const demoDrivers = [
  { name: 'Intel(R) Management Engine Interface #1', manufacturer: 'Intel', version: '2413.7.1.0', date: '2024-01-12', ageDays: 946, impact: 'Medium' },
  { name: 'ELAN PrecisionTouchpad Filter Driver', manufacturer: 'ELAN', version: '22.4.14.1', date: '2023-08-21', ageDays: 1090, impact: 'Medium' },
  { name: 'Microsoft UEFI-Compliant System', manufacturer: 'Microsoft', version: '10.0.26100', date: '2022-06-20', ageDays: 1517, impact: 'High' }
];

const demoStartup = [
  { name: 'GoogleDriveFS', command: 'GoogleDriveFS.exe --startup_mode', scope: 'Current user', registryPath: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', impact: 'High' },
  { name: 'OneDrive', command: 'OneDrive.exe /background', scope: 'Current user', registryPath: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', impact: 'Medium' }
];

const demoUpdates = {
  available: true,
  updates: [
    { name: 'PowerToys', id: 'Microsoft.PowerToys', version: '0.91.0', available: '0.92.1', source: 'winget' },
    { name: '7-Zip', id: '7zip.7zip', version: '24.09', available: '25.01', source: 'winget' }
  ]
};

const demoHealth = {
  scannedAt: new Date().toISOString(),
  score: 38,
  health: 'Poor',
  totalIssues: 28,
  cleanable: demoCleanable,
  startup: demoStartup,
  drivers: demoDrivers,
  oldDrivers: demoDrivers,
  processes: demoProcesses,
  updates: demoUpdates,
  categories: [
    { id: 'junk', name: 'Junk files', description: 'Clean safe temp and browser cache files.', issues: 5, rows: demoCleanable.locations },
    { id: 'startup', name: 'Unnecessary startup apps', description: 'Review apps that start with Windows.', issues: 2, rows: demoStartup },
    { id: 'updates', name: 'Outdated apps', description: 'Review updates reported by winget.', issues: 2, rows: demoUpdates.updates },
    { id: 'drivers', name: 'Outdated drivers', description: 'Review drivers older than 2 years.', issues: 3, rows: demoDrivers },
    { id: 'background', name: 'Unnecessary background apps', description: 'Put non-essential apps to sleep.', issues: 6, rows: demoProcesses }
  ]
};

function registerDemoHandlers() {
  ipcMain.handle('app:version', () => '1.0.0');
  ipcMain.handle('health:scan', () => demoHealth);
  ipcMain.handle('cleaner:scan', () => demoCleanable);
  ipcMain.handle('cleaner:clean', () => ({ cleanedAt: new Date().toISOString(), removedFiles: 0, removedSize: 0, skipped: 0, results: [] }));
  ipcMain.handle('processes:list', () => demoProcesses);
  ipcMain.handle('processes:sleep', () => ({ ok: true, message: 'Demo app was put to sleep.' }));
  ipcMain.handle('startup:list', () => demoStartup);
  ipcMain.handle('startup:open-settings', () => true);
  ipcMain.handle('software:list-updates', () => demoUpdates);
  ipcMain.handle('drivers:list', () => demoDrivers);
  ipcMain.handle('apps:list-installed', () => []);
  ipcMain.handle('folder:pick', () => null);
  ipcMain.handle('duplicates:scan', () => ({ folderPath: null, groups: [], totalWasted: 0, fileCount: 0 }));
  ipcMain.handle('path:reveal', () => true);
  ipcMain.handle('external:open', (_event, target) => shell.openExternal(target));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(win, filename) {
  await wait(500);
  const image = await win.capturePage();
  await fs.writeFile(path.join(outDir, filename), image.toPNG());
}

async function clickPage(win, page) {
  await win.webContents.executeJavaScript(`
    document.querySelector('[data-page="${page}"]').click();
  `);
  await wait(1500);
}

app.whenReady().then(async () => {
  await fs.mkdir(outDir, { recursive: true });
  registerDemoHandlers();

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    backgroundColor: '#0b111c',
    webPreferences: {
      preload: path.join(root, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      offscreen: true
    }
  });

  await win.loadFile(path.join(root, 'renderer', 'index.html'));
  await wait(2500);
  await capture(win, 'health-check.png');

  await clickPage(win, 'custom');
  await capture(win, 'custom-clean.png');

  await clickPage(win, 'optimizer');
  await capture(win, 'performance-optimizer.png');

  win.destroy();
  app.quit();
});

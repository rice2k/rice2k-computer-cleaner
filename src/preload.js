const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rice2k', {
  version: () => ipcRenderer.invoke('app:version'),
  healthScan: () => ipcRenderer.invoke('health:scan'),
  scanCleanable: () => ipcRenderer.invoke('cleaner:scan'),
  cleanLocations: (locationIds) => ipcRenderer.invoke('cleaner:clean', locationIds),
  listProcesses: () => ipcRenderer.invoke('processes:list'),
  sleepProcess: (pid) => ipcRenderer.invoke('processes:sleep', pid),
  listStartup: () => ipcRenderer.invoke('startup:list'),
  openStartupSettings: () => ipcRenderer.invoke('startup:open-settings'),
  listSoftwareUpdates: () => ipcRenderer.invoke('software:list-updates'),
  updateSoftware: (packageId) => ipcRenderer.invoke('software:update', packageId),
  listDrivers: () => ipcRenderer.invoke('drivers:list'),
  listInstalledApps: () => ipcRenderer.invoke('apps:list-installed'),
  scanCloudDrives: () => ipcRenderer.invoke('cloud:scan'),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  scanDuplicates: (folderPath) => ipcRenderer.invoke('duplicates:scan', folderPath),
  revealPath: (filePath) => ipcRenderer.invoke('path:reveal', filePath),
  openExternal: (target) => ipcRenderer.invoke('external:open', target)
});

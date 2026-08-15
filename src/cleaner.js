const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const fss = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RECENT_FILE_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SCAN_FILES_PER_LOCATION = 9000;
const MAX_DUPLICATE_FILES = 12000;
const MAX_CLOUD_SCAN_FILES = 15000;
const POWERSHELL = 'powershell.exe';

function defined(value) {
  return value !== undefined && value !== null && value !== '';
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatWindowsDate(input) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function bytesToImpact(size) {
  if (size > 400 * 1024 * 1024) return 'High';
  if (size > 125 * 1024 * 1024) return 'Medium';
  return 'Low';
}

function isInternalOrProtectedProcess(item) {
  const text = `${item.name || ''} ${item.path || ''} ${item.command || ''}`.toLowerCase();
  return [
    'openai.codex',
    '\\codex-runtimes\\',
    '\\.cache\\codex',
    'codex-code-mode-host',
    'node_repl',
    'chatgpt.exe',
    'electron.exe',
    'rice2k computer cleaner.exe',
    'rice2k-computer-cleaner'
  ].some((marker) => text.includes(marker));
}

function isInside(candidate, base) {
  if (!candidate || !base) return false;
  const resolvedCandidate = path.resolve(candidate);
  const resolvedBase = path.resolve(base);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 16,
      timeout: 45000,
      ...options
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runPowerShell(script, timeout = 45000) {
  const result = await execFileAsync(POWERSHELL, [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script
  ], { timeout });

  return result.stdout.trim();
}

function parseJsonOutput(output) {
  if (!output || !output.trim()) return [];
  try {
    return toArray(JSON.parse(output));
  } catch {
    const jsonStart = output.indexOf('[');
    const objectStart = output.indexOf('{');
    const start = jsonStart >= 0 ? jsonStart : objectStart;
    if (start < 0) return [];
    return toArray(JSON.parse(output.slice(start)));
  }
}

function getCleanLocations() {
  const localAppData = process.env.LOCALAPPDATA;
  const appData = process.env.APPDATA;
  const windir = process.env.WINDIR || 'C:\\Windows';
  const temp = os.tmpdir();

  const locations = [
    {
      id: 'user-temp',
      name: 'User temp files',
      group: 'System',
      icon: 'sparkles',
      minAgeMs: RECENT_FILE_MS,
      paths: [temp]
    },
    {
      id: 'windows-temp',
      name: 'Windows temp files',
      group: 'Windows',
      icon: 'windows',
      minAgeMs: DAY_MS,
      paths: [path.join(windir, 'Temp')]
    },
    {
      id: 'thumbnail-cache',
      name: 'Thumbnail cache',
      group: 'Windows',
      icon: 'image',
      minAgeMs: DAY_MS,
      paths: localAppData ? [path.join(localAppData, 'Microsoft', 'Windows', 'Explorer')] : [],
      includeFile: (filePath) => /^thumbcache_.*\.db$/i.test(path.basename(filePath))
    },
    {
      id: 'edge-cache',
      name: 'Microsoft Edge cache',
      group: 'Browser',
      icon: 'browser',
      minAgeMs: RECENT_FILE_MS,
      paths: localAppData ? [
        path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
        path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache')
      ] : []
    },
    {
      id: 'chrome-cache',
      name: 'Google Chrome cache',
      group: 'Browser',
      icon: 'browser',
      minAgeMs: RECENT_FILE_MS,
      paths: localAppData ? [
        path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache')
      ] : []
    },
    {
      id: 'firefox-cache',
      name: 'Mozilla Firefox cache',
      group: 'Browser',
      icon: 'browser',
      minAgeMs: RECENT_FILE_MS,
      dynamicPaths: async () => {
        if (!localAppData && !appData) return [];
        const roots = unique([
          localAppData && path.join(localAppData, 'Mozilla', 'Firefox', 'Profiles'),
          appData && path.join(appData, 'Mozilla', 'Firefox', 'Profiles')
        ]);
        const found = [];
        for (const root of roots) {
          try {
            const profiles = await fs.readdir(root, { withFileTypes: true });
            for (const profile of profiles) {
              if (profile.isDirectory()) {
                found.push(path.join(root, profile.name, 'cache2'));
                found.push(path.join(root, profile.name, 'startupCache'));
              }
            }
          } catch {
            // Missing browser folders are normal.
          }
        }
        return found;
      }
    },
    {
      id: 'windows-store-cache',
      name: 'Windows Store cache',
      group: 'Windows Store',
      icon: 'store',
      minAgeMs: DAY_MS,
      paths: localAppData ? [path.join(localAppData, 'Packages')] : [],
      includeFile: (filePath) => /[\\/]LocalCache[\\/]/i.test(filePath) || /[\\/]AC[\\/]INetCache[\\/]/i.test(filePath)
    },
    {
      id: 'log-files',
      name: 'Old log files',
      group: 'Advanced',
      icon: 'log',
      minAgeMs: 7 * DAY_MS,
      paths: [temp],
      includeFile: (filePath) => /\.(log|old|bak|tmp)$/i.test(filePath)
    }
  ];

  return locations;
}

async function resolveLocationPaths(location) {
  const staticPaths = location.paths || [];
  const dynamicPaths = location.dynamicPaths ? await location.dynamicPaths() : [];
  const existing = [];
  for (const folder of unique([...staticPaths, ...dynamicPaths])) {
    try {
      const stat = await fs.stat(folder);
      if (stat.isDirectory()) {
        existing.push(path.resolve(folder));
      }
    } catch {
      // Missing cleanup targets are fine.
    }
  }
  return existing;
}

function fileIsOldEnough(stat, minAgeMs) {
  if (!minAgeMs) return true;
  return Date.now() - stat.mtimeMs >= minAgeMs;
}

async function scanFileTree(basePath, location, result) {
  const stack = [basePath];
  const safeBase = path.resolve(basePath);

  while (stack.length > 0 && result.scanned < MAX_SCAN_FILES_PER_LOCATION) {
    const current = stack.pop();
    let entries;

    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      result.skipped += 1;
      continue;
    }

    for (const entry of entries) {
      if (result.scanned >= MAX_SCAN_FILES_PER_LOCATION) break;
      const fullPath = path.join(current, entry.name);

      if (!isInside(fullPath, safeBase)) {
        result.skipped += 1;
        continue;
      }

      if (entry.isSymbolicLink()) {
        result.skipped += 1;
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        result.skipped += 1;
        continue;
      }

      result.scanned += 1;
      if (!fileIsOldEnough(stat, location.minAgeMs)) continue;
      if (location.includeFile && !location.includeFile(fullPath, stat)) continue;

      result.files.push({
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
      result.size += stat.size;
    }
  }
}

async function scanCleanableLocation(location) {
  const paths = await resolveLocationPaths(location);
  const result = {
    id: location.id,
    name: location.name,
    group: location.group,
    icon: location.icon,
    paths,
    files: [],
    fileCount: 0,
    scanned: 0,
    skipped: 0,
    size: 0,
    impact: 'Low'
  };

  for (const targetPath of paths) {
    await scanFileTree(targetPath, location, result);
  }

  result.fileCount = result.files.length;
  result.impact = bytesToImpact(result.size);
  return result;
}

async function scanCleanableLocations() {
  const locations = getCleanLocations();
  const results = await Promise.all(locations.map(scanCleanableLocation));
  const totalSize = results.reduce((sum, item) => sum + item.size, 0);
  const totalFiles = results.reduce((sum, item) => sum + item.fileCount, 0);
  const issueCount = results.filter((item) => item.fileCount > 0).length;

  return {
    scannedAt: new Date().toISOString(),
    totalSize,
    totalFiles,
    issueCount,
    locations: results
  };
}

async function deleteFilesForLocation(location, selectedScan) {
  const bases = selectedScan.paths.map((item) => path.resolve(item));
  const outcome = {
    id: location.id,
    name: location.name,
    removedFiles: 0,
    removedSize: 0,
    skipped: 0,
    errors: []
  };

  for (const file of selectedScan.files) {
    const allowed = bases.some((base) => isInside(file.path, base));
    if (!allowed) {
      outcome.skipped += 1;
      continue;
    }

    try {
      const stat = await fs.stat(file.path);
      if (!fileIsOldEnough(stat, location.minAgeMs)) {
        outcome.skipped += 1;
        continue;
      }
      await fs.rm(file.path, { force: true });
      outcome.removedFiles += 1;
      outcome.removedSize += stat.size;
    } catch (error) {
      outcome.skipped += 1;
      if (outcome.errors.length < 8) {
        outcome.errors.push({ path: file.path, message: error.message });
      }
    }
  }

  return outcome;
}

async function cleanLocations(locationIds) {
  const ids = new Set(toArray(locationIds));
  const locationMap = new Map(getCleanLocations().map((location) => [location.id, location]));
  const selected = [...ids].map((id) => locationMap.get(id)).filter(Boolean);
  const scans = await Promise.all(selected.map(scanCleanableLocation));
  const results = [];

  for (const scan of scans) {
    const location = locationMap.get(scan.id);
    results.push(await deleteFilesForLocation(location, scan));
  }

  return {
    cleanedAt: new Date().toISOString(),
    removedFiles: results.reduce((sum, item) => sum + item.removedFiles, 0),
    removedSize: results.reduce((sum, item) => sum + item.removedSize, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
    results
  };
}

async function listStartupItems() {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$runKeys = @(
  @{ Scope = 'Current user'; Path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
  @{ Scope = 'Current user'; Path = 'HKCU:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' },
  @{ Scope = 'All users'; Path = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
  @{ Scope = 'All users'; Path = 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' }
)
$items = @()
foreach ($key in $runKeys) {
  $props = Get-ItemProperty -Path $key.Path
  if ($props) {
    foreach ($prop in $props.PSObject.Properties) {
      if ($prop.Name -notmatch '^PS') {
        $items += [PSCustomObject]@{
          name = $prop.Name
          command = [string]$prop.Value
          scope = $key.Scope
          registryPath = $key.Path
        }
      }
    }
  }
}
$items | Sort-Object name | ConvertTo-Json -Depth 4
`;

  try {
    const output = await runPowerShell(script);
    return parseJsonOutput(output).map((item) => ({
      name: item.name || 'Startup item',
      command: item.command || '',
      scope: item.scope || 'Unknown',
      registryPath: item.registryPath || '',
      impact: startupImpact(item.command || item.name || '')
    }));
  } catch {
    return [];
  }
}

function startupImpact(value) {
  const lower = String(value).toLowerCase();
  if (/(onedrive|google|office|teams|adobe|dropbox|steam|epic|discord)/.test(lower)) return 'High';
  if (/(update|helper|service|sync|launcher)/.test(lower)) return 'Medium';
  return 'Low';
}

async function listDriverAges() {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$drivers = Get-CimInstance Win32_PnPSignedDriver |
  Where-Object { $_.DeviceName -and $_.DriverDate } |
  ForEach-Object {
    $driverDate = $null
    try {
      $driverDate = [Management.ManagementDateTimeConverter]::ToDateTime($_.DriverDate)
    } catch {
      $driverDate = $null
    }
    [PSCustomObject]@{
      name = $_.DeviceName
      manufacturer = $_.Manufacturer
      version = $_.DriverVersion
      date = if ($driverDate) { $driverDate.ToString('yyyy-MM-dd') } else { $null }
    }
  } |
  Sort-Object date |
  Select-Object -First 90
$drivers | ConvertTo-Json -Depth 4
`;

  try {
    const output = await runPowerShell(script);
    return parseJsonOutput(output).map((item) => {
      const date = formatWindowsDate(item.date);
      const ageDays = date ? Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS) : null;
      return {
        name: item.name || 'Driver',
        manufacturer: item.manufacturer || 'Unknown',
        version: item.version || '',
        date,
        ageDays,
        impact: ageDays && ageDays > 365 * 4 ? 'High' : ageDays && ageDays > 365 * 2 ? 'Medium' : 'Low'
      };
    });
  } catch {
    return [];
  }
}

async function listInstalledApps() {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $paths |
  Where-Object { $_.DisplayName } |
  Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, UninstallString |
  Sort-Object DisplayName -Unique |
  ConvertTo-Json -Depth 4
`;

  try {
    const output = await runPowerShell(script);
    return parseJsonOutput(output).map((item) => ({
      name: item.DisplayName,
      version: item.DisplayVersion || '',
      publisher: item.Publisher || '',
      installDate: item.InstallDate || '',
      uninstallString: item.UninstallString || ''
    })).filter((item) => item.name);
  } catch {
    return [];
  }
}

function parseWingetTable(stdout) {
  const lines = stdout.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => /^Name\s+Id\s+Version\s+Available\s+Source/i.test(line));
  if (headerIndex < 0) return [];

  const header = lines[headerIndex];
  const positions = {
    name: header.indexOf('Name'),
    id: header.indexOf('Id'),
    version: header.indexOf('Version'),
    available: header.indexOf('Available'),
    source: header.indexOf('Source')
  };

  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (/^\d+\s+upgrades?\s+available/i.test(line)) break;
    if (/^-+$/.test(line.replace(/\s/g, ''))) continue;
    const name = line.slice(positions.name, positions.id).trim();
    const id = line.slice(positions.id, positions.version).trim();
    const version = line.slice(positions.version, positions.available).trim();
    const available = line.slice(positions.available, positions.source).trim();
    const source = line.slice(positions.source).trim();
    if (name && id) {
      rows.push({ name, id, version, available, source });
    }
  }
  return rows;
}

async function listAvailableUpdates() {
  try {
    await execFileAsync('winget.exe', ['--version'], { timeout: 10000 });
  } catch {
    return { available: false, updates: [], message: 'winget is not available on this PC.' };
  }

  try {
    const result = await execFileAsync('winget.exe', [
      'upgrade',
      '--accept-source-agreements',
      '--disable-interactivity'
    ], { timeout: 45000 });

    const updates = parseWingetTable(result.stdout);
    return { available: true, updates, raw: result.stdout };
  } catch (error) {
    return {
      available: true,
      updates: [],
      message: error.stderr || error.stdout || error.message
    };
  }
}

async function updateSoftwarePackage(packageId) {
  if (!/^[A-Za-z0-9_.:+-]+$/.test(String(packageId || ''))) {
    return { ok: false, message: 'Invalid package id.' };
  }

  try {
    const result = await execFileAsync('winget.exe', [
      'upgrade',
      '--id',
      packageId,
      '--exact',
      '--accept-source-agreements',
      '--accept-package-agreements',
      '--disable-interactivity'
    ], { timeout: 120000 });

    return {
      ok: true,
      message: 'Update command finished.',
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return {
      ok: false,
      message: error.stderr || error.stdout || error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

async function scanFolderStats(rootPath, maxFiles = MAX_CLOUD_SCAN_FILES) {
  const root = path.resolve(rootPath);
  const result = { fileCount: 0, folderCount: 0, size: 0, skipped: 0, limited: false };
  const stack = [root];

  while (stack.length > 0 && result.fileCount < maxFiles) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      result.skipped += 1;
      continue;
    }

    for (const entry of entries) {
      if (result.fileCount >= maxFiles) {
        result.limited = true;
        break;
      }

      const fullPath = path.join(current, entry.name);
      if (!isInside(fullPath, root) || entry.isSymbolicLink()) {
        result.skipped += 1;
        continue;
      }

      if (entry.isDirectory()) {
        result.folderCount += 1;
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      try {
        const stat = await fs.stat(fullPath);
        result.fileCount += 1;
        result.size += stat.size;
      } catch {
        result.skipped += 1;
      }
    }
  }

  return result;
}

async function existingDirectories(paths) {
  const found = [];
  for (const folderPath of unique(paths)) {
    if (!folderPath) continue;
    try {
      const stat = await fs.stat(folderPath);
      if (stat.isDirectory()) found.push(path.resolve(folderPath));
    } catch {
      // Missing cloud providers are normal.
    }
  }
  return found;
}

async function scanCloudDrives() {
  const userProfile = process.env.USERPROFILE || os.homedir();
  const localAppData = process.env.LOCALAPPDATA;
  const appData = process.env.APPDATA;
  const providers = [
    {
      id: 'onedrive',
      name: 'OneDrive',
      paths: [
        process.env.OneDrive,
        process.env.OneDriveConsumer,
        process.env.OneDriveCommercial,
        userProfile && path.join(userProfile, 'OneDrive')
      ],
      cachePaths: localAppData ? [path.join(localAppData, 'Microsoft', 'OneDrive')] : []
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      paths: [
        userProfile && path.join(userProfile, 'Google Drive'),
        'G:\\My Drive'
      ],
      cachePaths: localAppData ? [path.join(localAppData, 'Google', 'DriveFS')] : []
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      paths: [
        userProfile && path.join(userProfile, 'Dropbox')
      ],
      cachePaths: unique([
        localAppData && path.join(localAppData, 'Dropbox'),
        appData && path.join(appData, 'Dropbox')
      ])
    }
  ];

  const results = [];
  for (const provider of providers) {
    const paths = await existingDirectories(provider.paths);
    const cachePaths = await existingDirectories(provider.cachePaths);
    const scanTargets = unique([...paths, ...cachePaths]);
    let stats = { fileCount: 0, folderCount: 0, size: 0, skipped: 0, limited: false };

    for (const target of scanTargets) {
      const targetStats = await scanFolderStats(target);
      stats = {
        fileCount: stats.fileCount + targetStats.fileCount,
        folderCount: stats.folderCount + targetStats.folderCount,
        size: stats.size + targetStats.size,
        skipped: stats.skipped + targetStats.skipped,
        limited: stats.limited || targetStats.limited
      };
    }

    results.push({
      id: provider.id,
      name: provider.name,
      status: scanTargets.length ? 'Detected' : 'Not detected',
      paths,
      cachePaths,
      primaryPath: paths[0] || cachePaths[0] || '',
      ...stats
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    providers: results,
    detected: results.filter((provider) => provider.status === 'Detected').length,
    totalSize: results.reduce((sum, provider) => sum + provider.size, 0),
    totalFiles: results.reduce((sum, provider) => sum + provider.fileCount, 0)
  };
}

async function listBackgroundProcesses() {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$deny = @('Idle','System','Registry','smss.exe','csrss.exe','wininit.exe','winlogon.exe','services.exe','lsass.exe','svchost.exe','fontdrvhost.exe','dwm.exe','explorer.exe','sihost.exe','taskhostw.exe','audiodg.exe','spoolsv.exe','SecurityHealthService.exe','ChatGPT.exe','Codex.exe','electron.exe','Rice2k Computer Cleaner.exe','git.exe','node.exe','cmd.exe','conhost.exe','powershell.exe','pwsh.exe')
Get-CimInstance Win32_Process |
  Where-Object { $_.ExecutablePath -and ($deny -notcontains $_.Name) } |
  Select-Object ProcessId, Name, ExecutablePath, CommandLine, WorkingSetSize |
  Sort-Object WorkingSetSize -Descending |
  Select-Object -First 80 |
  ConvertTo-Json -Depth 4
`;

  try {
    const output = await runPowerShell(script, 30000);
    return parseJsonOutput(output).map((item) => {
      const size = Number(item.WorkingSetSize || 0);
      return {
        pid: Number(item.ProcessId),
        name: item.Name || path.basename(item.ExecutablePath || 'App'),
        path: item.ExecutablePath || '',
        command: item.CommandLine || '',
        memory: size,
        impact: bytesToImpact(size)
      };
    }).filter((item) => item.pid && item.name && !isInternalOrProtectedProcess(item));
  } catch {
    return [];
  }
}

async function sleepProcess(pid) {
  const numericPid = Number(pid);
  if (!Number.isFinite(numericPid) || numericPid <= 0) {
    return { ok: false, message: 'Invalid process id.' };
  }

  const denyList = new Set([
    'system', 'registry', 'smss.exe', 'csrss.exe', 'wininit.exe', 'winlogon.exe',
    'services.exe', 'lsass.exe', 'svchost.exe', 'dwm.exe', 'explorer.exe',
    'sihost.exe', 'taskhostw.exe', 'audiodg.exe', 'chatgpt.exe', 'codex.exe',
    'electron.exe', 'rice2k computer cleaner.exe', 'git.exe', 'node.exe',
    'cmd.exe', 'conhost.exe', 'powershell.exe', 'pwsh.exe'
  ]);

  const processes = await listBackgroundProcesses();
  const target = processes.find((item) => item.pid === numericPid);
  if (!target) {
    return { ok: false, message: 'Process was not found or is protected.' };
  }

  if (denyList.has(target.name.toLowerCase())) {
    return { ok: false, message: 'Protected Windows process skipped.' };
  }

  try {
    process.kill(numericPid);
    return { ok: true, message: `${target.name} was put to sleep.`, target };
  } catch (error) {
    return { ok: false, message: error.message, target };
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fss.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function collectFilesForDuplicateScan(folderPath) {
  const root = path.resolve(folderPath);
  const files = [];
  const stack = [root];

  while (stack.length > 0 && files.length < MAX_DUPLICATE_FILES) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (!isInside(fullPath, root) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'Windows', 'Program Files'].includes(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > 0) {
          files.push({ path: fullPath, size: stat.size });
        }
      } catch {
        // Skip locked files.
      }
    }
  }

  return files;
}

async function scanDuplicates(folderPath) {
  if (!defined(folderPath)) {
    return { folderPath: null, groups: [], totalWasted: 0, fileCount: 0 };
  }

  const root = path.resolve(folderPath);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    return { folderPath: root, groups: [], totalWasted: 0, fileCount: 0 };
  }

  const files = await collectFilesForDuplicateScan(root);
  const bySize = new Map();
  for (const file of files) {
    const group = bySize.get(file.size) || [];
    group.push(file);
    bySize.set(file.size, group);
  }

  const groups = [];
  for (const sameSize of bySize.values()) {
    if (sameSize.length < 2) continue;
    const byHash = new Map();
    for (const file of sameSize) {
      try {
        const hash = await hashFile(file.path);
        const group = byHash.get(hash) || [];
        group.push(file);
        byHash.set(hash, group);
      } catch {
        // Locked files are ignored.
      }
    }
    for (const duplicateGroup of byHash.values()) {
      if (duplicateGroup.length > 1) {
        groups.push({
          size: duplicateGroup[0].size,
          wasted: duplicateGroup[0].size * (duplicateGroup.length - 1),
          files: duplicateGroup
        });
      }
    }
  }

  groups.sort((a, b) => b.wasted - a.wasted);
  return {
    folderPath: root,
    groups: groups.slice(0, 50),
    totalWasted: groups.reduce((sum, group) => sum + group.wasted, 0),
    fileCount: files.length,
    limited: files.length >= MAX_DUPLICATE_FILES
  };
}

async function settle(name, promise, fallback) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

async function healthScan() {
  const [cleanable, startup, drivers, processes, updates] = await Promise.all([
    settle('cleanable', scanCleanableLocations(), { totalSize: 0, totalFiles: 0, issueCount: 0, locations: [] }),
    settle('startup', listStartupItems(), []),
    settle('drivers', listDriverAges(), []),
    settle('processes', listBackgroundProcesses(), []),
    settle('updates', listAvailableUpdates(), { available: false, updates: [] })
  ]);

  const oldDrivers = drivers.filter((driver) => driver.ageDays && driver.ageDays > 365 * 2);
  const highProcesses = processes.filter((item) => item.impact !== 'Low').slice(0, 12);
  const appUpdates = updates.updates || [];
  const totalIssues = cleanable.issueCount + startup.length + oldDrivers.length + highProcesses.length + appUpdates.length;
  const score = Math.max(0, Math.min(100, 100 - totalIssues * 4 - Math.round(cleanable.totalSize / (1024 * 1024 * 500))));

  return {
    scannedAt: new Date().toISOString(),
    score,
    health: score > 76 ? 'Healthy' : score > 45 ? 'Moderate' : 'Poor',
    totalIssues,
    cleanable,
    startup,
    drivers,
    oldDrivers,
    processes: highProcesses,
    updates,
    categories: [
      {
        id: 'junk',
        name: 'Junk files',
        description: 'Clean safe temp and browser cache files.',
        issues: cleanable.issueCount,
        rows: cleanable.locations.filter((item) => item.fileCount > 0)
      },
      {
        id: 'startup',
        name: 'Unnecessary startup apps',
        description: 'Review apps that start with Windows.',
        issues: startup.length,
        rows: startup
      },
      {
        id: 'updates',
        name: 'Outdated apps',
        description: 'Review updates reported by winget.',
        issues: appUpdates.length,
        rows: appUpdates
      },
      {
        id: 'drivers',
        name: 'Outdated drivers',
        description: 'Review drivers older than 2 years.',
        issues: oldDrivers.length,
        rows: oldDrivers.slice(0, 25)
      },
      {
        id: 'background',
        name: 'Unnecessary background apps',
        description: 'Put non-essential apps to sleep.',
        issues: highProcesses.length,
        rows: highProcesses
      }
    ]
  };
}

module.exports = {
  cleanLocations,
  healthScan,
  listAvailableUpdates,
  listBackgroundProcesses,
  scanCloudDrives,
  listDriverAges,
  listInstalledApps,
  listStartupItems,
  scanCleanableLocations,
  scanDuplicates,
  sleepProcess,
  updateSoftwarePackage
};

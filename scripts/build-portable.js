const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const releaseDir = path.join(root, 'release');
const tempDir = path.join(os.tmpdir(), `Rice2kComputerCleanerRelease-${Date.now()}`);
const cacheDir = path.join(os.tmpdir(), 'Rice2kElectronBuilderCache');
const builderArgs = [
  '--yes',
  'electron-builder@26.15.3',
  '--win',
  'portable',
  '--publish=never',
  `--config.directories.output=${tempDir}`
];
const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx.cmd', ...builderArgs] : builderArgs;

fs.mkdirSync(releaseDir, { recursive: true });

const result = spawnSync(command, args, {
  cwd: root,
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    ELECTRON_BUILDER_CACHE: cacheDir
  },
  stdio: 'inherit',
  shell: false
});

if (result.error) {
  console.error(result.error.message);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const exe = fs.readdirSync(tempDir)
  .filter((file) => /^Rice2k-Computer-Cleaner-.*\.exe$/i.test(file))
  .map((file) => path.join(tempDir, file))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

if (!exe) {
  throw new Error(`Portable executable was not found in ${tempDir}`);
}

const destination = path.join(releaseDir, path.basename(exe));
fs.copyFileSync(exe, destination);
console.log(`Portable executable copied to ${destination}`);

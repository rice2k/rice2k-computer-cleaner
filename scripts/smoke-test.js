const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const required = [
  'src/main.js',
  'src/preload.js',
  'src/cleaner.js',
  'renderer/index.html',
  'renderer/styles.css',
  'renderer/app.js',
  'assets/rice2k-cleaner-icon.ico',
  'assets/rice2k-cleaner-icon.png',
  'docs/screenshots/health-check.png',
  'docs/screenshots/custom-clean.png',
  'docs/screenshots/performance-optimizer.png',
  'docs/screenshots/software-updater.png',
  'docs/screenshots/cloud-drive-cleaner.png',
  'README.md'
];

for (const file of required) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const cleaner = require('../src/cleaner');
for (const fn of [
  'healthScan',
  'scanCleanableLocations',
  'cleanLocations',
  'listAvailableUpdates',
  'updateSoftwarePackage',
  'scanCloudDrives',
  'scanDuplicates'
]) {
  if (typeof cleaner[fn] !== 'function') {
    throw new Error(`Cleaner engine is missing ${fn}.`);
  }
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
if (/ccleaner/i.test(readme)) {
  throw new Error('README should not mention reference branding.');
}

console.log('Rice2k smoke test passed.');

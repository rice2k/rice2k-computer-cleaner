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
  'README.md'
];

for (const file of required) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

require('../src/cleaner');
console.log('Rice2k smoke test passed.');

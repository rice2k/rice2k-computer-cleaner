const navItems = [
  { id: 'health', label: 'Health Check', icon: '♡' },
  { id: 'custom', label: 'Custom Clean', icon: '♨' },
  { id: 'optimizer', label: 'Performance Optimizer', icon: '⌁', alert: true },
  { id: 'drivers', label: 'Driver Updater', icon: '▣', alert: true },
  { id: 'software', label: 'Software Updater', icon: '▤', alert: true },
  { id: 'cloud', label: 'Cloud Drive Cleaner', icon: '☁' },
  { id: 'uninstaller', label: 'Uninstaller', icon: '▰' },
  { id: 'duplicates', label: 'Duplicate Finder', icon: '▥' },
  { id: 'startup', label: 'Startup Manager', icon: '▱' }
];

const state = {
  page: 'health',
  busy: false,
  health: null,
  cleanable: null,
  processes: [],
  drivers: [],
  updates: null,
  startup: [],
  apps: [],
  duplicates: null,
  selectedCleanIds: new Set()
};

const view = document.querySelector('#view');
const nav = document.querySelector('#nav');
const toast = document.querySelector('#toast');

function bytes(value) {
  const number = Number(value || 0);
  if (number > 1024 ** 3) return `${(number / 1024 ** 3).toFixed(1)} GB`;
  if (number > 1024 ** 2) return `${(number / 1024 ** 2).toFixed(1)} MB`;
  if (number > 1024) return `${(number / 1024).toFixed(1)} KB`;
  return `${number} B`;
}

function dateText(value) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function setBusy(value) {
  state.busy = value;
  document.querySelectorAll('button').forEach((button) => {
    if (!button.classList.contains('nav-item')) button.disabled = value;
  });
}

function renderNav() {
  nav.innerHTML = navItems.map((item) => `
    <button class="nav-item ${state.page === item.id ? 'active' : ''}" data-page="${item.id}">
      <span class="nav-icon">${item.icon}${item.alert ? '<span class="dot"></span>' : ''}</span>
      <span>${item.label}</span>
    </button>
  `).join('');
}

function shell(title, body, footer = '', tabs = '') {
  return `
    <div class="view">
      <header class="header-strip">
        <div class="title-row">
          <h1>${title}</h1>
          ${state.busy ? '<span class="subtle">Working...</span>' : ''}
        </div>
        ${tabs}
      </header>
      <section class="content">${body}</section>
      <footer class="footer">${footer}</footer>
    </div>
  `;
}

function plainView(body, footer = '') {
  return `<div class="view"><section class="content">${body}</section><footer class="footer">${footer}</footer></div>`;
}

function impactDots(impact) {
  const count = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
  return `<span class="dots">${[0, 1, 2].map((index) => `<span class="${index < count ? 'on' : ''}"></span>`).join('')}</span>`;
}

function categoryRows(categories) {
  if (!categories || categories.length === 0) {
    return '<tr class="muted-row"><td>No issues found.</td><td></td></tr>';
  }

  return categories.map((category) => {
    const children = (category.rows || []).slice(0, 7).map((row) => {
      const right = row.size ? bytes(row.size) : row.date ? `Release date: ${dateText(row.date)}` : row.impact ? `${row.impact} impact ${impactDots(row.impact)}` : '';
      const name = row.name || row.DisplayName || row.id || 'Item';
      return `
        <tr class="child-row">
          <td>${escapeHtml(name)}</td>
          <td class="issue">${right}</td>
        </tr>
      `;
    }).join('');

    return `
      <tr class="category-row">
        <td>
          <div class="category-name">
            <span class="category-icon">▧</span>
            <div>
              <div>${escapeHtml(category.name)}</div>
              <div class="subtle">${escapeHtml(category.description)}</div>
            </div>
          </div>
        </td>
        <td class="issue">${category.issues || 0}</td>
      </tr>
      ${children}
    `;
  }).join('');
}

function renderHealth() {
  const data = state.health;
  if (!data) {
    view.innerHTML = plainView(`
      <div class="empty-state">
        <div>
          <h2>Rice2k Computer Cleaner</h2>
          <p>Ready for a health scan.</p>
        </div>
      </div>
    `, `<button class="button primary" data-action="scan-health">Scan now</button>`);
    return;
  }

  const scoreLeft = Math.max(4, Math.min(92, data.score));
  const body = `
    <div class="steps">
      <span class="step">More privacy</span>
      <span class="step-line"></span>
      <span class="step">More space</span>
      <span class="step-line"></span>
      <span class="step warn">Resolve issues</span>
    </div>
    <div class="hero-health">
      <div>
        <p class="big-count"><strong>${data.totalIssues}</strong> issues found on your PC</p>
        <p class="subtle">Resolve these issues to lower security risks and speed up your PC.</p>
      </div>
      <div class="health-card">
        <div class="health-title"><span>⊞ PC health: <b>${escapeHtml(data.health)}</b></span><span>ⓘ</span></div>
        <p class="subtle">Your PC can do better. Fix what's holding it back.</p>
        <div class="health-bar">
          <span></span><span></span><span></span>
          <i class="health-pointer" style="left:${scoreLeft}%"></i>
        </div>
        <div class="health-labels"><span>Poor</span><span>Moderate</span><span>Healthy</span></div>
      </div>
    </div>
    <table class="table">
      <thead><tr><th>Category</th><th>Issues</th></tr></thead>
      <tbody>${categoryRows(data.categories)}</tbody>
    </table>
  `;

  view.innerHTML = plainView(body, `
    <button class="button" data-action="scan-health">Scan again</button>
    <button class="button primary" data-action="go-custom">Resolve</button>
  `);
}

function cleanTabs() {
  return `
    <div class="tabs">
      <button class="tab active">▣ Junk</button>
      <button class="tab">▤ Browser</button>
      <button class="tab">▦ Registry</button>
    </div>
  `;
}

function renderCustomClean() {
  const data = state.cleanable;
  const selected = state.selectedCleanIds;
  const locations = data?.locations || [];
  const allSelected = locations.length > 0 && locations.every((item) => selected.has(item.id));

  const left = `
    <div class="left-list">
      <div class="check-row" data-action="toggle-all-clean">
        <span class="checkbox ${allSelected ? '' : 'empty'}">${allSelected ? '−' : ''}</span>
        <span></span>
        <span>Select all</span>
        <span>↻</span>
      </div>
      ${locations.map((item) => `
        <div class="check-row" data-action="toggle-clean" data-id="${item.id}">
          <span class="checkbox ${selected.has(item.id) ? '' : 'empty'}">${selected.has(item.id) ? '−' : ''}</span>
          <span>▧</span>
          <span>${escapeHtml(item.group)}</span>
          <span>⌄</span>
        </div>
      `).join('')}
    </div>
  `;

  const results = !data ? `
    <div class="empty-state"><div><h2>Custom Clean</h2><p>Run a scan to find safe junk files.</p></div></div>
  ` : `
    <div class="results-area">
      <h2 class="results-title">Your scan results (${data.issueCount} issues)</h2>
      <div class="metric-grid">
        <div class="metric"><div class="label">Files</div><div class="value">${data.totalFiles}</div></div>
        <div class="metric"><div class="label">Space</div><div class="value">${bytes(data.totalSize)}</div></div>
        <div class="metric"><div class="label">Locations</div><div class="value">${data.issueCount}</div></div>
      </div>
      <table class="table">
        <thead><tr><th>Name</th><th>Number of items</th><th>Size</th></tr></thead>
        <tbody>
          ${locations.map((item) => `
            <tr>
              <td><span class="category-name"><span class="category-icon">▧</span>${escapeHtml(item.name)}</span></td>
              <td>${item.fileCount}</td>
              <td>${bytes(item.size)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  view.innerHTML = shell('Custom Clean', `<div class="split">${left}${results}</div>`, `
    <button class="button" data-action="scan-clean">Scan again</button>
    <button class="button blue" data-action="clean-selected" ${selected.size === 0 ? 'disabled' : ''}>Clean and fix</button>
  `, cleanTabs());
}

function renderOptimizer() {
  const rows = state.processes;
  const body = `
    <div class="page-title">
      <h2>Put <strong>${rows.length}</strong> apps in sleep mode</h2>
      <p class="subtle">Boost your PC's performance by putting non-essential apps to sleep.</p>
    </div>
    <table class="table">
      <thead><tr><th>All active apps</th><th>Impact on PC's performance</th><th></th></tr></thead>
      <tbody>
        ${rows.length ? rows.map((item) => `
          <tr>
            <td><span class="category-name"><span class="category-icon">◉</span>${escapeHtml(item.name)}</span><div class="path">${escapeHtml(item.path)}</div></td>
            <td><span class="impact">${impactDots(item.impact)} ${item.impact}</span></td>
            <td class="list-actions"><button class="pill" data-action="sleep-process" data-pid="${item.pid}">Sleep</button><button class="button compact" data-action="reveal" data-path="${escapeHtml(item.path)}">⋯</button></td>
          </tr>
        `).join('') : '<tr class="muted-row"><td>No background apps found.</td><td></td><td></td></tr>'}
      </tbody>
    </table>
  `;

  view.innerHTML = shell('Performance Optimizer', body, `
    <span class="subtle">Last scan: just now</span>
    <button class="button" data-action="load-processes">Scan again</button>
  `, `
    <div class="tabs">
      <button class="tab active">☼ Active apps (${rows.length})</button>
      <button class="tab">☾ Sleeping apps</button>
      <button class="tab">♧ Excluded apps</button>
    </div>
  `);
}

function renderDrivers() {
  const rows = state.drivers;
  const oldCount = rows.filter((item) => item.impact !== 'Low').length;
  const body = `
    <div class="toolbar">
      <div class="page-title">
        <h2><strong>${oldCount}</strong> drivers need review</h2>
        <p class="subtle">Driver updates are review-only in this app.</p>
      </div>
    </div>
    <table class="table">
      <thead><tr><th>Driver</th><th>Manufacturer</th><th>Version</th><th>Release date</th></tr></thead>
      <tbody>
        ${rows.map((item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.manufacturer)}</td>
            <td>${escapeHtml(item.version)}</td>
            <td class="issue">${dateText(item.date)}</td>
          </tr>
        `).join('') || '<tr class="muted-row"><td>No driver data found.</td><td></td><td></td><td></td></tr>'}
      </tbody>
    </table>
  `;

  view.innerHTML = shell('Driver Updater', body, `<button class="button primary" data-action="load-drivers">Scan again</button>`);
}

function renderSoftware() {
  const updates = state.updates;
  const rows = updates?.updates || [];
  const body = `
    <div class="page-title">
      <h2><strong>${rows.length}</strong> outdated apps</h2>
      <p class="subtle">${updates?.available === false ? escapeHtml(updates.message || 'winget is unavailable.') : 'Updates are checked with Windows Package Manager.'}</p>
    </div>
    <table class="table">
      <thead><tr><th>App</th><th>Installed</th><th>Available</th><th>Source</th></tr></thead>
      <tbody>
        ${rows.map((item) => `
          <tr>
            <td>${escapeHtml(item.name)}<div class="path">${escapeHtml(item.id)}</div></td>
            <td>${escapeHtml(item.version)}</td>
            <td class="issue">${escapeHtml(item.available)}</td>
            <td>${escapeHtml(item.source)}</td>
          </tr>
        `).join('') || '<tr class="muted-row"><td>No app updates found.</td><td></td><td></td><td></td></tr>'}
      </tbody>
    </table>
  `;

  view.innerHTML = shell('Software Updater', body, `<button class="button primary" data-action="load-updates">Scan again</button>`);
}

function renderStartup() {
  const rows = state.startup;
  const body = `
    <div class="page-title">
      <h2><strong>${rows.length}</strong> startup apps</h2>
      <p class="subtle">Use Windows Startup settings to disable items safely.</p>
    </div>
    <table class="table">
      <thead><tr><th>Name</th><th>Scope</th><th>Impact</th><th>Command</th></tr></thead>
      <tbody>
        ${rows.map((item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.scope)}</td>
            <td><span class="impact">${impactDots(item.impact)} ${item.impact}</span></td>
            <td><div class="path">${escapeHtml(item.command)}</div></td>
          </tr>
        `).join('') || '<tr class="muted-row"><td>No startup entries found.</td><td></td><td></td><td></td></tr>'}
      </tbody>
    </table>
  `;

  view.innerHTML = shell('Startup Manager', body, `
    <button class="button" data-action="load-startup">Scan again</button>
    <button class="button primary" data-action="open-startup-settings">Open Startup settings</button>
  `);
}

function renderUninstaller() {
  const rows = state.apps;
  const body = `
    <div class="page-title">
      <h2><strong>${rows.length}</strong> installed apps</h2>
      <p class="subtle">Review apps and open Windows apps settings when you are ready.</p>
    </div>
    <table class="table">
      <thead><tr><th>App</th><th>Publisher</th><th>Version</th><th>Install date</th></tr></thead>
      <tbody>
        ${rows.slice(0, 250).map((item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.publisher)}</td>
            <td>${escapeHtml(item.version)}</td>
            <td>${escapeHtml(item.installDate)}</td>
          </tr>
        `).join('') || '<tr class="muted-row"><td>No installed apps found.</td><td></td><td></td><td></td></tr>'}
      </tbody>
    </table>
  `;

  view.innerHTML = shell('Uninstaller', body, `
    <button class="button" data-action="load-apps">Scan again</button>
    <button class="button primary" data-action="open-app-settings">Open Apps settings</button>
  `);
}

function renderDuplicates() {
  const dupes = state.duplicates;
  const body = `
    <div class="toolbar">
      <div class="page-title">
        <h2>Duplicate Finder</h2>
        <p class="subtle">${dupes ? `${dupes.groups.length} duplicate groups found in ${escapeHtml(dupes.folderPath)}` : 'Choose a folder to scan.'}</p>
      </div>
      <button class="button primary" data-action="choose-duplicate-folder">Choose folder</button>
    </div>
    ${dupes ? `
      <div class="metric-grid">
        <div class="metric"><div class="label">Files checked</div><div class="value">${dupes.fileCount}</div></div>
        <div class="metric"><div class="label">Groups</div><div class="value">${dupes.groups.length}</div></div>
        <div class="metric"><div class="label">Wasted space</div><div class="value">${bytes(dupes.totalWasted)}</div></div>
      </div>
      <table class="table">
        <thead><tr><th>Duplicates</th><th>Size</th><th>Wasted</th></tr></thead>
        <tbody>
          ${dupes.groups.map((group) => `
            <tr>
              <td>${group.files.map((file) => `<div class="path">${escapeHtml(file.path)}</div>`).join('')}</td>
              <td>${bytes(group.size)}</td>
              <td class="issue">${bytes(group.wasted)}</td>
            </tr>
          `).join('') || '<tr class="muted-row"><td>No duplicates found.</td><td></td><td></td></tr>'}
        </tbody>
      </table>
    ` : '<div class="empty-state">No folder selected.</div>'}
  `;

  view.innerHTML = shell('Duplicate Finder', body, `<button class="button" data-action="choose-duplicate-folder">Scan folder</button>`);
}

function renderCloud() {
  const body = `
    <div class="page-title">
      <h2>Cloud Drive Cleaner</h2>
      <p class="subtle">Cloud folders are reviewed from their local cache locations.</p>
    </div>
    <table class="table">
      <thead><tr><th>Provider</th><th>Detected path</th><th>Status</th></tr></thead>
      <tbody>
        ${['OneDrive', 'Google Drive', 'Dropbox'].map((name) => `
          <tr>
            <td>${name}</td>
            <td><span class="path">${name === 'OneDrive' ? escapeHtml(window.localStorage.getItem('oneDrivePath') || 'Use Custom Clean for local cache files') : 'Not connected in this build'}</span></td>
            <td class="issue">Review</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  view.innerHTML = shell('Cloud Drive Cleaner', body, `<button class="button primary" data-action="go-custom">Open Custom Clean</button>`);
}

function renderSettings() {
  const body = `
    <div class="page-title">
      <h2>Settings</h2>
      <p class="subtle">Rice2k Computer Cleaner v<span id="version">1.0.0</span></p>
    </div>
    <div class="metric-grid">
      <div class="metric"><div class="label">Cleanup mode</div><div class="value">Safe</div></div>
      <div class="metric"><div class="label">Registry cleaner</div><div class="value">Read-only</div></div>
      <div class="metric"><div class="label">Deletes</div><div class="value">Cache only</div></div>
    </div>
  `;
  view.innerHTML = plainView(body, `<button class="button primary" data-action="scan-health">Scan now</button>`);
  window.rice2k.version().then((version) => {
    const versionNode = document.querySelector('#version');
    if (versionNode) versionNode.textContent = version;
  });
}

function renderHelp() {
  const body = `
    <div class="page-title">
      <h2>Help</h2>
      <p class="subtle">The GitHub README has the full details, safety notes, and build steps.</p>
    </div>
    <table class="table">
      <tbody>
        <tr><td>Cleanable files</td><td>Temp files, browser caches, thumbnails, old logs</td></tr>
        <tr><td>Review-only areas</td><td>Drivers, registry, installed apps, software updates</td></tr>
        <tr><td>Duplicate finder</td><td>Hashes files and reports matches without deleting them</td></tr>
      </tbody>
    </table>
  `;
  view.innerHTML = plainView(body, `<button class="button primary" data-action="go-health">Health Check</button>`);
}

function render() {
  renderNav();
  if (state.page === 'health') renderHealth();
  if (state.page === 'custom') renderCustomClean();
  if (state.page === 'optimizer') renderOptimizer();
  if (state.page === 'drivers') renderDrivers();
  if (state.page === 'software') renderSoftware();
  if (state.page === 'startup') renderStartup();
  if (state.page === 'uninstaller') renderUninstaller();
  if (state.page === 'duplicates') renderDuplicates();
  if (state.page === 'cloud') renderCloud();
  if (state.page === 'settings') renderSettings();
  if (state.page === 'help') renderHelp();
}

async function runTask(message, task) {
  try {
    setBusy(true);
    render();
    const result = await task();
    if (message) showToast(message);
    return result;
  } catch (error) {
    showToast(error.message || 'Something went wrong.');
    return null;
  } finally {
    setBusy(false);
    render();
  }
}

async function scanHealth() {
  const data = await runTask('Health scan complete.', () => window.rice2k.healthScan());
  if (data) {
    state.health = data;
    state.cleanable = data.cleanable;
    state.selectedCleanIds = new Set((data.cleanable?.locations || []).filter((item) => item.fileCount > 0).map((item) => item.id));
    state.processes = data.processes || [];
    state.drivers = data.drivers || [];
    state.updates = data.updates || null;
    state.startup = data.startup || [];
  }
}

async function scanClean() {
  const data = await runTask('Custom clean scan complete.', () => window.rice2k.scanCleanable());
  if (data) {
    state.cleanable = data;
    state.selectedCleanIds = new Set(data.locations.filter((item) => item.fileCount > 0).map((item) => item.id));
  }
}

document.body.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-page], [data-action]');
  if (!target || state.busy) return;

  if (target.dataset.page) {
    state.page = target.dataset.page;
    render();
    if (state.page === 'optimizer' && state.processes.length === 0) {
      state.processes = await runTask('', () => window.rice2k.listProcesses()) || [];
    }
    if (state.page === 'drivers' && state.drivers.length === 0) {
      state.drivers = await runTask('', () => window.rice2k.listDrivers()) || [];
    }
    if (state.page === 'software' && !state.updates) {
      state.updates = await runTask('', () => window.rice2k.listSoftwareUpdates());
    }
    if (state.page === 'startup' && state.startup.length === 0) {
      state.startup = await runTask('', () => window.rice2k.listStartup()) || [];
    }
    if (state.page === 'uninstaller' && state.apps.length === 0) {
      state.apps = await runTask('', () => window.rice2k.listInstalledApps()) || [];
    }
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === 'scan-health') await scanHealth();
  if (action === 'scan-clean') await scanClean();
  if (action === 'go-custom') {
    state.page = 'custom';
    if (!state.cleanable) await scanClean();
    render();
  }
  if (action === 'go-health') {
    state.page = 'health';
    render();
  }
  if (action === 'toggle-clean') {
    const id = target.dataset.id;
    if (state.selectedCleanIds.has(id)) state.selectedCleanIds.delete(id);
    else state.selectedCleanIds.add(id);
    render();
  }
  if (action === 'toggle-all-clean') {
    const ids = (state.cleanable?.locations || []).map((item) => item.id);
    const allSelected = ids.every((id) => state.selectedCleanIds.has(id));
    state.selectedCleanIds = new Set(allSelected ? [] : ids);
    render();
  }
  if (action === 'clean-selected') {
    const ids = [...state.selectedCleanIds];
    const result = await runTask('Cleanup complete.', () => window.rice2k.cleanLocations(ids));
    if (result) {
      showToast(`Removed ${result.removedFiles} files and freed ${bytes(result.removedSize)}.`);
      await scanClean();
    }
  }
  if (action === 'load-processes') state.processes = await runTask('App scan complete.', () => window.rice2k.listProcesses()) || [];
  if (action === 'sleep-process') {
    const name = target.closest('tr')?.querySelector('td')?.textContent?.trim() || 'this app';
    if (window.confirm(`Put ${name} to sleep? Unsaved work in that app can be lost.`)) {
      const result = await runTask('', () => window.rice2k.sleepProcess(Number(target.dataset.pid)));
      showToast(result?.message || 'Sleep request finished.');
      state.processes = await window.rice2k.listProcesses();
      render();
    }
  }
  if (action === 'reveal') await window.rice2k.revealPath(target.dataset.path);
  if (action === 'load-drivers') state.drivers = await runTask('Driver scan complete.', () => window.rice2k.listDrivers()) || [];
  if (action === 'load-updates') state.updates = await runTask('Software scan complete.', () => window.rice2k.listSoftwareUpdates());
  if (action === 'load-startup') state.startup = await runTask('Startup scan complete.', () => window.rice2k.listStartup()) || [];
  if (action === 'open-startup-settings') await window.rice2k.openStartupSettings();
  if (action === 'load-apps') state.apps = await runTask('App list refreshed.', () => window.rice2k.listInstalledApps()) || [];
  if (action === 'open-app-settings') await window.rice2k.openExternal('ms-settings:appsfeatures');
  if (action === 'choose-duplicate-folder') {
    const folder = await window.rice2k.pickFolder();
    if (folder) {
      state.duplicates = await runTask('Duplicate scan complete.', () => window.rice2k.scanDuplicates(folder));
    }
  }
});

render();
scanHealth();

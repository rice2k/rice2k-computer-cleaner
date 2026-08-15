# Rice2k Computer Cleaner

Rice2k Computer Cleaner is a Windows desktop cleanup app inspired by the dark, scan-first cleaner layout shown in the reference screenshots. The design is original, uses a custom Rice2k app icon, and keeps cleanup actions conservative.

## Features

- Health Check dashboard with PC health score and issue categories
- Custom Clean for safe junk scanning and cleanup
- Browser cache scanning for Edge, Chrome, and Firefox
- Performance Optimizer that lists heavy background apps and can put selected apps to sleep after confirmation
- Software Updater page powered by Windows Package Manager (`winget`) in review mode
- Driver Updater page that lists driver ages in review mode
- Startup Manager that lists Windows startup entries and opens Windows Startup settings
- Uninstaller page that lists installed apps and opens Windows Apps settings
- Duplicate Finder that hashes files and reports duplicate groups without deleting them
- Custom Windows app icon generated for Rice2k Computer Cleaner

## Safety model

The cleaner only deletes safe cache and temp files that can be recreated by Windows or apps. It does not delete documents, downloads, cloud files, registry keys, drivers, installed apps, or duplicate files.

See [docs/SAFETY.md](docs/SAFETY.md) for the detailed cleanup boundaries.

## Screens and style

The app uses a CCleaner-like dark workspace pattern:

- left sidebar navigation
- top strip with tabs where useful
- health score card
- issue tables with orange counts
- bottom action bar with scan and resolve buttons

The app name, icon, colors, and code are original.

## Requirements

- Windows 10 or Windows 11
- Node.js 20 or newer for development
- Windows Package Manager (`winget`) is optional and only needed for the Software Updater page

## Run from source

```powershell
npm install
npm start
```

## Build installer and portable app

```powershell
npm run dist
```

Build output appears in the `release` folder.

The first packaging run downloads `electron-builder` through `npx`.

## Development scripts

```powershell
npm run lint
```

The smoke test checks the required project files and verifies that the cleaner module loads.

## Project structure

```text
assets/       App icon PNG and ICO files
docs/         Safety notes
renderer/     HTML, CSS, and browser-side app UI
scripts/      Local checks
src/          Electron main process, preload bridge, and cleaner engine
```

## Notes

- Driver updates and app updates are review-only.
- Registry cleaning is intentionally not implemented.
- Duplicate finding is report-only.
- Some cleanup targets may skip locked files, which is normal while apps are running.

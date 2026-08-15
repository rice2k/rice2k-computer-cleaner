# Safety Notes

Rice2k Computer Cleaner is designed to be conservative.

## What it deletes

- User temp files older than one hour
- Windows temp files older than one day
- Browser cache files for Microsoft Edge, Google Chrome, and Firefox
- Windows thumbnail cache files
- Old log, temp, backup, and similar files inside the user's temp directory

## What it does not delete

- Documents, photos, videos, music, downloads, desktop files, or project files
- Registry keys
- Drivers
- Installed applications
- Duplicate files found by the duplicate finder
- Cloud drive content

## Review-only areas

The app can list outdated software through Windows Package Manager, driver age data through Windows system inventory, installed applications, and startup entries. Those areas are intentionally review-only or route to Windows settings because changing them can affect the whole machine.

## Process sleep

The Performance Optimizer can terminate a selected non-essential background process after confirmation. Closing a process can lose unsaved work in that app, so it asks first and skips protected Windows processes.

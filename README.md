# MONTRA Trial Management System (TMS)

A mobile-first PWA starter for recording Montra Electric trial trips. The front end is a static GitHub Pages site; Google Sheets + Apps Script provide the data layer.

## Package contents

- `index.html` — mobile-first driver, manager and admin screens.
- `Code.gs` — Apps Script API and database logic.
- `appsscript.json` — explicitly enables the Google Apps Script V8 runtime (required for `const`, `let` and arrow functions used in `Code.gs`).
- `manifest.json`, `sw.js` — installable PWA support.
- `icon-192.png`, `icon-512.png`, `montra-mark.png`, `montra-logo.png` — temporary placeholder assets.

## Trial and trip logic

1. Admin creates a trial, enters the vehicle, customer, location, drivers, materials and targets.
2. The system creates an individual 8-digit driver PIN for each driver assigned to that trial. The PIN maps directly to that driver and trial.
3. Driver signs in with the PIN and opens a shift by entering shift, material, opening odometer and opening SOC.
4. `Loading In` starts the first trip. Each subsequent `Loading In` closes the previous trip and starts the next trip in the same action.
5. `Loading Out`, `Unloading In` and `Unloading Out` are time-stamped operational events.
6. `Charging` closes the active trip and asks for SOC before charging. `Complete Charging` asks for SOC after charging. Only charging requires these extra SOC entries.
7. `Break` closes the active trip. The next `Loading In` starts a new trip.
8. `Shift End` closes any open trip and asks for closing odometer, closing SOC and material confirmation.
9. Shift kilometres = closing odometer − opening odometer.
10. Shift SOC used = opening SOC + all SOC gained while charging − closing SOC.

The SOC result is a percentage-point consumption estimate, not kWh energy consumption.

## Database tabs

`initializeSheets()` creates these tabs and adds missing columns without deleting existing rows:

- `Trials`
- `Users`
- `Shifts`
- `Events`
- `Trips`
- `Audit`

Date/time fields are stored as text. `normalizeDate_()` also handles values that Sheets may already have converted to Date objects.

## Google Apps Script setup

1. Create a new Google Sheet in the Google account that will own the trial database. Name it `Montra TMS Database`.
2. Open **Extensions → Apps Script**.
3. In Apps Script, open **Project Settings** and enable **Show `appsscript.json` manifest file in editor**.
4. Return to the editor, open `appsscript.json`, and replace its contents with the supplied `appsscript.json` file. This explicitly sets `"runtimeVersion": "V8"`. Save the project.
5. Open `Code.gs`, replace its contents with the supplied `Code.gs` file, and save.
6. In Apps Script **Project Settings**, confirm the time zone is **Asia/Kolkata**.
7. Open **Project Settings → Script Properties → Add script property**. Add:
   - Property: `ADMIN_PIN`
   - Value: a strong initial admin PIN of at least 8 characters. Keep it private.
6. In the Apps Script function selector, run `initializeSheets`. Approve the requested permissions. This creates/migrates the tabs.
9. Run `setupAdmin` once. It creates the initial admin user named Amritesh using the `ADMIN_PIN` property.
10. Run `testWriteReadRoundTrip`. It should return `PASS`. It temporarily writes a test Audit row, reads it back, and removes it.
11. Run `testTripCalculations`. It should return `PASS` for the sample SOC calculation.
12. Select **Deploy → New deployment → Web app**.
13. Set **Execute as** to **Me**.
14. For the pilot only, set **Who has access** to **Anyone**, if your organisation permits it. Deploy and copy the URL ending in `/exec`.
15. In `index.html`, replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` in the `API_URL` constant with that `/exec` URL.
16. If you later change `Code.gs`, use **Deploy → Manage deployments → Edit → New version → Deploy**. This preserves the web app URL.

If your Montra Google Workspace administrator blocks Apps Script web apps with Anyone access, do not try to bypass that restriction. Ask IT for an approved deployment approach.

### Important: fix `ParseError: Unexpected token =` when saving Code.gs

This backend uses JavaScript V8 syntax, including arrow functions (`=>`) and `const`/`let`. If the Apps Script project is using the legacy Rhino runtime, it can report `Unexpected token =` at an arrow function. Install the supplied `appsscript.json` manifest with `"runtimeVersion": "V8"` as described above, save, then paste/save `Code.gs` again. Do not remove the `=` from the arrow function: `=>` is valid JavaScript in V8.

## GitHub Pages setup

1. Sign in to GitHub and create a new repository, for example `montra-trial-management`.
2. Upload the files in this folder to the repository root. Do not upload the temporary `frontend.js` or `backend-check.js` files if you create them during local syntax checking.
3. In the repository, open **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site. Open the HTTPS Pages URL on a phone.
7. On Android, use the browser's Install app / Add to Home Screen option. On iPhone, use **Share → Add to Home Screen**.
8. Replace `montra-logo.png` and `montra-mark.png` with official approved brand assets when supplied. Keep `icon-192.png` and `icon-512.png` as square PNG icons or replace them with approved exports.

## First-use flow

1. Open the GitHub Pages URL and sign in using the admin PIN from Script Properties.
2. In Admin, create a trial and enter one driver name per line.
3. Copy each generated one-time driver PIN and provide it to the relevant driver. The full PIN is shown only at creation/reset; the database stores a salted hash.
4. Create manager/utilization/Value Champion users in the access section. For Value Champions, select the trials they may see.
5. Drivers sign in with their individual PIN, open the shift, record events, and end the shift.
6. Managers/admins select a trial and date range to view the dashboard, export trip CSV and shift/KM/SOC CSV, or share a WhatsApp summary.

## Access roles

- `admin`: creates trials/users, resets PINs, changes trial status, and views all trial dashboards.
- `driver`: sees only the assigned trial and can record their own shifts.
- `manager`: views all trial dashboards.
- `utilization`: views all trial dashboards.
- `value_champion`: views only the trials listed in their user record.

Users can change their PIN from the signed-in screen. Admin can issue a new PIN if someone forgets it. For security, existing PINs cannot be read back; Admin resets them instead. If the Admin PIN itself is forgotten, update the `ADMIN_PIN` Script Property and run `setupAdmin()` again; it resets the existing admin PIN hash.

## Security and licensing notes — read before field use

- GitHub Pages hosting is free for public repositories and eligible plans; Google Apps Script and Sheets have usage quotas. This design aims for zero incremental cost, but Google Workspace policies and quotas apply.
- The API uses JSONP GET requests to match the requested cross-origin architecture. This means request parameters, including PINs at login, may appear in browser history, proxy logs or service logs. The `Anyone` web app is also publicly reachable. PIN hashing and short-lived server sessions help, but do **not** make this equivalent to a properly authenticated enterprise API.
- Use only non-sensitive trial operational data during the pilot. Do not put personal, confidential customer, commercially sensitive or regulated data into this prototype until Montra IT/security approves it.
- For production, prefer an authenticated POST API with Microsoft Entra ID / an approved backend, or another organisation-approved identity layer. That may require tenant administrator involvement and potentially paid services.
- The Excel + Power Automate route was not selected for this MVP because HTTP-trigger authentication/entitlement and concurrent Excel workbook writes need tenant-specific validation. It can be reconsidered if IT provides an approved API/authentication pattern and a concurrency-safe datastore.
- Email summaries, WhatsApp API messaging, offline trip submission/synchronisation, GPS, photo uploads, bulk vehicle assignment and full admin trip-edit screens are not implemented in this MVP. WhatsApp sharing opens a pre-filled message; it does not send automatically.

## Validation checklist before field deployment

- [ ] Set `API_URL` and confirm `health` responds (the page will surface API errors).
- [ ] Run `initializeSheets`, `setupAdmin`, `testWriteReadRoundTrip` and `testTripCalculations`.
- [ ] Create a sample trial with two drivers and issue PINs.
- [ ] Sign in as each driver and verify that each sees only the assigned trial.
- [ ] Open a shift and test `Loading In → Loading Out → Unloading In → Unloading Out → Loading In`; verify exactly one completed trip and a new open trip.
- [ ] Test Charging with before/after SOC; verify trip closure and SOC gain.
- [ ] Test Break; verify trip closure and that the next Loading In starts a new trip.
- [ ] Test Shift End; verify trip closure, total kilometres and SOC used.
- [ ] Test invalid event order, duplicate taps, manual event time, app reload during an open shift and date filters.
- [ ] Verify dashboard combined results for both drivers/shifts and CSV exports.
- [ ] Obtain Montra IT/security approval before inviting real field users.

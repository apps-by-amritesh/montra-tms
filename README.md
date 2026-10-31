# MONTRA Trial Management System — Version 2.0 Pilot

A mobile-first, installable PWA for Montra Electric field trials. The app is designed for GitHub Pages hosting with Google Sheets + Google Apps Script as the initial backend.

## What's included

- `index.html` — mobile-first driver, manager, Value Champion and admin UI.
- `Code.gs` — Apps Script V8 API and sheet data model.
- `appsscript.json` — explicitly enables Apps Script V8.
- `manifest.json`, `sw.js` — installable PWA and app-shell cache.
- `assets/montra-logo.svg` and `montra-logo.svg` — supplied Montra logo artwork.
- `montra-logo.png` / `assets/montra-logo.png` — PNG conversion of the supplied SVG for compatibility.
- `montra-mark.png` — supplied eagle picture mark used as the app icon source.
- `assets/icon-192.png`, `assets/icon-512.png` — icons derived from the supplied Montra eagle mark.
- `assets/montra-rhino-tipper.jpg`, `assets/montra-rhino-trailer.png` — supplied vehicle images for future trial-type cards.
- `icon-192.png`, `icon-512.png` — duplicate root-level icon files for convenience.
- `tests/logic-tests.js` — local calculation/state tests.

## Version 2.0 changes

1. PINs accept 4–10 digits. Admin enters the PIN when creating a user or assigning a replacement PIN; PINs are stored as salted hashes, not recoverable plaintext.
2. Admin workspace is divided into Overview, Trials, Users & PINs, Live Operations, Reports and Settings.
3. Driver interface has English/Hindi toggle, large event buttons, a highlighted next event, trip count, vehicle, shift and material context.
4. A trial can define up to 8 plant stages with custom In/Out event names and Hindi labels. Optional events can be skipped; a new first-stage In closes the previous trip and starts the next one.
5. Loading Out and intermediate plant events can be optional. The default flow is Loading In → optional Loading Out → optional Unloading In → required Unloading Out → next Loading In.
6. If the driver has not punched for 30 minutes, the first plant In / Loading In can be entered as a recovery punch, with an audit flag.
7. Charging closes the current trip and records the pre-charge SOC. Charging Complete records the post-charge SOC. Charging duration and SOC added are calculated from those timestamps and readings.
8. Break closes the current trip. Shift End closes any active trip and requires closing odometer and SOC.
9. Every punch is written to IndexedDB before the GPS request or network sync. GPS is requested in the background. Pending events are queued and synchronised when connectivity returns.
10. Local session, active shift, recent events and trip state are restored after reopening the PWA on the same device.
11. Manager dashboard has monthly portfolio cards. Trial detail has Summary, Trip Details, Plant & Movement, Charging & Energy, and Reports & History tabs.
12. Admin/manager can edit trip records with an audit entry and conclude a trial with outcome, delay reason and battery SOH.
13. Battery capacity (kWh) is configured at trial creation; battery SOH is entered at trial conclusion. The estimate is: `Energy kWh = SOC percentage-points used / 100 × nominal battery capacity × SOH / 100`; `Efficiency = total km / estimated kWh`.
14. Excel export is a formatted multi-worksheet Excel SpreadsheetML workbook (`.xls` XML). Open it in Excel and use Save As → `.xlsx` if the modern XLSX format is required.
15. Backend fields are reserved for per-trip earnings and incentives, but the feature is disabled by default.

## Branding

The supplied brand guide specifies:

- Montra Electric Red: `#D6001C`
- Steel Grey Dark: `#505050`
- Black: `#000000`
- White: `#FFFFFF`
- Aero headline typeface; Arial / Calibri secondary fallback.

The interface uses the supplied logo in a steel-grey logo panel, red primary actions and restrained grey surfaces. The app icon uses the supplied eagle picture mark; the supplied logo artwork is not distorted or recoloured.

## Setup — Google Sheets + Apps Script

### 1. Create the database

1. Create a Google Sheet named `Montra TMS Database`.
2. Open Extensions → Apps Script.
3. In Project Settings, enable **Show `appsscript.json` manifest file in editor**.
4. Replace the manifest with the contents of this package's `appsscript.json` (this sets `runtimeVersion` to `V8`).
5. Replace `Code.gs` with this package's `Code.gs`.
6. Save.

### 2. Initialise sheets and admin

1. Run `initializeSheets()` once. It creates the tabs and adds missing columns without deleting existing rows.
2. In Apps Script → Project Settings → Script Properties, add `ADMIN_PIN` with a 4–10 digit PIN you choose. For security, prefer 6 or more digits even though 4 is supported.
3. Run `setupAdmin()` once. It creates or resets the admin account using the Script Property.
4. Run `testWriteReadRoundTrip()`; expected result: `PASS: Sheet write/read round trip.`
5. Run `testTripCalculations()`; expected result: `PASS: SOC calculation = 130 percentage points.`

### 3. Deploy the API

1. Deploy → New deployment → Web app.
2. Execute as: **Me**.
3. Access: **Anyone** only if Montra IT/security approves this pilot architecture.
4. Deploy and copy the Web App URL ending in `/exec`.

### 4. Configure the PWA

1. Open `index.html` in a code editor.
2. At the top of the script, replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` in `API_URL` with the deployed `/exec` URL.
3. Upload the complete contents of this folder to the root of a GitHub repository, preserving the `assets/` folder.
4. In GitHub → Settings → Pages, deploy from the main branch and root folder.
5. Open the resulting `https://<account>.github.io/<repo>/` URL on the phone.
6. Allow location access if event GPS is required. Install the PWA from the browser's Install / Add to Home Screen option.

### 5. Create users and trials

1. Log in as Admin using the `ADMIN_PIN` configured earlier.
2. Open Users & PINs → Add user. Set a manual 4–10 digit PIN and role. For a driver or Value Champion, set the permitted Trial ID(s).
3. Note the generated User ID displayed by the backend only if you inspect the API response; the user list shows the IDs in the table's trial scope but does not expose PINs.
4. Open Trials → Create trial. Configure Trial ID, vehicle, customer, materials, target, battery capacity and plant stages. Add assigned driver and Value Champion User IDs if you use the explicit assignment lists.
5. Provide the PIN directly to the user. If forgotten, Admin assigns a new PIN; the original cannot be recovered from the hash.

## Script Properties and triggers

- Required Script Property: `ADMIN_PIN` (4–10 digits; use 6+ for the pilot).
- Required time-driven triggers: **none** in this version. Driver events sync from the PWA when the device reconnects, regains focus or the user taps Sync now. No MailApp or scheduled notification trigger is configured.

## Data tabs

- `Trials` — trial portfolio, workflow, targets, battery details and outcome.
- `Users` — role, trial scope, salted PIN hash and active status.
- `Shifts` — shift opening/closing odometer, SOC, material, km and SOC used.
- `Events` — timestamped event punches, GPS, correction reason and sync identifiers.
- `Trips` — one record per trip, short trip number (`T-001`, restarting by shift), duration and closure reason.
- `Audit` — admin/manager corrections and important actions.
- `Charging` — charging start/end timestamps, before/after SOC, SOC added and GPS.
- `TrialStages` — configured plant stages and event labels.

## Offline behaviour and limitations

- The first app load and first successful login require connectivity.
- After the app shell has been cached and a user has logged in successfully, the same device can reopen the saved active shift offline.
- Each driver punch is stored in IndexedDB before GPS/network work. Sync occurs when connectivity is available.
- GPS is best-effort: the browser/device must support geolocation, the app must be served over HTTPS, and the user must grant permission. If GPS is unavailable, the punch is still stored with blank coordinates.
- Do not clear browser site data or uninstall the PWA while unsynchronised punches exist. Local browser storage is device-specific and is not a backup.
- The current offline implementation queues punch events; admin setup, new user creation, trial creation and manager dashboard refresh require connectivity.
- The browser may suspend background work. The queue syncs on reconnect, app focus and visibility change; it is not a guaranteed operating-system background service on every phone.

## Important security / production warning

This pilot retains the requested JSONP/GET Apps Script pattern. It is not suitable for confidential production deployment without a security review:

- A public Apps Script Web App with `Anyone` access exposes an internet-reachable endpoint.
- PINs and session tokens are sent as query-string payloads for JSONP calls; server/browser infrastructure may log URLs.
- A four-digit PIN has low entropy. Use at least six digits for a pilot and avoid reusing employee or personal PINs.
- PIN hashes are not plaintext/recoverable; Admin resets a forgotten PIN instead of reading it.
- Location coordinates are sensitive operational data. Obtain company approval and inform drivers before collection.
- For production, replace JSONP with an authenticated API using an approved identity provider (for example Microsoft Entra ID) and an access-controlled database. This may require IT configuration and/or paid Microsoft/Azure licensing.

## Cost and service requirements

The pilot uses GitHub Pages and Google Apps Script/Sheets without a paid hosting service. It is intended to fit within the standard free service quotas for a small trial pilot. Google Workspace account policies, Apps Script quotas, storage growth and request volume still apply. No SMS/WhatsApp API or paid notification service is included. The WhatsApp button opens the user's WhatsApp share composer.

## Validation performed in this package

- JavaScript syntax check of `index.html` inline script using Node.js.
- JavaScript syntax check of `Code.gs` using Node.js parser (Apps Script services are not executed by Node).
- Local logic tests for trip boundaries, optional event skipping, charging SOC arithmetic, energy efficiency arithmetic and plant dwell/movement calculations.
- ZIP integrity test.

Not performed: deployment to your Google account, Apps Script live execution, actual phone GPS testing, multi-user live concurrency testing, or a live Google Sheets write/read round trip. Run the two Apps Script test functions in your own project after initialising the sheets.

# MONTRA Trial Management System — Version 2.1.0 Pilot

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

## Version 2.1.0 changes

1. PINs accept 4–10 digits. Admin enters the PIN when creating a user or assigning a replacement PIN; PINs are stored as salted hashes, not recoverable plaintext. A separate keyed PIN fingerprint (using Script Property `PIN_PEPPER`) is used to enforce uniqueness.
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
16. Admin can edit user profiles, deactivate accounts, reset PINs, and prepare WhatsApp welcome/reset messages with the app link and PIN for manual sending.
17. Driver and Value Champion assignment is performed from the trial profile using selectable user checklists. User creation no longer requests trial assignments. Manager and Utilization trial scope remains in the user profile.
18. Trial profile edits include driver and Value Champion assignment changes while the trial is ongoing.
19. Dashboard portfolio metric cards are shown only on Overview; other tabs show only their own workspace content. Mobile layout is constrained to the device viewport with horizontal scrolling contained inside data tables.
20. Driver start includes an explicit no-assignment recovery screen with Refresh and Sign out. Active driver screens include Sign out; completed shifts include Start another shift and Sign out.
21. If a driver starts a shift offline, the local shift-start record is queued and sent before that shift's punches. A second shift is held until the pending offline shift start has synchronised, preventing a second shift from overwriting the pending start record.
22. PWA update handling uses a versioned service-worker cache, network-first navigation, an update check, and a safe app-cache purge. Cache purge never deletes IndexedDB operational data and is blocked while a shift start or punches remain pending.
23. PWA icons use a white background, Montra-red eagle mark and the label “MONTRA TMS”.

## Branding

The supplied brand guide specifies:

- Montra Electric Red: `#D6001C`
- Steel Grey Dark: `#505050`
- Black: `#000000`
- White: `#FFFFFF`
- Aero headline typeface; Arial / Calibri secondary fallback.

The interface uses the supplied logo in a steel-grey logo panel, red primary actions and restrained grey surfaces. The app icon uses the supplied eagle mark recoloured in Montra red on white, with “MONTRA TMS” embedded below the mark. The header logo artwork is kept separate from the app icon.


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

## Troubleshooting: “Can't find variable: endpoint”

If the login screen shows `Can't find variable: endpoint`, replace `index.html` with the corrected file from the latest package. The API helper must use the configured `API_URL` (or the locally saved URL); older copies referenced an undefined variable named `endpoint`. After uploading the corrected frontend, hard-refresh the browser or close and reopen the installed PWA so the updated service-worker cache is activated.

The Apps Script URL must be the deployed Web App URL ending in `/exec`, not the Apps Script editor URL.



## Version 2.2.0 release notes

- Location capture is GPS-first. If GPS is unavailable or permission is denied, the user is prompted to enable location and can continue by entering the plant/site location manually. The record explicitly stores whether the location came from GPS or manual entry; coordinates are never fabricated.
- Operational entries and administrative changes retain browser/device metadata, timestamps, and available GPS/manual location details in the Events, Shifts, Charging, and Audit sheets.
- Admin Settings includes controls to load synthetic dashboard test data and delete only rows tagged `IsDemo=YES`. Demo rows are clearly labelled and do not contain fabricated GPS coordinates.
- Driver trip-punch and utility actions are placed before supporting shift details and event history.
- Form controls use a 16px minimum font size to prevent iOS Safari focus zoom.
- Buttons show immediate progress feedback while asynchronous work is underway.
- The app header uses the full original Montra SVG logo; the launch/login brand uses a TMS mark with faint truck silhouettes and the two-line title “Montra Electric” / “Trial Management System”.

### Backend deployment note
Deploy the included `Code.gs` as the Apps Script Web App and initialize sheets from the Admin/Apps Script setup before publishing the updated frontend. Existing sheets are extended with new metadata columns; existing operational rows are preserved. Do not deploy only `index.html`, because location metadata, audit capture, and demo-data controls require the updated backend.

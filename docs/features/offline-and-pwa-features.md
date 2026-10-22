# Offline Mode & Installable App (PWA)

Answers the "Basement Problem": technicians can keep working with no signal and their changes are replayed when the connection returns. Source: `frontend/src/sw.ts`, `frontend/vite.config.ts` (vite-plugin-pwa), `frontend/src/main.tsx`; backend `common/idempotency.ts`.

## Installable app

The app ships a web manifest ("ApexHVAC Field Service", theme `#0284c7`, 192/512 icons) and can be installed to a phone or desktop home screen. The service worker precaches the app shell and updates automatically (`registerType: autoUpdate`; `/sw.js` is served with `no-cache` so deploys reach installed clients).

## Offline reads

`GET /api/v1/*` uses network-first with a cached fallback (cache `api-cache`, up to 50 entries, 24 hours), so recently opened jobs, customers and equipment still load without signal.

## Offline writes

Every non-GET API request that fails because the network is down is stored in an IndexedDB-backed Background Sync queue (`api-writes`, kept 7 days) and replayed in order:

- Replays fire on the browser `online` event, on service-worker activation, and after a session refresh.
- A 401 pauses the queue and tells the page to re-authenticate (`sync-auth` message); 5xx and network errors are retried; other 4xx are dropped.
- After a drain the worker messages the page, which reloads its data store.

## Safe replays (idempotency)

Queued writes carry an `x-idempotency-key`. The backend stores the first response per `(user, key)` and returns it for any replay, so a request whose response was lost is never applied twice (no duplicate payments or jobs). A key reused for a different method / path / body is rejected (`422 IDEMPOTENCY_KEY_REUSED`); a retry that arrives while the first is still running gets `503` with `Retry-After`. Failed requests free their key; stored keys are pruned after 7 days by the daily sweep.

## Limitations

- Offline coverage is only as good as what was loaded before signal dropped; pages never opened have no cached data.
- Queued edits are not merged: if two people edit the same record, the last replay wins (backend validation still applies and rejected writes are dropped).

## Updates: sync banner, app shell, refused writes
- Page navigations (`/invoices`, `/technician_portal`, …) get the cached app shell, so a reload with no signal still opens the app. `/api/v1/auth/*` is never queued.
- With no network every pending write is answered `202 queued` immediately, and the UI says "saved on this phone". Lists reload from the server only once the queue is empty.
- Writes the server refuses after being queued (job cancelled meanwhile, rule changed) are stored in Cache Storage and shown in `SyncBanner` until dismissed. A new build reloads the page once if it takes over within 10 s of opening.

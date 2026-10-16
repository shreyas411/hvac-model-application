# Security & Authentication

Hardening added around the backend API and login flow (closes the "Authorization Bypass" loophole). Sources: `backend/src/common/auth.ts`, `backend/src/app.ts`, `frontend/src/services/api.ts`, `frontend/src/services/auth.ts`.

## Sessions

- Login sets two **httpOnly cookies**: `hvac_at` (access, 1 hour, path `/api/v1`) and `hvac_rt` (refresh, 7 days, path `/api/v1/auth`). Tokens are never returned in the response body or stored in `localStorage` (old keys are cleared on load).
- Cookies are `Secure` outside local dev; `COOKIE_SAMESITE` defaults to `lax` (use `none` only when web and API are on different sites).
- A `Bearer` header still works for API clients.
- On reload the app calls `/auth/me`; a 401 triggers one silent `/auth/refresh`. A network error keeps the user on the login screen instead of signing them out.
- Cookie-authenticated writes must send `x-requested-with: apexhvac` (CSRF guard); the frontend adds it to every request, including queued offline replays.
- Refresh tokens are rejected as access tokens; JWT issuer, audience and algorithm are checked for Supabase tokens.

## Local dev login

With `APP_ENV=local` and no Supabase secret, login uses passwords stored on the `users` table (scrypt hash, new `password` column) and locally signed JWTs; `x-dev-user` still works. Dev auth cannot be enabled in a deployed environment: the API refuses to boot unless `APP_URL` is localhost, and `APP_ENV` defaults to `production` when `NODE_ENV=production`. Unknown emails take the same time as wrong passwords (no account enumeration).

## HTTP hardening

- `helmet` headers; `Cache-Control: no-store` on `/api`; request ids accepted only if they match `[\w-]{1,64}`.
- Rate limits: auth routes 30 per 15 minutes per IP (300 in local); other API calls 600 per minute per user. `TRUST_PROXY` sets proxy hops so client IPs are right behind a reverse proxy.
- Small JSON limit (100 KB) on auth routes, 5 MB for signed-in users; signature data URLs must be `png`/`jpeg`/`svg` and under 1 MB.
- CORS uses an explicit origin list from `APP_URL` (comma separated) with credentials.
- `WORKER_INLINE` defaults on only in local dev so replicas do not all run the sweeps.
- Frontend on Netlify: `netlify.toml` proxies `/api/*` to the backend so cookies are first party, and sets `nosniff`, frame-deny, referrer and HSTS headers.

## Data safety

- `POST /import` replaces all data and now requires `?confirm=wipe`.
- The last admin user cannot be deleted (`LAST_ADMIN`).
- Money and compliance actions (invoice issue/void/credit/refund, job invoicing, data import) go to an append-only `audit_log`; jobs keep their own audit trail.
- Database-level guards: RLS, non-negative amount checks, one live invoice per quotation, extra lookup indexes.
- Notification sending claims a row (`ready_to_send` to `sending`) with a conditional update so it is never sent twice; rows stuck in `sending` for 5 minutes return to the queue.

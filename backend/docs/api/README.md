# API Reference

One file per module. Add a new module = add `<module>.md` here and a row below.

Base path `/api/v1`. JSON in and out. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant.

## Modules

| Module | Doc |
|---|---|
| auth | [auth.md](auth.md) |
| users | [users.md](users.md) |
| settings | [settings.md](settings.md) |
| technicians | [technicians.md](technicians.md) |
| customers | [customers.md](customers.md) |
| equipment | [equipment.md](equipment.md) |
| requests | [requests.md](requests.md) |
| jobs | [jobs.md](jobs.md) |
| quotations | [quotations.md](quotations.md) |
| invoices | [invoices.md](invoices.md) |
| inventory | [inventory.md](inventory.md) |
| notifications | [notifications.md](notifications.md) |
| audit | [audit.md](audit.md) |
| certificates | [certificates.md](certificates.md) |
| reports and dashboard | [reports.md](reports.md) |
| data | [data.md](data.md) |
| checklists | [checklists.md](checklists.md) |
| maintenance | [maintenance.md](maintenance.md) |

## Conventions

- **Auth:** the web app signs in with httpOnly session cookies (`hvac_at`, `hvac_rt`); cookie-authenticated writes must send `x-requested-with: apexhvac`. API clients may send `Authorization: Bearer <Supabase JWT>`. With `APP_ENV=local` and no Supabase secret, send `x-dev-user: dev-admin|dev-dispatcher|dev-technician|dev-accountant` (or log in with a local password). Every account belongs to a company and all data is scoped to it: `POST /auth/login` takes `{ company, email, password }` (company = its slug), and `x-dev-company` picks the company for `x-dev-user` (default `default`). Create one with `npm run company:create` (see `docs/COMPANIES.md`). Only `/auth/login|refresh|logout` and the health routes are public.
- **Idempotency:** a write may carry `x-idempotency-key` (1-64 word characters). It runs once per (user, key); replays get the stored response, and reuse with a different method/path/body is `422 IDEMPOTENCY_KEY_REUSED`. A replay while the first request is running gets `503` + `Retry-After`. Keys are pruned after 7 days.
- **Rate limits:** `/auth/*` 30 requests per 15 minutes per IP; everything else 600 per minute per user (`429`).
- **Lists** return `{ data: [...], nextCursor }` and accept `?limit` (the page size, 1-200, default 50), `?q` (text search) and `?status`. Page either by `?cursor` (id of the last row of the previous page) or by `?page` (1-based): with `?page` the response also carries `total`, the number of rows matching the filters. The web UI uses `?page` with `limit` set to the chosen page size (10, 25, 50 or 100).
- **List filters:** customers also take `?type` (`residential|commercial|landlord`), `?inactive` and `?archived=true|false`; certificates take `?customerId`, `?jobId` and `?type`. `GET /certificates` now returns the paged shape instead of a bare array.
- **Sorting:** lists also take `?sort=<column>&dir=asc|desc`. Each module allows its own columns (plain columns plus `relation.column` for to-one relations, e.g. quotations `customer.name`); anything else is ignored. Ties fall back to newest first. The web UI drives this from clickable column headers.
- **Soft delete:** `DELETE /<resource>/:id` on customers, requests, jobs, quotations, invoices, equipment, parts, technicians, users, checklist templates, maintenance agreements and certificates hides the row (`isDeleted`/`deletedAt`) instead of removing it; reads skip hidden rows. A record that is still referenced answers `409 IN_USE` (or `422 INVALID_REFERENCE` for technicians) with a reason. Deleting a customer frees its email for reuse.
- **Inactive flag:** users, locations, equipment, parts and checklist templates carry `inactive` (list filter `?inactive=true|false`, alias `?active`). Inactive users cannot sign in (`401`).
- **Expired flag:** quotations, certificates, equipment (warranty) and technicians (Gas Safe / F-Gas licence) return a computed `expired` boolean (date-only compare against today).
- **UK validation:** postcodes must be valid Royal Mail format and are stored as `LS1 4AB`; phone numbers match `+?[\d\s()-]{7,20}`; customer emails are trimmed and lower-cased. Customer-facing messages show dates as `19 Oct 2026`.
- **Errors** are RFC 7807 (`application/problem+json`): `{ title, status, code, detail }`, plus `issues` for validation errors.
- **Numbers** (`JOB-2026-0001`, `QTE-…`, `INV-…`, `SR-n`) and all totals are assigned and computed by the server.
- **Dates** are `YYYY-MM-DD`, times are `HH:MM`, money is a number rounded to 2dp.

| Status | Codes |
|---|---|
| 400 | `VALIDATION`, `BAD_JSON` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN`, `FEATURE_DISABLED` (also technician not qualified: missing skill, licence or expired licence) |
| 404 | `NOT_FOUND` |
| 409 | `SCHEDULE_CONFLICT`, `INVALID_TRANSITION`, `ALREADY_CONVERTED`, `NOT_ACCEPTED`, `INSUFFICIENT_STOCK`, `DUPLICATE_SKU`, `NOT_EDITABLE`, `NOT_DRAFT`, `NOT_PAYABLE`, `HAS_PAYMENTS`, `INVOICE_VOID`, `LOCATION_IN_USE`, `ALREADY_SENT`, `REQUEST_CANCELLED`, `JOB_CLOSED`, `JOB_NOT_ACTIVE`, `JOB_INVOICED`, `JOB_NOT_COMPLETED`, `NOT_CREDITABLE`, `HAS_CREDITS`, `ALREADY_REFUNDED`, `DUPLICATE_PAYMENT_REFERENCE`, `LAST_ADMIN` |
| 422 | `NOT_COMPLETABLE`, `REASON_REQUIRED`, `EMPTY_INVOICE`, `NOTHING_TO_INVOICE`, `OVER_CREDIT`, `EQUIPMENT_NOT_ON_JOB`, `CONFIRMATION_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `BAD_IDEMPOTENCY_KEY`, `OVERPAYMENT`, `INVALID_LOCATION`, `INVALID_TIME`, `INVALID_QUANTITY`, `CONSENT_REQUIRED`, `CHANNEL_NOT_PREFERRED` |

### Bulk routes

`POST /<module>/bulk-*` takes `{ ids: uuid[1..100], ...options }` (jobs use `jobIds`) and returns `200 { results: [{ id, ok, error?: { code, message } }] }` in request order, duplicates collapsed. The HTTP status is `200` even when some ids fail: check each `ok`. Each id runs the normal single-record checks and is saved on its own. A bad body (empty, over 100, non-UUID) is `400 VALIDATION` for the whole call; roles match the single-record route. `/jobs/bulk-assign` also returns the updated `job` per entry.

## Health (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/healthz` (root, not under `/api/v1`) | Process is up |
| GET | `/readyz` (root) | 200 when the DB answers `SELECT 1`, else 503 |


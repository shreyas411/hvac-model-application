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
| reports and dashboard | [reports.md](reports.md) |
| data | [data.md](data.md) |

## Conventions

- **Auth:** `Authorization: Bearer <Supabase JWT>`. In dev with no Supabase secret set, send `x-dev-user: dev-admin|dev-dispatcher|dev-technician|dev-accountant`. Only `/auth/login|refresh|logout` and the health routes are public.
- **Lists** return `{ data: [...], nextCursor }` and accept `?limit` (1-200, default 50), `?cursor` (id of the last row of the previous page), `?q` (text search) and `?status`.
- **Errors** are RFC 7807 (`application/problem+json`): `{ title, status, code, detail }`, plus `issues` for validation errors.
- **Numbers** (`JOB-2026-0001`, `QTE-…`, `INV-…`, `SR-n`) and all totals are assigned and computed by the server.
- **Dates** are `YYYY-MM-DD`, times are `HH:MM`, money is a number rounded to 2dp.

| Status | Codes |
|---|---|
| 400 | `VALIDATION`, `BAD_JSON` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN`, `FEATURE_DISABLED` |
| 404 | `NOT_FOUND` |
| 409 | `SCHEDULE_CONFLICT`, `INVALID_TRANSITION`, `ALREADY_CONVERTED`, `NOT_ACCEPTED`, `INSUFFICIENT_STOCK`, `DUPLICATE_SKU`, `NOT_EDITABLE`, `NOT_DRAFT`, `NOT_PAYABLE`, `HAS_PAYMENTS`, `INVOICE_VOID`, `LOCATION_IN_USE`, `ALREADY_SENT`, `REQUEST_CANCELLED` |
| 422 | `OVERPAYMENT`, `INVALID_LOCATION`, `INVALID_TIME`, `INVALID_QUANTITY`, `CONSENT_REQUIRED`, `CHANNEL_NOT_PREFERRED` |

## Health (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/healthz` (root, not under `/api/v1`) | Process is up |
| GET | `/readyz` (root) | Always ready until the DB exists |


# Backend Tech Spec

Status: draft. Derived from `frontend/src/types/index.ts` and `frontend/src/context/AppContext.tsx`, which are the source of truth for the current behaviour. Items marked **DECIDE** are open.

## 1. Goals

- Replace `localStorage` with a multi-user API and database, without changing what the UI can do.
- Move business rules (numbering, totals, status transitions, stock, conflicts) out of the client so they are enforced once.
- Make the move from `localStorage` to the database a repeatable, testable import (section 9).

Non-goals for v1: payments gateway, real email/SMS delivery, customer-facing portal, multi-tenant SaaS (**DECIDE**: single company per deployment assumed, matching the single `CompanySettings` object).

## 2. Stack (recommendation)

| Concern | Choice | Why |
|---|---|---|
| Runtime / language | Node 22 + TypeScript | The frontend already uses TS; `express`, `dotenv`, `tsx` are already in `package.json`. Types can be shared. |
| Framework | Express (modular monolith) | Already a dependency. One deployable, one folder per module. |
| DB | Supabase Postgres (prod), local Postgres container (dev/test) | Relational data, transactions for stock and payments, `numeric` for money, `jsonb` for the few embedded blobs. |
| ORM / migrations | Prisma | Declarative schema plus versioned migrations. |
| Validation | Zod | One schema per request. Also reused by the import script. |
| Auth | Supabase Auth. The API verifies the Supabase JWT. `users` is a profile table keyed to `auth.users.id` (role, `technician_id`) | Replaces the fake `switchUserRole`. |
| Jobs / scheduling | `pg_cron` for daily sweeps; notification sending via a worker in the same image (`pg-boss`) | No Redis. Container-friendly. |
| Tests | Vitest + Testcontainers Postgres | Real DB for rule tests. |
| API style | REST + OpenAPI generated from Zod | Matches the existing CRUD-shaped context actions. |

## 3. Layout

```
backend/
├── prisma/            # schema.prisma, migrations/
├── src/
│   ├── main.ts  app.ts  config.ts
│   ├── common/        # auth middleware, rbac, errors, pagination, money, numbering
│   ├── modules/
│   │   ├── auth/  users/  settings/  technicians/
│   │   ├── customers/  equipment/  requests/  jobs/
│   │   ├── quotations/  invoices/  inventory/  notifications/
│   │   └── reports/
│   └── jobs/          # background workers
├── scripts/import-local-storage.ts
└── tests/
```

Each module folder holds `routes.ts`, `service.ts`, `schema.ts` (Zod), `repo.ts`. Modules call each other through services only, never through each other's tables.

## 4. Data model

Conventions: `id uuid` PK (the frontend's `cust-<timestamp>` ids are kept in `legacy_id text unique` for import), `created_at/updated_at timestamptz`, money as `numeric(12,2)`, dates as `date`, times as `time`, `archived` stays a soft-delete flag.

| Table | Notes (from frontend type) |
|---|---|
| `users` | `User` + `password_hash`, `technician_id` FK nullable. Role enum: admin, dispatcher, technician, accountant. |
| `technicians` | Licences, `skills text[]`, `color`, `active`, `van_registration`. |
| `company_settings` | Single row. `bank_details` as `jsonb`, `available_vat_rates numeric[]`. |
| `counters` | `(key, year, next_value)`. See section 6.1. |
| `customers` | `billing_address` as `jsonb`, `communication_preference`, `gdpr_consent`, `archived`. |
| `service_locations` | Split out of `Customer.serviceLocations[]`. FK `customer_id`. |
| `equipment` | FK customer + location. Enums for type, status, frequency. |
| `equipment_service_records` | Split out of `serviceHistory[]`. `readings jsonb`, `parts_replaced text[]`, FK `job_id`. |
| `service_requests` | `request_number` unique, `converted_job_id` FK. |
| `jobs` | Scalars from `Job`. `required_skills text[]`, `customer_signature jsonb` (or object storage URL, **DECIDE**). |
| `job_equipment` | Join for `equipmentIds[]`. |
| `job_parts_used` | Split out of `partsUsed[]`. Snapshots `part_name`, `sku`, `unit_cost`, `unit_price`. |
| `job_checklist_items` | Split out of `checklist[]`. |
| `job_audit_log` | Append-only. Replaces `auditTrail[]`. |
| `quotations` / `quotation_items` | `LineItem[]` becomes rows with a `position`. |
| `invoices` / `invoice_items` | Same. Totals are stored and also recomputed on write. |
| `payments` | Split out of `Invoice.payments[]`. `amount_paid` and `balance_due` are derived (view or computed on read), not stored by hand. |
| `parts` | `stock_quantity` has `CHECK (>= 0)`. |
| `inventory_movements` | Append-only ledger. `parts.stock_quantity` is only changed alongside a movement row, in one transaction. |
| `notifications` | `customer_notifications`. |

Indexes: `jobs(technician_id, appointment_date)` for conflict checks and the dispatch board, `jobs(status)`, `invoices(status, due_date)`, `equipment(next_service_due_date)`, `service_requests(status)`, and unique on all number columns.

## 5. Modules and API

All routes are under `/api/v1`, JSON, paginated lists (`?limit&cursor&q&status`). Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Exact permissions should be copied from `Navbar.tsx` / `RoleBanner.tsx` when implementing (**DECIDE** where they conflict with the table below).

| Module | Endpoints | Rules |
|---|---|---|
| auth | `POST /auth/login`, `/refresh`, `/logout`, `GET /me` | Replaces role switching. |
| users | CRUD `/users` | A only. |
| settings | `GET/PATCH /settings` | A. Others read-only. |
| technicians | CRUD `/technicians` | A, D write. |
| customers | CRUD `/customers`, `POST /:id/archive` (toggle), nested `/locations` | Archive is a toggle today. Keep it, but expose explicit `archive`/`unarchive`. |
| equipment | CRUD `/equipment`, `POST /:id/service-records` | Adding a record sets `last_service_date`. **DECIDE**: also recompute `next_service_due_date` from `maintenance_frequency` (the client does not today). |
| requests | CRUD `/requests`, `POST /:id/convert` | See 6.4. |
| jobs | CRUD `/jobs`, `POST /:id/status`, `GET /jobs/conflicts`, `POST /:id/invoice`, nested checklist, parts, signature | See 6.2, 6.3, 6.5. |
| quotations | CRUD `/quotations`, `POST /:id/send`, `/accept`, `/convert-to-job`, `/convert-to-invoice` | See 6.6. |
| invoices | CRUD `/invoices`, `POST /:id/payments`, `/void` | See 6.7. |
| inventory | CRUD `/parts`, `POST /parts/:id/adjust`, `GET /movements` | See 6.8. |
| notifications | `GET/POST /notifications`, `POST /:id/approve-send` | See 6.9. |
| reports | `GET /reports/*`, `GET /dashboard` | Read-only aggregates. Replaces client-side `filter()` maths. |
| admin | `GET /export`, `POST /import` | A. Replaces `exportDataJson` / `importDataJson`. `resetAllData` is dev only. |

## 6. Business rules to move server-side

These are the behaviours currently in `AppContext.tsx`, plus the bugs that must not be carried over.

### 6.1 Document numbers
Today: `JOB-2026-${jobs.length + 813}`, `QTE-2026-${quotations.length + 42}`, `INV-2026-0${invoices.length + 119}`, `SR-${count}`. These collide on concurrent creates, reuse numbers after deletes, and the prefix/padding is inconsistent. They also ignore `prefixJob/Quote/Invoice` in settings.
Spec: `counters` row per `(key, year)`, incremented with `UPDATE ... RETURNING` inside the create transaction. Format `${prefix}-${year}-${zero-padded n}`. The import seeds each counter above the highest imported number.

### 6.2 Job lifecycle
Statuses: `new, awaiting_approval, scheduled, dispatched, in_progress, on_hold, completed, cancelled`. The client allows any status change. v1 should enforce an explicit transition map (**DECIDE** the map, with admin override). Side effects: first move to `in_progress` sets `arrival_time`, first `completed` sets `completion_time`. Every change writes `job_audit_log` with the actor taken from the token, not the client.

### 6.3 Schedule conflicts
Reject overlapping non-cancelled jobs for the same technician and date, where `reqStart < jobEnd && reqEnd > jobStart`, excluding the job being edited. Enforce in the service within a transaction. **DECIDE**: also a Postgres exclusion constraint on `(technician_id, tsrange)` for a hard guarantee. Today it is only a client-side check that the UI may bypass.

### 6.4 Request → Job
In one transaction: create the job (type `emergency_callout` if priority is emergency, else `repair`; status `scheduled` if a technician is assigned, else `new`; duration `max(30, end - start)`; default checklist; audit entry), set request `status=converted` and `converted_job_id`. Reject if the request is already converted. The hard-coded defaults (`hourlyRate 85`, `travelCharge 35`, `travelTimeMinutes 30`, `requiredSkills`) should move to `company_settings`.

### 6.5 Job → Invoice
Lines: labour (`labour_hours × hourly_rate`), travel (if `travel_charge > 0`), one line per part used. VAT from `default_vat_rate`. Status `issued`, due in `payment_terms_days` (client hard-codes 14). Reject if the job already has an invoice (the client allows duplicates today).

### 6.6 Quotations
Statuses `draft, sent, viewed, accepted, rejected, expired`. `accept` records `accepted_at/by`. `convert-to-job` creates an installation job (labour hours = sum of labour lines, default 4) and sets `converted_to_job_id`. `convert-to-invoice` copies items and totals. Both conversions require `accepted` (the client does not check). `expired` is derived from `expiry_date` by a daily worker. The client never sets it.

### 6.7 Invoices and payments
- Totals: `subtotal = Σ item.amount`, `vat = subtotal × rate`, `total = subtotal + vat`, rounded half-up to 2dp **on the server**. The client uses floats.
- `record payment` runs in a transaction: insert the payment, recompute `amount_paid` and `balance_due`, then set status `paid` if balance ≤ 0.01, else `partially_paid`. Reject overpayment (the client silently clamps the balance to 0). `recorded_by` comes from the token.
- `overdue` is never set by the client. A daily worker moves `issued`/`partially_paid` past `due_date` to `overdue`. The UI and dashboard already read this status.
- `void` is allowed only if there are no payments.

### 6.8 Inventory
`adjust` writes a movement (`used_on_job | stock_adjustment | restock_purchase`) and updates `stock_quantity` atomically. The client clamps at 0 with `Math.max`, which hides negative stock. The server should reject (**DECIDE**: or allow with a warning). Adding a part to a job should produce a `used_on_job` movement automatically. **Verify in `JobDetail` whether the UI does this today.** Low-stock = `stock_quantity <= min_stock_level`. Respect `enable_inventory`.

### 6.9 Notifications
Types: booking_confirmation, appointment_reminder, technician_arriving, quotation_ready, invoice_issued. Flow: created as `draft`/`ready_to_send`, a staff member approves, the worker delivers via a provider interface and stores `sent` / `failed`. Respect `communication_preference` and `gdpr_consent`. v1 ships a log-only provider. Real email/SMS is a later swap.

## 7. Cross-cutting

- **Errors:** RFC 7807 problem JSON, with a stable `code` for rule violations (`SCHEDULE_CONFLICT`, `ALREADY_CONVERTED`, `OVERPAYMENT`, `INSUFFICIENT_STOCK`).
- **Audit:** `job_audit_log` for jobs. **DECIDE** whether to add a generic `audit_log` for invoices, payments, and stock.
- **PII / GDPR:** customers hold names, addresses, and phone numbers. TLS only, encrypted DB volume, `gdpr_consent` enforced before sending marketing-type notifications, and an export/erase path per customer. Bank details live in settings, so restrict them to A and C.
- **Signatures:** base64 PNG data URLs bloat rows. Store in a private Supabase Storage bucket and keep the path. Serve through signed URLs.
- **Config:** see section 12. `.env.example` lives in `backend/`.
- **Observability:** structured logs (pino), request id, `/healthz`.

## 8. Frontend integration

Replace `AppContext`'s `useState` + `localStorage` with an API client behind the same `useApp()` surface, so the views don't change in the first pass. Toasts stay client-side. Server-derived fields (numbers, totals, statuses) come back in responses. Change one module at a time (customers first, since everything references it).

## 9. Migration: `localStorage` → Postgres

`scripts/import-local-storage.ts` consumes the existing `exportDataJson` output (keys `apexhvac_app_data_v1_*`: settings, technicians, customers, equipment, serviceRequests, jobs, quotations, invoices, parts, inventoryMovements, notifications, currentUser).

1. **Validate** the file with the Zod schemas, then abort with a report if anything is invalid. Nothing is written.
2. **Dry-run by default**, with `--commit` to write. Everything runs in one transaction.
3. **Order** (FK dependencies): settings → users/technicians → customers (+ locations) → parts → equipment (+ service records) → requests → jobs (+ children) → quotations → invoices (+ payments) → movements → notifications.
4. **Id mapping:** each old id is stored in `legacy_id`. A `Map<oldId, uuid>` rewrites every FK. Dangling references (e.g. `convertedJobId` to a missing job) are reported, then nulled by flag.
5. **Normalise:** explode embedded arrays into child tables, recompute invoice `amount_paid/balance_due` from payments and flag mismatches, convert money to `numeric`.
6. **Counters:** set each counter to `max(imported number) + 1`.
7. **Idempotent:** re-running skips rows whose `legacy_id` exists, so a failed run can be retried.
8. **Verify:** print row counts per table against the source, plus invoice totals sum and stock levels vs the movement ledger.
9. The seed in `frontend/src/data/initialData.ts` is the test fixture. CI runs the import on it and asserts the counts.

Schema changes after v1 are Prisma migrations only (`prisma migrate dev/deploy`). Never edit the DB by hand.

## 10. Delivery order

1. Scaffold, auth, users, settings, counters, CI.
2. customers, technicians, equipment.
3. requests, jobs (with conflicts, status, audit), checklist, parts used.
4. inventory (ledger).
5. quotations, invoices, payments, workers (expire/overdue).
6. notifications, reports/dashboard.
7. import script and frontend cut-over, one module at a time.

## 11. Open decisions

1. Single company or multi-tenant.
2. Where the images run (section 12).
3. Job transition map and who may override it.
4. Reject or allow negative stock.
5. RLS as a second layer behind the API, or API-only access (section 12).
6. Exclusion constraint for conflicts, or a service check only.
7. Whether to recompute `next_service_due_date` after a service record.
8. Unreviewed: the exact per-role permissions, which must be taken from `Navbar.tsx`.

## 12. Deployment (Supabase + Docker)

### 12.1 Topology

```
Browser ──► frontend container (nginx, static Vite build)
   │
   └──────► backend container (Express API + worker)
                 ├─► Supabase Postgres (pooler 6543 at runtime, direct 5432 for migrations)
                 ├─► Supabase Auth (JWT verification)
                 └─► Supabase Storage (signatures, attachments)
```

Supabase is the only stateful piece. Both containers are stateless and can be replaced or scaled freely. **DECIDE** where they run (Cloud Run, Fly.io, Railway, a VPS, ECS). The spec doesn't depend on it.

### 12.2 Images

| Image | Build | Notes |
|---|---|---|
| `hvac-backend` | Multi-stage: `node:22-alpine` build (`npm ci`, `prisma generate`, `tsc`), then a slim runtime with prod deps only | Runs as non-root. Exposes `PORT`. `CMD node dist/main.js`. The worker is the same image with `CMD node dist/worker.js`. |
| `hvac-frontend` | Multi-stage: Node build of `frontend/`, then `nginx:alpine` serving `dist/` | SPA fallback to `index.html`. The API URL is injected at build time (`VITE_API_URL`). |

Both images get a `.dockerignore` (`node_modules`, `.env*`, `.git`). Tag with the git SHA, never rely on `latest`. A `docker-compose.yml` for local dev runs the two images plus a `postgres:16` container, so development doesn't touch production Supabase.

### 12.3 Config and secrets

Injected as environment variables at runtime. Never baked into an image or committed.

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | API, worker | Supabase **pooler** string, port 6543, with `?pgbouncer=true`. |
| `DIRECT_URL` | migrations, import | Direct connection, port 5432. |
| `SUPABASE_URL` | API | |
| `SUPABASE_JWT_SECRET` or JWKS URL | API | Verifies tokens. |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | Bypasses RLS. **Never in the frontend image or any `VITE_*` var.** |
| `SUPABASE_ANON_KEY` | frontend (if it uses Supabase Auth client-side) | Public by design. Safe only with RLS on. |
| `APP_URL`, `PORT`, `NODE_ENV` | API | `APP_URL` is also used for CORS. |

### 12.4 Database and migrations on Supabase

- Schema lives in `backend/prisma/migrations/`. Deploy with `prisma migrate deploy` against `DIRECT_URL` as a release step. It runs once per deploy, **not** on every container start, or parallel replicas will race.
- **RLS:** tables created through SQL have RLS off, and the public anon key can then read them. Enable RLS on every table. With API-only access, add no policies (deny by default); the service-role key in the API is the only reader. If the frontend ever queries Supabase directly, write role-based policies per table first. Recommended for v1 is API-only.
- `pg_cron` jobs (daily `overdue` and `expired` sweeps) are created in a migration as SQL, so they are versioned with the schema.
- Backups: enable Supabase daily backups (and PITR on a paid plan). Take a manual backup immediately before the production import.
- Use separate Supabase projects for staging and production. Never run the import against production without a dry run on staging.

### 12.5 Release flow

1. CI: lint, tests (Testcontainers Postgres), build both images, push tagged with the SHA.
2. Run `prisma migrate deploy` against staging, deploy the images, smoke test `/healthz`.
3. Repeat for production, then run the one-time import (section 9) with `--commit`.
4. Rollback: redeploy the previous image tag. Migrations should be backward compatible for one release (add before you remove) so this is safe.

### 12.6 Health and ops

`/healthz` (process up) and `/readyz` (DB reachable) back the container healthchecks. Logs go to stdout as JSON for the platform to collect. Set `restart: unless-stopped` or the platform equivalent.

# ApexHVAC – UK Field Service Management


A field service management app for UK HVAC installation, repair and maintenance businesses. It covers the full job lifecycle: customer enquiry → service request → quotation → scheduled job → technician visit → invoice and payment, plus recurring maintenance, compliance records and credit notes.

It is a React frontend (`frontend/`) talking to an Express + Prisma API on Postgres/Supabase (`backend/`). See [features.md](features.md) for the full feature index and [backend/docs/api](backend/docs/api/README.md) for the API.

## Features

| Area | What it does |
|------|--------------|
| **Dashboard** | KPIs, upcoming jobs and quick-create actions |
| **Dispatch & Jobs** | Dispatch board for scheduling and assigning technicians; 30-minute travel buffer, double-booking prevention, workflow-checked statuses (admin force override with reason) |
| **Technician Portal** | Mobile-style view for technicians: jobs, template checklists, refrigerant log, parts used, readings, customer signature, service report PDF |
| **Customers** | Residential and commercial customers, multiple service locations (postcode lookup, currently mocked), GDPR consent, contact preferences |
| **Equipment & Assets** | Boilers, heat pumps, A/C, ventilation and chillers with warranty, service schedule and service history (flow/return temperatures, CO, refrigerant pressure, etc.) |
| **Service Requests** | Incoming requests with priority (low to emergency), converted into jobs |
| **Maintenance Plans** | Quarterly / six-monthly / annual agreements; a daily sweep raises a preventive-maintenance job 14 days before each is due |
| **Quotations** | Line-item quotes (per-line VAT) with a status lifecycle; convert to job or invoice |
| **Invoices & Payments** | Invoices, partial payments, credit notes, payment refunds, void with reason, `credited` status, Download PDF |
| **Parts & Stock** | Inventory items and an append-only stock movement ledger; parts used on jobs are tied to billable lines |
| **Notifications** | Customer notification log with consent checks and duplicate-safe sending |
| **Reports** | Financial, technician utilisation and low-stock reports; VAT return (API) |
| **Settings** | Company settings, default hourly rate and travel charge, technician roster with Gas Safe / F-Gas licences and expiry dates (admin only) |
| **Checklist Templates** | Admin-managed, drag-to-reorder checklist items per job type (admin only) |
| **Workflow Guide** | In-app modal with six end-to-end demo workflows (A to F) |

### Compliance and safety

- Technicians cannot be assigned to jobs needing `GAS_SAFE` / `F_GAS` without the licence, or with an expired one; boiler and refrigerant equipment add the requirement automatically.
- Completing a job requires ticked safety checklist items, a refrigerant log (if applicable), work performed and a customer signature.
- Money and compliance actions go to an append-only audit log.

### Offline and security

- Installable PWA: cached reads and an offline write queue replayed with idempotency keys, so no duplicate payments or jobs.
- httpOnly cookie sessions, CSRF header, rate limiting, helmet headers, server-side role checks.

### Roles

The current user's role controls which tabs are visible (`frontend/src/routes.ts`); the current tab is kept in the URL path. A `RoleBanner` shows the active role and its permissions. Technicians land on the Technician Portal by default. The API enforces the same roles server-side.

| Tab | admin | dispatcher | technician | accountant |
|-----|:--:|:--:|:--:|:--:|
| Dashboard | ✓ | ✓ | | ✓ |
| Technician Portal | ✓ | ✓ | ✓ | |
| Dispatch & Jobs | ✓ | ✓ | | |
| Customers | ✓ | ✓ | | ✓ |
| Equipment & Assets | ✓ | ✓ | ✓ | |
| Service Requests | ✓ | ✓ | | |
| Maintenance Plans | ✓ | ✓ | | ✓ |
| Quotations | ✓ | ✓ | | ✓ |
| Invoices & Payments | ✓ | | | ✓ |
| Parts & Stock | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | | | ✓ |
| Checklists | ✓ | | | |
| Settings | ✓ | | | |

UK-specific fields include Gas Safe and F-Gas licence numbers and expiry dates, UK postcodes, UK VAT (per-line rates) and GBP formatting (`frontend/src/utils/formatters.ts`).

## Tech stack

- Frontend: React 19 + TypeScript, Vite, Tailwind CSS 4, lucide-react, dnd-kit, jsPDF + html2canvas-pro, Workbox / vite-plugin-pwa
- Backend: Node.js, Express, Prisma, Postgres (Supabase), zod, pino, pdf-lib
- Deploy: Docker Compose (API runs Prisma migrations first); frontend on Netlify (`frontend/netlify.toml` proxies `/api/*`)

## Getting started

**Prerequisites:** Node.js, and a Postgres database for the backend (see `backend/.env.example`).

```bash
cd backend && npm install && cp .env.example .env && npm run dev   # http://localhost:3001
cd frontend && npm install && npm run dev                          # http://localhost:3000
```

With `APP_ENV=local` and no Supabase secret the API accepts local passwords and `x-dev-user`; see [backend/README.md](backend/README.md).

| Script (frontend) | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Type-check with `tsc --noEmit` |

## Project structure

```
frontend/src/
├── App.tsx                  # Tab routing, toast, quick-create modals
├── routes.ts                # Tabs, role access, URL-path routing
├── sw.ts                    # Service worker: offline reads and write queue
├── services/                # API client, auth, postcode lookup
├── store/useDataStore.ts    # Data loaded from the API
├── types/index.ts           # Domain models
├── utils/                   # formatters, PDF export
└── components/              # layout, dashboard, scheduling, technician, customers,
                             # equipment, requests, maintenance, quotations, invoices,
                             # inventory, notifications, reports, checklists, settings,
                             # workflows, modals
backend/
├── prisma/                  # schema + migrations
├── src/modules/<name>/      # routes.ts + service.ts per area
├── src/common/              # auth, idempotency, audit, errors, paging
├── src/jobs/sweeps.ts       # daily sweeps (overdue, expiry, maintenance, pruning)
└── docs/api/                # one API doc per module
```

## Documentation

- [features.md](features.md) and [docs/features/](docs/features/): per-feature docs
- [backend/docs/api/](backend/docs/api/README.md) and [backend/TECH_SPEC.md](backend/TECH_SPEC.md)
- [LOOPHOLES.md](LOOPHOLES.md): known gaps

## Origin

Scaffolded with Google AI Studio: https://ai.studio/apps/509fffc9-2af7-4ba8-bb79-75d1855331bb

## License

Source files carry an Apache-2.0 SPDX header.

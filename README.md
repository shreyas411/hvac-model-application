# ApexHVAC – UK Field Service Management

A front-end field service management app for UK HVAC installation, repair and maintenance businesses. It covers the full job lifecycle: customer enquiry → service request → quotation → scheduled job → technician visit → invoice and payment.

Everything runs in the browser. There is no backend, and data is seeded from `src/data/initialData.ts` and persisted to `localStorage`.

## Features

| Area | What it does |
|------|--------------|
| **Dashboard** | KPIs, upcoming jobs and quick-create actions |
| **Dispatch & Jobs** | Dispatch board for scheduling and assigning technicians |
| **Technician Portal** | Mobile-style view for technicians: their jobs, checklists, parts used, readings |
| **Customers** | Residential and commercial customers, multiple service locations, GDPR consent, contact preferences |
| **Equipment & Assets** | Boilers, heat pumps, A/C, ventilation and chillers with warranty, service schedule and service history (flow/return temperatures, CO, refrigerant pressure, etc.) |
| **Service Requests** | Incoming requests with priority (low to emergency), converted into jobs |
| **Quotations** | Line-item quotes with a status lifecycle |
| **Invoices & Payments** | Invoices and payment records |
| **Parts & Stock** | Inventory items and stock movements |
| **Notifications** | Customer notification log |
| **Reports** | Business reporting |
| **Settings** | Company settings (admin only) |
| **Workflow Guide** | In-app modal explaining the end-to-end workflow |

### Roles

The current user's role controls which tabs are visible (`src/components/layout/Navbar.tsx`). A `RoleBanner` shows the active role and its permissions. Technicians land on the Technician Portal by default.

| Tab | admin | dispatcher | technician | accountant |
|-----|:--:|:--:|:--:|:--:|
| Dashboard | ✓ | ✓ | | ✓ |
| Technician Portal | ✓ | ✓ | ✓ | |
| Dispatch & Jobs | ✓ | ✓ | | |
| Customers | ✓ | ✓ | | ✓ |
| Equipment & Assets | ✓ | ✓ | ✓ | |
| Service Requests | ✓ | ✓ | | |
| Quotations | ✓ | ✓ | | ✓ |
| Invoices & Payments | ✓ | | | ✓ |
| Parts & Stock | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | | | ✓ |
| Settings | ✓ | | | |

UK-specific fields include Gas Safe and F-Gas licence numbers for technicians, UK postcodes, and GBP formatting (`src/utils/formatters.ts`).

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4 (`@tailwindcss/vite`)
- lucide-react (icons), motion (animation)

## Getting started

**Prerequisites:** Node.js

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove `dist` and `server.js` |

## Project structure

```
src/
├── App.tsx                  # Tab routing, toast, quick-create modals
├── main.tsx
├── context/AppContext.tsx   # Global state, CRUD actions, localStorage sync
├── data/initialData.ts      # Seed data
├── types/index.ts           # Domain models (Customer, Job, Quotation, Invoice, ...)
├── utils/formatters.ts
└── components/
    ├── layout/              # Navbar, RoleBanner
    ├── dashboard/  scheduling/  technician/  customers/  equipment/
    ├── requests/   quotations/  invoices/    inventory/  notifications/
    ├── reports/    settings/    workflows/   modals/
```

State lives in a single `AppProvider` (`src/context/AppContext.tsx`). Components read and update it through the `useApp()` hook.

## Data persistence

App state is stored in `localStorage` under keys prefixed `apexhvac_app_data_v1_` (one per collection: customers, jobs, quotations and so on). To reset to the seed data, clear those keys in your browser's dev tools.

## Environment variables

`.env.example` lists `GEMINI_API_KEY` and `APP_URL`. These come from the Google AI Studio template, and the current source code doesn't use either. `@google/genai`, `express` and `dotenv` are installed but not imported.

## Origin

Scaffolded with Google AI Studio: https://ai.studio/apps/509fffc9-2af7-4ba8-bb79-75d1855331bb

## License

Source files carry an Apache-2.0 SPDX header.

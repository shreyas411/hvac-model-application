# ApexHVAC – Features

ApexHVAC is a field service management app (React frontend + Express/Postgres API) for UK HVAC businesses. It follows one job lifecycle:

```
Customer ─▶ Service Request ─▶ Quotation ─▶ Job (dispatch) ─▶ Technician visit ─▶ Invoice ─▶ Payment
                                                   │                 │
                                              Equipment         Parts & Stock
```

Each area below has its own deep-dive file in [`docs/features/`](docs/features/).

## Core workflow

| Feature | Details |
|---------|---------|
| Dashboard | [dashboard-features.md](docs/features/dashboard-features.md) |
| Dispatch & Jobs | [dispatch-features.md](docs/features/dispatch-features.md) |
| Technician Portal | [technician-portal-features.md](docs/features/technician-portal-features.md) |
| Customers | [customers-features.md](docs/features/customers-features.md) |
| Equipment & Assets | [equipment-features.md](docs/features/equipment-features.md) |
| Service Requests | [service-requests-features.md](docs/features/service-requests-features.md) |
| Quotations | [quotations-features.md](docs/features/quotations-features.md) |
| Invoices & Payments | [invoices-features.md](docs/features/invoices-features.md) |
| Maintenance Plans | [maintenance-features.md](docs/features/maintenance-features.md) |

## Operations & admin

| Feature | Details |
|---------|---------|
| Parts & Stock | [inventory-features.md](docs/features/inventory-features.md) |
| Notifications | [notifications-features.md](docs/features/notifications-features.md) |
| Reports | [reports-features.md](docs/features/reports-features.md) |
| Settings | [settings-features.md](docs/features/settings-features.md) |
| Custom Fields | [custom-fields-features.md](docs/features/custom-fields-features.md) |
| Checklist Templates | [checklists-features.md](docs/features/checklists-features.md) |
| Audit Log | [audit-log-features.md](docs/features/audit-log-features.md) |
| UI conventions & shared components | [ui-conventions-features.md](docs/features/ui-conventions-features.md) |

## Cross-cutting

| Feature | Details |
|---------|---------|
| Workflow Guide | [workflow-guide-features.md](docs/features/workflow-guide-features.md) |
| Quick Create modals | [quick-create-features.md](docs/features/quick-create-features.md) |
| Roles & access | [roles-and-access-features.md](docs/features/roles-and-access-features.md) |
| Data, state & persistence | [data-and-state-features.md](docs/features/data-and-state-features.md) |
| Compliance & safety guards | [compliance-features.md](docs/features/compliance-features.md) |
| Billing corrections, VAT & PDF | [billing-corrections-features.md](docs/features/billing-corrections-features.md) |
| Offline mode & installable app | [offline-and-pwa-features.md](docs/features/offline-and-pwa-features.md) |
| Security & authentication | [security-and-auth-features.md](docs/features/security-and-auth-features.md) |

Backend endpoints are documented in [`backend/docs/api/`](backend/docs/api/README.md); open gaps are tracked in [LOOPHOLES.md](LOOPHOLES.md) and planned work in [docs/ROADMAP.md](docs/ROADMAP.md). See [README.md](README.md) for setup and project structure.

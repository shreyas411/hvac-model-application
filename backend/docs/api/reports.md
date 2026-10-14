# reports and dashboard

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read-only.

| Method | Path | Roles | Returns |
|---|---|---|---|
| GET | `/reports/financial` | A C | Invoiced revenue, recorded payments, outstanding balance, pipeline, accepted quotes value, completed and open job counts (void invoices excluded) |
| GET | `/reports/technicians` | A C | Per technician: jobs, completed, hours, billable labour |
| GET | `/reports/low-stock` | A C | Parts at or below `minStockLevel` |
| GET | `/dashboard` | A D C | Job counts, new requests, outstanding quotes, unpaid invoices, collected and outstanding revenue, equipment maintenance due within 5 days |

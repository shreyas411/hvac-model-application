# quotations

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read/write: A D C. Convert to job: A D. Convert to invoice: A C.

| Method | Path | Notes |
|---|---|---|
| GET | `/quotations` | |
| GET | `/quotations/:id` | |
| POST | `/quotations` | `{ customerId, locationId, issueDate, expiryDate, items[{ type, description, quantity, unitPrice }], vatRatePercent?, terms?, notes?, jobId? }`. Starts as `draft`; totals computed |
| PATCH | `/quotations/:id` | Only while `draft` or `sent` |
| POST | `/quotations/:id/send` | `draft` → `sent` |
| POST | `/quotations/:id/accept` | `{ acceptedBy }`; from `sent` or `viewed` |
| POST | `/quotations/:id/reject` | From `sent` or `viewed` |
| POST | `/quotations/:id/convert-to-job` | `{ appointmentDate, startTime, endTime, technicianId? }` → `{ job, quotation }`. Requires `accepted` |
| POST | `/quotations/:id/convert-to-invoice` | → `{ invoice, quotation }`. Copies items and totals. Requires `accepted` |

`expired` is set by the daily sweep for `sent`/`viewed` quotations past `expiryDate`.

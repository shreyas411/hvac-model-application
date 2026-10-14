# invoices

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

All routes A C.

| Method | Path | Notes |
|---|---|---|
| GET | `/invoices` | |
| GET | `/invoices/:id` | Includes `payments` |
| POST | `/invoices` | `{ customerId, locationId, items[], vatRatePercent?, issueDate?, paymentTermsDays?, dueDate?, notes?, quoteId?, jobId?, status? }`; `status` is `draft` or `issued` (default `issued`) |
| PATCH | `/invoices/:id` | Items and VAT only while `draft`; `INVOICE_VOID` if void |
| POST | `/invoices/:id/issue` | `draft` → `issued` |
| POST | `/invoices/:id/payments` | `{ date, amount, method, reference?, notes? }`. `OVERPAYMENT` if above balance. Sets `paid` or `partially_paid`. `recordedBy` comes from the token |
| POST | `/invoices/:id/void` | `HAS_PAYMENTS` if any payment exists |

`overdue` is set by the daily sweep for `issued`/`partially_paid` invoices past `dueDate`.

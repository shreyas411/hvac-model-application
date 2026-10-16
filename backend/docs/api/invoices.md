# invoices

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

All routes A C.

| Method | Path | Notes |
|---|---|---|
| GET | `/invoices` | |
| GET | `/invoices/:id` | Includes `payments` |
| POST | `/invoices` | `{ customerId, locationId, items[], vatRatePercent?, issueDate?, paymentTermsDays?, dueDate?, notes?, quoteId?, jobId?, status? }`; `status` is `draft` or `issued` (default `issued`) |
| PATCH | `/invoices/:id` | Items and VAT only while `draft`; `INVOICE_VOID` if void |
| POST | `/invoices/:id/issue` | `draft` → `issued`. `EMPTY_INVOICE` if total is 0. Audited |
| POST | `/invoices/:id/payments` | `{ date, amount, method, reference?, notes? }`; `amount` in whole pence; `DUPLICATE_PAYMENT_REFERENCE` if the reference was already used on this invoice. `OVERPAYMENT` if above balance. Sets `paid` or `partially_paid`. `recordedBy` comes from the token |
| POST | `/invoices/:id/void` | `{ reason }` (3+ chars). `HAS_PAYMENTS` if any payment exists, `HAS_CREDITS` if any credit note exists. Audited |
| POST | `/invoices/:id/credit-notes` | `{ amount, reason }`, 201. `amount` is gross (VAT inclusive). `NOT_CREDITABLE` for draft/void, `OVER_CREDIT` above the remaining creditable amount. Number `CN-…`. Status becomes `credited` when fully credited |
| POST | `/invoices/:id/payments/:paymentId/refund` | `{ reason }`. Marks the payment refunded and re-opens the balance. `ALREADY_REFUNDED` |

`overdue` is set by the daily sweep for `issued`/`partially_paid` invoices past `dueDate`.

Line items may include `vatRatePercent` (per-line VAT; falls back to the invoice rate). `status` may now be `credited`. `GET /invoices` supports `?q` (number, notes), `?status`, `?cursor`, `?limit` in the database. Roles on credit notes and refunds: A C.
Server-side PDF generation exists in `src/modules/invoices/pdf.service.ts` but is not yet exposed as a route; the web app renders its own PDF.

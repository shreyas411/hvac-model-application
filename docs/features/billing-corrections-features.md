# Billing Corrections, VAT & PDF

Adds the credit note / refund workflow and VAT handling that were missing from invoicing. Details of the base invoice screen are in [invoices-features.md](invoices-features.md). Backend: `backend/src/modules/invoices/`, `backend/src/modules/reports/`.

## Credit notes

- `POST /invoices/:id/credit-notes` `{ amount, reason }` (admin, accountant). `amount` is gross (VAT inclusive) and cannot exceed what is still creditable (`OVER_CREDIT`).
- Numbered `CN-…` from the gap-free number counters; VAT credited is the pro-rata share of the invoice VAT.
- Draft and void invoices cannot be credited (`NOT_CREDITABLE`).
- Balance and status are recomputed: when credit notes cover the whole total the invoice becomes **`credited`** (violet badge); otherwise `paid` / `partially_paid` / `issued` follow from total, credits and payments.

## Refunds

`POST /invoices/:id/payments/:paymentId/refund` `{ reason }` marks the payment `refunded`, subtracts it from `amountPaid` and re-opens the balance. A payment can be refunded once (`ALREADY_REFUNDED`).

## Voiding

Void now needs a `reason` (3+ characters). Invoices with payments (`HAS_PAYMENTS`) or credit notes (`HAS_CREDITS`) cannot be voided: use a credit note instead.

## Per-line VAT

Line items can carry their own `vatRatePercent` (e.g. 0% or 5% reduced-rate work); lines without one use the document rate. Totals are computed server-side from the lines. Applies to quotations and invoices.

## Other invoice rules

- Issuing a zero-total invoice is rejected (`EMPTY_INVOICE`); generating from a job needs a **completed** job and something to bill (`JOB_NOT_COMPLETED`, `NOTHING_TO_INVOICE`).
- A quotation can only have one live (non-void) invoice.
- Payment amounts must be whole pence; duplicate payment references on an invoice are rejected (`DUPLICATE_PAYMENT_REFERENCE`).
- Job labour defaults to the company **default hourly rate** and travel to the **default travel charge** (Settings), not a hard-coded 85 / 35.
- Issue, void, credit, refund and invoice generation are written to an append-only audit log.

## VAT return

`GET /reports/vat?start=YYYY-MM-DD&end=YYYY-MM-DD` (admin, accountant) returns a UK-style summary: `box1` output VAT on non-void invoices issued in the period, `box4` input VAT on restock purchases, `netVat`, and `isReclaimable`.

## PDF download

The invoice sheet modal has a **Download PDF** button. It renders the on-screen `[data-pdf-sheet]` markup to an A4 PDF in the browser (`frontend/src/utils/pdf.ts`, html2canvas + jsPDF), named `<invoice number>.pdf`. Known ceiling: the page image is sliced by height, so a table row can split across pages.

`backend/src/modules/invoices/pdf.service.ts` contains a server-side generator (pdf-lib) but it is not yet exposed by any route.

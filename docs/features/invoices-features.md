# Invoices Features

The Invoices view ("Invoicing & Payment Ledger") shows summary KPIs, a searchable and filterable invoice table, a printable invoice sheet, and a record-payment flow that supports partial payments. Source: `frontend/src/components/invoices/InvoicesView.tsx`; mounted from `frontend/src/App.tsx:143` for tab `invoices`.

## Access

| Role | Can see tab |
|------|-------------|
| admin, accountant | Yes (`frontend/src/components/layout/Navbar.tsx:43`) |
| dispatcher, technician | No |

There are no per-action role checks inside the view. The current user's name is recorded as `recordedBy` on payments by the context.

## AppContext usage

Reads `invoices`, `customers`, `settings`, `currentUser` (destructured, unused in the view); calls `recordPayment`.

## Summary KPIs (`:85-86`, `:120-147`)

| Card | Calculation |
|------|-------------|
| Collected Revenue (Payments) | Sum of `amountPaid` over all invoices |
| Outstanding Balance (Debtors) | Sum of `balanceDue` over all invoices, plus a count of invoices with status `overdue` |
| UK Standard VAT (20%) Output | Sum of `vatAmount` over all invoices |

KPIs cover all invoices (including void and draft) and ignore the active filters. The "20%" label is static text.

## Search and status filter (`:72-83`, `:149-175`)

- Search matches invoice number or customer name (case-insensitive substring).
- Status buttons: all, issued, partially paid, overdue, paid. `draft` and `void` appear only under all. Filters combine (AND).

## Invoice table (`:177-276`)

Columns: invoice number; customer name and billing city; issue date; due date (bold red when status is `overdue`); total with VAT beneath; balance due (red if above 0, green otherwise) with "Paid x" beneath when something has been paid; status badge; actions.

Statuses: `draft | issued | partially_paid | paid | overdue | void` (`frontend/src/types/index.ts:248`). The view renders `overdue` styling but nothing in the view or context transitions an invoice to `overdue`; it can only come from seed data.

Actions: "View Sheet" (always) and "Record Payment" (when `balanceDue > 0`, so also shown for void or draft invoices with a balance).

## Invoice sheet and print (`:278-440`)

"View Sheet" opens a document-style modal containing: company name, address, VAT and company numbers; invoice number, issue and due dates, status; "Billed To" using the customer's billing address; line-item table (description, qty, unit price, amount); BACS details from `settings.bankDetails` with the invoice number as payment reference; subtotal, VAT, invoice total, amount paid, balance due; the recorded-payments history (date, method, reference, recorded by, amount) when any exist; and the company terms and conditions in the footer. "Print Invoice" calls `window.print()`.

## Record payment (`:40-70`, `:442-534`)

"Record Payment" opens a modal that shows total and outstanding balance.

| Field | Rules |
|-------|-------|
| Payment Amount | Required number, step 0.01, min 0.01, max = balance due; defaults to full balance. Partial amounts allowed |
| Method | bacs (default), card, cheque, cash |
| Reference | Required text; defaults to `BACS-` plus the last 5 digits of `Date.now()` |
| Internal Notes | Optional |

The payment date is today (`new Date().toISOString()` date part). Confirm calls `recordPayment` (`AppContext.tsx:704`), which appends a payment (id `pay-<timestamp>`, `recordedBy` = current user name), increases `amountPaid`, sets `balanceDue = max(0, total - amountPaid)`, and sets status to `paid` if the balance is at most 0.01, else `partially_paid`. A toast shows the amount and remaining balance. The `max` limit is enforced by HTML form validation only; the context does not clamp the payment amount itself.

## Creating invoices

- "New Invoice" calls `onOpenQuickAction('invoice')`, opening the shared quick-create modal (`frontend/src/components/modals/QuickCreateModals.tsx`), which calls `addInvoice` with status `issued` (`AppContext.tsx:678`, number `INV-2026-0<invoices.length + 120>`).
- Other creation paths live outside this view: `convertQuotationToInvoice` (from Quotations) and `generateInvoiceFromJob` (`AppContext.tsx:740`, builds labour, travel and parts lines at the default VAT rate with 14-day terms).

## Limitations

- No editing, voiding, deleting, sending or reminder actions; no automatic overdue detection.
- Recording a payment on a `void` or `draft` invoice flips it to `paid` or `partially_paid`.
- KPIs include every invoice regardless of status or filter, and the VAT card label is hard-coded to 20%.
- Printing uses `window.print()` on the whole page; no PDF export.
- No role restriction beyond tab visibility; `onNavigateTab` and `currentUser` are unused.

## Updates: credit notes, refunds, VAT and PDF

- New status **`credited`** (violet badge) when credit notes cover the whole invoice; credit notes (`CN-…`), payment refunds, void-with-reason, per-line VAT and the default rate card are described in [billing-corrections-features.md](billing-corrections-features.md).
- The invoice sheet modal now has a **Download PDF** button (A4 PDF of the on-screen sheet) next to Print.
- List, search and paging are served by the backend (`GET /invoices?q&status&cursor`).

## Updates: PDF and email

Issuing an invoice drafts (or, with auto-send on, sends) an email with a server-generated PDF attached (`GET /invoices/:id/pdf`). The Download PDF button in the modal still renders the on-screen sheet in the browser. See [notifications-features.md](notifications-features.md).

## Updates: reverse charge, CIS, retention, stage invoices

- **Create Invoice** modal has *Domestic reverse charge* (VAT forced to 0, "no VAT charged" line), a **CIS rate** (deducted from the labour portion only) and a **Retention %** field. Sent as `reverseCharge`, `cisRatePercent`, `retentionPercent`; see [invoices.md](../../backend/docs/api/invoices.md).
- Invoice detail shows "VAT (domestic reverse charge)", "Less CIS deduction (x% of labour)" and "Retention held (x%)" with a **Release** button (`POST /invoices/:id/release-retention`). The same lines print on the PDF.
- Stage invoices (made from an accepted quote, see [quotations-features.md](quotations-features.md)) show a grey badge on the list and detail: label and percent of quotation.
- Limitations: credit notes do not scale CIS or retention.

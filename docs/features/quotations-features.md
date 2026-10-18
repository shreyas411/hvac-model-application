# Quotations Features

The Quotations view ("Quotations & Estimates") lists customer quotes in a table with status filters, shows a printable quote document, records customer acceptance, and converts accepted quotes into either a scheduled installation job or an invoice. Source: `frontend/src/components/quotations/QuotationsView.tsx`; mounted from `frontend/src/App.tsx:136` for tab `quotations`.

## Access

| Role | Can see tab |
|------|-------------|
| admin, dispatcher, accountant | Yes (`frontend/src/components/layout/Navbar.tsx:42`) |
| technician | No |

No per-action role checks exist inside the view; any role with the tab can accept and convert.

## AppContext usage

Reads `quotations`, `customers`, `settings`, `technicians`; calls `acceptQuotation`, `convertQuotationToJob`, `convertQuotationToInvoice`. `addQuotation` and `updateQuotation` are destructured but unused here.

## Quotation statuses

`draft | sent | viewed | accepted | rejected | expired` (`frontend/src/types/index.ts:213`), each with its own badge colour (`QuotationsView.tsx:79-86`). The view only changes status to `accepted`; no UI sets the others.

## Table and status filter (`:54-57`, `:111-236`)

- Filter tabs: all, draft, sent, accepted, rejected, each with a count in parentheses. `viewed` and `expired` quotes appear only under "all".
- Columns: quote number, customer name with site city and postcode, issued date, expiry date, total (inc VAT) with "ex VAT" subtotal beneath, status badge, actions.
- Row actions are conditional:

| Action | Shown when |
|--------|-----------|
| Preview | Always |
| Accept | `status === 'sent'` |
| Convert to Job | `status === 'accepted'` and no `convertedToJobId` |
| Invoice | `status === 'accepted'` and no `convertedToInvoiceId` |

## New Quotation (`:102-108`)

The button calls `onOpenQuickAction('quote')`, opening the shared modal in `frontend/src/components/modals/QuickCreateModals.tsx`. That modal calls `addQuotation` with `status: 'sent'` and an expiry date 30 days out (`QuickCreateModals.tsx:189-196`), so quotes created in the UI start as `sent` (no draft step). `addQuotation` (`AppContext.tsx:527`) generates `QTE-2026-<quotations.length + 42, zero-padded to 4>`.

## Preview and print (`:238-374`)

"Preview" opens a document-style modal: company name, address, VAT and Gas Safe numbers from `settings`; quote number, issue and expiry dates, status; "Prepared for" customer name plus the address of the customer's first service location (not necessarily the quote's `locationId`); line-item table (description, type, qty, unit price, amount); net subtotal, VAT at the quote's rate, total; terms text; and "Accepted by ... on ..." when present. "Print Quote" calls `window.print()` (prints the whole page). Footer text "Valid for 30 days from date of issue" is static, independent of the actual expiry date.

## Record acceptance (`:59-64`, `:376-415`)

"Accept" (only for `sent`) opens a modal asking for an "Authorized Signatory Name" (required, prefilled with the customer's name). Confirming calls `acceptQuotation(id, name)` (`AppContext.tsx:553`), which sets `status: 'accepted'`, `acceptedAt` (ISO now) and `acceptedBy`, and shows a toast.

## Convert to Job (Workflow B) (`:66-72`, `:417-496`)

Modal fields: Lead Technician (select, defaults to first technician), Installation Date (default `2026-10-15`), Start (08:30) and End (16:30). Submit calls `convertQuotationToJob` and navigates to `dispatch`. `convertQuotationToJob` (`AppContext.tsx:571`) creates:

- Job `JOB-2026-<jobs.length + 815>`, type `installation`, priority `medium`, status `scheduled` (or `new` if no technician), no linked equipment.
- Duration = max(60, end minus start) minutes; labour hours = sum of the quote's `labour` line quantities, or 4 if none; rate 85.00; travel 30 min and 35.00; required skills `['F-Gas Heat Pumps', 'Domestic Gas']`.
- Description "Installation work as agreed per Quotation <number>", internal notes from quote notes, four-item installation checklist, audit-trail entry "Created from Quotation".
- Sets `convertedToJobId` on the quote, which hides the Convert to Job button.

No schedule-conflict check is performed here (unlike service request conversion).

## Convert to Invoice (`:74-77`)

"Invoice" calls `convertQuotationToInvoice` (`AppContext.tsx:638`) and navigates to the `invoices` tab. The invoice copies items, subtotal, VAT rate and amount, and total from the quote; status `issued`, issue date today, due date 14 days later, `paymentTermsDays: 14`, balance due = total, note referencing the quote number; number `INV-2026-0<invoices.length + 119>`. The quote gets `convertedToInvoiceId`, hiding the button.

## Limitations

- Quotes cannot be edited, deleted, rejected, expired, or marked sent/viewed from this view; line items and totals are only creatable via the quick-create modal.
- Convert to Job defaults to a hard-coded date and has no conflict check or skills matching; a quote can be converted to both a job and an invoice independently, and the guards only hide buttons (they are not enforced in context).
- Preview address uses the customer's first service location, and the footer validity text is hard-coded.
- No automatic expiry handling.
- Print uses `window.print()` for the whole page; there is no PDF export or email send.

## Updates: PDF and email

Sending a quotation drafts (or, with auto-send on, sends) an email with a server-generated PDF attached (`GET /quotations/:id/pdf`), superseding "no PDF export or email send" above for the API; the web app's Print button is unchanged. See [notifications-features.md](notifications-features.md).

## Updates: stage payments, Good/Better/Best, customer approval page

- **Stage** button on accepted quotes opens a modal: percent (capped at what is left to bill) and optional label, or **Final** (deducts earlier stages). Each stage is its own invoice (`POST /invoices/stage`) and the app jumps to Invoices. The plain **Convert to invoice** button is hidden once a quote has stages. Stage lines use the quote's document VAT rate. Not yet clicked through in a browser.
- Quote lines can carry an `option` label (Good, Better, Best). Unlabelled lines are shared. Detail view tags labelled lines and shows "Price per option (inc. VAT)"; stored totals are shared lines plus the cheapest option. Accepting a quote with options asks for the **Option chosen**; the other tiers are dropped. Pricebook is Parts `sellingPrice`.
- **Customer approval page** `/quote/<token>` (`frontend/src/components/public/QuoteApprovalPage.tsx`, no login): shows the quote, an option radio if tiers exist, typed name and drawn signature, **Accept** or **Decline**. Link is created when the quote is sent and emailed. Token is stored hashed and expires. Backend: [quotations.md](../../backend/docs/api/quotations.md).
- Limitation: the drawn signature is stored but not yet on the PDF.

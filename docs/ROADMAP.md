# ApexHVAC – Roadmap (missing features)

Source: three research passes over `features.md`, `docs/features/*`, `LOOPHOLES.md` and the code. Findings come from grep checks and are not all individually verified. Effort: S/M/L.

Status: `todo` · `wip` · `done` · `hold`

## Quick wins (in progress)

Note: the research agents wrongly reported overdue detection, parts edit and SKU uniqueness as missing; they already existed.

| # | Item | Effort | Status |
|---|------|--------|--------|
| Q1 | Server-side PDFs: `GET /invoices/:id/pdf` and `GET /quotations/:id/pdf` (shared renderer, wrapped lines, paged); attached to emails. UI buttons still use the in-browser PDF | S | done |
| Q2 | Resend email; invoice, quote, booking-confirmed and engineer-dispatched emails; company setting `autoSendEmails` (off = staff approve drafts, on = send at once). Service-due email todo | S-M | done |
| Q3 | Overdue sweep drafts a `payment_reminder` notification per invoice (staff approve; needs consent) done | S | done |
| Q4 | Parts `DELETE` + UI button done (refused if stock history). Low-stock notification dropped: notifications are customer-facing; the UI/`/reports/low-stock` already flag it | S | done |
| Q5 | Reports date filter, profitability, aged debtors done; admin Audit Log screen (`/audit`) done | S-M | done |
| Q6 | Customer form: notes, address line 2; service site edit/remove (server blocks sites in use) | S | done |

## P0 – blocks real-world use

| Item | Effort | Status |
|------|--------|--------|
| Real email delivery (Resend) done; SMS/WhatsApp todo | M | partly done |
| Server-side PDF routes (invoice, quotation) | S | done |
| Event-triggered templates: booking confirmation, "on the way", invoice due, service due | M | done (service-due todo) |
| Gas Safe certificates: CP12, service record, commissioning record (model, `/certificates` API + PDF, issue UI, expiring-CP12 endpoint). Engineer needs unexpired Gas Safe ID. Not an official Gas Safe/Benchmark form layout | L | done |
| Job photos (`/jobs/:id/photos`, WebP only, compressed in the browser, max 600 KB, 30 per job, stored in Postgres) and a real canvas signature pad in the technician portal. Photos are not yet on PDFs; other attachment types (PDF, video) todo | M | done |
| Customer quote approval link and e-sign (`/quote/<token>` page, hashed token, typed name + drawn signature; signature not yet on the PDF) | M | done |
| Online payments (Stripe / GoCardless, direct debit for plans) | M-L | **hold** |
| Accounting sync (Xero / QuickBooks / Sage) | L | **hold** |
| Reports fixes: date range unused, hard-coded "4 Active Engineers", job profitability | S-M | done |
| Parts edit/delete, SKU uniqueness, stock filters | S | done |
| MFA/SSO, password reset, user invite UI | M | **hold** |

## P1 – competitive parity and compliance

| Item | Effort | Status |
|------|--------|--------|
| Automatic overdue detection and dunning | S | done |
| Domestic reverse charge VAT, CIS deduction (labour only) and retention on invoices (`reverseCharge`, `cisRatePercent`, `retentionPercent`, `POST /invoices/:id/release-retention`; on the PDF; create-invoice fields, detail breakdown and Release button in the UI). Credit notes don't scale CIS/retention | M | done |
| Deposits / stage payments (link invoices to a quote with a percentage split; final invoice deducts earlier ones). `POST /invoices/stage` `{quoteId, percent \| final, label}`; each stage is its own invoice (`stageLabel`, `stagePercent`). Stage modal on accepted quotes, stage label on invoice list/detail; plain convert is blocked once staged (`HAS_STAGES`). Stage lines use the quote's document VAT rate. Not yet clicked through in a browser | M | done |
| Good/Better/Best quote options (`option` label on quote lines; unlabelled lines are shared; stored totals = shared + cheapest option; accepting requires `option` and drops the other tiers; PDF tags lines `[Good]` and lists each option's total). Pricebook = existing Parts `sellingPrice`; no separate pricebook model. UI: tier field per line in the quote modal, tier picker on `/quote/<token>` and in Record Acceptance; not clicked through in a browser | M | done |
| Service contracts on maintenance agreements: `annualPrice`, `endDate` term, `autoInvoice` (the sweep issues one invoice per visit, price × months/12), `autoRenew` (extends the term 12 months at a time, else the agreement deactivates past the term), `slaResponseHours` (call-outs at the site get `slaDueAt`; computed `slaBreached` while still `new` past it; red badge on the dispatch board). Not done: SLA breach alerts, renewal repricing/customer notice. Not clicked through in a browser | M | done |
| Landlord/agent accounts and CP12 expiry tracker | M | todo |
| GPS check-in/out, timesheets, live map, route optimisation | L | todo |
| Follow-up / recommended work becomes a draft quote | S | todo |
| Suppliers and purchase orders | L | todo |
| Van / multi-location stock and transfers | L | todo |
| Low-stock alerts and auto-reorder | S | dropped (UI + `/reports/low-stock` flag it) |
| First-time-fix rate, repeat visits/callbacks | M | todo |
| Aged debtors report | S | done |
| Report exports (full CSV/PDF, scheduled) | S | todo |
| Audit-log viewer, filter and export | S | done |
| CSV import (customers, parts, equipment) | M | todo |
| Customer quick-create modal (not implemented) | S | todo |
| GDPR: DSAR export, erasure/anonymisation, retention, consent log | M | todo |
| Multi-tenant / multi-branch (`CompanySettings` is a singleton) | L | todo |
| Granular permissions / custom roles | M | todo |
| Optimistic concurrency (`version` + `If-Match`) and offline conflict UI | M | todo |
| Account lockout, session list/revoke, login audit | M | todo |
| Observability: Sentry, `/healthz`, `/readyz` | S-M | todo |

## P2 – later

| Item | Effort | Status |
|------|--------|--------|
| Multi-visit / multi-day jobs, parts-awaiting status, callback link to original job | M | todo |
| Equipment lifecycle: age, replacement forecast, warranty, manufacturer, subtypes | M | todo |
| MCS / Part L / heat-pump design data and handover pack | L | todo |
| Customer self-service portal and review requests | L | todo |
| Barcode / QR scanning | M | todo |
| Revenue forecast and maintenance-plan MRR | M | todo |
| Custom fields | M | todo |
| Checklist templates: conditional logic, photo/signature items, per-job-type auto-attach | M | todo |
| Public API, API keys, outbound webhooks | M | todo |
| MTD VAT submission / accounting export | M | todo |
| Web push for technicians | M | todo |
| Backups / DR runbook, data-retention jobs | S | todo |
| i18n and accessibility audit | M | todo |
| Test and CI coverage (frontend, e2e, coverage gate) | M | todo |
| Offline pre-caching of the day's jobs, offline-created records | M | todo |
| Settings validation (bank, VAT, prefix), technician remove, per-company branding | S | todo |
| Workflow Guide: progress tracking; fix copy for features that don't exist | S | todo |
| Customer duplicate detection | S | todo |

## Doc hygiene to resolve

- `roles-and-access-features.md`, `data-and-state-features.md`, `settings-features.md` reportedly still describe localStorage / simulated auth, contradicting `security-and-auth-features.md`.
- `LOOPHOLES.md` reportedly lists items that are now built (offline, server RBAC, credit notes, VAT report). Reports disagree on Gas Safe/F-Gas enforcement; verify.

# Frontend UI Review — Issues

Reviewed against `.agents/skills/`: **web-design-guidelines** (Vercel Web Interface Guidelines), **vercel-react-best-practices** and **vercel-composition-patterns**. The frontend is Vite + React, so the Next.js/server rules don't apply.

Process: one module per batch. Each batch lists the issues found, then the fixes. `npm run lint` (`tsc --noEmit`) must pass before a batch is marked done.

## Progress

| # | Module | Files | Status |
|---|--------|-------|--------|
| 1 | App shell: layout + auth | `layout/Navbar.tsx`, `layout/RoleBanner.tsx`, `auth/AuthGate.tsx` | Fixed |
| 2 | Public + small views | `public/QuoteApprovalPage`, `audit/AuditView`, `certificates/`, `checklists/`, `maintenance/` | Fixed |
| 3 | Notifications, reports, requests | `notifications/`, `reports/`, `requests/` | Fixed |
| 4 | Inventory + equipment | `inventory/`, `equipment/` | Fixed |
| 5 | Quotations + invoices | `quotations/`, `invoices/` | Fixed |
| 6 | Modals + workflows | `modals/QuickCreateModals`, `workflows/WorkflowGuideModal` | Fixed |
| 7 | Dashboard + dispatch | `dashboard/`, `scheduling/DispatchBoardView` | Fixed |
| 8 | Settings + customers | `settings/`, `customers/` | Fixed |
| 9 | Technician portal | `technician/*` | Fixed |

---

## Batch 1: App shell (layout + auth)

### `layout/Navbar.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| N1 | Icon-only buttons need `aria-label` | Bell and hamburger buttons had no accessible name. The bell's pending dot was colour-only. | Fixed |
| N2 | Decorative icons `aria-hidden` | All lucide icons were exposed to assistive tech. | Fixed |
| N3 | Focus states | The brand buttons used `focus:outline-none` with no replacement. Nav links and menu buttons had no visible focus ring. | Fixed: shared `focus-visible` ring |
| N4 | Disclosure state | "New", account and hamburger buttons had no `aria-expanded` or `aria-haspopup`. | Fixed |
| N5 | Keyboard and dismiss | Quick-create and account menus could not be closed with Esc or an outside click. They could also be open at the same time. | Fixed: one effect plus a header ref, and opening one closes the other |
| N6 | Semantic HTML / landmarks | The mobile drawer was a bare `<div>`. Active links didn't expose the current page. | Fixed: `<nav aria-label>` and `aria-current` |
| N7 | Duplication | The brand button was copy-pasted for desktop and mobile. The five quick-create buttons were copy-pasted. The mobile copy had also drifted, showing "UK" instead of "Field Service UK". | Fixed: single `brandButton` and a `quickItems` map |
| N8 | Dead code | Unused `Wrench` import. | Fixed |

### `layout/RoleBanner.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| R1 | Correctness | The technician banner hard-coded "(Liam Campbell)", so every technician was labelled as Liam under real auth. | Fixed: removed the name |
| R2 | Accessibility | The role-switch toggles didn't expose their selected state. The icons weren't `aria-hidden`. | Fixed: `aria-pressed` and `aria-hidden` |
| R3 | Focus states | The switch buttons and the primary-action link had no visible focus ring. | Fixed |
| R4 | Duplication | Four near-identical switch buttons. | Fixed: mapped over roles |
| R5 | Dead code | Unused `ShieldCheck` import. | Fixed |

### `auth/AuthGate.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| A1 | Bug | `auth.me()` can return `null`, and `Login` used `me()!`. A null result bounced the user back to the login form with no message. | Fixed: shows an error |
| A2 | Forms | The inputs had no `name`. The email input was missing `spellCheck={false}`. | Fixed |
| A3 | Typography | Loading label is "Sign in" while busy; it should end in `…`. | Fixed: "Signing in…" |
| A4 | Accessibility / motion | The full-page spinner had no status role or text. Spinners ignored `prefers-reduced-motion`. | Fixed: `role="status"`, sr-only text, `motion-reduce:animate-none` |
| A5 | Focus states | The submit button had no focus ring. | Fixed |

### Noted, not changed

- `AuthGate` creates a new context value object on every render (`rerender-*` rules). It only re-renders on login and logout, so there's no measurable cost.
- `autoFocus` on the login email field is kept, because it is the only control on the page.
- Menus are disclosure popovers with no arrow-key roving focus. Add that if a full `role="menu"` pattern is wanted.
- Role labels and descriptions are duplicated between `Navbar.roleLabels` and `RoleBanner.roleConfigs`. Merge them when a third consumer appears.

---

## Batch 2: Public quote page + small views

### `public/QuoteApprovalPage.tsx` (customer-facing)

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| Q1 | Locale | Hard-coded `£${n.toFixed(2)}` and raw ISO expiry date. | Fixed: `Intl` currency and date formatting |
| Q2 | Forms | The name input had no `name` or `autoComplete="name"`, and no `required`. The tier radios had no `required`. | Fixed |
| Q3 | Destructive action | "Decline" was irreversible and fired with no confirmation. | Fixed: confirm dialog |
| Q4 | Focus and hover | The Accept and Decline buttons and the name input had no focus ring or hover state. | Fixed |
| Q5 | Async state | The error and loading states used the same plain `<p>`, with no live region. The fetch had no stale-response guard when `token` changes. | Fixed: `role=alert/status` and a stale flag |
| Q6 | Typography and semantics | Table headers had no `scope`. Money and quantity columns weren't tabular. The button label didn't change while busy. | Fixed: "Sending…", "Accept Quotation" |

### `audit/AuditView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| U1 | Bug | Out-of-order responses while typing could overwrite newer results. | Fixed: sequence ref |
| U2 | Bug | "Load more" could be double-clicked, appending the same page twice. | Fixed: disabled while busy, "Loading…" |
| U3 | Forms | The search input was not `type="search"`, with no `name` or `autoComplete`, and no focus ring. | Fixed |
| U4 | Accessibility | The error message had no `role="alert"`. The table headers had no `scope`. | Fixed |
| U5 | Content handling | Long `details` strings could blow out the table. | Fixed: `break-words` |

### `certificates/CertificatesView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| C1 | Bug | The submit button stayed enabled during the request, so a double-click could issue two certificates. | Fixed: busy state, "Issuing…" |
| C2 | Accessibility | The appliance check selects were labelled with the raw camelCase key (`flueOperation`). | Fixed: readable label |
| C3 | Accessibility | The "PDF" buttons were ambiguous per row. The empty actions `<th>` had no text. The toggle had no `aria-expanded`. | Fixed |
| C4 | Focus, copy | No focus rings. Title Case labels. | Fixed |

### `checklists/ChecklistsView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| K1 | Bug | A failed save still cleared the add input or closed the editor, because `run()` swallowed the error and resolved. | Fixed: `run()` now resolves true or false |
| K2 | Accessibility | The inline `contentEditable` label had no role or name, and no Enter key handling. | Fixed: `role="textbox"`, Enter commits |
| K3 | Forms | The selects and inputs had no labels (edit mode included). The edit input had no Enter or Esc handling. | Fixed |
| K4 | Destructive action | Delete had no confirmation (Maintenance already has one). | Fixed |
| K5 | Layout | `min-w-96` forced horizontal overflow on phones. `px-6` was not responsive. | Fixed |
| K6 | Decorative icons, focus | Icons weren't `aria-hidden`. The drag handle had no focus ring. | Fixed |

### `maintenance/MaintenanceView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| M1 | Bug | A failed save cleared the form (same `run()` problem as K1). | Fixed |
| M2 | Error handling | `reload` swallowed load errors silently. | Fixed: toast |
| M3 | Accessibility | The customer, site, equipment and frequency selects and the notes input had no labels. The per-row Active, Next due, Edit and Delete controls all had identical names. | Fixed: labels now include the agreement name |
| M4 | Decorative icons | Icons weren't `aria-hidden`. | Fixed |

### Noted, not changed

- `new Date().toISOString().slice(0, 10)` for "today" (Certificates, Maintenance) is UTC, so it is wrong by a day around midnight during BST. Fix with a local-date helper in `utils/` when a third caller appears.
- `CertificatesView` types appliances as `any[]` and has no confirm on the "Issue" action. Issuing is recorded in the audit log, so it was left alone.
- The table rows in Audit and Certificates are not virtualised. Audit is cursor-paged and Certificates is small.
- The Certificates table's blue and the rest of the app's sky accent are inconsistent. A design decision, not a bug.

---

## Batch 3: Notifications, reports, service requests

New shared helper: `utils/useEscape.ts` (Escape closes a modal). Used by both modal views here. Batch 6 should reuse it, or replace it with a proper `Modal` wrapper.

### `notifications/NotificationsView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| NF1 | Bug (customer-facing) | "Approve & Send", "Send to Customer" and "Save to Queue" stayed enabled during the request. A double-click could send a customer message twice. | Fixed: shared `busy` guard, "Saving…" |
| NF2 | Bug | The draft form was pre-filled with a hard-coded body ("Liam Campbell will be your Gas Safe engineer…") and a fixed subject. Sending it unedited told real customers the wrong engineer. | Fixed: empty fields with placeholders, cleared after save |
| NF3 | Accessibility | Both modals had no `role="dialog"` / `aria-modal`, no Escape handling, and the "✕" close buttons had no accessible name. | Fixed |
| NF4 | Forms | The `<label>`s weren't tied to their controls (no `htmlFor`). The subject and body had no `name`. | Fixed |
| NF5 | Accessibility / focus | The Preview buttons were identical per row. No focus rings. Icons weren't `aria-hidden`. | Fixed |
| NF6 | Empty state | An empty queue rendered a blank panel. | Fixed |

### `reports/ReportsView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| RP1 | Bug | The CSV export used a `data:` URI with `encodeURI`, which breaks on `#` or `%`, and Excel garbled `£` without a BOM. | Fixed: `Blob` + BOM + `revokeObjectURL` |
| RP2 | Accessibility | Table headers had no `scope`. The technician colour dot wasn't hidden from assistive tech. | Fixed |
| RP3 | Focus | The export button and period select had no focus ring. | Fixed |
| RP4 | Dead code | Eight unused lucide imports. | Fixed |

### `requests/ServiceRequestsView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| SR1 | Bug | The scheduling form defaulted to the hard-coded date `2026-10-13` and had no `min`, so it let you book jobs in the past. | Fixed: `getTodayISO()` default and `min` |
| SR2 | Bug | The submit stayed enabled while the job was being created, so a double-click could book the job twice. | Fixed: busy guard, "Scheduling…" |
| SR3 | Accessibility | The modal had no dialog role, no Escape handling, and an unnamed "✕" button. The conflict warning wasn't announced. | Fixed: `role="alert"` on the warning |
| SR4 | Forms | The labels weren't associated with their controls. | Fixed |
| SR5 | Layout / semantics | The filter tabs overflowed on narrow screens and didn't expose their selected state. A missing site rendered ", ()". | Fixed: wrap, `aria-pressed`, "No site on file" |
| SR6 | Dead code | Six unused lucide imports and an unused `updateServiceRequest`. | Fixed |

### Noted, not changed

- `ReportsView` uses `hourlyRate || 85` for technician billable labour but `|| 0` in Job Profitability. The two tables can disagree for jobs with no rate set. This is a business decision, so confirm which one is right.
- The Repeat Customer Ratio is O(customers × jobs) on every render. A `useMemo` or a count map would fix it if the data grows.
- The modals still have no focus trap or focus restore. Fix this with the shared `Modal` in batch 6.
- The notification type labels (`replace('_', ' ')`) only replace the first underscore, which is fine for today's six types.

---

## Batch 4: Inventory + equipment

Also touched: `context/AppContext.tsx`. `adjustStock` now returns `Promise<boolean>` (it used to return `void` and swallow errors), so callers can tell whether it worked. Existing callers ignore the return value.

### `inventory/InventoryView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| IV1 | Bug | The adjust-stock modal closed even when the server rejected the adjustment (e.g. negative stock), discarding the input. | Fixed: stays open on failure |
| IV2 | Bug | The numeric form fields coerced with `parseFloat(...) \|\| 0`, so a field couldn't be cleared and typing produced "05". | Fixed: string state, `Number()` on submit |
| IV3 | Data integrity | Demo values were pre-filled and saved as real data: cost £50, price £95, stock 10, "Warehouse Unit 4", and the note "Wolseley Trade Counter restock". | Fixed: empty fields, required where the server needs them, form reset after save |
| IV4 | Validation | A write-off could be entered for more than the stock held. | Fixed: `max` = current stock for write-offs |
| IV5 | Bug | The add and adjust submits had no busy guard, so a double-click could create duplicates. | Fixed: "Adding…" / "Saving…" |
| IV6 | Accessibility | The modals had no dialog role, no Escape handling, and an unnamed "✕" close button. The labels weren't tied to their controls. The search input had no label. | Fixed |
| IV7 | Accessibility | The per-row Adjust and Delete buttons were identical across rows. No focus rings. Table headers had no `scope`. | Fixed |
| IV8 | Empty states, typography | No empty state for the parts table or the movement log. Placeholders used `...` instead of `…`. Eight unused imports. | Fixed |

### `equipment/EquipmentView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| EQ1 | Bug | The "Service Due" badge compared against the hard-coded date `2026-10-13`, so it was wrong for any other day. | Fixed: `getTodayISO()` |
| EQ2 | Data integrity | The new-asset form saved pre-filled demo values as real data: brand "Worcester Bosch", installed 2024-05-10, warranty 2031-05-10, next service 2026-11-01. | Fixed: empty, dates `required`, installed date can't be in the future |
| EQ3 | Bug | The type filter omitted Ventilation and Chiller, which the form lets you create, so those assets only appeared under "All Types". | Fixed |
| EQ4 | Bug | "Book Service" and "Schedule Next Maintenance" had no busy guard, so a double-click could create two jobs. | Fixed |
| EQ5 | Data integrity | The history drawer showed an invented plant location ("Ground floor utility cupboard") when none was recorded. The refrigerant reading was labelled "R32" regardless of gas. | Fixed: "Not recorded" and "Refrigerant" |
| EQ6 | Accessibility | The history drawer and add modal had no dialog role and no Escape handling. The close buttons were unnamed. The labels weren't tied to controls. The filter chips didn't expose their state. | Fixed |
| EQ7 | Accessibility | The per-card History and Book Service buttons were identical across cards. The search input had no label. | Fixed |
| EQ8 | Empty state, dead code | No "no results" state. Eight unused imports. A missing site rendered "()". | Fixed |

### Noted, not changed

- `EquipmentView.handleBookServiceForEquipment` hard-codes £85/h, £35 travel, 09:00–11:30 and 150 minutes for the job it creates. These should come from `settings`, which is a business decision.
- The movement log in Inventory renders every movement. Cap it or paginate it if the ledger grows large.
- The "Service Due" badge is derived from the due date only, and ignores `eq.status`.
- The modals still have no focus trap or focus restore. Batch 6 covers the shared `Modal`.

---

## Batch 5: Quotations + invoices

Also touched:
- `utils/formatters.ts`: `getTodayISO()` now returns the local date. It used `toISOString()` (UTC), which is the wrong day after midnight in BST. This also fixes the batch 3/4 callers (Requests, Equipment) and the Dispatch board.
- `context/AppContext.tsx`: `acceptQuotation` now returns `Promise<boolean>` (it returned `void` and swallowed errors).

### `quotations/QuotationsView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| QT1 | Bug (customer document) | The preview printed the customer's *first* service location instead of the quoted site (`quote.locationId`). | Fixed |
| QT2 | Bug | The "Invoice" button had no busy guard, so a double-click could create two invoices. The Convert to Job, Stage and Accept submits had the same gap. | Fixed: shared `busy`, "Booking…" / "Saving…" |
| QT3 | Bug | "Confirm Acceptance" closed the modal without waiting for the result, so a failed acceptance still looked recorded. | Fixed: awaits, stays open on failure |
| QT4 | Data integrity | The job-booking date defaulted to the hard-coded `2026-10-15` with no `min`. The signatory name defaulted to "Nigel Edwards". | Fixed: today (local) with `min`, empty name |
| QT5 | Copy / correctness | The preview footer said "Valid for 30 days from date of issue", which could contradict the actual expiry date. | Fixed: "Valid until <expiry>" |
| QT6 | Bug | The status filter omitted Viewed and Expired, so those quotes only appeared under "All". | Fixed |
| QT7 | Accessibility | All four modals had no dialog role and no Escape handling. The "✕" button was unnamed. The labels weren't tied to controls. | Fixed |
| QT8 | Accessibility | The per-row Preview, Accept, Convert, Stage and Invoice buttons were identical across rows. The filter chips didn't expose their state and didn't wrap. No focus rings. Table headers had no `scope`. | Fixed |
| QT9 | Dead code | Nine unused lucide imports. | Fixed |

### `invoices/InvoicesView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| IN1 | Bug (ledger) | "Confirm & Reconcile" stayed enabled during the request, so a double-click could record a payment twice. The retention Release button had the same gap. | Fixed: busy guard, "Recording…" |
| IN2 | Data integrity | The payment reference was pre-filled with an invented `BACS-<timestamp>`, which would be saved as a real bank transaction ID. | Fixed: empty (the field is already required) |
| IN3 | Bug | The payment date was computed in UTC, so it was the wrong day after midnight in BST. | Fixed via `getTodayISO()` |
| IN4 | Bug | The amount field coerced with `parseFloat(...) \|\| 0`, so it couldn't be cleared and typing produced "05". | Fixed: string state, `Number()` on submit |
| IN5 | Bug | The status filter omitted Draft, Credited and Void. | Fixed |
| IN6 | Copy | The VAT KPI was labelled "UK Standard VAT (20%) Output" but sums every rate (5%, 0%, reverse charge). | Fixed: "VAT Output" |
| IN7 | Accessibility | Both modals had no dialog role and no Escape handling. The "✕" button was unnamed. The labels weren't tied to controls. The search input had no label. | Fixed |
| IN8 | Accessibility | The per-row View and Record Payment buttons were identical across rows. The filter chips didn't expose their state. Table headers had no `scope`. | Fixed |
| IN9 | Dead code | Ten unused lucide imports. | Fixed |

### Noted, not changed

- The Accept modal pre-fills the signatory with the *customer name* (often a company). The field wants a person. It is still required and editable.
- The invoice and quote preview documents are dense and inline. Splitting them into `QuoteSheet` / `InvoiceSheet` components (composition rules) would shrink these two 570-line files, but that is a refactor, not a fix.
- The modals still have no focus trap or focus restore. Batch 6 covers the shared `Modal`.

---

## Follow-up (requested after batch 5)

| ID | Issue | Fix | Status |
|----|-------|-----|--------|
| PR1 | "Print Quote", "Print Invoice" and the technician job report called `window.print()`, which printed the whole page (nav, backdrop, buttons) and clipped the document at the modal's max-height. | New `printSheet()` in `utils/pdf.ts`: it clones the modal's `[data-pdf-sheet]` unclipped into `#print-root`, hides everything else with `body.printing-sheet > :not(#print-root)` in `index.css`, then prints and cleans up on `afterprint`. It handles multi-page documents, and `@page { margin: 12mm }` was added. | Fixed (3 call sites) |
| JD1 | The Quick Create **job** form defaulted to the hard-coded date `2026-10-14`. The component stays mounted, so the date also kept whatever was last chosen. | Defaults to `getTodayISO()` and is reset to today every time the job form opens. | Fixed |

Not changed on purpose: the Dispatch board's modal reschedules an *existing* job, so it keeps that job's date. Booking a service from an equipment card uses the asset's next-service-due date.

### Found while checking, for batch 7

`dashboard/DashboardView.tsx` hard-codes the app's "today" as `2026-10-13` (and a week of `2026-10-12`..`2026-10-18`) in at least eight places. "Jobs today", overdue jobs, the weekly view and the maintenance-due list are all wrong on any other day. This will be fixed in batch 7.

---

## Batch 6: Modals + workflow guide

### Shared: `utils/useDialogFocus.ts` (called once in `App.tsx`)

Closes the "no focus trap / focus restore" gap noted in batches 3–5 **for every modal in the app** (about 15 dialogs), without touching each one. Any overlay with `role="dialog" aria-modal="true"` now gets:
- focus moved into it when it opens,
- Tab and Shift+Tab trapped inside the topmost dialog,
- focus returned to the button that opened it when it closes.

Escape-to-close stays in `utils/useEscape.ts`. A full `<Modal>` wrapper was not built: the overlay markup is the same in all dialogs and the hook covers the behaviour. Add the wrapper only if the overlay styling needs to change in one place.

### `modals/QuickCreateModals.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| QC1 | Bug (data bleed) | The component stays mounted, so the previous form's state survived: line items, problem text, job description, VAT, CIS, retention. A new quote started from the last quote's lines. | Fixed: every open resets to a clean form |
| QC2 | Bug | Terms and default VAT were captured once at mount, before settings finished loading, so new quotes and invoices could carry empty terms or the wrong VAT. | Fixed: re-read from `settings` on each open |
| QC3 | Bug (wrong site) | Every request, job, quote and invoice was attached to the customer's **first** service location, with no way to pick another. | Fixed: a site selector appears when the customer has more than one site, and equipment is filtered to that site |
| QC4 | Bug | Changing customer kept the previously chosen equipment id, which could be sent for the wrong customer. | Fixed: cleared on customer and site change |
| QC5 | Bug | None of the four submits had a busy guard, so a double-click could create duplicate requests, jobs, quotes or invoices. | Fixed: shared `guard()`, buttons disabled |
| QC6 | Bug | Issue, expiry and due dates were computed in UTC (wrong day after midnight in BST). | Fixed: local dates |
| QC7 | Validation | A quote or invoice could be submitted with zero line items. | Fixed: the submit is disabled until there is at least one line |
| QC8 | Accessibility | No dialog role or Escape handling. The close button was unnamed. The labels weren't tied to controls (about 12 fields). The line-item description, option, remove, VAT, CIS and retention controls had no accessible names. | Fixed |
| QC9 | Accessibility / focus | Icons weren't `aria-hidden`. Cancel and submit buttons had no focus ring. | Fixed |

### `workflows/WorkflowGuideModal.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| WF1 | Accessibility | No dialog role or Escape handling. The close button was unnamed. | Fixed: `aria-labelledby` the title |
| WF2 | Accessibility | The workflow tabs were plain buttons: no `tablist` / `tab` / `tabpanel`, and no selected state. | Fixed: roles, `aria-selected`, `aria-controls` |
| WF3 | Copy | The subtitle said "required by Section 16", an internal spec reference shown to users. | Fixed |
| WF4 | Dead code | Ten unused lucide imports. | Fixed |

### Noted, not changed

- **`WorkflowGuideModal` is demo content.** The copy names seeded records and people (SR-1024, QTE-2026-0041, JOB-2026-0810, "David Ross or Liam Campbell", "Mrs. Margaret Higgins"). It is misleading against real data, and under real auth `switchUserRole` is a deliberate no-op, so the "Tech Van Portal" buttons only navigate. **Done (follow-up):** all demo entry points are hidden when `realAuth` is true. That covers the Navbar "Workflow Demo" button, the Dashboard "Guided Test Scenarios" card, the footer "Test End-to-End Workflows" link and its "Realistic Sample Business Data Loaded" note. The modal itself also refuses to open (`isOpen && !realAuth`).
- The tabs have no arrow-key roving (Tab moves between them). Add it if the full WAI-ARIA tabs pattern is wanted.
- The default quote lines (£85 labour, £35 travel), the job's £85/h rate and the "sent" status on creation are hard-coded in `QuickCreateModals`. They should come from `settings` (the same business decision as the Equipment booking note in batch 4).
- Quote/invoice quantity and price still coerce with `|| 0`. The fields are small and `min` is set, so it was left.
- The focus hook observes all DOM mutations (a cheap `querySelectorAll` each time). Narrow it if it ever appears in a profile.

### Found while doing the follow-up, for batch 7

The Dashboard's "Regulatory Certifications" card hard-codes Gas Safe `#649201`, F-Gas `#REF1039841`, VAT `GB 384 9201 44` and "20% (Standard)" instead of reading `settings`. It shows invented identifiers as the company's own, so the card will be fixed in batch 7.

---

## Batch 7: Dashboard + dispatch board

Also touched:
- `utils/formatters.ts`: new `addDaysISO(iso, days)`, local-time date arithmetic with no UTC drift.
- `context/AppContext.tsx`: `updateJob` now returns `Promise<boolean>`, the same pattern as `adjustStock` and `acceptQuotation`.

A repo-wide search confirms **no hard-coded calendar dates remain** in components, context, store, services or utils.

### `dashboard/DashboardView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| DB1 | Bug | "Today" was hard-coded as `2026-10-13` in 8 places, with the week as `2026-10-12..18` and the month as `2026-10`. Today's Jobs, the roster, overdue jobs, the date filters and the maintenance-due list were all wrong on any other day. | Fixed: local today, Monday–Sunday week, current month, next 7 days |
| DB2 | Data integrity | The header hard-coded "Apex Climate Solutions Ltd", "London & South East Depot" and "Tuesday, 13 October 2026". The filter options said "Today Only (13 Oct)" and "October 2026". | Fixed: `settings.companyName`, `settings.city`, today's date and the month name computed |
| DB3 | Data integrity | The Regulatory Certifications card showed invented Gas Safe `#649201`, F-Gas `#REF1039841`, VAT `GB 384 9201 44` and "20% (Standard)" as the company's own. | Fixed: reads `settings` ("—" when unset) |
| DB4 | Bug | The Action Queue header counted overdue jobs but never listed them. | Fixed: lists up to 3 with a Manage link, plus a "Nothing needs attention" empty state |
| DB5 | Bug | The status filter omitted Awaiting Approval and On Hold. | Fixed |
| DB6 | Data integrity | A job with no city displayed "London". Dates showed as raw ISO strings. | Fixed |
| DB7 | Accessibility | The filter selects had no labels. The per-row Manage buttons were identical. Table headers had no `scope`. Icons weren't `aria-hidden`. The pulsing "On Site" dot ignored reduced motion. | Fixed |
| DB8 | Dead code | Eleven unused lucide imports. | Fixed |

### `scheduling/DispatchBoardView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| DS1 | Bug | "Save Schedule" always closed the modal, even when the update failed (the error was swallowed), so the user's edits were lost. | Fixed: stays open on failure |
| DS2 | Bug | The save button had no busy guard. | Fixed: "Saving…" |
| DS3 | Bug | The day navigation parsed and formatted dates across UTC and local time, so it drifts a day in some timezones. | Fixed: `addDaysISO` |
| DS4 | Accessibility | The job cards were `<div onClick>` with no keyboard access. | Fixed: `role="button"`, `tabIndex`, Enter/Space, per-job label |
| DS5 | Accessibility | The reschedule modal had no dialog role and no Escape handling. The close button was unnamed. The labels weren't tied to controls. The conflict and certification warnings weren't announced. | Fixed: `role="alert"` on the warnings |
| DS6 | Accessibility | The view toggle and status buttons didn't expose their selected state. The day-nav buttons were icon-only with just a `title`. The "Edit / Reassign" buttons were identical across rows. Table headers had no `scope`. | Fixed |
| DS7 | Production hygiene | A `console.log` ran on **every render**, and emoji debug logs (plus a `console.warn` and `console.error`) ran inside the save handler. | Removed |
| DS8 | Content | The audit trail showed time only, with no date. | Fixed: date and time |
| DS9 | Dead code | Eleven unused lucide imports, and unused `formatGBP`, `equipment` and `parts`. | Fixed |

### Noted, not changed

- **Settings already has `defaultHourlyRate` and `defaultTravelCharge`.** The hard-coded £85/h, £35 travel and 09:00–11:30 slot in `EquipmentView` and `QuickCreateModals` (noted in batches 4 and 6) have a proper source. Wiring them up is a small follow-up.
- The Dispatch list view renders every job with no virtualisation or paging. Add `content-visibility: auto` or paging when the job count passes about 200.
- `viewMode` allows `'calendar'` but there is no calendar UI.
- The Action Queue still shows only the first 2 maintenance reminders while its header counts all of them. Add "+N more" if that matters.

---

## Batch 8: Settings + customers

Also touched: `context/AppContext.tsx`. `updateTechnician`, `updateCustomer`, `addCustomerLocation` and `updateCustomerLocation` now return `Promise<boolean>`, the same pattern as the earlier batches. Callers that ignored the result still compile.

### `settings/SettingsView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| SE1 | Compliance / data integrity | The "Add Technician" form was pre-filled with demo values that were **saved as real**: Gas Safe `GSR-992140`, F-Gas `FGAS-2079`, van `LO24 KMP` and skills "Domestic Gas, Heat Pumps". A new engineer was created holding a fake gas licence. | Fixed: empty fields, form reset after save |
| SE2 | Bug (destructive) | "Reset Demo Data" (replaces **all** data with the sample set) was one confirm away for production admins. | Fixed: hidden when `realAuth` is true |
| SE3 | Bug (destructive) | "Restore JSON" replaced all data from the chosen file with **no confirmation**. | Fixed: confirm naming the file. The input is reset so the same file can be chosen again. |
| SE4 | Accessibility | The Restore file input was `display:none`, so keyboard users couldn't reach it. | Fixed: `sr-only` with a `focus-within` ring on the label |
| SE5 | Bug | The form copied `settings` once at mount, but settings load async, so a stale copy could be edited and saved over the real settings. | Fixed: re-synced when `settings` changes |
| SE6 | Bug | "Update Profile" closed the modal and showed a second "Updated" toast even when the save failed. | Fixed: stays open on failure, single toast |
| SE7 | Bug | None of Save All Settings, Add Technician or Update Profile had a busy guard. | Fixed: "Saving…" / "Adding…" |
| SE8 | Accessibility | 34 labels weren't tied to their controls. Both technician modals had no dialog role or Escape handling. The icon-only Edit buttons were identical across technicians. | Fixed |
| SE9 | Forms / content | The registration, sort-code and account fields were spell-checked and not numeric. The add-technician skills placeholder suggested "Domestic Gas, Commercial Gas, VRF AC", but the scheduling guard matches keys like `GAS_SAFE` / `F_GAS`. The backup filename used `Date.now()`. | Fixed: `inputMode`, `spellCheck`, key-style placeholder, ISO date |
| SE10 | Dead code | Six unused lucide imports. | Fixed |

### `customers/CustomersView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| CU1 | Compliance (UK GDPR) | "Customer consented to service communication" was **pre-ticked** for every new customer. Consent must be an affirmative act. | Fixed: defaults to unticked |
| CU2 | Bug | A failed save still closed the customer modal (add and edit), and a failed site save still closed the site form, so entered data was lost. | Fixed: stays open on failure |
| CU3 | Bug | There were no busy guards on creating a customer or saving a site, so a double-click could create duplicates. | Fixed |
| CU4 | Data integrity | The billing city defaulted to "London". | Fixed: empty |
| CU5 | Bug | Phone search failed when the stored number had spaces ("020 8940…") and the user typed without them. | Fixed: whitespace-insensitive |
| CU6 | Forms | The customer fields had no `name` and used browser autofill, which could fill the *operator's* own details into a customer record. | Fixed: `autoComplete="off"`, email spellcheck off |
| CU7 | Accessibility | The 360 drawer and the add/edit modal had no dialog role or Escape handling. The close buttons were unnamed. 10 labels weren't tied to controls. The "Customer Type" radios had no group. The site-form inputs had only placeholders. | Fixed: `radiogroup`, `aria-label`s, one Escape closes the topmost |
| CU8 | Accessibility / focus | The name button used `focus:outline-none` with no replacement. The type filters and archive toggle didn't expose their state. The icon-only Edit and Archive buttons and the Edit and Remove site links were identical across rows. Table headers had no `scope`. | Fixed |
| CU9 | Content | Job and equipment dates showed as raw ISO strings. | Fixed |
| CU10 | Dead code | The postcode-lookup state and handlers (`handleSiteLookup`, `selectSiteAddress`, four `useState`s and the import) had no UI. About 25 lines plus 12 unused lucide imports. | Deleted |

### Noted, not changed

- **Server must also guard `data.import`.** Hiding "Reset Demo Data" under `realAuth` removes the button, but `POST` import (`services.data.import`) is the same endpoint Restore uses. Confirm the backend restricts it to admins and, ideally, refuses it outside demo mode.
- Archive has no confirmation (it is reversible via "Restore"), so it was left alone.
- The Settings number inputs (`Number(e.target.value)`) still can't be emptied. There are only three, all with `min={0}`.
- The technician roster has no way to deactivate someone (`active` is set to `true` on create and never changed in the UI).
- The customer table renders every customer with no pagination. Add paging if the directory grows into the hundreds.

---

## Batch 9: Technician portal (field app)

Also touched: `context/AppContext.tsx`. `addJobPart` and `addRefrigerantLog` now return `Promise<boolean>`.

### `technician/TechnicianPortalView.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| TP1 | **Compliance / data integrity** | The diagnostic readings were pre-filled (pressure 1.4 bar, flow 70 °C, return 54 °C, **CO 14 ppm**, CO₂ 9.2 %, refrigerant 125 psi). "Save Findings" logged these as measurements the engineer never took. | Fixed: empty fields |
| TP2 | **Compliance / data integrity** | With no notes typed, Save Findings wrote "Standard maintenance inspection performed." and "System running satisfactory." into the permanent equipment service history. The printed certificate also claimed "completed to Gas Safe / F-Gas standards" when no work was recorded. | Fixed: work notes are required to save, no invented text, and the certificate says "No work notes recorded." |
| TP3 | **Bug (data corruption)** | Form state (notes, hours, follow-up, readings, signature name and ink) lived outside the job. Switching job or van carried the previous job's text onto the next, and the next Save wrote it there. | Fixed: everything resets when the job shown changes, and the signature pad remounts |
| TP4 | Bug (privacy) | When a technician had no jobs the screen fell back to `jobs[0]`, showing another technician's job. The van selector was also available to technicians. The portal defaulted to the hard-coded `tech-1` / `job-1`. | Fixed: it never falls back to someone else's job, and the selector is office-only |
| TP5 | **Bug** | Signing called `updateJob` without waiting, then set "Signed" and toasted "Job marked completed!". If the server refused (completion gate: unticked safety item, no refrigerant log), the UI still showed the job as signed off. | Fixed: awaits the result, shows signed only on success |
| TP6 | Bug | Save Findings toasted success and wrote service history even when the job update failed. | Fixed: awaits, then writes history only on success |
| TP7 | Bug | There were no busy guards. A double-tap on Add Part deducted stock twice and created two movements. Refrigerant Add, Save Findings and Sign-off had the same gap. A failed refrigerant entry also cleared the form. | Fixed: guards, and the entry is kept on failure |
| TP8 | Bug | The parts list defaulted at mount, before parts loaded, so "Add Part" silently did nothing. | Fixed: defaults at render time |
| TP9 | Bug | The "Today's Route" list showed every job the technician ever had (including old completed ones) in one horizontal strip. | Fixed: open stops from today onwards plus unfinished older ones, sorted by time. Retitled "Route & Assigned Stops". |
| TP10 | Validation | Labour hours could be 0 (`parseFloat \|\| 0`) and still save. | Fixed: must be above 0 |
| TP11 | Destructive | "Cancel" job fired immediately from a status button. | Fixed: confirm |
| TP12 | Mobile / touch | The checklist checkboxes were about 16 px. The Add, Clear, phone and email targets were short. | Fixed: 20 px checkboxes, taller buttons and links |
| TP13 | Accessibility | 9 labels weren't tied to controls. The refrigerant, part and quantity inputs had only placeholders. The status buttons and stop selector didn't expose their state. "Sign on Glass" and "Update Job Status" were `<label>`s with no control. The service report had no dialog role or Escape handling. | Fixed |
| TP14 | Dead code | Seven unused lucide imports, plus `useRef` and `formatTimeOnly`. | Fixed |

### `technician/SignaturePad.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| SG1 | Accessibility / touch | The "Clear" button was 10 px text. The "Signature captured" status wasn't announced. | Fixed: larger target, `aria-live` |

### `technician/JobPhotos.tsx`

| ID | Rule | Issue | Status |
|----|------|-------|--------|
| PH1 | Accessibility | The file input was `hidden` (display:none), so keyboard users couldn't add photos. | Fixed: `sr-only` with a `focus-within` ring |
| PH2 | Bug (evidence) | A slow photo response for a previous job could overwrite the current job's photos. | Fixed: sequence guard |
| PH3 | Destructive / touch | The remove "×" was a ~20 px target and deleted a compliance photo with no confirmation. | Fixed: 36 px target and confirm |

### Noted, not changed

- `SignaturePad` sizes its canvas once at mount. Rotating the phone mid-signature misaligns later strokes. It needs a `ResizeObserver` that redraws the saved image.
- `labourHours` still defaults to 2.5 on a job with none recorded, so a job could be billed for hours nobody entered. Consider leaving it empty (like the readings) once the invoice flow no longer relies on it.
- Saving findings more than once adds another service-history record per piece of equipment each time. The server has no idempotency key for service records, so the UI can only prevent double-taps, not deliberate repeats.
- The technician screen is online-first at the UI level: "Works offline" is claimed in the workflow copy, and queueing lives in `services/` and `sw.ts`, which were out of scope for this UI review.

---

## Final status: all 9 batches reviewed and fixed

`npm run lint` (`tsc --noEmit`) passes after every batch.

### What changed across the codebase (cross-cutting)

- **Shared helpers added:** `utils/useEscape.ts` (Escape closes a modal), `utils/useDialogFocus.ts` (focus trap and restore for all dialogs, called once in `App.tsx`), `printSheet()` in `utils/pdf.ts` (prints only the document), and `addDaysISO()` in `utils/formatters.ts`.
- **`getTodayISO()` now returns the local date**, not UTC.
- **Context handlers now report success:** `adjustStock`, `acceptQuotation`, `updateJob`, `updateTechnician`, `updateCustomer`, `addCustomerLocation`, `updateCustomerLocation`, `addJobPart` and `addRefrigerantLog` return a boolean, so views no longer close modals or claim success after a failure.
- **Patterns fixed repeatedly:** hard-coded dates and demo values saved as real data, double-submit on every create/record action, modals without dialog semantics or Escape, labels not tied to controls, icon-only buttons with no name, missing focus rings, and filter chips missing statuses the data can hold.

### Outstanding decisions and follow-ups

1. **Backend:** confirm `data.import` is admin-only and refused outside demo mode (batch 8).
2. **Settings-driven defaults:** `defaultHourlyRate` / `defaultTravelCharge` exist in settings, but Equipment booking, Quick Create and the job's £85/h hard-code them (batches 4, 6, 7).
3. **Reports:** `hourlyRate || 85` vs `|| 0` makes the two tables disagree (batch 3).
4. **Signature canvas** resize handling (batch 9).
5. **Print stylesheet and modal sheets** could be split into `QuoteSheet` / `InvoiceSheet` components, which is a refactor, not a fix (batch 5).

---

## Verification status (what has NOT been checked)

After the nine batches only `npm run lint` (`tsc --noEmit`) had been run. A later browser pass (2026-10-18, Playwright against the Vite dev server and the dev backend) checked most of the UX table below; results are in "Browser verification". There are still no frontend tests, and anything not listed there remains **type-checked, not tested**.

### Browser verification (2026-10-18)

**Passed**

| Area | Result |
|------|--------|
| `useDialogFocus` | All four Quick Create modals: focus moves in on open, Tab/Shift+Tab never leave (80 presses each), focus returns to the opener when it stays mounted. |
| `useEscape` | Escape closes the topmost layer. Customers: edit modal closes before the 360 drawer. |
| `printSheet()` + `index.css` | In print media only `#print-root` is visible. `afterprint` removes the clone and body class. One-page quotation printed correctly. |
| Quick Create reset | Reopened modal is empty. |
| Busy guard | Double-click sent one POST; button disabled while saving and re-enabled after failure. |
| Stay-open-on-failure | After a mocked 500 the modal stays open with its input. |
| Technician portal | Notes, readings and name reset on van switch; signature canvas clears; failed sign-off does not show "Signed" and keeps name and signature. |
| Technician scoping | `dev-technician` gets 3 of 9 jobs, 403 on customers and invoices. |
| Labels and names | All 15 tabs: no duplicate ids, broken `htmlFor`, unnamed controls or unnamed buttons. |
| Focus rings | Every focusable element on Dashboard and Invoices has a visible ring. |
| Build | `vite build` succeeds; `jspdf` and `html2canvas` stay lazy chunks. Size not compared with `main`. |

**Found and fixed**

- Navbar overflowed horizontally at phone widths (hamburger at x≈419, user menu clipped). Brand text in `Navbar.tsx` now shows from `sm` up.
- Certificates page overflowed by up to 113px: an absolutely positioned `sr-only` span escaped the non-`relative` scroll wrapper. Added `relative` in `CertificatesView.tsx`.
- Keyboard submit dropped focus to `<body>` when the busy guard disabled the focused button. `useDialogFocus` now keeps focus in the dialog and restores it to that button on re-enable (it still sits on `<body>` briefly while the button is disabled).

**Found, not fixed**

- "New → Add Customer" only switches to the Customers tab; no form opens (intended per a code comment, but the label implies one).
- Focus returns to `<body>` when the opener unmounts (the New menu), and to the drawer's `Close` after the nested edit modal closes.
- Checklist checkboxes update only after the server responds (no optimistic update).
- `[STORE-DEBUG]` logs print on every store call.
- Dev mode only: the UI role switcher is independent of the `x-dev-user` API header, and "Test as: technician" only navigates.

**Still not verified:** real auth mode (needs Supabase), multi-page print, screen reader, two overlapping dialogs with a toast, tap-target sizes beyond a count of controls under 32px, Lighthouse and React Profiler.

### UX: not verified

| Area | What is unverified | Risk |
|------|--------------------|------|
| `utils/useDialogFocus.ts` | Focus moves into a dialog on open, Tab and Shift+Tab stay inside the topmost one, focus returns to the opener on close. | Medium. It uses a `MutationObserver`, so focus could jump when something else mounts (e.g. a toast) or when two dialogs overlap. |
| `utils/useEscape.ts` | Escape closes the right modal, including nested cases (Customers closes the modal before the drawer). | Low |
| `printSheet()` + `index.css` | Print shows only the document (quote, invoice, service report), including multi-page output. `afterprint` cleanup fires and the page returns to normal. | Medium. Print behaviour differs between browsers. |
| Quick Create modals | Reset-on-open (today's date, clean line items, current settings terms/VAT). New site selector and equipment filtering. | Medium |
| Busy guards | Buttons disable while saving and re-enable after a failure on every create/record action. | Low |
| Stay-open-on-failure | Modals keep their input after a rejected save. This depends on the new boolean returns from the context handlers. | Medium |
| Technician portal | Form reset when switching job or van. Signature pad remount. Sign-off only shows "Signed" on success. Technician cannot see another technician's job. | Medium. This is the highest-risk file. |
| Real auth vs dev mode | Demo triggers hidden under `realAuth`. "Reset Demo Data" hidden. Technician van selector hidden. | Medium. Only dev mode paths have been reasoned about. |
| Mobile (about 375 px) | Layout, the 20 px checklist checkboxes, enlarged tap targets, filter chips wrapping, tables scrolling horizontally. | Unknown |
| Keyboard-only and screen reader | Tab order, visible focus rings, `aria-*` labels, tabs in the workflow guide. | Unknown. Roles and labels were added by pattern, not tested with a screen reader. |
| Regex-driven edits | About 250 labels tied to inputs with `htmlFor` / `id` via scripts. Spot-checked for duplicate ids, not for every label-to-input pairing. | Low to medium |

### Performance: not measured

Most changes were correctness and accessibility. Almost none of the `vercel-react-best-practices` rules were applied, and nothing was profiled.

| Item | Status |
|------|--------|
| Bundle size | Not measured. `vite build` was not run, and there is no before/after comparison. |
| Render profiling | Not done (Dashboard, Dispatch board, large tables). |
| Lighthouse / Web Vitals | Not run. |
| New costs introduced | `useDialogFocus` observes all DOM mutations and runs a `querySelectorAll` on each. The Dashboard now computes its date values on every render. Both are likely negligible but unmeasured. |

**Known gaps, not fixed (carried over from the batch notes):**

| Gap | Where | Suggested fix |
|-----|-------|---------------|
| No virtualization or paging | Dispatch list view (all jobs), Customers table, Audit log accumulation after "Load more", Inventory movement log, Certificates, Invoices and Quotations tables | `content-visibility: auto`, paging, or `virtua` once lists pass about 100–200 rows |
| O(customers x jobs) on every render | Reports "Repeat Customer Ratio" | `useMemo` with a count map |
| Many derived values recomputed each render | Dashboard KPI counts, Reports aggregates, repeated `customers.find(...)` inside row maps (Invoices, Quotations, Requests, Notifications) | `useMemo` and an id-to-customer `Map` |
| Whole app re-renders on any context change | `AppContext` holds all data and handlers, so one update re-renders every consumer | Split the context, or select from the store (`useDataStore`) |
| Focus hook scope | `useDialogFocus` observes `document.body` | Narrow to the dialog mount points if it appears in a profile |
| Signature canvas | Sized once at mount, so rotation misaligns strokes | `ResizeObserver` that redraws the saved image |
| Already good | `jsPDF` and `html2canvas-pro` are lazy-loaded in `utils/pdf.ts`. Photos are compressed to WebP before upload. | none |

### Plan to close this out

1. Run `vite build` and compare bundle size against `main`.
2. Start the app and drive it with Playwright: Escape and focus trap per modal, print isolation, Quick Create reset, double-click guards, technician job switching, keyboard-only pass, 375 px mobile, and a console error check.
3. Run Lighthouse and the React Profiler on the Dashboard and Dispatch board.
4. Record results here and move each item above to "Verified" or open a new issue for it.

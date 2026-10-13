# Data and State Management

All application data lives in a single React context (`AppProvider`) backed by per-slice localStorage persistence, seeded from a static demo dataset for a fictional UK HVAC company. The context exposes typed CRUD and workflow actions (requests to jobs, quotes to jobs/invoices, payments, stock, notifications), generates human-readable reference numbers, writes job audit trails and stock movements, and offers reset/export/import. Sources: `src/context/AppContext.tsx`, `src/data/initialData.ts`, `src/types/index.ts`, `src/utils/formatters.ts`.

## State and persistence

- Slices (`AppContext.tsx:127-139`): `users` (constant), `currentUser`, `settings`, `technicians`, `customers`, `equipment`, `serviceRequests`, `jobs`, `quotations`, `invoices`, `parts`, `inventoryMovements`, `notifications`, plus a transient `toastMessage`.
- Initialisation: each slice is read via `loadStored(key, default)`, which reads `localStorage['apexhvac_app_data_v1_<key>']`, parses JSON, and falls back to the seed on missing/invalid data (`:112-125`). There is no schema versioning or migration beyond the key suffix `v1`.
- Writes: one `useEffect` (`:151-168`) re-serialises all 12 persisted slices to localStorage whenever any changes. Errors (e.g. quota) are silently ignored. `toastMessage` and `users` are not persisted.
- `useApp()` throws if used outside `AppProvider` (`:957-963`).
- IDs for new records are `<prefix>-<Date.now()>` (`tech-`, `cust-`, `eq-`, `rec-`, `sr-`, `job-`, `quote-`, `inv-`, `pay-`, `part-`, `mov-`, `notif-`), line items in generated invoices use `li-<now>-<n>`.
- Nearly every action updates state through functional `setX(prev => ...)`, but several read the closed-over array for lookups or counts (`jobs`, `serviceRequests`, `quotations`, `invoices`, `parts`).

### Toasts

`showToast(text, type = 'success')` sets `toastMessage` and clears it after 4000 ms (`:143-148`). Types `success | error | info`; rendered by `App.tsx:63-84` bottom-right. Overlapping toasts share timers: an earlier timeout can clear a newer toast early.

### Reset, export, import

| Action | Behaviour |
|---|---|
| `resetAllData` (`:185-199`) | Sets every slice (including `currentUser` = first seed user, admin) to seed values; the persistence effect then overwrites localStorage. Info toast. |
| `exportDataJson` (`:201-217`) | Returns pretty JSON of settings, technicians, customers, equipment, serviceRequests, jobs, quotations, invoices, parts, inventoryMovements, notifications, plus `exportedAt`. Does not include `currentUser`. |
| `importDataJson` (`:219-243`) | Parses JSON; requires both `customers` and `jobs` keys, else error toast "Invalid backup file structure" and returns false. Replaces each slice that is present (truthy) with no per-record validation. Parse failure -> error toast, false. Success -> toast, true. |

## Actions

| Group | Action | Behaviour |
|---|---|---|
| Role | `switchUserRole`, `setCurrentUser` | See `roles-and-access-features.md` |
| Settings | `updateSettings(partial)` | Shallow merge, toast. Nested `bankDetails` is replaced wholesale if supplied. |
| Technicians | `addTechnician`, `updateTechnician` | Append / merge by id, toast. No delete. |
| Customers | `addCustomer` | Prepends; sets `createdAt/updatedAt`; returns customer. |
| | `updateCustomer` | Merge + `updatedAt`. |
| | `archiveCustomer(id)` | Toggles `archived` (not one-way) and bumps `updatedAt`. No hard delete. |
| Equipment | `addEquipment` | Prepends with empty `serviceHistory`; returns it. |
| | `updateEquipment` | Merge by id. |
| | `addEquipmentServiceRecord(eqId, record)` | Prepends record (id `rec-<now>`) to `serviceHistory` and sets `lastServiceDate = record.date`. Does not recompute `nextServiceDueDate`; no toast. Called from the technician portal when saving findings. |
| Requests | `addServiceRequest` | Prepends with auto number; returns it. |
| | `updateServiceRequest` | Merge + `updatedAt`; no toast. |
| | `convertRequestToJob(requestId, date, start, end, techId)` | See "Conversions". Throws `Request not found`. |
| Jobs | `addJob`, `updateJob`, `updateJobStatus`, `checkScheduleConflict` | See below. |
| Quotations | `addQuotation`, `updateQuotation`, `acceptQuotation`, `convertQuotationToJob`, `convertQuotationToInvoice` | See below. |
| Invoices | `addInvoice`, `updateInvoice`, `recordPayment`, `generateInvoiceFromJob` | See below. |
| Parts | `addPart` (append, `createdAt`), `updatePart` (merge), `adjustStock` | See "Stock movements". |
| Notifications | `createNotification`, `sendNotification` | See "Notifications". |

## Auto-numbering

Numbers are derived from the current array length plus a constant, not from a persistent counter, so they can repeat after deletion or import and are never checked for uniqueness. Prefix settings (`prefixJob/Quote/Invoice`) are not used; formats are hard-coded.

| Entity | Format | Formula | Source |
|---|---|---|---|
| Service request | `SR-<n>` | `serviceRequests.length + 1025` | `:332-336` |
| Job (addJob) | `JOB-2026-<n>` | `jobs.length + 814` | `:454-459` |
| Job (from request) | `JOB-2026-<n>` | `jobs.length + 813` | `:397-405` |
| Job (from quote) | `JOB-2026-<n>` | `jobs.length + 815` | `:581-593` |
| Quotation | `QTE-2026-<NNNN>` (4-digit zero-padded) | `quotations.length + 42` | `:530-535` |
| Invoice (addInvoice) | `INV-2026-0<n>` | `invoices.length + 120` | `:681-686` |
| Invoice (from quote) | `INV-2026-0<n>` | `invoices.length + 119` | `:642-649` |
| Invoice (from job) | `INV-2026-0<n>` | `invoices.length + 121` | `:744-794` |

With the seed data (3 requests, 4 jobs, 2 quotes, 4 invoices) the first new items are SR-1028, JOB-2026-0817 (addJob) or 0816 (from request) / 0818 (from quote), QTE-2026-0044, INV-2026-0124 / 0123 / 0125. The differing offsets per path mean different creation routes can yield the same number (e.g. a request conversion and an addJob when counts differ). Hard-coded year `2026`; invoice numbers prepend a literal `0` (so they would become `INV-2026-01000` at 1000).

## Jobs, audit logs and status

- `AuditLog` = `{timestamp, userId, userName, action, details}` (`types/index.ts`). Each job has an `auditTrail`.
- Entries are written on: `addJob` ("Job Created", "Created by <name>"), `convertRequestToJob` ("Converted from Service Request", "Created from SR-..."), `convertQuotationToJob` ("Created from Quotation"), and any `updateJob` call that supplies `auditAction` (appended, details "Updated by <name>").
- `updateJob(id, updates, auditAction?)` merges updates, sets `updatedAt`, toasts "Job updated". Without an `auditAction` nothing is logged.
- `updateJobStatus(id, status, note?)` (`:507-524`): sets `arrivalTime` the first time status becomes `in_progress`, `completionTime` the first time it becomes `completed`; audit text `Status set to <status>: <note>` or `Status updated to <status>`; toast "Job <no> marked as <status>". No transition validation: any status can be set from any status. Returns silently if job not found.
- `checkScheduleConflict(techId, date, start, end, excludeJobId?)` (`:354-384`): returns null if no tech; otherwise the first non-cancelled job of the same tech and date whose interval overlaps (`reqStart < jobEnd && reqEnd > jobStart`, so back-to-back slots are allowed). Status `completed` jobs still block. Used by Quick Create and dispatch.

## Conversions

| Action | Creates | Side effects |
|---|---|---|
| `convertRequestToJob` | Job: type `emergency_callout` if request priority is emergency else `repair`; status `scheduled` if technician given else `new`; description = reported problem; equipment from the request; duration = max(30 min, end - start); labour = duration/60 h at GBP 85/h; travel 30 min / GBP 35; 3 general checklist items; skills `['System Diagnostics']` | Request set to `converted` with `convertedJobId`. Does not check conflicts. |
| `convertQuotationToJob` | Installation job, priority medium; duration min 60 min; labour hours = sum of `labour` line quantities (4 if none); skills F-Gas Heat Pumps and Domestic Gas; 4 installation checklist items; `internalNotes = quote.notes` | Quotation gets `convertedToJobId`. Does not require status `accepted`, and does not set `quote.jobId`. |
| `convertQuotationToInvoice` | Invoice status `issued`, due +14 days, items/totals copied, `quoteId`, `jobId = quote.jobId`, payments empty, notes mention the quote | Quotation gets `convertedToInvoiceId`. Does not require acceptance. |
| `generateInvoiceFromJob` | Invoice with: labour line (if `labourHours > 0`), travel line (if `travelCharge > 0`), one part line per `partsUsed` (at `unitPrice`); VAT = `settings.defaultVatRate`; status `issued`, due +14 days | None on the job; can be run repeatedly to produce duplicate invoices. |

`acceptQuotation(id, acceptedBy)` sets status `accepted`, `acceptedAt`, `acceptedBy`.

## Payments

`recordPayment(invoiceId, payment)` (`:704-738`): appends a `PaymentRecord` (`recordedBy` = current user name); `amountPaid += amount`; `balanceDue = max(0, total - amountPaid)`; status becomes `paid` if balance <= 0.01 else `partially_paid`. Overpayment is allowed (balance clamps at 0, `amountPaid` can exceed total). No guard against void invoices or non-positive amounts. Toast shows amount and remaining balance. Note that `overdue` is a type status but nothing in the context sets it automatically.

## Stock movements

`adjustStock(partId, delta, type, notes, jobId?)` (`:837-866`): new quantity = `max(0, stock + delta)` (clamped at zero, but the movement still records the full requested `delta`); updates the part; prepends an `InventoryMovement` with id, type, `quantityDelta`, optional `jobId`, notes, timestamp, `userName`. Toast "Stock updated for <part>: new qty <n>". Callers: Inventory view (manual adjustments/restock) and the technician portal, which calls it with `-quantity` and type `used_on_job` immediately after appending a `JobPartUsed` (using selling price) to the job (`TechnicianPortalView.tsx:111-125`). `updateJob` and `adjustStock` are separate: removing a part from a job does not restore stock in this code. Low stock is a derived concept (`stockQuantity` vs `minStockLevel`) displayed in the UI; the context has no low-stock side effect.

## Notifications

- `createNotification` (prepend, id `notif-<now>`, `createdAt`) and `sendNotification(id)` (status `sent`, `sentAt`, `approvedBy` = current user; toast) are the only actions. `createNotification` shows no toast.
- There are no automatic notifications: no other context action (job scheduled, invoice issued, etc.) creates one. Only the Notifications view creates them (`NotificationsView.tsx:38-45` with status `ready_to_send`). "Sending" is a status flip; nothing is actually emailed or texted.
- The Navbar bell dot reflects `ready_to_send` items.

## Entity model and status lifecycles (`types/index.ts`)

Core entities: `User`, `TechnicianProfile`, `Customer` (with `ServiceLocation[]`, billing address, `communicationPreference` email/sms/both, `gdprConsent`, `archived`), `Equipment` (+ `EquipmentServiceRecord[]`, `EquipmentReading`), `ServiceRequest`, `Job` (+ `JobPartUsed[]`, `AuditLog[]`, `JobChecklistItem[]`, optional `customerSignature`, `followUpRecommended/followUpNotes`, `arrivalTime`, `completionTime`), `Quotation` / `Invoice` (+ `LineItem[]`, `PaymentRecord[]`), `PartItem`, `InventoryMovement`, `CustomerNotification`, `CompanySettings`.

Relationships (by id strings, not enforced): request -> job (`requestId`, `convertedJobId`); quote -> job/invoice (`convertedToJobId`, `convertedToInvoiceId`, `jobId`); invoice -> quote/job (`quoteId`, `jobId`); job -> customer, location, equipment[], technician, parts; equipment -> customer, location; user -> technician (`technicianId`).

| Entity | Statuses | Types and notes |
|---|---|---|
| ServiceRequest | `new`, `awaiting_approval`, `converted`, `cancelled` | Priority `low/medium/high/emergency`; slot `morning/afternoon/all_day/urgent`. Only `converted` is set by context code. |
| Job | `new`, `awaiting_approval`, `scheduled`, `dispatched`, `in_progress`, `on_hold`, `completed`, `cancelled` | Types `installation/repair/inspection/emergency_callout/preventive_maintenance`. Typical path new -> scheduled -> dispatched -> in_progress -> completed; code enforces no ordering. Checklist categories `gas_safety/electrical/refrigerant/general`. |
| Quotation | `draft`, `sent`, `viewed`, `accepted`, `rejected`, `expired` | Context sets only `accepted` (plus whatever views pass to `updateQuotation`). Expiry is not automatic. |
| Invoice | `draft`, `issued`, `partially_paid`, `paid`, `overdue`, `void` | Context sets `issued`, `partially_paid`, `paid`. |
| Equipment | `operational`, `requires_attention`, `decommissioned` | Types combi_boiler, system_boiler, heat_pump, air_conditioning, ventilation, chiller; maintenance `quarterly/biannual/annual`. |
| Notification | `draft`, `ready_to_send`, `sent`, `failed` | Types booking_confirmation, appointment_reminder, technician_arriving, quotation_ready, invoice_issued; channel email/sms. |
| InventoryMovement type | `used_on_job`, `stock_adjustment`, `restock_purchase` | |
| LineItem type | `labour`, `part`, `equipment`, `travel`, `discount`, `fee` | |
| Payment method | `bacs`, `card`, `cheque`, `cash` | |
| UserRole | `admin`, `dispatcher`, `technician`, `accountant` | |

## Seed data (`initialData.ts`)

Fictional UK company "Apex Climate Solutions Ltd" (trading "Apex HVAC Engineering"; Gas Safe 649201; F-Gas REF1039841). Dates are set around "today" = 2026-10-13.

| Export | Count | Highlights |
|---|---|---|
| `INITIAL_SETTINGS` | 1 | VAT default 20, available rates [20, 5, 0]; hours 08:00-17:30; inventory enabled; prefixes `JOB-`, `QTE-`, `INV-`; bank details; T&Cs |
| `INITIAL_USERS` | 5 | Admin, dispatcher, 2 technicians, accountant (see roles doc) |
| `INITIAL_TECHNICIANS` | 4 | Liam Campbell (tech-1, gas/heat pumps), David Ross (tech-2, F-Gas/VRF/chillers), Sophie Walker (tech-3), Marcus Vance (tech-4, installation mate) |
| `INITIAL_CUSTOMERS` | 6 | Crown & Thistle Pub & Hotel, Kensington Medical Centre, ByteForge Tech Hub (commercial); Dr. Alistair & Clare Finch, Mrs. Margaret Higgins, Oliver Davies (residential) |
| `INITIAL_EQUIPMENT` | 6 | Vaillant ecoTEC, Mitsubishi Mr Slim, Daikin VRV IV, Daikin SkyAir, Daikin Altherma 3 (due 2026-10-15), Worcester Bosch Greenstar (overdue 2026-10-05); two are `requires_attention` |
| `INITIAL_SERVICE_REQUESTS` | 3 | SR-1024 emergency new, SR-1025 high new, SR-1026 medium awaiting_approval |
| `INITIAL_PARTS` | 7 | Includes a low-stock item (Daikin fan motor, 2 on hand, min 2); Fernox F1 24 on hand |
| `INITIAL_JOBS` | 4 | JOB-2026-0808 completed (12 Oct), 0810 in_progress and 0811 scheduled (13 Oct), 0812 scheduled (14 Oct) |
| `INITIAL_QUOTATIONS` | 2 | QTE-2026-0041 sent (GBP 4,812.00), QTE-2026-0040 accepted (GBP 816.00) |
| `INITIAL_INVOICES` | 4 | INV-2026-0118 issued (GBP 325.20), 0115 overdue (GBP 631.80), 0110 paid (GBP 348.00), 0114 partially paid (GBP 570.00, balance GBP 270.00) |
| `INITIAL_INVENTORY_MOVEMENTS` | 3 | used_on_job, stock_adjustment, restock_purchase |
| `INITIAL_NOTIFICATIONS` | 2 | appointment_reminder and invoice_issued, both sent by email |

## Formatters (`utils/formatters.ts`)

| Function | Output |
|---|---|
| `formatGBP(amount)` | `Intl.NumberFormat('en-GB', currency GBP, 2 decimals)`, e.g. GBP symbol with thousands separators |
| `formatDateUK(str)` | `en-GB` day 2-digit, short month, year (e.g. "13 Oct 2026"); returns '' for empty and the input unchanged if unparseable |
| `formatDateTimeUK(str)` | As above plus 2-digit hour/minute |
| `formatTimeOnly(str)` | If the string contains `T` (ISO), formats `HH:MM` via `en-GB`; otherwise returns the input (e.g. already "09:00"); '' for empty |

`formatTimeOnly` on an invalid ISO string would yield "Invalid Date"; there is no guard like the other two.

## Limitations

- Persistence is localStorage only: single browser, no backend, no sync, no versioning/migration; failures are swallowed.
- Auto-numbers are length-based and can collide after deletes/imports or across creation paths; prefix settings and `currencySymbol` are unused by these actions (currency is hard-coded GBP, `Intl`).
- No transition validation, no referential integrity (archiving a customer or deleting is not cascaded), no deletes for most entities.
- Several actions read stale closures (counts, lookups) so rapid successive calls within one render can duplicate numbers.
- Invoice `overdue` and quotation `expired` are never computed by the context.
- `generateInvoiceFromJob` can duplicate invoices; quote conversions do not require acceptance.
- Stock clamps at 0 while recording the unclamped delta, so movement history may not sum to the stock level; removing a used part does not restock.
- Notifications are never auto-generated and "send" is simulated.
- Import does not validate record shapes and does not restore `currentUser`.

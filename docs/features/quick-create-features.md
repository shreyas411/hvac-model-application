# Quick Create Modals

Quick Create is a single modal component that lets office users create a service request, job, quotation or invoice from anywhere in the app without first opening the relevant list view. The "customer" action is not a modal: it simply navigates to the Customers tab. Sources: `frontend/src/components/modals/QuickCreateModals.tsx`, trigger wiring in `frontend/src/App.tsx` and `frontend/src/components/layout/Navbar.tsx`.

## How it is triggered

- State in App: `quickActionModal: 'customer'|'job'|'request'|'quote'|'invoice'|null` (`App.tsx:30-32`).
- Navbar "+ New" dropdown (`Navbar.tsx:147-216`) is hidden for the technician role. It lists Service Request, Book Job, Add Customer, (divider) Quotation, Invoice, and calls `onQuickAction(action)` then closes the menu.
- App's `onQuickAction` handler (`App.tsx:49-55`): `customer` -> `setCurrentTab('customers')`; anything else -> `setQuickActionModal(action)`. The same customer special case is applied for the Dashboard (`App.tsx:91-97`).
- Dispatch, Equipment, Requests, Quotations, Invoices views receive `onOpenQuickAction` that sets the modal state directly (`App.tsx:109-147`). Customers view casts it `as any` and so can pass `customer`, which the modal ignores.
- `<QuickCreateModals>` is always mounted (`App.tsx:160-164`) with `activeModal`, `onClose` (sets state to null) and `onNavigateTab`.
- The component returns `null` when `activeModal` is null or `'customer'` (`QuickCreateModals.tsx:74`). Note this early return happens after all hooks, so hook order is safe.

## Shared behaviour

- Header title: "Create New <type>" (`:246`).
- A required-looking "Customer Client" dropdown lists all customers (including archived ones; no filter) as "name (type)". Default is the first customer. The location used is always the customer's first service location (`serviceLocations[0]`); there is no location picker.
- After a successful submit: `onClose()` then `onNavigateTab(<tab>)`. The created record's own toast comes from the context `add*` action.
- Form state lives in the component and is never reset on close, so the previous entries (problem text, line items, dates) persist the next time the modal opens while the app stays mounted.
- The customer selection and the default technician are initialised once from the first render's data (`useState` initialisers), so they are not updated if customers/technicians load or change later.

## Service Request form (`activeModal === 'request'`)

| Field | Detail |
|---|---|
| Reported Problem | textarea, required |
| Priority | low / medium / high / emergency (default medium) |
| Preferred Time Slot | morning (08:00-12:00) / afternoon (12:00-17:00) / all_day / urgent (default morning) |
| Customer Equipment | optional; only equipment whose `customerId` matches the selected customer; blank = "General / Not Specified" |

Submit (`:111-129`) calls `addServiceRequest` with status `new`, contact person = customer name, contact phone = customer phone. Auto-number `SR-<count+1025>` (see data doc). Navigates to `requests`. Note the equipment selection is not cleared when the customer changes, so a stale `reqEquipmentId` from a previous customer can be submitted.

## Book Job form (`activeModal === 'job'`)

| Field | Detail |
|---|---|
| Job Type | repair (default) / installation / preventive_maintenance / inspection ("Inspection / CP12 Gas Check") / emergency_callout |
| Assign Engineer | all technicians (active or not) as "name (first skill)", or Unassigned; default first technician |
| Appointment Date | date input, required, default `2026-10-14` (hard-coded) |
| Start / End Time | defaults 09:00 / 11:30, required |
| Instructions / Description | textarea, required |

Note: `jobPriority` state exists (default medium) but has no input; priority is always `medium`.

Submit (`:132-181`):
1. If a technician is chosen, runs `checkScheduleConflict(tech, date, start, end)`. On overlap shows a rose warning "Technician conflict: Already booked for <jobNumber> from <start> to <end>." and aborts. The warning clears when the engineer or date changes (not when times change).
2. Duration = max(30, end - start in minutes).
3. Calls `addJob` with status `scheduled` if a technician is set, else `new`; `technicianId` or null; `equipmentIds: []`; `requiredSkills: ['System Diagnostics']`; `labourHours = duration/60`; `hourlyRate 85`; `travelTimeMinutes 30`; `travelCharge 35`; and a 3-item general checklist (visual survey/isolate supply, diagnostics and maintenance, verify safety/test cycle), all unchecked.
4. Navigates to `dispatch`.

The job is not linked to a request or equipment, and the `parts` value pulled from context is unused.

## Quotation and Invoice forms (`'quote'` / `'invoice'`)

Shared line-item editor (`:451-549`):
- Starts with two default lines: Labour "Standard HVAC Diagnostic & Service Labour (2 hrs)" 2 x GBP 85.00 and Travel "Depot Van Travel & Callout Fee" 1 x GBP 35.00 (subtotal GBP 205.00).
- "Add Line" appends a `part` line, "HVAC Part / Material Item", qty 1, GBP 50.00.
- Per line: editable description, quantity (step 0.5, min 0.5), unit price (step 0.01), a computed line total, and a delete button. `handleUpdateLine` recomputes `amount = quantity x unitPrice` (`:91-100`). Invalid number input becomes 0.
- Line `type` cannot be changed in the UI; it stays labour/travel/part as created.
- VAT select: 20% Standard, 5% Reduced, 0% Zero (hard-coded options; default is `settings.defaultVatRate`). Totals: subtotal, `vatAmount = subtotal x rate/100`, total. Only "Grand Total" is displayed (subtotal and VAT amount are not shown).
- Submit label: "Generate Quotation" or "Issue Invoice".

| | Quotation (`:184-207`) | Invoice (`:210-237`) |
|---|---|---|
| Status | `sent` | `issued` |
| Dates | issue today, expiry +30 days | issue today, due +14 days |
| Text field | `terms` = settings T&Cs (state `terms`, no input to edit it) | `notes` = the same T&Cs string |
| Payments | n/a | `payments: []`, `amountPaid 0`, `balanceDue = total`, `paymentTermsDays 14` |
| Navigates to | `quotations` | `invoices` |

Dates use `new Date().toISOString().split('T')[0]` (UTC date).

## Limitations

- Customer quick-create is not implemented in the modal; it only opens the Customers tab.
- No validation beyond HTML `required`: a quote/invoice can be submitted with zero lines or zero total, blank descriptions, or negative prices.
- Quote/invoice created here are not linked to a job (`jobId`/`quoteId` absent) and cannot select a service location other than the first.
- Hard-coded defaults (date `2026-10-14`, GBP 85/hr, GBP 35 travel, 30-minute travel time, 14-day terms, 30-day quote validity).
- No Escape/backdrop close, no form reset between uses, archived customers are selectable.
- Navbar hides "+ New" for technicians, but the modal itself performs no role check; any view that passes `onOpenQuickAction` can open it.
- Invoice VAT options are hard-coded rather than read from `settings.availableVatRates`.

## Updates

- The Quick Create **job** form now pre-fills the checklist from the checklist templates for the chosen job type ([checklists-features.md](checklists-features.md)) and no longer forces a placeholder required skill.
- Customer defaults to the first loaded customer at render time (customers load after login), and request, job, quote and invoice creation need a customer *and* a service location.

# Dashboard Features

The Dashboard (`frontend/src/components/dashboard/DashboardView.tsx`) is the operations landing page for the admin, dispatcher and accountant roles. It shows a KPI strip, a filterable job queue, a technician availability roster, an action queue (new service requests and maintenance reminders), quick-create shortcuts, a workflow-guide launcher and a static compliance card. It is read-only: it mutates no state itself and instead calls navigation/modal callbacks passed in from `frontend/src/App.tsx`.

All "today" logic uses a hardcoded reference date, `2026-10-13` (`DashboardView.tsx:55`, `75`, `82`, `324`, `536`). Nothing uses the system clock.

## Role access

Nav entry "Dashboard" is allowed for `admin`, `dispatcher`, `accountant` (`frontend/src/components/layout/Navbar.tsx` `navLinks`). Technicians are redirected to `technician_portal` on switching to that role (`frontend/src/App.tsx:36-40`). The view itself has no role checks.

## AppContext data used

`jobs`, `serviceRequests`, `quotations`, `invoices`, `technicians`, `customers`, `equipment`. `currentUser` and `switchUserRole` are destructured (`DashboardView.tsx:43-44`) but never used. No AppContext actions are called.

## Quick actions strip (`:112-142`)

| Button | Callback |
|---|---|
| Service Request | `onOpenQuickAction('request')` |
| Book Job | `onOpenQuickAction('job')` |
| New Quote | `onOpenQuickAction('quote')` |
| New Invoice | `onOpenQuickAction('invoice')` |

In `App.tsx` these open `QuickCreateModals`. (The `'customer'` action is handled in `App.tsx` by switching to the Customers tab, but the Dashboard has no customer button.)

## KPI strip (`:73-216`)

Six tiles, always computed over the full data set (not affected by the filter toolbar):

| Tile | Calculation |
|---|---|
| Today's Jobs | jobs with `appointmentDate === '2026-10-13'`; subtext shows count of all `in_progress` jobs ("active on site") |
| Awaiting Dispatch | service requests with status `new`; "Triage requests" link navigates to `requests` |
| Completed Jobs | jobs with status `completed`; subtext shows `cancelled` count |
| Open Quotations | quotations with status `sent` or `draft`; subtext is sum of their `total` formatted with `formatGBP` |
| Unpaid Invoices | invoices with status `issued`, `overdue` or `partially_paid`; subtext is sum of `balanceDue` across **all** invoices (`:89`) |
| Revenue Collected | sum of `amountPaid` across all invoices |

## Filter toolbar (`:47-71`, `:218-295`)

Four selects filter the Scheduled Jobs Queue only: date range, technician, job status, customer. They are ANDed.

- Date range: `all`, `today` (`appointmentDate === 2026-10-13`), `this_week` (hardcoded `2026-10-12` to `2026-10-18` string compare), `this_month` (`appointmentDate` starts with `2026-10`).
- Status options listed: new, scheduled, dispatched, in_progress, completed, cancelled (no `awaiting_approval` or `on_hold`).
- Technician filter matches `job.technicianId`; unassigned jobs only appear under "All Technicians".
- "Reset Filters" button appears only when any filter is not `all`.

## Technician availability and live van status (`:303-369`)

One card per technician in `technicians` (inactive ones are not filtered out): colour dot, name, van registration (or "Van"), skills joined with " · ". Counts jobs assigned for 2026-10-13 (any status, including cancelled). Shows "On Site (JOB-no)" with a pinging dot if one of those jobs is `in_progress`, otherwise "Available". "Dispatch Board" link navigates to `dispatch`.

## Scheduled Jobs Queue (`:371-486`)

Table of `filteredJobs`: job number and type, customer name and service-location city/postcode (city falls back to "London"), date and start-end time, technician first name with colour dot (or italic "Unassigned"), coloured status badge, and a "Manage" button. "Manage" calls `onSelectJob(job.id)` (stores `selectedJobId` in `App.tsx`) then navigates to `dispatch`. Header count reflects the filter. Empty state message when nothing matches. "View Full Calendar" navigates to `dispatch`. The status colour map has no entries for `awaiting_approval` or `on_hold` (falls back to grey text).

## Action Queue (`:492-569`)

Header shows `newRequestsCount + overdueJobs.length + maintenanceDueEquipments.length` pending.

- Every service request with status `new`: request number, priority badge, customer, reported problem (2-line clamp), preferred slot, and a "Convert to Job" button that only navigates to `requests` (conversion happens there).
- Up to the first 2 equipment items with `nextServiceDueDate <= '2026-10-18'`: brand/model, customer, due date, badge "Overdue" (due before 2026-10-13) or "Due Soon", and a "Schedule Service" link to `equipment`.
- `overdueJobs` (appointment before today, not completed/cancelled) is computed (`:81`) and added to the pending count, but no overdue-job cards are rendered.

## Workflow simulator launcher (`:571-593`)

Dark card with a "Launch Workflow Simulator" button calling `onOpenWorkflowGuide` (opens `WorkflowGuideModal` in `App.tsx`).

## Regulatory certifications card (`:595-616`)

Static text: Gas Safe `#649201`, Refcom F-Gas `#REF1039841`, VAT `GB 384 9201 44`, VAT rate 20%. Header also hardcodes company name, depot and date ("Apex Climate Solutions Ltd", "London & South East Depot", "Tuesday, 13 October 2026"). These do not read from `settings`.

## Limitations

- All dates are hardcoded to 13 Oct 2026; the dashboard will not roll forward.
- Compliance numbers and header text are hardcoded, not taken from `CompanySettings`.
- KPI tiles ignore the filter toolbar; filters affect only the job queue.
- Overdue jobs are counted in the Action Queue total but never listed.
- Only the first 2 maintenance-due equipment items are shown, in data order, regardless of how many are due.
- "Convert to Job" and "Schedule Service" are navigation links only; the dashboard does not perform conversions.
- Unused imports/props: `formatDateUK`, `currentUser`, `switchUserRole`, several lucide icons.
- The "Awaiting Dispatch" tile counts new service requests, not jobs awaiting dispatch.

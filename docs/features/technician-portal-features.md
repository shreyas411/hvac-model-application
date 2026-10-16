# Technician Portal Features

The Technician Van Portal (`frontend/src/components/technician/TechnicianPortalView.tsx`) is a mobile-oriented field view. A technician (or an office user previewing it) picks a van and one of its assigned jobs, then moves the job through status steps, ticks the compliance checklist, logs gauge readings and work notes, consumes parts from stock, records a customer sign-off, and views or prints a service report.

## Role access

Nav "Technician Portal" is allowed for `admin`, `dispatcher` and `technician` (`Navbar.tsx`). Technicians land here by default (`App.tsx:36-40`) and do not see the Dashboard, Dispatch, Customers, Invoices or Settings links; the "+ New" quick menu is hidden for them. The Role Banner says financial and company settings are restricted for technicians.

Demo users (`frontend/src/data/initialData.ts`) include two technician users linked to `tech-1` and `tech-2`; `switchUserRole('technician')` selects the first technician user, i.e. `tech-1`. The view has no permission checks of its own: any role that can open it can use every control, and the Active Van dropdown lets anyone (including a technician) switch to another technician's van.

## AppContext data and actions

| Item | Use |
|---|---|
| `currentUser.technicianId` | initial active technician, falling back to `tech-1` |
| `technicians`, `jobs`, `customers`, `equipment`, `parts`, `settings` | rendering |
| `updateJob(id, updates, auditAction)` | checklist, parts, findings, sign-off |
| `updateJobStatus(id, status)` | status step buttons |
| `adjustStock(partId, delta, 'used_on_job', note, jobId)` | stock deduction and inventory movement |
| `addEquipmentServiceRecord(equipmentId, record)` | service history entry (also sets `lastServiceDate`) |
| `showToast` | feedback |

## Van and route selector (`:44-53`, `:200-276`)

A header card shows the active technician's name, van registration and first two skills. The "Active Van" dropdown lists all technicians. "Today's Route and Assigned Stops (n)" lists every job for that technician that is not `cancelled`, across all dates (despite the "Today" label). Each chip shows time range, status and customer. Selecting one sets `selectedJobId` and reloads the notes, labour hours, follow-up fields and signed flag from that job. The initially selected job is hardcoded to `job-1`, falling back to the technician's first job, then `jobs[0]`. Changing the van does not change the selected job or reload form fields.

## Job header and status workflow (`:278-335`)

Shows job number, job type, customer name and a "Service Report" button. Five step buttons call `updateJobStatus`: On the Way (`dispatched`), Arrived / Start (`in_progress`), On Hold (`on_hold`), Completed (`completed`), Cancel (`cancelled`). The current status is highlighted. Context side effects: `in_progress` stamps `arrivalTime` once, `completed` stamps `completionTime` once, an audit entry is added and a toast shown. Transitions are not restricted.

## Site and contact details (`:337-377`)

Service address (with access notes highlighted), site contact name (location contact or customer name), tap-to-call `tel:` link and `mailto:` link to the customer email.

## Equipment on site (`:379-394`)

Lists equipment records referenced by the job's `equipmentIds`: brand, model, type, serial number.

## Service checklist (`:397-434`, `:88-94`)

Shows the job's `checklist` items with category label and "x of y checked". Toggling a checkbox calls `updateJob` with the new checklist and audit action "Updated checklist item". Items are created by job-creation flows (e.g. `convertRequestToJob` adds three general items); the portal cannot add or edit items.

## Diagnostic readings and work notes (`:436-588`, `:128-169`)

Inputs: pressure (bar), flow temp, return temp, CO ppm, CO2 %, refrigerant suction psi, work notes, labour hours (min 0.5, step 0.5). Gauge inputs default to demo values (1.4, 70, 54, 14, 9.2, 125) and are local state shared across jobs.

"Save Findings and Log Readings":
- Updates the job: `workPerformed`, `labourHours`, `followUpRecommended`, `followUpNotes`, audit "Updated work notes and diagnostic readings".
- For each equipment id on the job, adds an `EquipmentServiceRecord` (date = appointment date, `jobId` = job number string, technician name, service type, findings from notes or a default text, readings, parts replaced = names of parts used, recommendations = follow-up notes or "System running satisfactory.").
- Readings are stored only on the equipment service record, not on the job.

Follow-up checkbox ("Workflow D"): reveals a notes textarea; text states it notifies the dispatcher to prepare a quotation. Only the flags are saved (on Save Findings); the code creates no notification or quotation.

## Van parts consumed (`:590-649`, `:96-126`)

Select any part (shows SKU and available stock), enter a quantity (min 1), "Add Part". This appends a `JobPartUsed` (part id, name, SKU, quantity, unit cost, selling price) to the job with audit "Added part X xN", then calls `adjustStock` with a negative delta, type `used_on_job`, creating an inventory movement. The list shows each part's quantity and `quantity * unitPrice` in GBP. Stock is floored at 0 by `adjustStock` and there is no remove/undo.

## Customer sign-off (`:651-726`, `:171-195`)

Requires a typed customer name. "Capture Signature and Complete Job" stores `customerSignature` with a fixed mock SVG squiggle as `dataUrl` (there is no drawable pad), sets `status: 'completed'` and `completionTime`, with audit "Customer sign-off collected from <name>. Job marked as completed." Afterwards the card shows "Signed by" and a "View Service Sheet" button. The signed flag is local state, derived from the job when it is selected.

## Service report (`:730-813`)

Modal with company name, address, Gas Safe and F-Gas numbers (from `settings`), job number, date, engineer, customer and site, work done (or default text), checklist with check/cross marks, and sign-off name and timestamp. "Print Report" calls `window.print()`.

## Limitations

- The signature is simulated; no real capture, and the stored image is identical for every customer.
- Sign-off completes the job without requiring checklist items, readings or notes.
- Local form state is not reset or scoped per job for gauge readings; switching jobs keeps previous values.
- Saving findings twice adds duplicate equipment service records.
- Follow-up flag does not notify anyone or create a quote.
- Route list shows all non-cancelled jobs for the technician regardless of date.
- Access is not restricted to the logged-in technician's own van or jobs.
- Parts cannot be removed; stock deduction is not checked against availability.
- `formatTimeOnly`, `onNavigateTab`, several icons are unused.
- Uses a service report modal that prints the whole page via `window.print()`.

## Updates

- **Checklist templates:** under the service checklist, "Add all" / `+ item` add the job type's template items, and a "Custom checklist item" box adds a general item ([checklists-features.md](checklists-features.md)).
- **Status buttons** now include New, Awaiting Approval and Scheduled and are disabled for moves the workflow or the technician role does not allow (technicians may only go to dispatched, in progress, on hold, completed).
- **Completion gate:** completing needs ticked safety items, a refrigerant log for refrigerant checklists, work performed and a customer signature ([compliance-features.md](compliance-features.md)).
- **Refrigerant log:** entries are recorded with `POST /jobs/:id/refrigerant`.
- **Service report:** a Download (PDF) button sits beside Print.
- **Offline:** actions made without signal are queued and replayed ([offline-and-pwa-features.md](offline-and-pwa-features.md)).

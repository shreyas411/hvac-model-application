# Dispatch Board Features

The Scheduling and Dispatch Board (`src/components/scheduling/DispatchBoardView.tsx`) lets office staff see jobs by technician and day, view all jobs in a list, and edit a job's technician, date, time, instructions and status through a reschedule modal. Reassigning or rescheduling a job checks for technician double-booking before saving, and writes an audit-trail entry.

## Role access

Nav "Dispatch & Jobs" is allowed for `admin` and `dispatcher` only (`src/components/layout/Navbar.tsx`). The view has no internal role checks (`currentUser` is read but unused). The Role Banner describes dispatchers as able to "manage technician schedules, check booking conflicts, and assign jobs".

## AppContext data and actions

| Item | Use |
|---|---|
| `jobs`, `technicians`, `customers` | rendering the board, list and counts |
| `updateJob(id, updates, auditAction)` | saving the modal (`AppContext.tsx:478`) |
| `updateJobStatus(id, status, note?)` | status quick buttons (`AppContext.tsx:507`) |
| `checkScheduleConflict(techId, date, start, end, excludeJobId)` | overlap check (`AppContext.tsx:354`) |
| `equipment`, `parts` | destructured, unused |

Props from `App.tsx`: `onOpenQuickAction('job')` opens the Book Job modal; `selectedJobId` / `onSelectJob` are accepted but never read in this view, so the Dashboard's "Manage" button navigates here but does not open or highlight that job.

## View modes (`:47`, `:146-167`)

A toggle switches between **Dispatch Board** (default) and **List View**. The type also allows `'calendar'`, but there is no calendar button or render branch.

## Date navigation (`:48`, `:179-223`)

Previous/next day buttons, a "Jump to Today" button (today = hardcoded `2026-10-13`), and a heading showing `formatDateUK(selectedDate)` with "(Today)" when on that date. Day stepping uses `new Date(...).toISOString()`. Summary shows "Active Technicians" (count of all technicians) and "Jobs this date" (all jobs on the selected date, including cancelled and unassigned).

## Board mode (`:226-360`)

- **Unassigned / Pending column**: all jobs with no `technicianId` and status not `cancelled`, across all dates (not filtered by the selected date). Card shows job number, priority badge, customer, description, target date and "Assign" hint. Clicking opens the modal.
- **One column per technician** (all technicians, no `active` filter): header with colour dot, name, job count, van registration and first skill. Cards are jobs where `technicianId` matches, `appointmentDate === selectedDate`, status not `cancelled`. Card shows start-end time, priority badge, customer, address line and postcode, description, status label and job number; card background reflects status. Empty column message per date. Cards are not sorted by time (data order).
- Layout is a 1/2/4 column responsive grid; with many technicians columns wrap.

Status styling (`statusColors`, `:114-123`): new = "New / Unassigned", awaiting_approval, scheduled, dispatched = "Dispatched / En Route", in_progress = "In Progress (On Site)", on_hold, completed, cancelled. Priority badges: emergency, high, medium, low.

## List view (`:363-439`)

Table of every job (all dates, all statuses, including cancelled), in context order: job number, date/time, type, customer and city/postcode, technician or "Unassigned", priority, status text, and an "Edit / Reassign" button that opens the modal. No sorting or filtering controls.

## Reschedule and assign modal (`:441-604`)

Opened by clicking a board card or "Edit / Reassign" (`openEditModal`, `:59`). Pre-fills from the job.

| Field | Notes |
|---|---|
| Assign Technician | select of all technicians (name plus first two skills) or "Leave Unassigned" |
| Appointment Date | `type="date"`, required |
| Start / End Time | `type="time"`, required |
| Work Instructions | textarea, saved to `description` |
| Update Status | buttons for scheduled, dispatched, in_progress, completed, cancelled |
| Audit Trail History | read-only list of `auditTrail` (action, user, time, details) |

Save behaviour (`handleModalSave`, `:69-112`):

1. If a technician is selected, `checkScheduleConflict` runs, excluding the job being edited. Overlap rule: `reqStart < jobEnd && reqEnd > jobStart` on the same technician and date, ignoring cancelled jobs (touching times are allowed). On conflict, a red banner names the clashing job number and times, and the save is blocked. Changing technician/date/time clears the warning.
2. Duration = end minus start in minutes, minimum 30; saved to `estimatedDurationMinutes`.
3. `updateJob` writes date, times, technician (`null` if unassigned), description, duration, and auto-promotes status `new` to `scheduled` when a technician is set. Audit action: `Rescheduled appointment to <date> <start>-<end> (Assigned|Unassigned)`; the audit `details` are "Updated by <user>". A "Job updated" toast shows.

Status buttons (`:552-571`) call `updateJobStatus` immediately (independent of Save). Side effects in context: `in_progress` sets `arrivalTime` if empty, `completed` sets `completionTime` if empty, an audit entry is added, and a toast is shown. The highlight on the active status button uses the `editingJob` snapshot, so it does not change after clicking while the modal stays open.

## Limitations

- No true drag-and-drop or calendar mode, despite the header describing "real-time" assignment and the unused `'calendar'` type.
- Unassigned column ignores the selected date; technician columns and the date summary use it.
- Status buttons offer no `new`, `awaiting_approval` or `on_hold`, and do not validate transitions (any status can be set from any status, including un-completing or un-cancelling).
- No conflict check is made when a status is changed or when a technician is unassigned; end time before start time is not rejected (duration silently floors to 30 min while the stored times stay invalid).
- Conflict check does not consider skills, working hours (`settings.workingHoursStart/End`) or technician `active` flag.
- `selectedJobId` from the Dashboard is not used; the target job is not opened.
- The board always uses the hardcoded "today" of 2026-10-13.
- Job cards cannot be created here beyond launching the Book Job quick-action modal.

# Service Requests Features

The Service Requests view ("Customer Service Requests & Enquiries") is a triage list of customer enquiries and breakdown reports. Staff filter by status, create a new enquiry, and convert an open request into a scheduled job with a technician and time slot, with a double-booking check. Source: `src/components/requests/ServiceRequestsView.tsx`; mounted from `src/App.tsx:129` for tab `requests`.

## Access

| Role | Can see tab |
|------|-------------|
| admin, dispatcher | Yes (`src/components/layout/Navbar.tsx:41`) |
| technician, accountant | No |

No per-action role checks exist inside the view.

## AppContext usage

Reads `serviceRequests`, `customers`, `equipment`, `technicians`; calls `convertRequestToJob`, `checkScheduleConflict`. `updateServiceRequest` is destructured but unused (`ServiceRequestsView.tsx:27-35`).

## Request list and status filter (`:37`, `:47-50`, `:123-217`)

Filter tabs: All Requests, New / Unassigned (`new`), Awaiting Approval (`awaiting_approval`), Converted to Job (`converted`). There is no tab for `cancelled` (a valid status in `src/types/index.ts:112`); cancelled requests show only under All. The tabs show no counts. Empty state: "No service requests found in this category."

Each request card shows:

- Request number (e.g. `SR-1025`), priority badge (`emergency` red/bold, `high` amber, `medium` sky, `low` slate), and the preferred slot text.
- Customer name and the location address line, city and postcode.
- Reported problem text.
- Attached asset (brand, model, serial) when `equipmentId` resolves.
- "Logged <createdAt>" date.
- Right side: a green "Job Booked" badge if `status === 'converted'`, otherwise a "Schedule Job" button. This means `new`, `awaiting_approval` and `cancelled` requests all show the button.

## New Enquiry (`:114-120`)

The "New Enquiry" button calls `onOpenQuickAction('request')`, opening the shared quick-create modal (`src/components/modals/QuickCreateModals.tsx`), which calls `addServiceRequest` with `status: 'new'`. `addServiceRequest` (`AppContext.tsx:327`) assigns id `sr-<timestamp>`, number `SR-<requests.length + 1025>`, and timestamps; new requests are prepended.

## Convert to Job (Schedule Job) (`:52-91`, `:219-334`)

"Schedule Job" opens a modal titled "Convert <SR number> to Job".

| Field | Required | Default |
|-------|----------|---------|
| Technician (select, lists all technicians with their skills) | Select, but not marked blocking | First technician |
| Appointment Date | Yes | `2026-10-13` (hard-coded) |
| Start Time | Yes | 09:00, or 13:00 if the request's `preferredSlot` is `afternoon` |
| End Time | Yes | 11:30, or 15:30 for afternoon |

On "Confirm & Schedule":

1. If a technician is selected, `checkScheduleConflict(tech, date, start, end)` runs (`AppContext.tsx:354`). It returns the first non-cancelled job for the same technician and date whose time range overlaps (`reqStart < jobEnd && reqEnd > jobStart`, using minutes). On conflict the modal shows a red "Technician Conflict!" banner naming the job number and its times, and submission stops. Editing the technician, date or times clears the warning.
2. Otherwise `convertRequestToJob` runs (`AppContext.tsx:387`), then the modal closes and the app navigates to the `dispatch` tab.

### What `convertRequestToJob` creates

- Job number `JOB-2026-<jobs.length + 813>`, id `job-<timestamp>`, `requestId` linked back.
- `type`: `emergency_callout` if request priority is `emergency`, else `repair`; priority copied.
- Status `scheduled` when a technician is set, else `new`.
- Equipment: the request's single `equipmentId` (or none); description from reported problem; internal notes copied.
- Duration = max(30, end minus start) minutes; labour hours = duration / 60; hourly rate 85.00; travel 30 min and 35.00; required skills `['System Diagnostics']` (the technician's skills are not checked against this).
- Three-item general checklist (visual inspection, diagnostics, test operation) and an audit-trail entry "Converted from Service Request" by the current user.
- The request is updated to `status: 'converted'` with `convertedJobId`, and a toast is shown.

## Limitations

- Dates default to a hard-coded `2026-10-13`, not today.
- The technician select has no "unassigned" option, so the UI always assigns someone when technicians exist; the skills shown are informational only (no skills matching).
- The `awaiting_approval` and `cancelled` statuses have no in-view way to be set; no edit, cancel or notes editing of requests (`updateServiceRequest` unused).
- Conflict check covers only the chosen technician and exact date, not travel time.
- `contactPerson`, `contactPhone` and `internalNotes` are not displayed.
- No role restriction beyond tab visibility.

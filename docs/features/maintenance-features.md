# Maintenance Plans

Recurring preventive-maintenance contracts. An agreement says "service this site (and optionally this equipment) every quarter / six months / year"; a daily backend sweep turns each due agreement into a `preventive_maintenance` job, so the office no longer has to book repeat visits by hand. Source: `frontend/src/components/maintenance/MaintenanceView.tsx`, `backend/src/modules/maintenance/`.

## Access

| Role | Tab `maintenance` | Create / edit / delete |
|------|-------------------|------------------------|
| admin, dispatcher | Yes | Yes |
| accountant | Yes (read only on API) | No |
| technician | No | No |

## Agreement fields

| Field | Notes |
|-------|-------|
| Customer, Location | Location must belong to the customer (`INVALID_LOCATION` otherwise) |
| Equipment | Optional; when set it is attached to the raised job |
| Frequency | `quarterly` (3 months), `biannual` (6), `annual` (12) |
| Next due date | Date picker; new agreements cannot start in the past |
| Active | Checkbox; inactive agreements are skipped by the sweep |
| Notes | Optional; copied into the job description |

The view is a single inline form plus a table: rows can be edited (pencil), have the next due date changed in place, be toggled active, or deleted (confirm prompt).

## How jobs are raised

The daily sweep (`raiseMaintenanceJobs`, run with the overdue-invoice and quote-expiry sweeps) looks for active agreements whose `nextDueDate` is within **14 days**. For each one, inside a transaction it:

1. Claims the agreement by advancing `nextDueDate` by the frequency (a conditional update, so two workers cannot raise the same visit twice).
2. Creates a `preventive_maintenance` job on the original due date, 09:00 to 10:00, unassigned, priority medium, with the company default hourly rate, and the job type's checklist templates (see [checklists-features.md](checklists-features.md)).
3. Writes an audit entry "Created by maintenance agreement".

The job lands unassigned on the dispatch board for the dispatcher to schedule; it is not auto-assigned to a technician.

## Limitations

- Fixed 14-day lead time, fixed 09:00 slot; neither is configurable.
- No billing automation: invoices are still generated from the completed job.

## Updates: price, term and SLA

Agreement form adds **annual price** (ex-VAT, with *auto-invoice*), **term end date** with *auto-renew* (past the term an agreement deactivates unless auto-renew rolls it on), and **SLA hours**. The list row summarises them (`£x/yr auto-invoiced · renews yyyy-mm-dd · SLA nh`). Call-outs at the site get `slaDueAt`; see [maintenance.md](../../backend/docs/api/maintenance.md). Not done: SLA breach alerts, renewal repricing or customer notice.

## Updates: bulk selection

- Staff who can write get a select column: **Activate**, **Pause** (loops `PATCH /maintenance/:id`) and admin-style **Delete** (loops `DELETE /maintenance/:id`, with confirmation). View-local, no AppContext action.

Shared behaviour: [BULK_SELECTION.md](../BULK_SELECTION.md). Selection is limited to the current page; failures are reported as "N of M done. Skipped: …".

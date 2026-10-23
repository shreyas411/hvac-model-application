# maintenance

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/maintenance/`.

Recurring preventive-maintenance agreements. Read: A D C. Write: A D.

| Method | Path | Notes |
|---|---|---|
| GET | `/maintenance-agreements` | `?q` searches notes and frequency |
| GET | `/maintenance-agreements/:id` | |
| POST | `/maintenance-agreements` | `{ customerId, locationId, equipmentId?, frequency, nextDueDate, active?, notes?, annualPrice?, endDate?, slaResponseHours?, autoInvoice?, autoRenew? }`. `autoRenew` needs `endDate` (422 `NO_TERM`) and extends the term 12 months at a time instead of deactivating. `annualPrice` is ex-VAT; `autoInvoice` needs a price (422 `NO_PRICE`); `endDate` must not precede `nextDueDate` (422 `BAD_TERM`). The daily sweep, for each visit raised, issues an invoice for `annualPrice × months / 12` when `autoInvoice` is on, and deactivates the agreement once the next visit falls past `endDate`. `slaResponseHours` times call-outs: a non-maintenance job created for a site with an active SLA agreement gets `slaDueAt` (the shortest SLA); see `slaBreached` in jobs.md.  `frequency`: `quarterly \| biannual \| annual`. Location must belong to the customer; equipment must exist |
| PATCH | `/maintenance-agreements/:id` | Partial |
| DELETE | `/maintenance-agreements/:id` | |

The daily sweep raises a `preventive_maintenance` job for every active agreement whose `nextDueDate` is within 14 days (unassigned, 09:00-10:00, with that job type's checklist templates) and advances `nextDueDate` by the frequency (3, 6 or 12 months).

## Bulk use

| Method | Path | Roles | Body | Per-id action |
|---|---|---|---|---|
| POST | `/maintenance-agreements/bulk-update` | A D | `{ ids, active: boolean }` | Activate or pause |
| POST | `/maintenance-agreements/bulk-delete` | A D | `{ ids }` | Same as `DELETE /maintenance-agreements/:id` |

Response `{ results: [{ id, ok, error?: { code, message } }] }`, one entry per id. Max 100 ids (`400 VALIDATION` otherwise, duplicates collapsed). Each id runs the same checks as the single-record route and is saved on its own, so some can fail while others succeed; see [README](README.md) for the shared shape.

# requests (service requests)

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

All routes A D.

| Method | Path | Notes |
|---|---|---|
| GET | `/requests` | |
| GET | `/requests/:id` | |
| POST | `/requests` | `{ customerId, locationId, reportedProblem, priority?, preferredSlot?, equipmentId?, contactPerson?, contactPhone?, internalNotes? }`; assigns `SR-n` |
| PATCH | `/requests/:id` | Partial; status may be set to `new`, `awaiting_approval` or `cancelled` |
| POST | `/requests/:id/convert` | `{ appointmentDate, startTime, endTime, technicianId? }` → the new job. Emergency → `emergency_callout`, else `repair`. `ALREADY_CONVERTED` on repeat |

## Changes
- `DELETE /requests/:id` (admin) soft-deletes; a `converted` request cannot be deleted (it is part of its job's history).

## Bulk use

| Method | Path | Roles | Body | Per-id action |
|---|---|---|---|---|
| POST | `/requests/bulk-cancel` | A D | `{ ids }` | Sets `status: cancelled` (same as `PATCH /requests/:id`) |

Response `{ results: [{ id, ok, error?: { code, message } }] }`, one entry per id. Max 100 ids (`400 VALIDATION` otherwise, duplicates collapsed). Each id runs the same checks as the single-record route and is saved on its own, so some can fail while others succeed; see [README](README.md) for the shared shape.

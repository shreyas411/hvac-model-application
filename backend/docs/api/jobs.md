# jobs

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read/write work record: A D T (technicians are limited to their own jobs). Create, conflicts: A D. Invoice: A C.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/jobs` | A D T | Technicians only see jobs where `technicianId` matches their profile |
| GET | `/jobs/conflicts` | A D | `?technicianId&date&startTime&endTime&excludeJobId` → `{ conflict: Job \| null }` |
| GET | `/jobs/:id` | A D T | |
| POST | `/jobs` | A D | Job fields; `status` may be `new`, `awaiting_approval` or `scheduled`. `SCHEDULE_CONFLICT` if the technician overlaps |
| PATCH | `/jobs/:id` | A D T | A/D: dispatch fields. T: only `workPerformed`, `labourHours`, `customerSignature`, `checklist`, `followUpRecommended`, `followUpNotes` |
| POST | `/jobs/:id/status` | A D T | `{ status, note?, override? }`. Transitions are enforced; `override` is admin only. T may only set `in_progress`, `on_hold` or `completed`. First `in_progress` sets `arrivalTime`, first `completed` sets `completionTime` |
| POST | `/jobs/:id/parts` | A D T | `{ partId, quantity }`. Adds to `partsUsed` and writes a `used_on_job` movement when inventory is enabled (one transaction) |
| POST | `/jobs/:id/invoice` | A C | Builds an invoice from labour, travel and parts. `ALREADY_CONVERTED` if the job has a non-void invoice |

Allowed transitions:

| From | To |
|---|---|
| `new` | `awaiting_approval`, `scheduled`, `cancelled` |
| `awaiting_approval` | `new`, `scheduled`, `cancelled` |
| `scheduled` | `new`, `dispatched`, `on_hold`, `cancelled` |
| `dispatched` | `scheduled`, `in_progress`, `on_hold`, `cancelled` |
| `in_progress` | `on_hold`, `completed`, `cancelled` |
| `on_hold` | `scheduled`, `dispatched`, `in_progress`, `cancelled` |
| `completed`, `cancelled` | none |

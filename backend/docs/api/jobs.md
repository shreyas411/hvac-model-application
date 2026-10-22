# jobs

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read/write work record: A D T (technicians are limited to their own jobs). Create, conflicts: A D. Invoice: A C.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/jobs` | A D T | Technicians only see jobs where `technicianId` matches their profile |
| GET | `/jobs/conflicts` | A D | `?technicianId&date&startTime&endTime&excludeJobId` → `{ conflict: Job \| null }` |
| GET | `/jobs/:id` | A D T | |
| POST | `/jobs` | A D | Job fields; `hourlyRate` defaults to the company default rate; assigning a technician checks certifications (`403` if not qualified: skill, licence or expired licence; `GAS_SAFE` / `F_GAS` are added from boiler / refrigerant equipment); `status` may be `new`, `awaiting_approval` or `scheduled`. `SCHEDULE_CONFLICT` if the technician overlaps another job or is within 30 minutes of one |
| PATCH | `/jobs/:id` | A D T | A/D: dispatch fields. T: only `workPerformed`, `labourHours`, `customerSignature`, `checklist`, `followUpRecommended`, `followUpNotes` |
| POST | `/jobs/:id/status` | A D T | `{ status, note?, override? }`. Transitions are enforced; `override` is admin only and needs a `note` (`REASON_REQUIRED`). Moving to `completed` without override needs ticked safety checklist items, a refrigerant log if the job has a refrigerant checklist item, `workPerformed` and a customer signature (`NOT_COMPLETABLE`). T may only set `in_progress`, `on_hold` or `completed`. First `in_progress` sets `arrivalTime`, first `completed` sets `completionTime` |
| POST | `/jobs/:id/parts` | A D T | `{ partId, quantity }`. Adds to `partsUsed` and writes a `used_on_job` movement when inventory is enabled (one transaction) |
| POST | `/jobs/:id/refrigerant` | A D T | `{ refrigerant, action: charge \| recover \| reclaim \| leak_check, amountKg, cylinderId?, certNumber, equipmentId?, notes? }`, 201. Technicians: own open jobs only. `JOB_CLOSED` once completed/cancelled |
| DELETE | `/jobs/:id/parts/:usedId` | A D T | Removes a part line and returns stock. Technicians: own jobs only. `JOB_CLOSED`, `JOB_INVOICED` |
| POST | `/jobs/:id/invoice` | A C | Builds an invoice from labour, travel and parts. `ALREADY_CONVERTED` if the job has a non-void invoice; `JOB_NOT_COMPLETED` unless the job is completed; `NOTHING_TO_INVOICE`. Audited |

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

Completed and cancelled jobs are read-only (`JOB_CLOSED`) except for admin. `GET /jobs` is paged in the database (`?q`, `?status`, `?cursor`). Cancelling a job whose parts were never invoiced returns the stock. A customer signature must be a `png`/`jpeg`/`svg` data URL under 1 MB.

## Photos

| Method | Path | Notes |
|---|---|---|
| GET | `/jobs/:id/photos` | A D T (own job). Metadata only: `{ id, jobId, caption, takenBy, createdAt, mime }` |
| POST | `/jobs/:id/photos` | A D T (own job). `{ dataUrl, caption? }`, a `data:image/webp;base64,` URL; the UI compresses to WebP before upload. The header is checked (`RIFF....WEBP`). Max 600 KB decoded, 30 per job (`BAD_IMAGE`, `IMAGE_TOO_LARGE`, `TOO_MANY_PHOTOS`, 422) |
| GET | `/jobs/:id/photos/:photoId` | A D T (own job). Raw image bytes |
| DELETE | `/jobs/:id/photos/:photoId` | A D T (own job). 204 |

## SLA

Jobs carry `slaDueAt` when the site has an active maintenance agreement with `slaResponseHours` (not set on preventive-maintenance jobs). `slaBreached` is computed: `slaDueAt` has passed and the job is still `new`. The dispatch board flags it.

## List filters

`GET /jobs` also accepts:

| Query | Notes |
|---|---|
| `from`, `to` | `YYYY-MM-DD`, inclusive bounds on `appointmentDate`. Malformed values are ignored |
| `technicianId` | A D only: narrow to one technician (UUID; invalid ignored). Technicians are always scoped to their own jobs and cannot override it |

## Changes
- `POST /jobs/:id/invoice` now needs `{ vatRatePercent }` (0-100) in the body.
- `DELETE /jobs/:id` (admin) soft-deletes; only jobs in `new`, `awaiting_approval`, `scheduled` or `cancelled`, and without an invoice (`409 IN_USE`).
- Each job carries `site` (`customerName`, `customerPhone`, address lines, city, postcode, `accessNotes`, contact) so technicians, who cannot read `/customers`, can find and enter the property.
- Required Gas Safe / F-Gas skills are also inferred from keywords in `title` + `description` (gas, boiler, flue; refrigerant, heat pump, air con, chiller…), not just from attached equipment. Re-checked against the assigned technician when title or description changes.
- Completion signature must be a genuine inked PNG (`422` for empty or stub images). List `?sort=appointmentDate|type|priority|status…`.

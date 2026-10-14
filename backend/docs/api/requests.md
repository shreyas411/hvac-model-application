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

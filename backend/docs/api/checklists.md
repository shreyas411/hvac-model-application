# checklists

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/checklists/routes.ts`.

Checklist items offered per job type; copied onto a job when added. Read: A D T C. Write: A only.

| Method | Path | Notes |
|---|---|---|
| GET | `/checklist-templates` | Ordered by `position` |
| GET | `/checklist-templates/:id` | |
| POST | `/checklist-templates` | `{ jobType, label, category? }`. `jobType`: `installation \| repair \| inspection \| emergency_callout \| preventive_maintenance`. `category`: `gas_safety \| electrical \| refrigerant \| general` (default). Appended to the end of its job type |
| PATCH | `/checklist-templates/:id` | `{ label?, category? }` only |
| DELETE | `/checklist-templates/:id` | |
| POST | `/checklist-templates/reorder` | `{ ids[] }` in desired order for one job type; position = index; 204 |

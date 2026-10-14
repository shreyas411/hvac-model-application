# equipment

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read: A D T. Write: A D. Service records: A D T.

| Method | Path | Notes |
|---|---|---|
| GET | `/equipment` | |
| GET | `/equipment/:id` | Includes `serviceHistory` |
| POST | `/equipment` | Location must belong to the customer. `nextServiceDueDate` defaults from `maintenanceFrequency` |
| PATCH | `/equipment/:id` | Partial |
| DELETE | `/equipment/:id` | |
| POST | `/equipment/:id/service-records` | `{ date, jobId, technicianName, serviceType, findings, readings?, partsReplaced?, recommendations? }`. Sets `lastServiceDate` and recomputes `nextServiceDueDate` |

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

Technicians can only add service records for their own jobs, and the equipment must be on that job (`EQUIPMENT_NOT_ON_JOB`, `JOB_CLOSED`). `GET /equipment` is paged in the database.

## Changes
- New fields `refrigerantType` (e.g. `R410A`) and `refrigerantChargeKg` (> 0, ≤ 10 000), both nullable, used for F-Gas leak-check intervals in the UI. `inactive` flag added.
- `DELETE /equipment/:id` is a soft delete. List searches `customer.name` too; `?sort=type|warrantyExpiryDate|nextServiceDueDate`, filters `?inactive`, `?status`, `?type`. Rows carry `expired` (warranty lapsed).

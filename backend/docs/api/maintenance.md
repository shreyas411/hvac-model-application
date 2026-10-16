# maintenance

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/maintenance/`.

Recurring preventive-maintenance agreements. Read: A D C. Write: A D.

| Method | Path | Notes |
|---|---|---|
| GET | `/maintenance-agreements` | `?q` searches notes and frequency |
| GET | `/maintenance-agreements/:id` | |
| POST | `/maintenance-agreements` | `{ customerId, locationId, equipmentId?, frequency, nextDueDate, active?, notes? }`. `frequency`: `quarterly \| biannual \| annual`. Location must belong to the customer; equipment must exist |
| PATCH | `/maintenance-agreements/:id` | Partial |
| DELETE | `/maintenance-agreements/:id` | |

The daily sweep raises a `preventive_maintenance` job for every active agreement whose `nextDueDate` is within 14 days (unassigned, 09:00-10:00, with that job type's checklist templates) and advances `nextDueDate` by the frequency (3, 6 or 12 months).

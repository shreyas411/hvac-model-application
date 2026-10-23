# customers

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read: A D C. Write: A D. No delete; archive instead.

| Method | Path | Notes |
|---|---|---|
| GET | `/customers` | |
| GET | `/customers/:id` | Includes `serviceLocations` |
| POST | `/customers` | `{ type, name, phone, email, billingAddress, serviceLocations?, communicationPreference?, gdprConsent?, companyName?, notes? }`; locations get ids |
| PATCH | `/customers/:id` | Partial; locations are not editable here |
| POST | `/customers/:id/archive` | |
| POST | `/customers/:id/unarchive` | |
| POST | `/customers/:id/locations` | `{ label, addressLine1, city, postcode, addressLine2?, accessNotes?, contactName?, contactPhone? }` |
| PATCH | `/customers/:id/locations/:locId` | Partial |
| DELETE | `/customers/:id/locations/:locId` | `LOCATION_IN_USE` if a job or equipment references it |

## Changes
- `type` accepts `landlord` (landlord / letting agent) besides `residential` and `commercial`.
- Postcodes are UK-validated and normalised; `email` is trimmed, lower-cased and must be unique among active, non-archived customers (`409 DUPLICATE_CUSTOMER`, also on restore via `unarchive`). Location `label`, `addressLine1`, `city` and `postcode` are required.
- `DELETE /customers/:id` (admin) soft-deletes; `409 IN_USE` while jobs, quotes, invoices, requests or equipment reference it. Deleted locations disappear from `serviceLocations`.
- List: `?sort=type`, `?inactive`.

## Bulk use

| Method | Path | Roles | Body | Per-id action |
|---|---|---|---|---|
| POST | `/customers/bulk-archive` | A D | `{ ids, archived: boolean }` | `true` archives, `false` restores (same as `/archive` and `/unarchive`) |

Response `{ results: [{ id, ok, error?: { code, message } }] }`, one entry per id. Max 100 ids (`400 VALIDATION` otherwise, duplicates collapsed). Each id runs the same checks as the single-record route and is saved on its own, so some can fail while others succeed; see [README](README.md) for the shared shape.

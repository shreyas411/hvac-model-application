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

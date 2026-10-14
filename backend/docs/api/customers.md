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

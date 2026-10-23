# custom-fields

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/custom-fields/routes.ts`.

Admin-defined extra fields on eight modules. Definitions live in `custom_field_definitions`; values live on each record in a `custom_fields` JSONB column (`{ "<definition id>": value }`).

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/custom-fields` | any | All definitions (inactive included), ordered by `position`; forms render from this |
| POST | `/custom-fields` | A | Create; appended at the end of its entity's order |
| PATCH | `/custom-fields/:id` | A | Edit `label`, `options`, `required`, `inactive`. `entity` and `type` are fixed once created (stored values depend on them) |
| DELETE | `/custom-fields/:id` | A | Soft delete |
| POST | `/custom-fields/reorder` | A | Body `{ ids: uuid[] }`; sets `position` by array index (204) |

## Definition

| Field | Notes |
|---|---|
| `entity` | `customer`, `equipment`, `request`, `job`, `quotation`, `invoice`, `part`, `maintenance` |
| `label` | Required, trimmed |
| `type` | `text`, `number`, `date`, `select`, `checkbox` |
| `options` | Choices for `select`; at least one required for that type |
| `required` | Enforced on create and on edits that send `customFields`. Ignored for `checkbox` |
| `inactive` | Hidden from forms and details; existing values are kept |

## Values on records

Customers, equipment, requests, jobs, quotations, invoices, parts (`/inventory/parts`) and maintenance agreements accept and return `customFields` on `POST /` and `PATCH /:id`. Each module mounts `withCustomFields(entity)` and lists `customFieldsInput` in its zod schema.

- POST always validates (a missing object still enforces required fields); PATCH validates only when `customFields` is sent, and the object replaces the stored one.
- Unknown, inactive or deleted definition ids are dropped silently, as are empty values (`''`, `null`).
- Value types: `number` finite number, `checkbox` boolean, `date` `YYYY-MM-DD`, `select` one of `options`, `text` string.
- Errors (422): `INVALID_CUSTOM_FIELD` (wrong type / not an option), `CUSTOM_FIELD_REQUIRED`.

Migrations: `20261103000000_custom_fields` (table), `20261103000001_custom_fields_all_modules` (`custom_fields` column on the other tables).

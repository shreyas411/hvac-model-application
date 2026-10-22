# settings

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/settings` | any | Single `CompanySettings` object; `bankDetails` only for A and C |
| PATCH | `/settings` | A | Partial update (VAT rates, number prefixes, `enableInventory`, `defaultHourlyRate`, `defaultTravelCharge`, bank details…) |

## Updates: auto-send emails

`PATCH /settings` accepts `autoSendEmails` (boolean, default `false`). When true, status-triggered customer emails (invoice issued, quotation sent, booking confirmed, engineer dispatched) are sent immediately instead of waiting as drafts for approval. See [notifications.md](notifications.md).

Company `postcode` must be a valid UK postcode (or empty).

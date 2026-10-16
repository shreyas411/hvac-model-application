# settings

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/settings` | any | Single `CompanySettings` object; `bankDetails` only for A and C |
| PATCH | `/settings` | A | Partial update (VAT rates, number prefixes, `enableInventory`, `defaultHourlyRate`, `defaultTravelCharge`, bank details…) |

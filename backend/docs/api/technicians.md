# technicians

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read: A D T C (a technician only sees their own profile). Write: A D. No delete; set `active: false`.

| Method | Path | Notes |
|---|---|---|
| GET | `/technicians` | |
| GET | `/technicians/:id` | |
| POST | `/technicians` | `{ name, phone, email, skills?, color?, active?, gasSafeLicense?, gasSafeExpiry?, fGasLicense?, fGasExpiry?, vanRegistration? }`. Expiry dates are `YYYY-MM-DD`; an expired licence blocks assignment to jobs requiring `GAS_SAFE` / `F_GAS` |
| PATCH | `/technicians/:id` | Partial |

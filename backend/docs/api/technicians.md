# technicians

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read: A D T C. Write: A D. No delete; set `active: false`.

| Method | Path | Notes |
|---|---|---|
| GET | `/technicians` | |
| GET | `/technicians/:id` | |
| POST | `/technicians` | `{ name, phone, email, skills?, color?, active?, gasSafeLicense?, fGasLicense?, vanRegistration? }` |
| PATCH | `/technicians/:id` | Partial |

# auth

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

| Method | Path | Roles | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` → `{ accessToken, refreshToken, expiresIn }` (proxied to Supabase Auth) |
| POST | `/auth/refresh` | public | `{ refreshToken }` |
| POST | `/auth/logout` | public | Bearer token; 204 |
| GET | `/auth/me` | any | Current `User` profile |

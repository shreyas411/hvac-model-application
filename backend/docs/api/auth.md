# auth

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Tokens travel as httpOnly cookies, never in the body. All routes need the `x-requested-with: apexhvac` header (CSRF guard). Rate limited to 30 requests per 15 minutes per IP.

| Method | Path | Roles | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` sets `hvac_at` + `hvac_rt` cookies, returns `{ expiresIn }`. Proxied to Supabase Auth; in local dev checks the `users.password` scrypt hash |
| POST | `/auth/refresh` | public | No body; reads the `hvac_rt` cookie, sets fresh cookies. A failure clears the cookies |
| POST | `/auth/logout` | public | Clears cookies and revokes the Supabase session; 204 |
| GET | `/auth/me` | any | Current `User` profile |

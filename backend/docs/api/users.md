# users

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

All routes A only. The `id` is the Supabase `auth.users.id`.

| Method | Path | Notes |
|---|---|---|
| GET | `/users` | List |
| GET | `/users/:id` | |
| POST | `/users` | `{ id, name, email, phone?, role, avatar?, technicianId? }` |
| PATCH | `/users/:id` | Partial |
| DELETE | `/users/:id` | |

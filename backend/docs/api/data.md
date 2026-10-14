# data (export / import)

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Both routes A only.

| Method | Path | Notes |
|---|---|---|
| GET | `/export` | Same shape as the frontend `exportDataJson` |
| POST | `/import` | Accepts that JSON (`customers` and `jobs` required). Replaces every collection present in the payload, keeps the old ids, reseeds the number counters → `{ imported: { <key>: count } }`. Validated first, so a bad file writes nothing |

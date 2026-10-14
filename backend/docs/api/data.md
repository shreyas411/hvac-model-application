# data (export / import)

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Both routes A only.

| Method | Path | Notes |
|---|---|---|
| GET | `/export` | Same shape as the frontend `exportDataJson` |
| POST | `/import` | Accepts that JSON (`customers` and `jobs` required). Customers, jobs and everything hanging off them (equipment, requests, movements, quotations, invoices, notifications) are always replaced, so a missing key empties that collection; parts, technicians and settings only when present. Records get new uuids (old ids kept in `legacy_id`) and every reference between them is rewritten. A reference to an id missing from the file → `422 DANGLING_REFERENCE`; with `?nullDangling=true`, equipment service records that point at a job not in the file are imported without the job link and listed in `nulledReferences` (other references stay errors). Reseeds the number counters → `{ imported: { <key>: count } }`. One transaction, so a bad file writes nothing |

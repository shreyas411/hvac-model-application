# audit

Base path `/api/v1`. Roles: **A** admin only. Shared conventions and error codes: [README](README.md). Source: `src/modules/audit/routes.ts`.

| Method | Path | Notes |
|---|---|---|
| GET | `/audit` | Paged (`?limit&cursor`), newest first. `?q` searches entity, action, details and user name. Each row: `{ id, entity, entityId, action, details, userId, userName, timestamp }` |

Read-only view of the append-only `audit_log` (invoice, payment, credit, refund and similar actions). Job history lives in each job's own audit trail. Other roles get `403`.

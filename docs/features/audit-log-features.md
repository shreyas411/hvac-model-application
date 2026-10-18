# Audit Log Features

Admin-only **Audit Log** tab (`frontend/src/components/audit/AuditView.tsx`, route `/audit`). Read-only table of the append-only `audit_log`: when, user, entity, action, details. Source API: `GET /audit` ([audit.md](../../backend/docs/api/audit.md)).

- Search box (debounced) filters on entity, action, details and user name.
- Newest first; **Load more** follows the server cursor, 50 rows at a time.
- Covers invoice, payment, credit-note, refund and similar actions. Job changes are in each job's own audit trail, not here.

## Limitations

- No date filter or CSV export.
- No field-level history for customers, settings or users.

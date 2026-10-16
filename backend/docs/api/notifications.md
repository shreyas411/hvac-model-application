# notifications

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

All routes A D.

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | |
| POST | `/notifications` | `{ customerId, type, channel, subject, messageBody, recipient?, status? }`. Requires GDPR consent (`CONSENT_REQUIRED`) and a matching communication preference (`CHANNEL_NOT_PREFERRED`). `recipient` defaults to the customer's email or phone |
| POST | `/notifications/:id/approve-send` | Records `approvedBy` and delivers through the provider (log-only in v1) → `sent` or `failed`. A worker retries approved ones left `ready_to_send` |

Statuses: `draft`, `ready_to_send`, `sending`, `sent`, `failed`. The worker claims a row (`ready_to_send` to `sending`) with a conditional update so it is never sent twice; rows stuck in `sending` for 5 minutes are re-queued. `GET /notifications` is paged in the database (`?q` searches subject, recipient, body).

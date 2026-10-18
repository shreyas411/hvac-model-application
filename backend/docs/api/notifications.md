# notifications

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

All routes A D.

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | |
| POST | `/notifications` | `{ customerId, type, channel, subject, messageBody, recipient?, status? }`. Requires GDPR consent (`CONSENT_REQUIRED`) and a matching communication preference (`CHANNEL_NOT_PREFERRED`). `recipient` defaults to the customer's email or phone |
| POST | `/notifications/:id/approve-send` | Records `approvedBy` and delivers through the provider (log-only in v1) → `sent` or `failed`. A worker retries approved ones left `ready_to_send` |

Statuses: `draft`, `ready_to_send`, `sending`, `sent`, `failed`. The worker claims a row (`ready_to_send` to `sending`) with a conditional update so it is never sent twice; rows stuck in `sending` for 5 minutes are re-queued. `GET /notifications` is paged in the database (`?q` searches subject, recipient, body).

## Updates: Resend, templates, attachments

- Delivery uses Resend's HTTP API when `RESEND_API_KEY` is set (`MAIL_FROM` is the sender; must be a verified Resend domain). Otherwise log-only. Only `email` is delivered; `sms` is log-only.
- `type` also accepts `payment_reminder`.
- Notifications carry optional `invoiceId` / `quotationId`; when set, the matching PDF is attached to the email.
- The server creates notifications on invoice issue, quotation send, job scheduled, job dispatched and (as drafts) overdue invoices. With company setting `autoSendEmails` on, all but payment reminders are approved and sent immediately as "System (auto-send)"; otherwise they stay `draft` until `approve-send`. Customers without consent or on SMS only get no email.

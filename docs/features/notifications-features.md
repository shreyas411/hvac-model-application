# Customer Notifications Features

The Notifications view ("Customer Notifications & Automated Templates") is an approval queue for customer-facing email/SMS messages. Users draft a message for a customer, review it in a preview, and approve it for sending. Sending is simulated: it only flips the record's status in app state; no message is actually transmitted. Source: `frontend/src/components/notifications/NotificationsView.tsx`.

## Communications queue (`NotificationsView.tsx:82-144`)

Lists all `notifications` from `AppContext` (newest first, because new ones are prepended). Each row shows customer name, channel icon (email or SMS), recipient, type badge, subject, and a one-line truncated body. The header shows the queue count and the text "Respects UK GDPR communication preferences" (static label only; no consent check is implemented in this view).

Status badge:

| Condition | Badge |
|---|---|
| `status === 'sent'` | green "Sent on <UK date of sentAt>" |
| anything else | amber "Ready for Approval" |

Note the type includes `draft` and `failed` too (`types/index.ts:317`), but the view treats every non-`sent` status identically.

The type badge uses `type.replace('_', ' ')`, which replaces only the first underscore (e.g. "booking confirmation", "technician arriving", "appointment reminder"; but `quotation_ready` renders "quotation ready").

## Draft a notification (`NotificationsView.tsx:33-49`, modal `:201-299`)

Opened by "Draft Notification". Fields:

| Field | Default / options |
|---|---|
| Customer Recipient * | select from `customers`; defaults to first customer at mount |
| Notification Type | Booking Confirmation (`booking_confirmation`), Appointment Reminder (`appointment_reminder`), Technician En Route (`technician_arriving`), Quotation Proposal (`quotation_ready`), Invoice Issued (`invoice_issued`) |
| Channel | Email (default) or SMS Text |
| Subject Header (required) | prefilled "Appointment Confirmation: Heating & Hot Water Inspection" |
| Message Body (required) | prefilled sample text mentioning Apex Climate Solutions and Liam Campbell |

On "Save to Queue", `createNotification` is called with `recipient` = customer email (email channel) or phone (SMS), and `status: 'ready_to_send'`. Context adds `id` (`notif-<timestamp>`) and `createdAt`. No toast is shown by `createNotification`. Nothing is created if the selected customer is not found. Selecting a type does not change the prefilled subject/body; there are no real templates.

## Preview (`NotificationsView.tsx:147-198`)

"Preview" opens a modal with channel, recipient, subject, body (whitespace preserved) and the raw status string. A "Send to Customer" button appears if not sent.

## Approve & send (`NotificationsView.tsx:51-56`)

"Approve & Send" (row) or "Send to Customer" (preview) calls `sendNotification(id)` (`AppContext.tsx:881`), which sets `status: 'sent'`, `sentAt` = now and `approvedBy` = `currentUser.name`, and toasts "Customer notification sent successfully". If the preview is open it is updated locally to show sent. There is no undo and no failure path.

## Related data and roles

- Data: `notifications`, `customers`, `currentUser`; actions `createNotification`, `sendNotification`.
- The navbar bell button (all roles) opens this view and shows an amber dot when any notification has `status === 'ready_to_send'` (`Navbar.tsx:33`, `:135-142`). The Notifications tab is not in the role-filtered nav link list.
- The view performs no role checks: any role can draft and send.
- Other parts of the app may create notifications via `createNotification`; this view only displays them.

## Limitations

- Sending is a state change only; no email/SMS provider integration.
- No edit or delete of queued items, no filtering, search or pagination.
- Customer's contact preferences/consent are not enforced; the recipient may be an empty string if the customer lacks that email/phone.
- Draft form state is not reset after saving.
- The default customer is captured once at mount (empty if customers load later).

## Updates: safe sending

Notifications have a new `sending` status. Sending claims the row with a conditional update (`ready_to_send` to `sending`) so two workers can never send the same message; the provider call runs outside any DB transaction, and rows stuck in `sending` for 5 minutes are put back in the queue (at-least-once for those rare rows). See [security-and-auth-features.md](security-and-auth-features.md).

## Updates: real email, templates and auto-send

Supersedes "Sending is simulated" and the "no provider" limitation above.

- **Email is delivered through Resend** (`backend/src/modules/notifications/service.ts`). Set `RESEND_API_KEY` and `MAIL_FROM` in `backend/.env`; `MAIL_FROM` must be on a domain verified in Resend (or `onboarding@resend.dev`, which only delivers to the Resend account owner). Without a key the provider is log-only. SMS is still log-only.
- A failed send sets `status: failed` (the reason is only in the backend log).
- **Status-triggered emails** (`notifications/templates.ts`), created automatically and skipped for customers without GDPR consent or who prefer SMS:

| Trigger | Type | Attachment |
|---|---|---|
| Invoice issued | `invoice_issued` | invoice PDF |
| Quotation sent | `quotation_ready` | quotation PDF |
| Job becomes scheduled (created with an engineer, converted from a request or quote, or moved to scheduled) | `booking_confirmation` | none |
| Job moves scheduled to dispatched | `technician_arriving` | none |
| Daily sweep marks an invoice overdue | `payment_reminder` | none |

- **Auto-send setting:** Settings > "Send customer emails automatically" (`autoSendEmails`, default off). Off: the emails above wait as drafts for staff to approve here. On: they are approved by "System (auto-send)" and sent at once. Payment reminders always stay drafts.
- The type list in the Draft form gains "Payment Reminder".
- Not built: service-due email for jobs raised by maintenance plans; SMS/WhatsApp delivery; showing the failure reason in the UI.

## Updates: bulk selection

- Select rows and **Approve & send** (loops `POST /notifications/:id/approve-send`, with confirmation; failed sends can be retried). Bulk dismiss is not built (no backend dismissed status).

Shared behaviour: [BULK_SELECTION.md](../BULK_SELECTION.md). Selection is limited to the current page; failures are reported as "N of M done. Skipped: …".

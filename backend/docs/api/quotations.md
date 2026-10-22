# quotations

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Read/write: A D C. Convert to job: A D. Convert to invoice: A C.

| Method | Path | Notes |
|---|---|---|
| GET | `/quotations` | |
| GET | `/quotations/:id` | |
| POST | `/quotations` | `{ customerId, locationId, issueDate, expiryDate, items[{ type, description, quantity, unitPrice }], vatRatePercent?, terms?, notes?, jobId? }`. Starts as `draft`; totals computed |
| PATCH | `/quotations/:id` | Only while `draft` or `sent` |
| POST | `/quotations/:id/send` | `draft` → `sent` |
| POST | `/quotations/:id/accept` | `{ acceptedBy, option? }`; from `sent` or `viewed`. `409 OPTION_REQUIRED` if the quote has options and `option` is missing/unknown; other tiers' lines are dropped and totals repriced |
| POST | `/quotations/:id/reject` | From `sent` or `viewed` |
| POST | `/quotations/:id/convert-to-job` | `{ appointmentDate, startTime, endTime, technicianId? }` → `{ job, quotation }`. Requires `accepted` |
| POST | `/quotations/:id/convert-to-invoice` | → `{ invoice, quotation }`. Copies items and totals. Requires `accepted` |

`expired` is set by the daily sweep for `sent`/`viewed` quotations past `expiryDate`.

Items may include `vatRatePercent` (per-line VAT). `GET /quotations` is paged in the database (`?q`, `?status`, `?cursor`).

## Updates: PDF and email

| Method | Path | Notes |
|---|---|---|
| GET | `/quotations/:id/pdf` | A D C. A4 `application/pdf` (`<quoteNumber>.pdf`) with items, VAT, totals and terms |

`POST /quotations/:id/send` queues a `quotation_ready` email with this PDF attached. Converting a quote to a job (with an engineer) queues a `booking_confirmation` email. See [notifications.md](notifications.md).

## Customer approval link (public, no login)

`POST /quotations/:id/send` generates a random token and emails the link `${APP_URL}/quote/<token>`. Only a SHA-256 hash is stored, so the link cannot be recovered later; to issue a new one, resend a draft. Staff payloads never include the token hash or the signature.

| Method | Path | Notes |
|---|---|---|
| GET | `/public/quotes/:token` | Customer-safe view (no internal ids). First view moves `sent` to `viewed` |
| POST | `/public/quotes/:token/accept` | `{ name, option?, signature? }` (PNG data URL, max ~400 KB). Records `acceptedBy`, `acceptedAt`, signature. `409 EXPIRED` past `expiryDate` |
| POST | `/public/quotes/:token/reject` | From `sent` or `viewed` |

Rate limited to 60 requests / 15 min per IP. Unknown token is `404`; an already decided quote is `409 INVALID_TRANSITION`.

## Changes
- `DELETE /quotations/:id` (A D) soft-deletes; refused for accepted or converted quotes (`409 IN_USE`).
- Quotes carry `expired` (status `expired`, or open and past `expiryDate`). Customer acceptance via the public link and conversion to a job are audited. List `?sort=issueDate|expiryDate|total|status|customer.name`.

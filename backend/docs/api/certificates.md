# certificates

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician (own jobs only). Shared conventions and error codes: [README](README.md). Source: `src/modules/certificates/routes.ts`.

| Method | Path | Notes |
|---|---|---|
| GET | `/certificates` | A D T. Newest first, paged (`?limit&page`, returns `total`). Filters `?customerId&jobId&type`, search `?q` over number, engineer and Gas Safe number |
| GET | `/certificates/expiring` | A D T. Latest CP12 per site expiring within `?days` (default 60, max 365), soonest first; includes already-expired |
| GET | `/certificates/:id` | A D T |
| GET | `/certificates/:id/pdf` | A D T. `application/pdf` |
| POST | `/certificates` | A D T. Body `{ type, customerId, locationId, jobId?, technicianId?, issueDate?, data }`; `data` is validated per `type` (`cp12`: appliances[], defects, warningNoticeIssued; `service_record`: workCarried, checks[], notes; `commissioning`: applianceMake, pressures, coPpm, co2Percent, flueTestPassed, notes) |

Issuing rules: the engineer (a technician always issues as themselves; others pass `technicianId`) must have a Gas Safe number that has not expired on the issue date (`NO_GAS_SAFE` / `GAS_SAFE_EXPIRED`, 422). Name and number are copied onto the certificate. A `jobId` must match the customer/site (`JOB_MISMATCH`). CP12 gets `expiryDate` = issue date + 1 year. Certificates are immutable (no PATCH/DELETE) and each issue is written to the audit log. Numbered `CERT-YYYY-NNNN`.

## Changes
- `DELETE /certificates/:id` soft-deletes. Rows carry `expired`; `?sort=type|issueDate|expiryDate`.

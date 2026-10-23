# Bulk selection

Shared pieces live in `frontend/src/components/common/BulkSelect.tsx` (`useRowSelection`, `SelectAllHead`, `SelectCell`, `BulkBar`). CSV export: `frontend/src/utils/csv.ts` (`downloadCsv`).

## Adding it to a list view

```tsx
const sel = useRowSelection(paged.rows /*, (row) => canActOn(row) */);
<BulkBar count={sel.selected.length} onClear={sel.clear}>…buttons using sel.selected…</BulkBar>
<SelectAllHead sel={sel} label="invoices" />                       // first header cell
<SelectCell sel={sel} row={inv} label={inv.invoiceNumber} />       // first cell of each row (+ data-state on the row)
```

- Selection covers the rows on the current page only; ids that leave the page drop out.
- Bulk actions return `{ id: errorMessage }` for failures (see `bulkAssignJobs`, `bulkIssueInvoices` in `AppContext.tsx`), so the view can report "N of M done. Skipped: …" and clear the bar.
- Bulk actions are one request: send the ids in the payload and the server loops (`bulk()` in `backend/src/common/bulk.ts`, max 100 ids, duplicates collapsed). Each id runs the normal service checks, so one failure never stops the rest. The response is `{ results: [{ id, ok, error?: { code, message } }] }`; `bulkCall` in `AppContext.tsx` turns it into the `{ id: errorMessage }` map and reloads the list.
- New bulk action: add a route calling `bulk(ids, (id) => svc.thePerRecordFunction(id))` next to the module's other routes (same role guard as the single-record route), a `bulkPost` entry in `services/index.ts`, and a `bulkCall` in `AppContext.tsx`.
- Bump the empty-state `colSpan` by one.

## Bulk endpoints

All `POST`, body `{ ids: string[] }` (jobs use `jobIds`), response `{ results }`. Same roles as the single-record route.

| Endpoint | Extra body | Per-id action |
|---|---|---|
| `/jobs/bulk-assign` | `technicianId` (null clears) | assign, then `new` becomes `scheduled` |
| `/jobs/bulk-status` | `status` | status change (workflow rules apply) |
| `/customers/bulk-archive` | `archived` | archive or restore |
| `/requests/bulk-cancel` | | set `cancelled` |
| `/quotations/bulk-send`, `/bulk-reject` | | send, reject |
| `/invoices/bulk-issue` | | issue draft |
| `/notifications/bulk-approve-send` | | approve and send (a failed delivery is reported as `DELIVERY_FAILED`) |
| `/parts/bulk-update` | `inactive` | activate or deactivate |
| `/parts/bulk-delete` | | delete (parts with stock history are refused) |
| `/equipment/bulk-update` | `inactive` | activate or deactivate |
| `/maintenance-agreements/bulk-update` | `active` | activate or pause |
| `/maintenance-agreements/bulk-delete` | | delete |
| `/certificates/bulk-delete` (admin) | | delete |

Certificate PDF download stays one `GET /certificates/:id/pdf` per file (a file can't ride in the JSON result).

## Status

| Module | Bulk actions | Status |
|---|---|---|
| Dispatch (jobs list) | Assign technician | Done |
| Invoices | Issue drafts, export CSV | Done |
| Quotations | Send drafts, reject open, export CSV | Done |
| Quotations, PDFs | Download PDFs | Todo (PDFs are rendered from the preview modal's DOM, needs an offscreen renderer) |
| Notifications | Approve and send | Done |
| Notifications, dismiss | Dismiss | Todo (no backend delete or `dismissed` status yet) |
| Service Requests | Cancel new or awaiting-approval requests | Done |
| Jobs, status | Set status (scheduled, on hold, cancelled) | Done |
| Jobs, reschedule | Reschedule | Todo (each job needs its own date and time, see below) |
| Maintenance contracts | Activate or pause, delete | Done |
| Certificates | Download PDFs, delete (admin) | Done |
| Customers | Archive or restore (follows the Active/Archived filter), export CSV | Done |
| Inventory | Activate or deactivate, delete, export CSV | Done |
| Equipment | Activate or deactivate (no archive concept), export CSV | Done |

## Not done on purpose

- **Jobs: bulk reschedule.** Each job needs its own date, time and conflict check, so one form would invent data. Add a "shift selected by N days" action if dispatchers ask.
- **Service requests: bulk convert to jobs.** Each job needs its own date, time and technician, so a single bulk form would invent data. Use the Dispatch board's bulk assign once jobs exist, or add a "book N requests onto one technician's day" flow if dispatchers ask.
- **Inventory: bulk adjust stock.** Each part needs its own quantity and reason for the ledger, so one form would invent data. Add a CSV stock-count import if stockroom staff ask.
- **Invoices: bulk record payment and bulk void.** Each needs a per-invoice bank reference or reason, so a single bulk form would invent data. Add if customers ask for a "mark paid from bank statement" flow.

# inventory

Base path `/api/v1`. Roles: **A** admin, **D** dispatcher, **T** technician, **C** accountant. Shared conventions and error codes: [README](README.md). Source: `src/modules/*/routes.ts`.

Mounted at the API root. Returns 403 `FEATURE_DISABLED` when `enableInventory` is off.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/parts` | A D T C | `?lowStock=true` returns parts at or below `minStockLevel` |
| GET | `/parts/:id` | A D T C | |
| POST | `/parts` | A D | `stockQuantity` becomes an opening `stock_adjustment` movement. `DUPLICATE_SKU` |
| PATCH | `/parts/:id` | A D | Cannot change stock; use `adjust` |
| POST | `/parts/:id/adjust` | A D | `{ delta, type: used_on_job \| stock_adjustment \| restock_purchase, notes?, jobId? }` → `{ part, movement }`. `INSUFFICIENT_STOCK` if it would go negative |
| GET | `/movements` | A D T C | `?partId` filter; append-only ledger |

Technicians can no longer adjust stock; parts used on a job go through `POST /jobs/:id/parts`, and `type: used_on_job` is rejected on `adjust` (`403`). Movements carry a `vatAmount` that feeds the VAT return (`/reports/vat`).

## Updates: delete

| Method | Path | Notes |
|---|---|---|
| DELETE | `/parts/:id` | A D. `204`. A part that has stock-movement rows is refused with `422 INVALID_REFERENCE`, so the ledger stays append-only |

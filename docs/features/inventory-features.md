# Inventory (Parts & Stock) Features

The Inventory view (nav label "Parts & Stock", page title "HVAC Parts & Inventory Catalogue") lets users browse the parts catalogue, search it, add catalogue items, manually adjust stock levels, and review a log of stock movements. All state lives in `AppContext` (`parts`, `inventoryMovements`) and is persisted to localStorage. Source: `frontend/src/components/inventory/InventoryView.tsx`.

## Feature toggle

| Item | Detail |
|---|---|
| Setting | `settings.enableInventory` (Settings > "Enable Warehouse & Van Stock Inventory Tracking") |
| Behaviour when off | The whole view is replaced by an "Inventory Tracking Disabled" message (`InventoryView.tsx:83-91`). Nothing else renders. |

## KPI cards (`InventoryView.tsx:93`, `:119-139`)

- **Catalogue Items**: `parts.length`.
- **Low Stock Warnings**: count of parts where `stockQuantity <= minStockLevel` (at or equal to threshold counts as low).
- **Total Stock Valuation**: sum of `stockQuantity * unitCost` (wholesale cost, not selling price), via `formatGBP`.

## Search (`InventoryView.tsx:42-52`)

Case-insensitive substring match against `name`, `sku` and `category`. Empty/whitespace input shows everything. No other filters or sorting exist.

## Parts table (`InventoryView.tsx:156-219`)

Columns: Item Name & SKU, Category, Location / Bin, Unit Cost, Selling Price, Stock Level, Actions. A part with `stockQuantity <= minStockLevel` shows its quantity in red plus a "Low (Min N)" label. Each row has an **Adjust Stock** button.

## Add catalogue item (`InventoryView.tsx:54-68`, modal `:317-443`)

Opened by "Add Catalogue Item". Calls `addPart(...)`, which assigns `id = part-<timestamp>` and `createdAt`, appends to `parts`, and toasts.

| Field | Required | Default | Notes |
|---|---|---|---|
| Part / Item Name | yes | empty | |
| SKU Code | yes | empty | No uniqueness check |
| Category | no | `Valves & Controls` | Free text |
| Unit Cost (£) | yes | 50 | step 0.01; non-numeric becomes 0 |
| Selling Price (£) | yes | 95 | step 0.01 |
| Initial Stock Qty | yes | 10 | integer; non-numeric becomes 0 |
| Min Reorder Level | yes | 3 | integer |
| Storage Location | no | `Warehouse Unit 4` | |

The form state is not reset after saving, so the next open keeps the previous values. The `description` field is passed to `addPart` but has no input in the modal (stays whatever the earlier state value is, initially empty). No initial-stock movement is logged.

## Adjust stock (`InventoryView.tsx:70-81`, modal `:248-314`)

Opened from a row; resets quantity to 5 and type to restock. Two types:

| Type (UI label) | Movement `type` | Sign applied |
|---|---|---|
| Restock Purchase (+ Add) | `restock_purchase` | `+quantity` |
| Stock Write-Off / Audit (- Deduct) | `stock_adjustment` | `-quantity` |

Quantity is an integer, min 1. "Reason / Supplier Note" is required (default "Wolseley Trade Counter restock"). Submit calls `adjustStock(partId, delta, type, notes)` (`AppContext.tsx:837`), which:

- sets new quantity to `Math.max(0, stockQuantity + delta)` (never negative; the movement still records the requested delta),
- prepends an `InventoryMovement` (`mov-<timestamp>`, `userName = currentUser.name`),
- toasts "Stock updated for X: new qty N".

The movement type `used_on_job` exists in `AppContext`/types but is not selectable here.

## Movement log (`InventoryView.tsx:222-245`)

Lists every entry in `inventoryMovements` (newest first, since new ones are prepended): part name (fallback "Part"), notes, signed delta (green for positive, red otherwise) and "date by userName" (`formatDateUK`).

## Roles

Nav access: admin, dispatcher, technician, accountant (all four) (`Navbar.tsx:44`). The view itself does no role checks, so every role who can see it can add parts and adjust stock.

## Limitations

- No editing or deleting of parts from this view (`updatePart` exists in context but is unused here).
- No pagination, sorting, category filter, or low-stock-only filter.
- Movement log is unbounded and not filterable, despite the "Recent" heading.
- Disabling inventory hides the view only; it does not change stock data.
- Quantity input falls back to 1 when cleared; write-offs larger than stock silently clamp to 0.
- Currency is fixed to GBP.

## Updates: delete part

Each row has a **Delete** button (with a confirmation). The server refuses to delete a part that has stock history, so the movement ledger stays complete; the error shows as a toast.

# Custom Fields Features

Admins add their own fields to eight modules without code changes. Source: `frontend/src/components/custom-fields/CustomFieldsView.tsx`; API: [custom-fields.md](../../backend/docs/api/custom-fields.md).

## Roles
Admin only for the **Custom Fields** screen (`custom_fields` route, `routes.ts`). Everyone sees the fields on forms and details for modules they can open.

## Managing fields
- One tab per module: Customers, Equipment, Service Requests, Jobs, Quotations, Invoices, Parts & Stock, Maintenance Plans.
- Field types: Text, Number, Date, Dropdown (needs at least one option), Checkbox. Optional **Required** flag.
- Type and module can't change after creation (stored values depend on them); label, options, required and active can.
- Drag the grip handle to reorder; the order is the order forms and drawers use (optimistic, reverts if the server refuses).
- **Inactive** fields disappear from forms and details but keep their stored values. Delete is a soft delete.

## Where fields show
| Piece | Use |
|---|---|
| `useCustomFields(entity)` (`data/customFields.ts`) | Loads definitions once; returns `all`, `defs` (this entity) and `active` (what forms/details show) |
| `CustomFieldInputs` (`common/CustomFields.tsx`) | Form section "Custom fields": text/number inputs, `Select`, `DatePicker`, checkbox. Empty values are removed from the object |
| `CustomFieldBox` (`common/CustomFields.tsx`) | Read-only display of values in details drawers |
| `RecordDetails` (`common/RecordDetails.tsx`) | Details drawer for modules with no document view: label/value rows, then custom fields, Close / Edit |

Wired into: customer form and 360 drawer, equipment, service request (new `RequestEditDrawer`), job detail drawer and dispatch board, quotations, invoices (new `InvoiceEditDrawer`), parts, maintenance plans, and the quick-create modals.

## Validation
Done on the server (`withCustomFields`): wrong type or non-option → `INVALID_CUSTOM_FIELD`; missing required (checkbox excepted) → `CUSTOM_FIELD_REQUIRED`. Shown as a toast.

## Limitations
Custom fields aren't in lists/columns, CSV export, search, reports or PDFs yet.

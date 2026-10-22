# UI Conventions & Shared Components

Every module follows one layout; the pieces live in `frontend/src/components/common/` and `components/ui/` (shadcn/Radix, configured by `frontend/components.json`).

| Piece | Use |
|---|---|
| `TableCard` + `Pager` | List container: the table scrolls in the remaining window height with a sticky header, pager pinned below. Page size (10/25/50/100) is shared across lists and remembered. |
| `SortHead` / `usePaged` (`Pager.tsx`) | Clickable column headers drive server-side `?sort=&dir=` (asc, desc, default). Changing filter or size returns to page 1. |
| `DetailDrawer` | Right-side drawer for every create / edit / details screen (`form` = narrow, `detail` = wide). With unsaved changes, closing asks to discard first. Customer form is now `CustomerFormDrawer`; `Customer360Drawer` shows the customer 360 view. |
| `ConfirmDialog` | Replaces `confirm()`/`prompt()`; optional required reason field. `confirmToast(text, onConfirm, options)` opens it. |
| `RowActions`, `Tip` | Icon row actions with tooltips; overflow menu for the rest. |
| `DatePicker`, `Combobox` | shadcn date / date-range picker (values stay `YYYY-MM-DD`, UK display) and searchable select for long lists (customers, parts, technicians). |
| `LineItemPicker` | Quote/invoice lines pick from Parts and Services; free text still allowed. |
| `AddressInput` | Google Places address suggestions that fill line 1/2, city and postcode. Off unless `VITE_GOOGLE_MAPS_API_KEY` is set at build time (passed through `docker-compose.yml` and `frontend/Dockerfile`); restrict the key to the site's referrers and the Places API. The typed text is sent to Google only while it is on. |
| Inline validation (`utils/inlineValidation.ts`) | Native constraint checks stay, but failures show as a persistent message under the field ("Enter email address") instead of the browser tooltip. |
| `SyncBanner` | Shows queued offline writes and writes the server refused after they were queued. See [offline-and-pwa-features.md](offline-and-pwa-features.md). |
| `utils/fgas.ts` | CO2-equivalent and leak-check interval (12 / 6 / 3 months at 5 / 50 / 500 tCO2e) for common refrigerants. Unknown gases show nothing. |

Deleting records is a soft delete through `deleteRecord` (customers, requests, jobs, quotations, invoices, equipment) and `removeTechnician`; the server answers `409 IN_USE` with a reason that is shown as a toast. Quick-create buttons are limited per role by `quickCreateRoles` in `routes.ts` (matching the API write roles).

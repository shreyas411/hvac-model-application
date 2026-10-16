# Settings Features

The Settings view ("Business Settings & Company Profile") is the admin screen for company profile and UK regulatory details, VAT default, document-number prefixes, the inventory toggle, bank details for invoices, the technician roster, and backup/restore/reset of all app data. Source: `frontend/src/components/settings/SettingsView.tsx`.

## Roles

Nav access: admin only (`Navbar.tsx:46`). The view has no internal role check.

## Company settings form (`SettingsView.tsx:31`, `:46-49`, `:129-378`)

The form is initialised once from `settings` into local state (`useState(settings)`), edited locally, and committed only by **Save All Settings**, which calls `updateSettings(form)` (merges into `settings`, toasts "Company settings updated successfully"). Settings are persisted to localStorage with the rest of the app state. Nothing is validated beyond the one `required` field.

| Section | Fields (`CompanySettings` key) |
|---|---|
| Company details and registrations | Registered Company Name (`companyName`, required), Trading / Brand Name (`tradingName`), Gas Safe Register Number (`gasSafeRegisterNo`), Refcom F-Gas Certificate Number (`fGasCertNo`), UK VAT Registration Number (`vatNumber`), Companies House Number (`companyNumber`), Headquarters Address (`addressLine1`), City / County (`city`), Postcode (`postcode`) |
| VAT and numbering | Default VAT Rate (`defaultVatRate`: 20, 5 or 0 via dropdown), Job Number Prefix (`prefixJob`), Invoice Prefix (`prefixInvoice`) |
| Inventory | Checkbox `enableInventory`: "Enable Warehouse & Van Stock Inventory Tracking". When off, the Inventory view shows a disabled message |
| Bank details (BACS invoices) | `bankDetails.bankName`, `accountName`, `sortCode`, `accountNumber` |

Fields that exist in `CompanySettings` but have no input here: `email`, `phone`, `prefixQuote` (see `types/index.ts:323-345`).

## Technician roster (`SettingsView.tsx:380-416`)

Card grid of every technician: colour dot, name, van registration, email, phone, skills (comma-joined), Gas Safe and F-Gas numbers ("N/A" if empty). Read-only; there is no edit or deactivate control.

### Add technician (`SettingsView.tsx:51-65`, modal `:419-518`)

| Field | Required | Default |
|---|---|---|
| Full Name | yes | empty |
| Email | yes (email type) | empty |
| Phone | yes (tel type) | empty |
| Skills (comma separated) | no | `Domestic Gas, Heat Pumps` |
| Gas Safe # | no | `GSR-992140` |
| F-Gas # | no | `FGAS-2079` |
| Van Reg | no | `LO24 KMP` |

Submit calls `addTechnician` with `skills` split on commas and trimmed, `color: '#0284c7'` (fixed for every new tech) and `active: true`. Context assigns `id = tech-<timestamp>` and toasts "Added technician <name>". The new tech appears in the roster and in the Reports utilisation table. The `updateTechnician` action exists in context but is not used here.

## Backup, restore and reset

| Action | Behaviour |
|---|---|
| Export Backup (`:67-77`) | `exportDataJson()` serialises settings, technicians, customers, equipment, serviceRequests, jobs, quotations, invoices, parts, inventoryMovements, notifications and `exportedAt`; downloads `ApexHVAC_Backup_<timestamp>.json`; toasts "Database backup downloaded" |
| Restore JSON (`:79-90`) | File picker (`.json`), read as text, passed to `importDataJson` (`AppContext.tsx:219`). Accepted only if parsed JSON has truthy `customers` and `jobs`; then each present collection overwrites state. Toasts success, "Invalid backup file structure" or "Failed to parse JSON file" |
| Reset Demo Data (`:357-368`) | After `window.confirm`, `resetAllData()` restores all collections and settings to the built-in sample data and sets the current user back to the first initial user; toasts an info message |

## Limitations

- Local form state is not re-synced if `settings` change elsewhere (for example after a restore or reset while the page is open), so the form can show stale values and a later Save would overwrite the restored settings.
- Restore has no schema validation beyond `customers` and `jobs`, no confirmation prompt, and replaces data wholesale (it does not touch `currentUser`, and the file input is not cleared, so re-selecting the same file will not retrigger).
- Add-technician form state is not reset after saving; no duplicate checks; no edit/remove of technicians; colour not selectable.
- Prefix, VAT-number, sort code and account number formats are not validated.
- All data is browser localStorage; there is no server-side persistence.

## Updates

- **Default Hourly Rate** (default 85) and **Default Travel Charge** (default 35) are now company settings, used for new jobs and maintenance jobs instead of hard-coded values.
- **Technician edit form** (Edit Field Technician) adds Gas Safe / F-Gas licence numbers and **Gas Safe Expiry / F-Gas Expiry** dates; an expired licence blocks assignment to jobs that require it ([compliance-features.md](compliance-features.md)).
- Bank details are only returned by the API to admin and accountant.
- Admin-only **Checklists** tab manages job checklist templates ([checklists-features.md](checklists-features.md)).

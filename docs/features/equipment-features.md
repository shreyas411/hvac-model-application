# Equipment & Assets Features

The Equipment view ("HVAC Equipment & Asset Register", nav label "Equipment & Assets") is a card-grid register of customer HVAC plant (boilers, heat pumps, air con, etc.). Users can search and filter the register, register a new asset, open a service-history drawer, and book a preventive-maintenance job for an asset. Source: `frontend/src/components/equipment/EquipmentView.tsx`; mounted from `frontend/src/App.tsx:122` for tab `equipment`.

## Access

| Role | Can see tab |
|------|-------------|
| admin, dispatcher, technician | Yes (`frontend/src/components/layout/Navbar.tsx:40`) |
| accountant | No |

Navigation is gated only by the navbar. The view itself has no per-action role checks, so every role that can open it can register assets and book services.

## AppContext usage

Reads `equipment`, `customers`; calls `addEquipment`, `addJob` (`EquipmentView.tsx:28`). `updateEquipment` is destructured but never used.

## Search and type filter (`EquipmentView.tsx:49-62`, `:140-165`)

- Free-text search (case-insensitive substring) over brand, model, serial number and the owning customer's name.
- Type filter buttons: All Types, combi boiler, system boiler, heat pump, air conditioning. Buttons use `type.replace('_',' ')` so only the first underscore is replaced.
- Types `ventilation` and `chiller` exist (`frontend/src/types/index.ts:62`) and can be registered, but have no filter button; they appear only under "All Types".
- Both filters combine (AND).

## Asset cards (`EquipmentView.tsx:168-234`)

Each card shows: type badge, `brand model`, customer name and location city, serial number (mono), installed and warranty dates (UK format), next service due date, and two buttons (History, Book Service).

**Status badge:** computed purely from the date, `nextServiceDueDate <= '2026-10-13'` (hard-coded string, line 172) gives a red "Service Due"; otherwise a green "Operational". The stored `Equipment.status` field (`operational | requires_attention | decommissioned`) is not displayed or used for the badge.

## Register Asset (`EquipmentView.tsx:94-112`, `:329-491`)

"Register Asset" opens a modal form.

| Field | Required | Default / notes |
|-------|----------|-----------------|
| Customer | Yes (select) | First customer; changing it resets location to that customer's first service location |
| Service Location | Yes (select) | Options come from the chosen customer's `serviceLocations` |
| Equipment Type | Select | combi_boiler (default), system_boiler, heat_pump, air_conditioning, ventilation, chiller |
| Brand | Yes | Default "Worcester Bosch" |
| Model | Yes | |
| Serial Number | Yes | No uniqueness check |
| Installed | Date | Default 2024-05-10 |
| Warranty Till | Date | Default 2031-05-10 |
| Next Service | Date | Default 2026-11-01 |
| Plant Location Notes | No | Stored as `locationNotes` |

On submit it calls `addEquipment` with `status: 'operational'` and `maintenanceFrequency` set to the `formFrequency` state, which defaults to `'annual'` and has no input in the form (always annual for new assets). `addEquipment` (`AppContext.tsx:293`) assigns id `eq-<timestamp>`, empty `serviceHistory`, prepends to the list, and shows a toast. The modal then closes and the history drawer for the new asset opens. Initial customer/location form state is captured at first render, so if `customers` is empty at mount the defaults stay empty.

## Service history drawer (`EquipmentView.tsx:236-327`)

"History" opens a right-side drawer containing:

- Specifications: maintenance frequency ("Every annual/biannual/quarterly"), installed date, warranty expiry, plant location (falls back to "Ground floor utility cupboard" when no notes).
- Service visit records (`serviceHistory`): service type, date, engineer name, findings, optional readings grid (pressure bar, flow temp C, refrigerant shown as "R32: x psi", CO ppm; only present values render), and optional engineer recommendation.
- Empty state: "No historical visits logged yet."
- Footer: "Schedule Next Maintenance" (same action as Book Service, then closes drawer) and Close.

Records are added elsewhere via `addEquipmentServiceRecord` (`AppContext.tsx:309`), which also sets `lastServiceDate`; this view does not call it. `returnTempC`, `co2Percent`, `deltaTC`, `partsReplaced` and `jobId` are not rendered.

## Book Service (preventive maintenance) (`EquipmentView.tsx:64-92`)

Creates a job via `addJob` with:

- `type: 'preventive_maintenance'`, `priority: 'medium'`, `status: 'new'`, `technicianId: null` (unassigned).
- `appointmentDate` = the asset's `nextServiceDueDate`, 09:00-11:30, 150 min estimate.
- `requiredSkills`: `['Domestic Gas']` if the type string contains "boiler", otherwise `['F-Gas Heat Pumps']` (so ventilation/chiller/air con get F-Gas Heat Pumps).
- Description: "Scheduled <frequency> maintenance for <brand> <model> (S/N ...)".
- Labour 2.5 h at 85.00/h; travel 30 min, 35.00 charge.
- A three-item general checklist (clean filters/heat exchanger, inspect relief valve and pressure, check electrical controls and thermistors).

It then navigates to the `dispatch` tab. There is no conflict check, no duplicate-booking guard, and the asset's `nextServiceDueDate` is not advanced afterwards.

## Limitations

- "Service Due" uses a hard-coded date (`2026-10-13`), not the current date, and ignores `Equipment.status`.
- Maintenance frequency cannot be chosen when registering; there is no edit or delete of assets (`updateEquipment` unused).
- No filter buttons for ventilation or chiller.
- Book Service can create repeated jobs for the same asset, and the job's date may be in the past for overdue assets.
- No role-based restriction on actions beyond tab visibility; `onOpenQuickAction` is accepted but unused.

## Updates: refrigerant, inactive, delete
- Heat pumps, air conditioning and chillers capture **refrigerant type** and **charge (kg)**. The detail drawer shows the CO2e tonnage and the F-Gas leak-check interval (`utils/fgas.ts`).
- Equipment can be marked inactive, soft-deleted, sorted by type / warranty / next service, and the register uses server paging. Warranty status comes from the API `expired` flag instead of a hard-coded date.

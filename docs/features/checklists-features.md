# Checklist Templates

Admin-managed lists of checklist items offered per job type. Technicians (and the maintenance sweep) copy items from the template onto a job, so the same safety steps are used every visit. Source: `frontend/src/components/checklists/ChecklistsView.tsx`, `frontend/src/data/checklistTemplates.ts`, `backend/src/modules/checklists/`.

## Access

Tab `checklists` is admin only. Everyone signed in can read templates (technicians and dispatchers pick from them); only admin can create, edit, delete or reorder.

## Managing templates

- Job-type selector: Installation, Repair, Inspection / CP12 Gas Check, Emergency Callout, Preventive Maintenance.
- Add an item with a label and a category: `general`, `gas_safety`, `electrical`, `refrigerant`. New items go to the end of that job type's list.
- Edit label and category inline (pencil / tick / cross), delete with the bin.
- Drag the grip handle (or use the keyboard) to reorder; the new order is saved with `POST /checklist-templates/reorder`.

## Where templates are used

| Place | Behaviour |
|-------|-----------|
| Technician Portal, Service checklist | Shows the templates for the active job's type that are not already on the job: "Add all", or `+ item` one at a time. A free-text "Custom checklist item" box adds a `general` item |
| Maintenance sweep | Auto-created maintenance jobs start with the `preventive_maintenance` templates |
| Job completion gate | `gas_safety` and `electrical` items must be ticked, and any `refrigerant` item requires a refrigerant log entry (see [compliance-features.md](compliance-features.md)) |

Templates are copied onto the job, so later template edits do not change existing jobs.

## Updates: inactive, delete
- Checklist templates can be marked inactive or soft-deleted.

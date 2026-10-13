# Workflow Guide Modal

The Workflow Guide is a full-screen modal that walks a tester through four end-to-end UK HVAC business cycles (Workflows A to D) using the seeded demo data. It is purely a navigation aid: it holds no business data of its own, and its buttons close the modal and jump to the relevant tab, optionally switching the active role first. Source: `src/components/workflows/WorkflowGuideModal.tsx`.

## Opening and closing

- Rendered once in `src/App.tsx:167-172`; visibility is the `workflowGuideOpen` state (`App.tsx:29`).
- Three triggers set it to true: the "Workflow Demo" button in the Navbar (`Navbar.tsx:125-132`), the `onOpenWorkflowGuide` prop passed to `DashboardView` (`App.tsx:98`), and the footer link "Test End-to-End Workflows" (`App.tsx:189-194`).
- When `isOpen` is false the component returns `null` (`WorkflowGuideModal.tsx:32`).
- Closed by the X button in the header or the "Close Guide" button in the footer; there is no backdrop-click or Escape handling.

## Props

| Prop | Type | Use |
|---|---|---|
| `isOpen` | boolean | Show/hide |
| `onClose` | `() => void` | Close modal |
| `onNavigateTab` | `(tab: string) => void` | Maps to `setCurrentTab` in App |
| `onOpenQuickAction` | `(action) => void` | Declared and passed by App, but never called inside the component |

## Workflow tabs

A tab strip (`:56-75`) switches local state `activeWorkflow` (`'A'|'B'|'C'|'D'`, default `'A'`). Each tab shows a coloured overview banner and 3-4 numbered step cards. Some steps have an action button, others are text only.

| Workflow | Overview | Steps | Action buttons |
|---|---|---|---|
| A: Callout to Paid Invoice | Request, dispatch, technician checklist and signature, service report, invoice, BACS payment | 1 Log Customer Request (mentions SR-1024); 2 Dispatcher Schedules Job (David Ross / Liam Campbell, conflict check); 3 Technician Van Portal; 4 Generate Invoice and Record Payment | "View Requests" -> `requests`; "Open Dispatch" -> `dispatch`; "Tech Van Portal" -> switches role to technician, then `technician_portal`; "View Invoices" -> `invoices` |
| B: Quote to Job to Invoice | Itemised quote (labour, equipment, VAT), acceptance, 1-click convert to job, invoice without re-entry | 1 Create or Inspect Quotation (QTE-2026-0041, GBP 4,812.00); 2 Record Acceptance and Convert to Job; 3 Convert to Invoice on Completion | "View Quotes" -> `quotations` (steps 2 and 3 have no button) |
| C: Preventive Maintenance | Equipment next-service dates flagged, office books appointment, tech completes checklist, history updated | 1 Inspect Maintenance Alerts (Margaret Higgins' boiler, Dr Finch's Altherma); 2 Book Preventive Maintenance Job; 3 Log Readings and Renew Warranty | "View Equipment Register" -> `equipment` (steps 2 and 3 text only) |
| D: On-Site Finding and Follow-up | Technician flags extra work, office quotes, customer approves, follow-up booked | 1 Technician Flags Additional Defect (JOB-2026-0810, Crown & Thistle); 2 Office Prepares Follow-Up Quote; 3 Customer Authorization and Follow-up Booked | "Open Tech Portal" -> role switch to technician then `technician_portal`; "Quotations" -> `quotations` |

## Action button behaviour

- Plain navigation buttons call `onClose()` then `onNavigateTab(tab)` (e.g. `:93-96`).
- Role-switching buttons (`:127-131`, `:258-262`) call `switchUserRole('technician')` from `useApp()` first, then close and navigate. `switchUserRole` selects the first user with that role (Liam Campbell, see roles doc) and shows an info toast.
- The guide does not switch back to another role; the user stays a technician until they change it.

## Footer

The footer text reads "Current Role: <A|B|C|D> test sequence" (`:300-302`). The label says "Current Role" but renders the active workflow letter, not the user role.

## Limitations

- Step text is hard-coded and refers to specific seeded records (SR-1024, QTE-2026-0041, JOB-2026-0810, named customers/technicians). If data is edited, imported, or deleted, the text can be stale. The "Overdue" claims depend on the demo date (seed data assumes 2026-10-13).
- Steps 2/3 of B, 2/3 of C, and 3 of D have descriptive text only; the guide does not perform or verify any step, and does not track progress.
- Descriptions mention features ("1-click Book Service", "Renew Warranty", "Record Customer Acceptance") that are described, not implemented, by this component; consult the respective views for what exists.
- `onOpenQuickAction` is unused; imported icons (`CheckCircle2`, `ArrowRight`, `Wrench`, etc.) are unused.
- The Technician Portal button is shown regardless of role, but the technician role cannot see the Dispatch, Requests, Quotations, or Invoices nav links, so after the role switch in step 3/D1 the user would need to switch back to continue other steps.
- No keyboard accessibility extras (no focus trap, no Escape, no `role="dialog"`).

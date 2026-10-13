# Roles and Access

The app simulates four user roles (admin, dispatcher, technician, accountant) with no real authentication. The active user is held in context state and persisted to localStorage; switching role changes which navigation links are shown, whether the "+ New" menu appears, what the role banner says, and which tab technicians land on. Permissions are enforced only by hiding navigation; there is no route guard. Sources: `src/components/layout/Navbar.tsx`, `src/components/layout/RoleBanner.tsx`, `src/context/AppContext.tsx`, `src/App.tsx`, `src/data/initialData.ts`.

## Users and roles

`UserRole = 'admin' | 'dispatcher' | 'technician' | 'accountant'` (`types/index.ts:1`). Five seed users (`initialData.ts:49-`):

| id | Name | Role | technicianId |
|---|---|---|---|
| usr-1 | Eleanor Wright | admin | none |
| usr-2 | James Miller | dispatcher | none |
| usr-3 | Liam Campbell | technician | tech-1 |
| usr-4 | David Ross | technician | tech-2 |
| usr-5 | Rachel Patel | accountant | none |

`users` is a constant (`useState(INITIAL_USERS)` with no setter, `AppContext.tsx:127`). `currentUser` defaults to `INITIAL_USERS[0]` (admin) unless a stored value exists in localStorage (`:128`).

## Role switching

- `switchUserRole(role)` (`AppContext.tsx:171-177`): finds the first user whose role matches, sets it as `currentUser`, and shows an info toast "Switched active profile to <name> (<ROLE>)". If no match, nothing happens.
- Because it matches by role, the technician role always resolves to Liam Campbell (usr-3). David Ross (usr-4) cannot actually be selected: clicking his row in the Navbar switcher calls `switchUserRole(u.role)` (`Navbar.tsx:253`) and activates Liam instead. The row of the current user is highlighted by `u.id === currentUser.id`, so David's row is never highlighted.
- `setCurrentUser` is also exposed on the context but not used by the layout components.
- Role switching does not reset the current tab, except as described under "Technician landing" below.
- Triggers: Navbar user menu (all five users listed), RoleBanner "Test as" buttons, and WorkflowGuideModal buttons (technician only).

## Navbar (`Navbar.tsx`)

### Navigation visibility

`navLinks` (`:35-47`) each carry `allowedRoles`; the list is filtered by `currentUser.role` (`:49`). Used in the desktop left sidebar (`:80-94`) and mobile drawer (`:287-304`).

| Link (tab id) | admin | dispatcher | technician | accountant |
|---|---|---|---|---|
| Dashboard (`dashboard`) | Y | Y | | Y |
| Technician Portal (`technician_portal`) | Y | Y | Y | |
| Dispatch & Jobs (`dispatch`) | Y | Y | | |
| Customers (`customers`) | Y | Y | | Y |
| Equipment & Assets (`equipment`) | Y | Y | Y | |
| Service Requests (`requests`) | Y | Y | | |
| Quotations (`quotations`) | Y | Y | | Y |
| Invoices & Payments (`invoices`) | Y | | | Y |
| Parts & Stock (`inventory`) | Y | Y | Y | Y |
| Reports (`reports`) | Y | | | Y |
| Settings (`settings`) | Y | | | |

The `notifications` tab has no sidebar link; it is reached only via the bell icon. It is therefore available to every role.

### Other Navbar features

- Brand button: goes to `technician_portal` for technicians, otherwise `dashboard` (`:63-65`, `:104-106`).
- Layout: fixed 240px sidebar on `lg` screens; on smaller screens a hamburger toggles a drawer that also shows "Signed in as <name>" and role (`:305-308`).
- "Workflow Demo" button opens the Workflow Guide (see `workflow-guide-features.md`).
- Bell button navigates to Notifications; an amber dot shows if any notification has status `ready_to_send` (`:33`, `:141-143`). It is a presence indicator, not a count.
- "+ New" quick-create dropdown is rendered only when `role !== 'technician'` (`:147`). See `quick-create-features.md`.
- User switcher (`:219-273`): button shows initial, first name and role; the dropdown lists every user with name, an uppercase role chip coloured per role, and a description:

| Role | Label | Description |
|---|---|---|
| admin | Business Owner / Admin | Full access to operations, finances & settings |
| dispatcher | Office Manager / Dispatcher | Manage jobs, calendar, customers & requests |
| technician | Field Technician | Mobile-first job view, checklists & signatures |
| accountant | Accountant | Quotations, invoices, VAT & payment ledgers |

- The three menus (quick, role, mobile) are independent booleans; opening one does not close the others, and none closes on outside click.

## Role banner (`RoleBanner.tsx`)

A strip under the navbar, rendered on every tab (`App.tsx:60`). It shows, for the current role: an icon, title, badge, and a one-line description (`line-clamp-1`), plus "Test as:" buttons (Admin, Dispatcher, Technician, Accountant; the active one is dark) and a role-specific primary action link.

| Role | Title (badge) | Primary action -> tab |
|---|---|---|
| admin | Business Owner / Admin Mode (Full Access) | View Dashboard -> `dashboard` |
| dispatcher | Office Manager & Dispatcher Mode (Scheduling & Ops) | Go to Dispatch Board -> `dispatch` |
| technician | Field Technician Mode (Liam Campbell) (Van & Field App) | Open Technician Van View -> `technician_portal` |
| accountant | Accountant Mode (Financial Ledger) | Open Invoices & Ledger -> `invoices` |

- The Technician button additionally calls `onSelectTab('technician_portal')` (`:92-95`); the other three only switch role, leaving the current tab as is.
- The technician title hard-codes "Liam Campbell", which matches the role-switch behaviour.
- Banner descriptions state restrictions (e.g. technician "Financial and company settings are restricted") that correspond to the hidden nav links.

## Technician landing and active technician

- `App.tsx:36-40`: an effect keyed on `currentUser.role` sets the tab to `technician_portal` when role is technician and the current tab is `dashboard`. If the tech is already on another tab it is left alone. The initial tab is `dashboard`, so a stored technician user lands on the portal on load.
- `TechnicianPortalView.tsx:44-46` picks the active technician as `currentUser.technicianId || 'tech-1'`, so non-technician roles viewing the portal see Liam Campbell's jobs.
- The technician view also uses `currentUser` for audit logs and stock movements (below).

## Where `currentUser` is recorded

| Action | Field written | Source |
|---|---|---|
| `addJob`, `convertRequestToJob`, `convertQuotationToJob`, `updateJob` (when an audit label is given) | audit entry `userId`, `userName` | `AppContext.tsx:436-465, 487-491, 622-625` |
| `recordPayment` | `recordedBy = currentUser.name` | `:714` |
| `adjustStock` | movement `userName` | `:861` |
| `sendNotification` | `approvedBy = currentUser.name` | `:889` |

## Limitations

- Navigation-only enforcement: `currentTab` is plain React state with no check against `allowedRoles`. Examples that bypass hiding: the Workflow Guide, RoleBanner primary actions, the dashboard, quick-create, or an already-open tab all call `setCurrentTab` directly. For instance the dispatcher can click "Go to Dispatch Board"; the accountant banner links to `invoices`, which is allowed, but a role switch while on a restricted tab leaves that tab open (e.g. admin on Settings switching to technician still shows Settings).
- Context actions (`updateSettings`, `recordPayment`, `resetAllData`, etc.) perform no role checks.
- `switchUserRole` can reach only the first user per role; David Ross is unreachable. No login, passwords, or sessions.
- `users` cannot be added or edited in the UI.
- Technician quick-create is hidden in Navbar only; dashboards or views passing `onOpenQuickAction` are not role-filtered by this code.
- Menus do not close on outside click or Escape.

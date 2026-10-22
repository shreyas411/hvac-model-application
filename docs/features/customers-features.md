# Customer Features

The Customers view (`frontend/src/components/customers/CustomersView.tsx`) is the customer directory. It provides search and filtering, add/edit/archive of customers, and a right-hand "360" drawer showing a customer's contact details, service locations (with an add-site form), registered equipment, job history and a financial summary.

## Role access

Nav "Customers" is allowed for `admin`, `dispatcher` and `accountant` (`Navbar.tsx`). Technicians cannot reach it. The view has no per-action role checks, so accountants can add, edit and archive too.

## AppContext data and actions

| Item | Use |
|---|---|
| `customers` | directory data |
| `addCustomer(cust)` | create (`AppContext.tsx:261`; assigns `id` `cust-<timestamp>`, timestamps, toast) |
| `updateCustomer(id, updates)` | edit and add-site (`:274`; refreshes `updatedAt`, toast) |
| `archiveCustomer(id)` | toggles `archived` (`:283`) |
| `equipment`, `jobs`, `invoices` | 360 drawer lists and totals |
| `quotations`, `serviceRequests` | destructured, unused |
| `showToast` | add-site confirmation |

Props `onOpenQuickAction` and `onNavigateTab` are accepted but not called anywhere in this view.

## Directory list and filters (`:46-99`, `:237-402`)

Table columns: customer (name and company, click opens the 360 drawer), type badge, phone and email, primary service location (first in `serviceLocations`), site count, GDPR status ("Consent OK" or "Pending"), and actions (360 View, edit, archive/restore).

- **Search** (case-insensitive substring): name, company name, email, any service-location postcode; phone is matched as case-sensitive `includes` on the raw string (formatting must match).
- **Type filter**: All, Commercial, Residential. The "All" label shows the count of non-archived customers (ignores type/search).
- **Archived toggle**: shows either active customers or only archived ones (it is a switch between the two sets, not "include archived"). Button reads "Show Archived" / "Viewing Archived".
- Empty state: "No customers found matching your criteria."
- The archive icon toggles immediately with no confirmation; the tooltip reads Restore or Archive.

## Add and edit customer (`:101-185`, `:616-790`)

Opened with "Add Customer", the row edit icon, or "Edit Customer" in the drawer.

| Field | Rule |
|---|---|
| Customer Type | residential or commercial (radio); defaults to residential |
| Primary Contact Name | required |
| Company / Trading Name | shown and required only when commercial; stored only for commercial (`undefined` otherwise) |
| Phone, Email | required (`type=tel`, `type=email`) |
| Billing street address | required |
| City / Borough | defaults to "London" on add |
| UK Postcode | required, upper-cased on save; no format validation |
| Communication Preference | both (default on add), email, sms |
| GDPR consent | checkbox, default on; labelled "Customer consented to service communication (UK GDPR)" |

On create, `addCustomer` is called with `archived: false` and one auto-generated primary service location (label "Primary Site / HQ" for commercial, "Main Residence" for residential) copied from the billing address and using the customer's name and phone as site contact. The new customer's drawer opens afterwards. On edit, `updateCustomer` replaces type, name, company, phone, email, billing address, notes, preference and consent; service locations are left untouched.

## Customer 360 drawer (`:404-614`)

Slide-in panel with name, type badge and company. Sections:

- **Contact and billing**: phone, email, communication preference, billing address.
- **Service locations (multi-site)**: list with label, address, postcode and amber access notes. "+ Add Location" shows a form (label, address line 1, city, postcode required; access notes optional). Saving appends a location (id `loc-<timestamp>`, postcode upper-cased, default label "Secondary Site") via `updateCustomer`, resets the form and toasts.
- **Registered HVAC assets**: equipment where `customerId` matches: brand and model, serial number, next service due date.
- **Job history and visits**: all jobs for the customer (unsorted): job number, description, date and status.
- **Financial history**: count of invoices and outstanding balance (sum of `balanceDue`, GBP). Quotations are not shown despite the section being commented as "Invoices & Quotations".
- Footer: Edit Customer, Close Drawer.

## Limitations

- No delete, only archive; archive has no confirmation and does not check for open jobs or invoices.
- The Add/Edit form has no notes input: `notes` is loaded and re-saved unchanged, so new customers get empty notes and notes cannot be edited here.
- Existing service locations and billing address line 2 cannot be edited or removed; editing a customer rewrites `billingAddress` without `line2`, dropping any existing value. New sites cannot hold contact name or phone.
- Primary location is not kept in sync with billing address after creation.
- No email/phone/postcode format or duplicate checks.
- The drawer has no links to create jobs, quotes or invoices (props for that go unused) and shows no quotations or service requests.
- The "All" count and archive filter do not reflect the active search or type filter.
- Customer data lives in browser localStorage (via `AppContext`), so changes are per-browser.

## Updates: postcode lookup

Adding a service site has a postcode lookup (`frontend/src/services/postcode.ts`) that fills address line, city and postcode. It is currently a **mock** with a few test postcodes (SW1A 1AA, EC1A 1BB, M1 1AE, B1 1BB) and a simulated delay; swap in Loqate, GetAddress or Postcodes.io for production. Customer lists are paged and searched on the server.

## Updates: edit notes, address line 2 and service sites

- The Add/Edit form now has **Notes** and **Address Line 2** inputs; saving no longer drops line 2 or leaves notes uneditable (supersedes those limitations above).
- Each service location in the drawer has **Edit** (reuses the add-site form) and **Remove**. The server refuses to remove a site still used by jobs, equipment or service requests (`409 LOCATION_IN_USE`, shown as a toast). Site contact name/phone are still not editable here.

## Updates: job details from the 360 drawer

Rows under **Job history & visits** are now buttons that open the read-only job record (`JobDetailDrawer`, see [dispatch-features.md](dispatch-features.md)) with PDF/Print.

## Updates: landlords, validation, delete
- New customer type **Landlord / Agent** (filter option "Landlord"; first site is labelled "Rental Property"). Reverse charge and CIS are only offered to commercial customers (the API refuses them otherwise).
- The add/edit form is now `CustomerFormDrawer`; the list uses server paging, sorting by type and an inactive filter. See [ui-conventions-features.md](ui-conventions-features.md). Address lines autocomplete when Google Places is configured.
- UK postcode and phone are validated and the postcode is normalised (`LS1 4AB`). Email is lower-cased and unique among active customers (`409 DUPLICATE_CUSTOMER`, also when restoring an archived customer).
- Admins can delete a customer (soft delete); refused while it has jobs, quotes, invoices, requests or equipment. Removed sites vanish from the drawer.

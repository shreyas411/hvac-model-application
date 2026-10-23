# Companies (multi-tenant login)

Every account and every business record belongs to one company. Users sign in with **company, email, password**; the company is its `slug` (case-insensitive). The same email can exist in several companies, and no company can see another's data.

## Create a company

From `backend/`:

```bash
npm run company:create -- <slug> "<Company name>" <admin email> <admin password> [auth user id]
```

Example:

```bash
npm run company:create -- acme "Acme Heating" boss@acme.co 'Str0ng-Pass!'
```

This creates, in one go:
- the company (`slug` must be unique),
- its settings row (name, default VAT rates; edit the rest under Settings),
- one `admin` user. Sign in with `acme` / `boss@acme.co` / the password.

The script uses whichever database `DATABASE_URL` points at (`.env.local` etc.), so check that first.

### With Supabase auth

Passwords live in Supabase, not in our database. Create the admin in Supabase Auth first, then pass its user id as the last argument (the password argument is ignored):

```bash
npm run company:create -- acme "Acme Heating" boss@acme.co ignored <supabase-auth-user-id>
```

Login checks that the Supabase account belongs to the company typed. One email is one Supabase account, so the same email can't have different passwords in two companies.

## After creating

- The admin adds the rest of the team under **Users** (they are created in the admin's company automatically).
- Document numbers (`JOB-`, `QTE-`, `INV-`, ...), SKUs and customer emails are unique per company, so two companies can both have `INV-2026-0001`.

## Local dev

- `x-dev-user: dev-admin` signs in as the `default` company; add `x-dev-company: <slug>` to use another.
- Existing data from before multi-company lives in the company with slug `default`.

## How scoping works

`backend/src/common/prisma.ts` adds the signed-in user's company to every query on tenant tables, and a query with no company in context throws. Background jobs use `forEachCompany`; pre-login lookups use `unscoped`. See migration `20261102000000_multi_company`.

# Backend

Express + TypeScript API from `TECH_SPEC.md`. Storage is Postgres via Prisma
(`prisma/schema.prisma`, migrations in `prisma/migrations`).

```
npm install
cp .env.example .env
npm run dev      # :3001, /api/v1/*
npm test
```

Auth: set `SUPABASE_JWT_SECRET` (or `SUPABASE_JWKS_URL`). With neither set and `NODE_ENV!=production`,
send `x-dev-user: dev-admin|dev-dispatcher|dev-technician|dev-accountant`.

API docs: `docs/api/` (one file per module).

Layout: `src/modules/<name>/{routes,service}.ts`, shared pieces in `src/common`, sweeps in `src/jobs`.
`src/types.ts` is a copy of `frontend/src/types/index.ts`.

Also see `.env.example` / `.env.local.example`. Key settings: `APP_ENV` (`local|staging|production`; defaults to `production` when `NODE_ENV=production`), `APP_URL` (comma-separated CORS origins), `COOKIE_SAMESITE`, `TRUST_PROXY`, `WORKER_INLINE` (inline sweeps, on by default only in local dev). Apply migrations with Prisma (`prisma migrate deploy`); recent ones add idempotency keys, credit notes/refunds/VAT, checklist templates, audit log + RLS, refrigerant logs / rate card / licence expiry, notification claiming, job-slot exclusion and maintenance agreements. The daily sweep marks overdue invoices, expires quotations, raises maintenance jobs and prunes idempotency keys. Feature overview: `../features.md`.

Also see `.env.example` / `.env.local.example`. Key settings: `APP_ENV` (`local|staging|production`; defaults to `production` when `NODE_ENV=production`), `APP_URL` (comma-separated CORS origins), `COOKIE_SAMESITE`, `TRUST_PROXY`, `WORKER_INLINE` (inline sweeps, on by default only in local dev). Apply migrations with `prisma migrate deploy`; recent ones add idempotency keys, credit notes/refunds/VAT, checklist templates, the audit log + RLS, refrigerant logs / rate card / licence expiry, notification claiming, job-slot exclusion and maintenance agreements. The daily sweep marks overdue invoices, expires quotations, raises maintenance jobs and prunes idempotency keys. Feature overview: `../features.md`.

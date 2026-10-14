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

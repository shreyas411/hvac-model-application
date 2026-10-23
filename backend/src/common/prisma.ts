import { AsyncLocalStorage } from 'node:async_hooks';
import '../config.js'; // must load .env.<APP_ENV> before the client reads DATABASE_URL
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { conflict, notFound, unprocessable } from './errors.js';
import { pageFrom } from './paginate.js';

// Prisma's defaults (2s wait for a pooled connection, 5s per transaction) turn bursts of concurrent bookings into 500s.
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), transactionOptions: { maxWait: 10_000, timeout: 15_000 } });

/** Models with `isDeleted`/`deletedAt`: reads hide deleted rows unless the query sets `isDeleted` itself (`undefined` = include them). Deleting = softDelete(). */
const SOFT_DELETED = new Set(['User', 'Technician', 'Customer', 'ServiceLocation', 'Equipment', 'ServiceRequest', 'Job', 'Quotation', 'Invoice', 'Part', 'ChecklistTemplate', 'MaintenanceAgreement', 'Certificate']);
const FILTERED = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy', 'updateMany']);

/**
 * Multi-company: models carrying `companyId` are scoped to the company of the current request (set by authenticate / runAs),
 * so no query can read or write another company's rows. Child tables (payments, line items, ...) are reached through their parent.
 * A query on these models outside runAs() throws; use `unscoped` where there is deliberately no company yet (login, sweeps).
 */
const TENANT = new Set(['User', 'Technician', 'CompanySettings', 'Counter', 'Customer', 'ServiceLocation', 'Equipment', 'ServiceRequest', 'Job', 'Quotation', 'Invoice', 'CreditNote', 'Part', 'InventoryMovement', 'Notification', 'ChecklistTemplate', 'AuditLog', 'MaintenanceAgreement', 'Certificate']);
const SCOPED_WHERE = new Set([...FILTERED, 'update', 'delete', 'deleteMany', 'upsert']);
const tenant = new AsyncLocalStorage<string>();
export const runAs = <T>(companyId: string, fn: () => T) => tenant.run(companyId, fn);
export const currentCompany = () => tenant.getStore() ?? (() => { throw new Error('No company in context: wrap in runAs()'); })();
const withCompany = (d: any, companyId: string): any => Array.isArray(d) ? d.map((r) => withCompany(r, companyId))
  : { ...d, companyId, ...(d.locations?.create && { locations: { create: withCompany([d.locations.create].flat(), companyId) } }) }; // a customer's nested service locations are tenant rows too

// Cast keeps every `Tx`/`PrismaClient` signature in the codebase unchanged.
export const prisma = client.$extends({
  query: { $allModels: { $allOperations: ({ model, operation, args, query }) => {
    const a: any = { ...args };
    if (SOFT_DELETED.has(model) && FILTERED.has(operation)) a.where = { isDeleted: false, ...a.where };
    if (TENANT.has(model)) {
      const companyId = currentCompany();
      if (SCOPED_WHERE.has(operation)) a.where = { ...a.where, companyId };
      if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') a.data = withCompany(a.data, companyId);
      if (operation === 'upsert') a.create = { ...a.create, companyId };
    }
    return query(a);
  } } },
}) as unknown as PrismaClient;

/** The raw client: no company scoping. Only for lookups that happen before a company is known (login, public links, sweeps). */
export const unscoped = client;

/** Runs `fn` once per company (background sweeps have no request to take the company from). Sums numeric results. */
export const forEachCompany = async (fn: () => Promise<number>) => {
  let total = 0;
  for (const { id } of await client.company.findMany({ select: { id: true } })) total += await runAs(id, fn);
  return total;
};

export const softDelete = (model: any, where: object) => model.update({ where, data: { isDeleted: true, deletedAt: new Date() } });

/** DELETE handler body: 404 if missing, `blocker` returns a reason to refuse (409 IN_USE) while the record is still referenced. */
export const removeRecord = async (model: any, id: string, label: string, blocker?: (row: any) => string | false | Promise<string | false>) => {
  const row = isUuid(id) ? await model.findUnique({ where: { id } }) : null;
  if (!row) throw notFound(label);
  const why = await blocker?.(row);
  if (why) throw conflict('IN_USE', why);
  await softDelete(model, { id });
};

/** Client or interactive-transaction client. */
export type Tx = Prisma.TransactionClient;

export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** DB row → API shape: drops nulls and `drop` columns, Decimal → number, Date → ISO string (YYYY-MM-DD for `dates` keys). */
export const plain = (row: object, drop: string[] = [], dates: string[] = []) =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([k, v]) => v !== null && !drop.includes(k))
      .map(([k, v]) => [k, v instanceof Prisma.Decimal ? v.toNumber() : v instanceof Date ? (dates.includes(k) ? v.toISOString().slice(0, 10) : v.toISOString()) : v]),
  );

/** Store for a flat Prisma model (uuid id, createdAt), newest first. Plugs into crud(). */
export const prismaRepo = <T extends { id: string }>(model: any, drop = ['legacyId', 'updatedAt'], extra?: (r: any) => object) => {
  const out = (r: any) => ({ ...plain(r, drop), ...extra?.(r) }) as unknown as T;
  return {
    page: (query: unknown, searchFields: string[], sorts?: string[]) => pageFrom(query, model, { searchFields, sorts, filters: ['inactive', 'active'] }, out),
    all: async () => (await model.findMany({ orderBy: { createdAt: 'desc' } })).map(out) as T[],
    find: async (id: string) => (isUuid(id) ? ((r) => (r ? out(r) : undefined))(await model.findUnique({ where: { id } })) : undefined),
    insert: async (data: object) => out(await model.create({ data })),
    update: async (id: string, patch: object) => out(await model.update({ where: { id }, data: patch })),
    remove: async (id: string) => { await softDelete(model, { id }); },
  };
};

export const date = (v?: string | null) => (v ? new Date(v) : undefined);

/** Import helper: oldId → new uuid, or a 422 naming the record when the payload references something it doesn't contain. */
export const refer = (ids: Map<string, string>, old: unknown, from: string) => {
  const id = ids.get(String(old));
  if (!id) throw unprocessable('DANGLING_REFERENCE', `${from} references unknown id ${old}`);
  return id;
};

/** `SELECT ... FOR UPDATE` on one row: serialises concurrent writers (payments, conversions, edits) on the same record. */
export const lockRow = (tx: Tx, table: 'invoices' | 'quotations' | 'jobs', id: string) =>
  tx.$queryRawUnsafe(`SELECT 1 FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id); // `table` is a literal union, never user input

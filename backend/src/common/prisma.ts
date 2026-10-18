import '../config.js'; // must load .env.<APP_ENV> before the client reads DATABASE_URL
import { Prisma, PrismaClient } from '@prisma/client';
import { unprocessable } from './errors.js';
import { pageFrom } from './paginate.js';

// Prisma's defaults (2s wait for a pooled connection, 5s per transaction) turn bursts of concurrent bookings into 500s.
export const prisma = new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 15_000 } });

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
export const prismaRepo = <T extends { id: string }>(model: any, drop = ['legacyId', 'updatedAt']) => {
  const out = (r: any) => plain(r, drop) as unknown as T;
  return {
    page: (query: unknown, searchFields: string[]) => pageFrom(query, model, { searchFields }, out),
    all: async () => (await model.findMany({ orderBy: { createdAt: 'desc' } })).map(out) as T[],
    find: async (id: string) => (isUuid(id) ? ((r) => (r ? out(r) : undefined))(await model.findUnique({ where: { id } })) : undefined),
    insert: async (data: object) => out(await model.create({ data })),
    update: async (id: string, patch: object) => out(await model.update({ where: { id }, data: patch })),
    remove: async (id: string) => { await model.delete({ where: { id } }); },
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

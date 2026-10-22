import { z } from 'zod';
import { isUuid } from './prisma.js';

const q = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** 1-based page number: offset paging that also returns `total`. Without it, paging is by `cursor`. */
  page: z.coerce.number().int().min(1).optional(),
  cursor: z.string().optional(),
  q: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
});

/** `?limit&page|cursor&q&status` over an already-ordered list. Cursor = id of the last row of the previous page. */
export function paginate<T extends { id: string }>(rows: T[], query: unknown) {
  const { limit, page, cursor, q: text, status } = q.parse(query);
  let list = rows;
  if (status) list = list.filter((r: any) => r.status === status);
  if (text) list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(text.toLowerCase()));
  const start = page ? (page - 1) * limit : cursor ? list.findIndex((r) => r.id === cursor) + 1 : 0;
  const data = list.slice(start, start + limit);
  return { data, nextCursor: start + limit < list.length ? data[data.length - 1]?.id ?? null : null, ...(page && { total: list.length }) };
}

/**
 * Database-side paging for big tables: `?limit&page|cursor&q&status`. Fetches limit+1 rows, so only one page is ever loaded.
 * With `page` (1-based) it uses an offset and also returns `total` for the filtered listing; with `cursor` it continues after that id.
 * `q` is a case-insensitive "contains" over `searchFields` (plain columns of the model, or `relation.column` through a to-one relation);
 * `?sort=<column>&dir=asc|desc` orders by one of `sorts` or a plain `searchFields` column (`relation.column` goes through a to-one relation), then newest first.
 * `filters` are query params matched by equality (`true`/`false` become booleans); `where` scopes the whole listing (e.g. one technician).
 */
export async function pageFrom<R extends { id: string }, T>(
  query: unknown, model: { findMany(args: any): Promise<unknown[]>; count(args: any): Promise<number> },
  o: { where?: object; include?: object; searchFields: string[]; filters?: string[]; sorts?: string[] }, map: (r: R) => T,
) {
  const { limit, page, cursor, q: text, status, sort, dir } = q.parse(query);
  const raw = (query ?? {}) as Record<string, unknown>;
  const equal = Object.fromEntries((o.filters ?? []).flatMap((f) => {
    const v = raw[f];
    if (typeof v !== 'string' || (f.endsWith('Id') && !isUuid(v))) return [];
    return [[f, v === 'true' ? true : v === 'false' ? false : v]];
  }));
  const nest = (field: string, leaf: unknown) => field.split('.').reduceRight<unknown>((inner, key) => ({ [key]: inner }), leaf);
  const match = (field: string) => nest(field, { contains: text, mode: 'insensitive' });
  const sortable = [...(o.sorts ?? []), ...o.searchFields.filter((f) => !f.includes('.some.'))];
  const where = { ...o.where, ...equal, ...(status && { status }), ...(text && { OR: o.searchFields.map(match) }) };
  const [rows, total] = await Promise.all([
    model.findMany({
      where, include: o.include, orderBy: [...(sort && sortable.includes(sort) ? [nest(sort, dir)] : []), { createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      ...(page ? { skip: (page - 1) * limit } : cursor && isUuid(cursor) && { cursor: { id: cursor }, skip: 1 }),
    }) as Promise<R[]>,
    page ? model.count({ where }) : undefined,
  ]);
  const data = rows.slice(0, limit);
  return { data: data.map(map), nextCursor: rows.length > limit ? data[data.length - 1].id : null, ...(total !== undefined && { total }) };
}

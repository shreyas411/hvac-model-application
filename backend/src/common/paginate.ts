import { z } from 'zod';
import { isUuid } from './prisma.js';

const q = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  q: z.string().optional(),
  status: z.string().optional(),
});

/** `?limit&cursor&q&status` over an already-ordered list. Cursor = id of the last row of the previous page. */
export function paginate<T extends { id: string }>(rows: T[], query: unknown) {
  const { limit, cursor, q: text, status } = q.parse(query);
  let list = rows;
  if (status) list = list.filter((r: any) => r.status === status);
  if (text) list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(text.toLowerCase()));
  const start = cursor ? list.findIndex((r) => r.id === cursor) + 1 : 0;
  const data = list.slice(start, start + limit);
  return { data, nextCursor: start + limit < list.length ? data[data.length - 1]?.id ?? null : null };
}

/**
 * Database-side paging for big tables: `?limit&cursor&q&status`. Fetches limit+1 rows after the cursor id, so only one page is ever loaded.
 * `q` is a case-insensitive "contains" over `searchFields` (plain columns of the model); `where` scopes the whole listing (e.g. one technician).
 */
export async function pageFrom<R extends { id: string }, T>(
  query: unknown, model: { findMany(args: any): Promise<unknown[]> }, o: { where?: object; include?: object; searchFields: string[] }, map: (r: R) => T,
) {
  const { limit, cursor, q: text, status } = q.parse(query);
  const rows = (await model.findMany({
    where: { ...o.where, ...(status && { status }), ...(text && { OR: o.searchFields.map((f) => ({ [f]: { contains: text, mode: 'insensitive' } })) }) },
    include: o.include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
    ...(cursor && isUuid(cursor) && { cursor: { id: cursor }, skip: 1 }),
  })) as R[];
  const page = rows.slice(0, limit);
  return { data: page.map(map), nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}

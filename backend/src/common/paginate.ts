import { z } from 'zod';

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

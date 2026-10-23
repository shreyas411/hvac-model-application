import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError, PRISMA } from './errors.js';

export const bulkIds = z.array(z.string().uuid()).min(1).max(100).transform((a) => [...new Set(a)]);

export type BulkResult = { id: string; ok: boolean; error?: { code?: string; message: string } };

/** Run one per-record action over many ids. Each id goes through the normal service checks; one failure doesn't stop the rest.
 *  ponytail: sequential, capped at 100 ids per call; parallelise or queue if batches grow. */
export async function bulk(ids: string[], act: (id: string) => unknown): Promise<{ results: BulkResult[] }> {
  const results: BulkResult[] = [];
  for (const id of ids) {
    try {
      await act(id);
      results.push({ id, ok: true });
    } catch (e) {
      const p = e instanceof Prisma.PrismaClientKnownRequestError ? PRISMA[e.code] : undefined;
      results.push({ id, ok: false, error: e instanceof ApiError ? { code: e.code, message: e.message } : p ? { code: p[1], message: p[2] } : { message: (e as Error).message ?? 'Failed' } });
    }
  }
  return { results };
}

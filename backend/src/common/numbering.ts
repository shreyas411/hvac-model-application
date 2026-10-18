import { prisma, type Tx } from './prisma.js';
import { getSettings } from '../modules/settings/service.js';

export type NumberKey = 'job' | 'quote' | 'invoice' | 'request' | 'credit' | 'certificate';
const KEYS: NumberKey[] = ['job', 'quote', 'invoice', 'request', 'credit', 'certificate'];
// Service requests are numbered across years (SR-12), the rest per year.
const yearOf = (key: NumberKey, year: number) => (key === 'request' ? 0 : year);

/** One atomic statement per number, so concurrent creates never collide. Pass the caller's `tx` so a rollback also rolls the counter back (gap-free invoice numbers). */
export async function nextNumber(key: NumberKey, now = new Date(), c: Tx = prisma): Promise<string> {
  const year = now.getUTCFullYear();
  const [{ n }] = await c.$queryRaw<{ n: number }[]>`
    INSERT INTO counters (key, year, next_value) VALUES (${key}, ${yearOf(key, year)}, 2)
    ON CONFLICT (key, year) DO UPDATE SET next_value = counters.next_value + 1
    RETURNING next_value - 1 AS n`;
  const s = await getSettings(c);
  const prefix = ({ job: s.prefixJob, quote: s.prefixQuote, invoice: s.prefixInvoice, request: 'SR-', credit: 'CN-', certificate: 'CERT-' })[key].replace(/-+$/, '');
  return key === 'request' ? `${prefix}-${n}` : `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

/** Import ops: empty the counters, then start each one above the highest number already in use. */
export function counterOps(numbers: Partial<Record<NumberKey, string[]>>) {
  const max = new Map<string, { key: NumberKey; year: number; n: number }>();
  for (const key of KEYS) {
    for (const num of numbers[key] ?? []) {
      const m = num.match(/^[A-Za-z]+-(?:(\d{4})-)?(\d+)$/);
      if (!m || (key !== 'request' && !m[1])) continue;
      const year = key === 'request' ? 0 : Number(m[1]), id = `${key}:${year}`;
      max.set(id, { key, year, n: Math.max(max.get(id)?.n ?? 0, Number(m[2])) });
    }
  }
  return [prisma.counter.deleteMany(), prisma.counter.createMany({ data: [...max.values()].map((c) => ({ key: c.key, year: c.year, nextValue: c.n + 1 })) })];
}

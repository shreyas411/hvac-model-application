import { db } from './store.js';

// ponytail: in-memory counters; become a `counters` row incremented via UPDATE ... RETURNING in the create transaction.
const counters = new Map<string, number>();
const slot = (key: string, year: number) => `${key}:${year}`;

export type NumberKey = 'job' | 'quote' | 'invoice' | 'request';
const prefixes = (): Record<NumberKey, string> => ({
  job: db.settings.prefixJob, quote: db.settings.prefixQuote, invoice: db.settings.prefixInvoice, request: 'SR-',
});

export function nextNumber(key: NumberKey, now = new Date()): string {
  const year = now.getUTCFullYear();
  const k = slot(key, key === 'request' ? 0 : year);
  const n = (counters.get(k) ?? 0) + 1;
  counters.set(k, n);
  const prefix = prefixes()[key].replace(/-+$/, '');
  return key === 'request' ? `${prefix}-${n}` : `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

/** Bump counters above every number already in use (after an import). */
export function seedCounters(numbers: Partial<Record<NumberKey, string[]>>) {
  for (const [key, list] of Object.entries(numbers) as [NumberKey, string[]][]) {
    for (const num of list) {
      const m = num.match(/^[A-Za-z]+-(?:(\d{4})-)?(\d+)$/);
      if (!m) continue;
      const k = slot(key, key === 'request' ? 0 : Number(m[1]));
      counters.set(k, Math.max(counters.get(k) ?? 0, Number(m[2])));
    }
  }
}
export const resetCounters = () => counters.clear();

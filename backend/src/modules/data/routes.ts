import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { resetCounters, seedCounters } from '../../common/numbering.js';
import { db } from '../../common/store.js';

// Maps the frontend's exportDataJson keys onto repos. Old ids are kept as ids (they're plain strings),
// so foreign keys stay valid without a mapping table.
const repos = {
  technicians: db.technicians, customers: db.customers, equipment: db.equipment, serviceRequests: db.requests,
  jobs: db.jobs, quotations: db.quotations, invoices: db.invoices, parts: db.parts,
  inventoryMovements: db.movements, notifications: db.notifications,
} as const;
const rows = z.array(z.object({ id: z.string().min(1) }).passthrough());
const payload = z.object({ settings: z.record(z.unknown()).optional(), ...Object.fromEntries(Object.keys(repos).map((k) => [k, rows.optional()])) })
  .passthrough()
  .refine((d) => d.customers && d.jobs, { message: 'customers and jobs are required' });

export const dataRouter = Router();
dataRouter.use(allow('admin'));
dataRouter.get('/export', h(() => ({
  settings: db.settings,
  ...Object.fromEntries(Object.entries(repos).map(([k, r]) => [k, r.all()])),
  exportedAt: new Date().toISOString(),
})));

/** Replaces the data for every key present in the payload. Validated up front, so a bad file writes nothing. */
dataRouter.post('/import', h((req) => {
  const data = payload.parse(req.body) as Record<string, any>;
  resetCounters();
  if (data.settings) Object.assign(db.settings, data.settings);
  const counts: Record<string, number> = {};
  for (const [key, repo] of Object.entries(repos)) {
    if (!data[key]) continue;
    (repo as any).clear();
    for (const row of [...data[key]].reverse()) (repo as any).insert(row); // payload is newest-first
    counts[key] = data[key].length;
  }
  seedCounters({
    job: db.jobs.all().map((j) => j.jobNumber), quote: db.quotations.all().map((q) => q.quoteNumber),
    invoice: db.invoices.all().map((i) => i.invoiceNumber), request: db.requests.all().map((r) => r.requestNumber),
  });
  return { imported: counts };
}));

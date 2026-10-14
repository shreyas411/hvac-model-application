import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { counterOps } from '../../common/numbering.js';
import { prisma } from '../../common/prisma.js';
import { importCustomerOps, listCustomers } from '../customers/service.js';
import { importEquipmentOps, equipmentStore } from '../equipment/service.js';
import { importInvoiceOps, listInvoices } from '../invoices/service.js';
import { importMovementOps, importPartOps, listMovements, partsRepo } from '../inventory/service.js';
import { importJobOps, listJobs } from '../jobs/service.js';
import { importNotificationOps, listNotifications } from '../notifications/service.js';
import { importQuotationOps, listQuotations } from '../quotations/service.js';
import { importRequestOps, requestsRepo } from '../requests/service.js';
import { getSettings, settingsUpdateOp } from '../settings/service.js';
import { settingsSchema } from '../settings/routes.js';
import { importTechnicianOps, techniciansRepo } from '../technicians/service.js';

// Maps the frontend's exportDataJson keys onto the stores. Old ids are remapped to new uuids (kept in `legacy_id`), including
// every reference between records.
const keys = ['technicians', 'customers', 'parts', 'equipment', 'serviceRequests', 'jobs', 'inventoryMovements', 'quotations', 'invoices', 'notifications'] as const;
const rows = z.array(z.object({ id: z.string().min(1) }).passthrough());
const payload = z.object({ settings: z.record(z.unknown()).optional(), ...Object.fromEntries(keys.map((k) => [k, rows.optional()])) })
  .passthrough()
  .refine((d) => d.customers && d.jobs, { message: 'customers and jobs are required' });

export const dataRouter = Router();
dataRouter.use(allow('admin'));
dataRouter.get('/export', h(async () => ({
  settings: await getSettings(),
  technicians: await techniciansRepo.all(),
  customers: await listCustomers(),
  parts: await partsRepo.all(),
  equipment: await equipmentStore.all(),
  serviceRequests: await requestsRepo.all(),
  jobs: await listJobs(),
  inventoryMovements: await listMovements(),
  quotations: await listQuotations(),
  invoices: await listInvoices(),
  notifications: await listNotifications(),
  exportedAt: new Date().toISOString(),
})));

/**
 * Replaces everything: customers, jobs and all that hangs off them (equipment, requests, movements, quotations, invoices,
 * notifications) are always replaced, so a key missing from the file empties that collection. Parts, technicians and settings
 * are only replaced when present. One transaction, so a bad file writes nothing.
 */
dataRouter.post('/import', h(async (req) => {
  const data = payload.parse(req.body) as Record<string, any>;
  const settings = data.settings && settingsSchema.parse(data.settings);
  const nulled = req.query.nullDangling === 'true' ? ([] as string[]) : undefined; // spec §9.4: report, then null
  const ids = new Map<string, string>();
  // These point at each other, so their ids exist before any of them is built.
  for (const k of ['equipment', 'serviceRequests', 'jobs', 'quotations', 'invoices']) for (const r of data[k] ?? []) ids.set(r.id, randomUUID());

  const tech = data.technicians && (await importTechnicianOps(data.technicians, ids));
  const cust = importCustomerOps(data.customers, ids);
  const parts = data.parts && importPartOps(data.parts, ids);
  const equipment = importEquipmentOps(data.equipment ?? [], ids, nulled);
  const requests = importRequestOps(data.serviceRequests ?? [], ids);
  const jobs = importJobOps(data.jobs, ids);
  const movements = importMovementOps(data.inventoryMovements ?? [], ids);
  const quotations = importQuotationOps(data.quotations ?? [], ids);
  const invoices = importInvoiceOps(data.invoices ?? [], ids);
  const notifications = importNotificationOps(data.notifications ?? [], ids);

  await prisma.$transaction([
    notifications.wipe, ...invoices.wipe, quotations.wipe, movements.wipe, jobs.wipe, requests.wipe, equipment.wipe,
    ...(parts ? [parts.wipe] : []), cust.wipe, ...(tech ? [tech.wipe] : []),
    ...(tech?.create ?? []), ...cust.create, ...(parts?.create ?? []), ...equipment.create, ...requests.create, ...jobs.create, ...requests.link,
    ...equipment.records, ...movements.create, ...quotations.create, ...invoices.create, ...quotations.link, ...notifications.create,
    ...(settings ? [settingsUpdateOp(settings)] : []),
    ...counterOps({
      job: data.jobs.map((j: any) => j.jobNumber), quote: data.quotations?.map((q: any) => q.quoteNumber),
      invoice: data.invoices?.map((i: any) => i.invoiceNumber), request: data.serviceRequests?.map((r: any) => r.requestNumber),
    }),
  ]);
  return { imported: Object.fromEntries(keys.filter((k) => data[k]).map((k) => [k, data[k].length])), ...(nulled?.length && { nulledReferences: nulled }) };
}));

import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { bulk, bulkIds } from '../../common/bulk.js';
import { crud } from '../../common/crud.js';
import { prisma, prismaRepo } from '../../common/prisma.js';
import { h, unprocessable } from '../../common/errors.js';
import { isoDate, patch } from '../../common/zod.js';
import { customFieldsInput, withCustomFields } from '../custom-fields/routes.js';
import { assertLocation } from '../customers/service.js';
import { getEquipment } from '../equipment/service.js';

const agreement = z.object({
  customerId: z.string().uuid(), locationId: z.string().uuid(), equipmentId: z.string().uuid().nullish(),
  frequency: z.enum(['quarterly', 'biannual', 'annual']), nextDueDate: isoDate, active: z.boolean().default(true), notes: z.string().optional(),
  annualPrice: z.number().min(0).max(1e7).default(0), endDate: isoDate.nullish(), slaResponseHours: z.number().int().min(1).max(8760).nullish(), autoInvoice: z.boolean().default(false), autoRenew: z.boolean().default(false),
  customFields: customFieldsInput,
});
type Row = z.infer<typeof agreement> & { id: string };
const repo = prismaRepo<Row>(prisma.maintenanceAgreement, ['updatedAt']);
const dates = (d: any) => ({ ...d, ...(d.nextDueDate && { nextDueDate: new Date(d.nextDueDate) }), ...(d.endDate && { endDate: new Date(d.endDate) }) });

const check = (m: { autoRenew?: boolean; autoInvoice?: boolean; annualPrice?: number; endDate?: string | null; nextDueDate?: string }) => {
  if (m.autoRenew && !m.endDate) throw unprocessable('NO_TERM', 'Auto-renew needs a term end date');
  if (m.autoInvoice && !(m.annualPrice! > 0)) throw unprocessable('NO_PRICE', 'Auto-invoicing needs an annual price');
  if (m.endDate && m.nextDueDate && m.endDate.slice(0, 10) < m.nextDueDate.slice(0, 10)) throw unprocessable('BAD_TERM', 'Term end is before the next due date');
};

// Staff manage agreements; the daily sweep (worker) turns them into jobs.
const crudRouter = crud<Row>({
  repo, label: 'Maintenance agreement', read: ['admin', 'dispatcher', 'accountant'], write: ['admin', 'dispatcher'], del: true,
  create: agreement, update: patch(agreement), page: (q) => repo.page(q, ['notes', 'frequency']),
  beforeCreate: async (d) => (check(d), await assertLocation(d.customerId, d.locationId), d.equipmentId && (await getEquipment(d.equipmentId)), dates(d)),
  beforeUpdate: async (cur, d) => {
    const m = { ...cur, ...d };
    check(m);
    await assertLocation(m.customerId, m.locationId);
    if (d.equipmentId) await getEquipment(d.equipmentId);
    return dates(d);
  },
});

const staff = allow('admin', 'dispatcher');
export const maintenanceRouter = Router();
maintenanceRouter.use(withCustomFields('maintenance'));
maintenanceRouter.post('/bulk-update', staff, h((req) => {
  const b = z.object({ ids: bulkIds, active: z.boolean() }).parse(req.body);
  return bulk(b.ids, (id) => repo.update(id, { active: b.active }));
}));
maintenanceRouter.post('/bulk-delete', staff, h((req) => bulk(z.object({ ids: bulkIds }).parse(req.body).ids, (id) => repo.remove(id))));
maintenanceRouter.use(crudRouter);

import { z } from 'zod';
import { crud } from '../../common/crud.js';
import { prisma, prismaRepo } from '../../common/prisma.js';
import { isoDate } from '../../common/zod.js';
import { assertLocation } from '../customers/service.js';
import { getEquipment } from '../equipment/service.js';

const agreement = z.object({
  customerId: z.string().uuid(), locationId: z.string().uuid(), equipmentId: z.string().uuid().nullish(),
  frequency: z.enum(['quarterly', 'biannual', 'annual']), nextDueDate: isoDate, active: z.boolean().default(true), notes: z.string().optional(),
});
type Row = z.infer<typeof agreement> & { id: string };
const repo = prismaRepo<Row>(prisma.maintenanceAgreement, ['updatedAt']);
const dates = (d: any) => ({ ...d, ...(d.nextDueDate && { nextDueDate: new Date(d.nextDueDate) }) });

// Staff manage agreements; the daily sweep (worker) turns them into jobs.
export const maintenanceRouter = crud<Row>({
  repo, label: 'Maintenance agreement', read: ['admin', 'dispatcher', 'accountant'], write: ['admin', 'dispatcher'], del: true,
  create: agreement, update: agreement.partial(), page: (q) => repo.page(q, ['notes', 'frequency']),
  beforeCreate: async (d) => (await assertLocation(d.customerId, d.locationId), d.equipmentId && (await getEquipment(d.equipmentId)), dates(d)),
  beforeUpdate: async (cur, d) => {
    const m = { ...cur, ...d };
    await assertLocation(m.customerId, m.locationId);
    if (d.equipmentId) await getEquipment(d.equipmentId);
    return dates(d);
  },
});

import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { crud } from '../../common/crud.js';
import { h } from '../../common/errors.js';
import { plain, prisma, prismaRepo } from '../../common/prisma.js';
import type { ChecklistTemplate } from '../../types.js';

const jobType = z.enum(['installation', 'repair', 'inspection', 'emergency_callout', 'preventive_maintenance']);
const template = z.object({
  jobType, label: z.string().trim().min(1),
  category: z.enum(['gas_safety', 'electrical', 'refrigerant', 'general']).default('general'),
});
const out = (r: object) => plain(r, ['updatedAt', 'createdAt', 'position']) as unknown as ChecklistTemplate;
const base = prismaRepo<ChecklistTemplate>(prisma.checklistTemplate);

// Everyone reads (techs/dispatchers pick from it); only admin edits.
export const checklistsRouter = crud<ChecklistTemplate>({
  repo: {
    ...base,
    all: async () => (await prisma.checklistTemplate.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })).map(out),
    // new items go to the end of their job type
    insert: async (data: z.infer<typeof template>) => {
      const { _max } = await prisma.checklistTemplate.aggregate({ where: { jobType: data.jobType }, _max: { position: true } });
      return out(await prisma.checklistTemplate.create({ data: { ...data, position: (_max.position ?? 0) + 1 } }));
    },
  },
  label: 'Checklist template', read: ['admin', 'dispatcher', 'technician', 'accountant'], write: ['admin'],
  create: template, update: template.pick({ label: true, category: true }).partial().extend({ inactive: z.boolean().optional() }).strict(), del: true,
});

// Body: ids in the desired order (one job type's list); position = index.
checklistsRouter.post('/reorder', allow('admin'), h(async (req) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);
  await prisma.$transaction(ids.map((id, position) => prisma.checklistTemplate.updateMany({ where: { id }, data: { position } })));
}, 204));

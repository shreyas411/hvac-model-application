import { z } from 'zod';
import { patch } from '../../common/zod.js';
import { crud } from '../../common/crud.js';
import { prisma, prismaRepo } from '../../common/prisma.js';
import { conflict } from '../../common/errors.js';
import type { User } from '../../types.js';

const user = z.object({
  id: z.string().uuid().describe('Supabase auth.users.id'),
  name: z.string().min(1), email: z.string().email(), phone: z.string().default(''),
  role: z.enum(['admin', 'dispatcher', 'technician', 'accountant']),
  avatar: z.string().optional(), technicianId: z.string().uuid().optional(), inactive: z.boolean().optional(),
});

const repo = prismaRepo<User>(prisma.user, ['createdAt', 'updatedAt']);
/** Never delete the last admin: nobody could manage users afterwards. */
const remove = async (id: string) => {
  const target = await repo.find(id);
  if (target?.role === 'admin' && (await prisma.user.count({ where: { role: 'admin' } })) <= 1) throw conflict('LAST_ADMIN', 'Cannot delete the last admin');
  return repo.remove(id);
};

export const usersRouter = crud({
  repo: { ...repo, remove }, label: 'User', read: ['admin'], write: ['admin'], del: true,
  create: user, update: patch(user.omit({ id: true })),
});

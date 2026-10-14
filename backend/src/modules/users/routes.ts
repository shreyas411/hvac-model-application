import { z } from 'zod';
import { crud } from '../../common/crud.js';
import { prisma, prismaRepo } from '../../common/prisma.js';
import type { User } from '../../types.js';

const user = z.object({
  id: z.string().uuid().describe('Supabase auth.users.id'),
  name: z.string().min(1), email: z.string().email(), phone: z.string().default(''),
  role: z.enum(['admin', 'dispatcher', 'technician', 'accountant']),
  avatar: z.string().optional(), technicianId: z.string().uuid().optional(),
});

export const usersRouter = crud({
  repo: prismaRepo<User>(prisma.user, ['createdAt', 'updatedAt']), label: 'User', read: ['admin'], write: ['admin'], del: true,
  create: user, update: user.omit({ id: true }).partial(),
});

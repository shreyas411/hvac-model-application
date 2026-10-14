import { z } from 'zod';
import { crud } from '../../common/crud.js';
import { db } from '../../common/store.js';

const user = z.object({
  id: z.string().min(1).describe('Supabase auth.users.id'),
  name: z.string().min(1), email: z.string().email(), phone: z.string().default(''),
  role: z.enum(['admin', 'dispatcher', 'technician', 'accountant']),
  avatar: z.string().optional(), technicianId: z.string().optional(),
});

export const usersRouter = crud({
  repo: db.users, label: 'User', read: ['admin'], write: ['admin'], del: true,
  create: user, update: user.omit({ id: true }).partial(),
});

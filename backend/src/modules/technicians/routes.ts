import { z } from 'zod';
import { crud } from '../../common/crud.js';
import { techniciansRepo } from './service.js';

const tech = z.object({
  name: z.string().min(1), phone: z.string().min(1), email: z.string().email(),
  gasSafeLicense: z.string().optional(), fGasLicense: z.string().optional(),
  skills: z.array(z.string()).default([]), color: z.string().default('#0ea5e9'),
  active: z.boolean().default(true), vanRegistration: z.string().optional(),
});

// No delete: jobs reference technicians; deactivate with `active: false`.
export const techniciansRouter = crud({
  repo: techniciansRepo, label: 'Technician',
  read: ['admin', 'dispatcher', 'technician', 'accountant'], write: ['admin', 'dispatcher'],
  create: tech, update: tech.partial(),
});

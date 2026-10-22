import { z } from 'zod';
import { Router } from 'express';
import { crud } from '../../common/crud.js';
import { forbidden, h, notFound } from '../../common/errors.js';
import { techniciansRepo } from './service.js';

const tech = z.object({
  name: z.string().min(1), phone: z.string().min(1), email: z.string().email(),
  gasSafeLicense: z.string().optional(), fGasLicense: z.string().optional(),
  gasSafeExpiry: z.string().date().optional(), fGasExpiry: z.string().date().optional(),
  skills: z.array(z.string()).default([]), color: z.string().default('#0ea5e9'),
  active: z.boolean().default(true), vanRegistration: z.string().optional(),
});

// Delete is refused (422 INVALID_REFERENCE) while jobs/certificates still reference the technician; deactivate with `active: false` instead.
// Prisma wants Date objects for @db.Date columns.
const dates = (d: any) => ({ ...d, ...(d.gasSafeExpiry && { gasSafeExpiry: new Date(d.gasSafeExpiry) }), ...(d.fGasExpiry && { fGasExpiry: new Date(d.fGasExpiry) }) });
const base = crud({
  repo: techniciansRepo, label: 'Technician',
  read: ['admin', 'dispatcher', 'technician', 'accountant'], write: ['admin', 'dispatcher'], del: true,
  create: tech, update: tech.partial(), beforeCreate: dates, beforeUpdate: (_cur, d) => dates(d),
});

// A technician sees only their own profile (phone, email and licence numbers of colleagues stay private).
export const techniciansRouter = Router();
techniciansRouter.get(['/', '/:id'], (req, res, next) => {
  if (req.user.role !== 'technician') return next();
  const own = req.user.technicianId ? techniciansRepo.find(req.user.technicianId) : Promise.resolve(undefined);
  h(async () => {
    const t = await own;
    if (req.params.id && req.params.id !== t?.id) throw notFound('Technician');
    return req.params.id ? t : { data: t ? [t] : [], nextCursor: null };
  })(req, res, next);
});
// Licence numbers and expiry dates are what the job-assignment guard trusts, so only an admin may set them.
const LICENCE_FIELDS = ['gasSafeLicense', 'gasSafeExpiry', 'fGasLicense', 'fGasExpiry'];
techniciansRouter.use((req, _res, next) => {
  const touches = req.method !== 'GET' && req.body && LICENCE_FIELDS.some((k) => k in req.body);
  next(touches && req.user.role !== 'admin' ? forbidden('Only an admin can change Gas Safe and F-Gas details') : undefined);
});
techniciansRouter.use(base);

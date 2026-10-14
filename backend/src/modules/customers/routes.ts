import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { crud } from '../../common/crud.js';
import { h } from '../../common/errors.js';
import { db } from '../../common/store.js';
import * as svc from './service.js';

const location = z.object({
  label: z.string().min(1), addressLine1: z.string().min(1), addressLine2: z.string().optional(),
  city: z.string().min(1), postcode: z.string().min(1),
  accessNotes: z.string().optional(), contactName: z.string().optional(), contactPhone: z.string().optional(),
});
const customer = z.object({
  type: z.enum(['residential', 'commercial']), name: z.string().min(1), companyName: z.string().optional(),
  phone: z.string().min(1), email: z.string().email(),
  billingAddress: z.object({ line1: z.string().min(1), line2: z.string().optional(), city: z.string().min(1), postcode: z.string().min(1) }),
  serviceLocations: z.array(location).default([]),
  notes: z.string().optional(),
  communicationPreference: z.enum(['email', 'sms', 'both']).default('email'),
  gdprConsent: z.boolean().default(false),
});

const rw = allow('admin', 'dispatcher');
export const customersRouter = Router();
// Declared before crud so create assigns location ids. No delete: archive instead.
customersRouter.post('/', rw, h((req) => svc.createCustomer({ ...customer.parse(req.body), archived: false }), 201));
customersRouter.post('/:id/archive', rw, h((req) => svc.setArchived(req.params.id, true)));
customersRouter.post('/:id/unarchive', rw, h((req) => svc.setArchived(req.params.id, false)));
customersRouter.post('/:id/locations', rw, h((req) => svc.addLocation(req.params.id, location.parse(req.body)), 201));
customersRouter.patch('/:id/locations/:locId', rw, h((req) => svc.updateLocation(req.params.id, req.params.locId, location.partial().parse(req.body))));
customersRouter.delete('/:id/locations/:locId', rw, h((req) => svc.removeLocation(req.params.id, req.params.locId)));
customersRouter.use(crud({
  repo: db.customers, label: 'Customer', read: ['admin', 'dispatcher', 'accountant'], write: ['admin', 'dispatcher'],
  create: customer, update: customer.omit({ serviceLocations: true }).partial(),
}));

import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { paginate } from '../../common/paginate.js';
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
// No delete: archive instead.
customersRouter.post('/', rw, h((req) => svc.createCustomer({ ...customer.parse(req.body), archived: false }), 201));
customersRouter.post('/:id/archive', rw, h((req) => svc.setArchived(req.params.id, true)));
customersRouter.post('/:id/unarchive', rw, h((req) => svc.setArchived(req.params.id, false)));
customersRouter.post('/:id/locations', rw, h((req) => svc.addLocation(req.params.id, location.parse(req.body)), 201));
customersRouter.patch('/:id/locations/:locId', rw, h((req) => svc.updateLocation(req.params.id, req.params.locId, location.partial().parse(req.body))));
customersRouter.delete('/:id/locations/:locId', rw, h((req) => svc.removeLocation(req.params.id, req.params.locId)));
const read = allow('admin', 'dispatcher', 'accountant');
customersRouter.get('/', read, h(async (req) => paginate(await svc.listCustomers(), req.query)));
customersRouter.get('/:id', read, h((req) => svc.getCustomer(req.params.id)));
customersRouter.patch('/:id', rw, h((req) => svc.updateCustomer(req.params.id, customer.omit({ serviceLocations: true }).partial().parse(req.body))));

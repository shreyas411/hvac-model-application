import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { prisma, removeRecord } from '../../common/prisma.js';
import { paginate } from '../../common/paginate.js';
import { ukPostcode } from '../../common/zod.js';
import * as svc from './service.js';

const phone = z.string().regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a valid phone number');
const text = z.string().regex(/[A-Za-z0-9]/, 'Required');
const location = z.object({
  label: z.string().min(1), addressLine1: text, addressLine2: z.string().optional(),
  city: text, postcode: ukPostcode,
  accessNotes: z.string().optional(), inactive: z.boolean().optional(), contactName: z.string().optional(), contactPhone: phone.optional(),
});
const customer = z.object({
  type: z.enum(['residential', 'commercial', 'landlord']), name: z.string().min(1), companyName: z.string().optional(),
  phone, email: z.string().trim().toLowerCase().email(),
  billingAddress: z.object({ line1: text, line2: z.string().optional(), city: text, postcode: ukPostcode }),
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
customersRouter.delete('/:id', allow('admin'), h((req) => removeRecord(prisma.customer, req.params.id, 'Customer', async (c) => {
  const where = { customerId: c.id };
  return (await Promise.all([prisma.job.count({ where }), prisma.quotation.count({ where }), prisma.invoice.count({ where }), prisma.serviceRequest.count({ where }), prisma.equipment.count({ where })])).some(Boolean) && 'Customer still has jobs, quotes, invoices, requests or equipment';
})));
const read = allow('admin', 'dispatcher', 'accountant');
customersRouter.get('/', read, h((req) => svc.pageCustomers(req.query)));
customersRouter.get('/:id', read, h((req) => svc.getCustomer(req.params.id)));
customersRouter.patch('/:id', rw, h((req) => svc.updateCustomer(req.params.id, customer.omit({ serviceLocations: true }).partial().parse(req.body))));

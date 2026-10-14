import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { paginate } from '../../common/paginate.js';
import { db } from '../../common/store.js';
import { hhmm, isoDate, priority } from '../../common/zod.js';
import * as svc from './service.js';

const request = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1), equipmentId: z.string().optional(),
  reportedProblem: z.string().min(1), priority: priority.default('medium'),
  preferredSlot: z.enum(['morning', 'afternoon', 'all_day', 'urgent']).default('all_day'),
  status: z.enum(['new', 'awaiting_approval']).default('new'),
  contactPerson: z.string().optional(), contactPhone: z.string().optional(), internalNotes: z.string().optional(),
});
const convert = z.object({ appointmentDate: isoDate, startTime: hhmm, endTime: hhmm, technicianId: z.string().nullable().optional() });

export const requestsRouter = Router();
requestsRouter.use(allow('admin', 'dispatcher'));
requestsRouter.get('/', h((req) => paginate(db.requests.all(), req.query)));
requestsRouter.get('/:id', h((req) => svc.getRequest(req.params.id)));
requestsRouter.post('/', h((req) => svc.createRequest(request.parse(req.body)), 201));
requestsRouter.patch('/:id', h((req) => {
  const r = svc.getRequest(req.params.id);
  return db.requests.update(r.id, request.partial().extend({ status: z.enum(['new', 'awaiting_approval', 'cancelled']).optional() }).parse(req.body));
}));
requestsRouter.post('/:id/convert', h((req) => svc.convertToJob(req.params.id, convert.parse(req.body), actor(req)), 201));

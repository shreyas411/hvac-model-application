import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { prisma, removeRecord } from '../../common/prisma.js';
import { paginate } from '../../common/paginate.js';
import { hhmm, isoDate, priority } from '../../common/zod.js';
import { bulk, bulkIds } from '../../common/bulk.js';
import { customFieldsInput, withCustomFields } from '../custom-fields/routes.js';
import * as svc from './service.js';

const request = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1), equipmentId: z.string().optional(),
  reportedProblem: z.string().min(1), priority: priority.default('medium'),
  preferredSlot: z.enum(['morning', 'afternoon', 'all_day', 'urgent']).default('all_day'),
  status: z.enum(['new', 'awaiting_approval']).default('new'),
  contactPerson: z.string().optional(), contactPhone: z.string().optional(), internalNotes: z.string().optional(),
  customFields: customFieldsInput,
});
const convert = z.object({ appointmentDate: isoDate, startTime: hhmm, endTime: hhmm, technicianId: z.string().nullable().optional() });

export const requestsRouter = Router();
requestsRouter.use(allow('admin', 'dispatcher'));
requestsRouter.use(withCustomFields('request'));
requestsRouter.get('/', h((req) => svc.pageRequests(req.query)));
requestsRouter.get('/:id', h((req) => svc.getRequest(req.params.id)));
requestsRouter.delete('/:id', allow('admin'), h((req) => removeRecord(prisma.serviceRequest, req.params.id, 'Service request', (r) => r.status === 'converted' && 'A converted request is part of its job history')));
requestsRouter.post('/', h((req) => svc.createRequest(request.parse(req.body)), 201));
requestsRouter.patch('/:id', h((req) =>
  svc.updateRequest(req.params.id, request.partial().extend({ status: z.enum(['new', 'awaiting_approval', 'cancelled']).optional() }).parse(req.body))));
requestsRouter.post('/bulk-cancel', h((req) => bulk(z.object({ ids: bulkIds }).parse(req.body).ids, (id) => svc.updateRequest(id, { status: 'cancelled' }))));
requestsRouter.post('/:id/convert', h((req) => svc.convertToJob(req.params.id, convert.parse(req.body), actor(req)), 201));

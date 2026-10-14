import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { paginate } from '../../common/paginate.js';
import { hhmm, isoDate, lineItems } from '../../common/zod.js';
import * as svc from './service.js';

const base = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1), jobId: z.string().optional(),
  issueDate: isoDate, expiryDate: isoDate, items: lineItems.min(1),
  vatRatePercent: z.number().min(0).max(100).optional(), terms: z.string().optional(), notes: z.string().optional(),
});
const quotation = base.refine((q) => q.expiryDate >= q.issueDate, { message: 'expiryDate must not precede issueDate', path: ['expiryDate'] });
const slot = z.object({ appointmentDate: isoDate, startTime: hhmm, endTime: hhmm, technicianId: z.string().nullable().optional() });

export const quotationsRouter = Router();
quotationsRouter.use(allow('admin', 'dispatcher', 'accountant'));
quotationsRouter.get('/', h(async (req) => paginate(await svc.listQuotations(), req.query)));
quotationsRouter.get('/:id', h((req) => svc.getQuotation(req.params.id)));
quotationsRouter.post('/', h((req) => svc.createQuotation(quotation.parse(req.body)), 201));
quotationsRouter.patch('/:id', h((req) => svc.updateQuotation(req.params.id, base.partial().parse(req.body))));
quotationsRouter.post('/:id/send', h((req) => svc.send(req.params.id)));
quotationsRouter.post('/:id/reject', h((req) => svc.reject(req.params.id)));
quotationsRouter.post('/:id/accept', h((req) => svc.accept(req.params.id, z.object({ acceptedBy: z.string().min(1) }).parse(req.body).acceptedBy)));
// Creating a job is dispatch work; invoicing is accounts work.
quotationsRouter.post('/:id/convert-to-job', allow('admin', 'dispatcher'), h((req) => svc.convertToJob(req.params.id, slot.parse(req.body), actor(req)), 201));
quotationsRouter.post('/:id/convert-to-invoice', allow('admin', 'accountant'), h((req) => svc.convertToInvoice(req.params.id), 201));

import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { prisma, removeRecord } from '../../common/prisma.js';
import { hhmm, isoDate, lineItems } from '../../common/zod.js';
import { generateQuotationPdf } from './pdf.service.js';
import * as svc from './service.js';

const base = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1), jobId: z.string().optional(),
  issueDate: isoDate, expiryDate: isoDate, items: z.array(lineItems.element.extend({ option: z.string().trim().min(1).max(40).optional() })).min(1),
  vatRatePercent: z.number().min(0).max(100).optional(), terms: z.string().optional(), notes: z.string().optional(),
});
const quotation = base.refine((q) => q.expiryDate >= q.issueDate, { message: 'expiryDate must not precede issueDate', path: ['expiryDate'] });
const slot = z.object({ appointmentDate: isoDate, startTime: hhmm, endTime: hhmm, technicianId: z.string().nullable().optional() });

export const quotationsRouter = Router();
quotationsRouter.use(allow('admin', 'dispatcher', 'accountant'));
quotationsRouter.get('/', h((req) => svc.pageQuotations(req.query)));
quotationsRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const q = await svc.getQuotation(req.params.id);
    res.type('application/pdf').attachment(`${q.quoteNumber}.pdf`).send(Buffer.from(await generateQuotationPdf(q.id)));
  } catch (e) { next(e); }
});
quotationsRouter.get('/:id', h((req) => svc.getQuotation(req.params.id)));
quotationsRouter.post('/', h((req) => svc.createQuotation(quotation.parse(req.body)), 201));
quotationsRouter.patch('/:id', h((req) => svc.updateQuotation(req.params.id, base.partial().parse(req.body))));
quotationsRouter.delete('/:id', allow('admin', 'dispatcher'), h((req) => removeRecord(prisma.quotation, req.params.id, 'Quotation', (q) =>
  (q.status === 'accepted' || q.convertedToJobId || q.convertedToInvoiceId) && 'An accepted or converted quote cannot be deleted')));
quotationsRouter.post('/:id/send', h((req) => svc.send(req.params.id)));
quotationsRouter.post('/:id/reject', h((req) => svc.reject(req.params.id)));
quotationsRouter.post('/:id/accept', h((req) => {
  const { acceptedBy, option } = z.object({ acceptedBy: z.string().min(1), option: z.string().optional() }).parse(req.body);
  return svc.accept(req.params.id, acceptedBy, undefined, option);
}));
// Creating a job is dispatch work; invoicing is accounts work.
quotationsRouter.post('/:id/convert-to-job', allow('admin', 'dispatcher'), h((req) => svc.convertToJob(req.params.id, slot.parse(req.body), actor(req)), 201));
quotationsRouter.post('/:id/convert-to-invoice', allow('admin', 'accountant'), h((req) => svc.convertToInvoice(req.params.id), 201));

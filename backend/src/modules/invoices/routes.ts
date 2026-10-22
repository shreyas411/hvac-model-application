import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { prisma, removeRecord } from '../../common/prisma.js';
import { isoDate, lineItems } from '../../common/zod.js';
import * as svc from './service.js';
import { generateInvoicePdf } from './pdf.service.js';

const invoice = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1), quoteId: z.string().optional(), jobId: z.string().optional(),
  items: lineItems.min(1), vatRatePercent: z.number().min(0).max(100).optional(),
  issueDate: isoDate.optional(), paymentTermsDays: z.number().int().positive().optional(), dueDate: isoDate.optional(),
  notes: z.string().optional(), status: z.enum(['draft', 'issued']).optional(),
  reverseCharge: z.boolean().optional(), cisRatePercent: z.number().min(0).max(100).optional(), retentionPercent: z.number().min(0).max(100).optional(),
});
const payment = z.object({
  date: isoDate, amount: z.number().positive().multipleOf(0.01), method: z.enum(['bacs', 'card', 'cheque', 'cash']),
  reference: z.string().default(''), notes: z.string().optional(),
});

export const invoicesRouter = Router();
invoicesRouter.use(allow('admin', 'accountant'));
invoicesRouter.get('/', h((req) => svc.pageInvoices(req.query)));
invoicesRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const inv = await svc.getInvoice(req.params.id);
    res.type('application/pdf').attachment(`${inv.invoiceNumber}.pdf`).send(Buffer.from(await generateInvoicePdf(inv.id)));
  } catch (e) { next(e); }
});
invoicesRouter.get('/:id', h((req) => svc.getInvoice(req.params.id)));
invoicesRouter.post('/', h((req) => svc.createInvoice(invoice.parse(req.body)), 201));
invoicesRouter.patch('/:id', h((req) => svc.updateInvoice(req.params.id, invoice.omit({ customerId: true, locationId: true, quoteId: true, jobId: true, status: true }).partial().parse(req.body))));
invoicesRouter.post('/stage', h((req) => {
  const b = z.object({ quoteId: z.string().min(1), percent: z.number().positive().max(100).optional(), label: z.string().optional(), final: z.boolean().optional() })
    .refine((x) => x.final || x.percent, 'percent or final required').parse(req.body);
  return svc.createStageInvoice(b.quoteId, b);
}, 201));
invoicesRouter.delete('/:id', allow('admin'), h((req) => removeRecord(prisma.invoice, req.params.id, 'Invoice', async (i) =>
  !['draft', 'void'].includes(i.status) ? 'Only a draft or void invoice can be deleted (void it first)'
    : (await prisma.payment.count({ where: { invoiceId: i.id } })) > 0 && 'Invoice has payments')));
invoicesRouter.post('/:id/issue', h((req) => svc.issueInvoice(req.params.id, actor(req))));
invoicesRouter.post('/:id/payments', h((req) => svc.recordPayment(req.params.id, payment.parse(req.body), actor(req)), 201));
invoicesRouter.post('/:id/release-retention', h((req) => svc.releaseRetention(req.params.id, actor(req))));
invoicesRouter.post('/:id/void', h((req) => svc.voidInvoice(req.params.id, z.object({ reason: z.string().trim().min(3) }).parse(req.body).reason, actor(req))));
invoicesRouter.post('/:id/credit-notes', h((req) => svc.creditInvoice(req.params.id, z.object({ amount: z.number().positive().multipleOf(0.01), reason: z.string().trim().min(3) }).parse(req.body), actor(req)), 201));
invoicesRouter.post('/:id/payments/:paymentId/refund', h((req) => svc.refundPayment(req.params.id, req.params.paymentId, z.object({ reason: z.string().trim().min(3) }).parse(req.body).reason, actor(req))));

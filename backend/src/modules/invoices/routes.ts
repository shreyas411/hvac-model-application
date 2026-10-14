import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { paginate } from '../../common/paginate.js';
import { db } from '../../common/store.js';
import { isoDate, lineItems } from '../../common/zod.js';
import * as svc from './service.js';

const invoice = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1), quoteId: z.string().optional(), jobId: z.string().optional(),
  items: lineItems.min(1), vatRatePercent: z.number().min(0).max(100).optional(),
  issueDate: isoDate.optional(), paymentTermsDays: z.number().int().positive().optional(), dueDate: isoDate.optional(),
  notes: z.string().optional(), status: z.enum(['draft', 'issued']).optional(),
});
const payment = z.object({
  date: isoDate, amount: z.number().positive(), method: z.enum(['bacs', 'card', 'cheque', 'cash']),
  reference: z.string().default(''), notes: z.string().optional(),
});

export const invoicesRouter = Router();
invoicesRouter.use(allow('admin', 'accountant'));
invoicesRouter.get('/', h((req) => paginate(db.invoices.all(), req.query)));
invoicesRouter.get('/:id', h((req) => svc.getInvoice(req.params.id)));
invoicesRouter.post('/', h((req) => svc.createInvoice(invoice.parse(req.body)), 201));
invoicesRouter.patch('/:id', h((req) => svc.updateInvoice(req.params.id, invoice.omit({ customerId: true, locationId: true, quoteId: true, jobId: true, status: true }).partial().parse(req.body))));
invoicesRouter.post('/:id/issue', h((req) => svc.issueInvoice(req.params.id)));
invoicesRouter.post('/:id/payments', h((req) => svc.recordPayment(req.params.id, payment.parse(req.body), actor(req)), 201));
invoicesRouter.post('/:id/void', h((req) => svc.voidInvoice(req.params.id)));

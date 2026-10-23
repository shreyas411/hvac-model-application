import { Router } from 'express';
import { z } from 'zod';
import { today } from '../../common/dates.js';
import { conflict, h, notFound } from '../../common/errors.js';
import { prisma, runAs, unscoped } from '../../common/prisma.js';
import { getSettings } from '../settings/service.js';
import { accept, getQuotation, hashToken, reject } from './service.js';
import { isInkedPng } from '../../common/signature.js';

/** Customer-facing, no login: the unguessable emailed token is the credential. */
async function byToken(token: string) {
  const row = await prisma.quotation.findUnique({ where: { approvalTokenHash: hashToken(token) }, select: { id: true } });
  if (!row) throw notFound('Quotation');
  return getQuotation(row.id);
}
const open = (q: { status: string; expiryDate: string }) => {
  if (q.expiryDate < today()) throw conflict('EXPIRED', 'This quotation has expired. Please contact us for a new one');
  return q;
};
const decision = z.object({
  name: z.string().trim().min(1).max(120),
  option: z.string().optional(),
  signature: z.string().max(400_000).refine(isInkedPng, 'Signature is empty or not a valid PNG').optional(),
});

export const publicQuotesRouter = Router();
// The token also names the company: everything below runs scoped to it.
publicQuotesRouter.param('token', (_req, _res, next, token) => void unscoped.quotation.findUnique({ where: { approvalTokenHash: hashToken(token) }, select: { companyId: true } })
  .then((q) => (q ? runAs(q.companyId, () => next()) : next(notFound('Quotation'))), next));
publicQuotesRouter.get('/:token', h(async (req) => {
  const q = await byToken(req.params.token);
  if (q.status === 'sent') await prisma.quotation.updateMany({ where: { id: q.id, status: 'sent' }, data: { status: 'viewed' } });
  const { id, customerId, locationId, jobId, convertedToJobId, convertedToInvoiceId, ...view } = q;
  return { ...view, status: q.status === 'sent' ? 'viewed' : q.status, companyName: (await getSettings()).companyName };
}));
publicQuotesRouter.post('/:token/accept', h(async (req) => {
  const q = open(await byToken(req.params.token)) as Awaited<ReturnType<typeof byToken>>;
  const { name, signature, option } = decision.parse(req.body);
  await accept(q.id, name, signature, option);
  return { status: 'accepted' };
}));
publicQuotesRouter.post('/:token/reject', h(async (req) => {
  await reject((await byToken(req.params.token)).id);
  return { status: 'rejected' };
}));

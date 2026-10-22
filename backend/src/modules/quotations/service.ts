import type { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../../config.js';
import { emailBookingConfirmed, emailQuotationReady } from '../notifications/templates.js';
import type { Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, notFound } from '../../common/errors.js';
import { audit } from '../../common/audit.js';
import { isPast, toMinutes, today } from '../../common/dates.js';
import { pageFrom } from '../../common/paginate.js';
import { totals } from '../../common/money.js';
import { nextNumber } from '../../common/numbering.js';
import { date, isUuid, lockRow, plain, prisma, refer, type Tx } from '../../common/prisma.js';
import { getSettings } from '../settings/service.js';
import { assertLocation } from '../customers/service.js';
import { fromQuotation, lineImport, lineRows, type ItemInput } from '../invoices/service.js';
import { createJob, getJob } from '../jobs/service.js';

const include = { items: { orderBy: { position: 'asc' } } } satisfies Prisma.QuotationInclude;
type Row = Prisma.QuotationGetPayload<{ include: typeof include }>;

const toQuotation = ({ legacyId, items, acceptedSignature, approvalTokenHash, ...q }: Row) => ({
  ...plain(q, [], ['issueDate', 'expiryDate']),
  expired: q.status === 'expired' || (['draft', 'sent', 'viewed'].includes(q.status) && isPast(q.expiryDate)),
  items: items.map(({ quotationId, invoiceId, position, ...x }) => plain(x)),
}) as unknown as Quotation;

export async function getQuotation(id: string, c: Tx = prisma) {
  const row = isUuid(id) ? await c.quotation.findUnique({ where: { id }, include }) : null;
  if (!row) throw notFound('Quotation');
  return toQuotation(row);
}
export const pageQuotations = (query: unknown) => pageFrom(query, prisma.quotation, { include, searchFields: ['quoteNumber', 'notes'], sorts: ['issueDate', 'expiryDate', 'total', 'status', 'customer.name'] }, toQuotation);
export const listQuotations = async () => (await prisma.quotation.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toQuotation);

type Input = {
  customerId: string; locationId: string; jobId?: string; issueDate: string; expiryDate: string;
  items: ItemInput[]; vatRatePercent?: number; terms?: string; notes?: string;
};

/** Lines with an `option` are alternatives (Good/Better/Best); stored totals cover the shared lines plus the cheapest option. */
const priced = async (items: ItemInput[], vatRatePercent?: number) => {
  const rows = lineRows(items);
  const vat = vatRatePercent ?? (await getSettings()).defaultVatRate;
  const tiers: Record<string, typeof rows> = {};
  for (const r of rows) if (r.option) (tiers[r.option] ??= []).push(r);
  const cheapest = Object.values(tiers).sort((a, b) => totals(a, vat).subtotal - totals(b, vat).subtotal)[0] ?? [];
  return { rows, vatRatePercent: vat, ...totals([...rows.filter((r) => !r.option), ...cheapest], vat) };
};

export async function createQuotation(i: Input) {
  await assertLocation(i.customerId, i.locationId);
  if (i.jobId) await getJob(i.jobId);
  const { rows, ...p } = await priced(i.items, i.vatRatePercent);
  return toQuotation(await prisma.$transaction(async (tx) => tx.quotation.create({
    include,
    data: {
      quoteNumber: await nextNumber('quote', new Date(), tx), customerId: i.customerId, locationId: i.locationId, jobId: i.jobId,
      issueDate: new Date(i.issueDate), expiryDate: new Date(i.expiryDate), status: 'draft', ...p,
      terms: i.terms ?? (await getSettings()).termsAndConditions, notes: i.notes, items: { create: rows },
    },
  })));
}

export function updateQuotation(id: string, patch: Partial<Input>) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'quotations', id);
    const q = await getQuotation(id, tx);
    if (q.status !== 'draft' && q.status !== 'sent') throw conflict('NOT_EDITABLE', `A ${q.status} quotation cannot be edited`);
    const { items, vatRatePercent, issueDate, expiryDate, ...rest } = patch;
    if (rest.customerId || rest.locationId) await assertLocation(rest.customerId ?? q.customerId, rest.locationId ?? q.locationId);
    if (rest.jobId) await getJob(rest.jobId, tx);
    const repriced = items || vatRatePercent !== undefined ? await priced(items ?? q.items, vatRatePercent ?? q.vatRatePercent) : undefined;
    return toQuotation(await tx.quotation.update({
      where: { id }, include,
      data: {
        ...rest, ...(issueDate && { issueDate: new Date(issueDate) }), ...(expiryDate && { expiryDate: new Date(expiryDate) }),
        ...(repriced && { vatRatePercent: repriced.vatRatePercent, subtotal: repriced.subtotal, vatAmount: repriced.vatAmount, total: repriced.total, items: { deleteMany: {}, create: repriced.rows } }),
      },
    }));
  });
}

/** Conditional UPDATE: only moves from an allowed status, so concurrent transitions can't both win. */
async function move(id: string, from: Quotation['status'][], to: Quotation['status'], extra: Prisma.QuotationUpdateManyMutationInput = {}) {
  const { count } = isUuid(id) ? await prisma.quotation.updateMany({ where: { id, status: { in: from } }, data: { status: to, ...extra } }) : { count: 0 };
  if (!count) {
    const q = await getQuotation(id); // 404 if it doesn't exist
    throw conflict('INVALID_TRANSITION', `Cannot move quotation from ${q.status} to ${to}`);
  }
  return getQuotation(id);
}
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Only the hash is stored; the raw token exists in the customer's emailed link alone. */
export async function send(id: string) {
  const token = randomBytes(32).toString('base64url');
  const q = await move(id, ['draft'], 'sent', { approvalTokenHash: hashToken(token) });
  await emailQuotationReady(q, `${config.appUrl.split(',')[0]}/quote/${token}`);
  return q;
}
export const reject = (id: string) => move(id, ['sent', 'viewed'], 'rejected');
/** With options on the quote, the customer picks one: the other tiers' lines are dropped and totals reprice. */
export function accept(id: string, acceptedBy: string, acceptedSignature?: string, option?: string) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'quotations', id);
    const q = await getQuotation(id, tx);
    if (q.status !== 'sent' && q.status !== 'viewed') throw conflict('INVALID_TRANSITION', `Cannot move quotation from ${q.status} to accepted`);
    const names = new Set(q.items.flatMap((i) => (i.option ? [i.option] : [])));
    if (names.size && !(option && names.has(option))) throw conflict('OPTION_REQUIRED', `Choose one of: ${[...names].join(', ')}`);
    const chosen = names.size ? await priced(q.items.filter((i) => !i.option || i.option === option), q.vatRatePercent) : undefined;
    await audit(tx, 'quotation', id, { id: 'customer', name: `${acceptedBy} (customer)` } as Actor, 'accepted', `${q.quoteNumber}${option ? `, option ${option}` : ''}`);
    return toQuotation(await tx.quotation.update({
      where: { id }, include,
      data: {
        status: 'accepted', acceptedAt: new Date(), acceptedBy, acceptedSignature,
        ...(chosen && { subtotal: chosen.subtotal, vatAmount: chosen.vatAmount, total: chosen.total, items: { deleteMany: {}, create: chosen.rows } }),
      },
    }));
  });
}

function assertConvertible(q: Quotation, already: string | undefined) {
  if (q.status !== 'accepted') throw conflict('NOT_ACCEPTED', 'Quotation must be accepted first');
  if (already) throw conflict('ALREADY_CONVERTED', `${q.quoteNumber} is already converted`);
}

export async function convertToJob(id: string, slot: { appointmentDate: string; startTime: string; endTime: string; technicianId?: string | null }, who: Actor) {
  const result = await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'quotations', id);
    const q = await getQuotation(id, tx);
    assertConvertible(q, q.convertedToJobId ?? q.convertedToInvoiceId);
    const rates = await getSettings();
    const labourHours = q.items.filter((i) => i.type === 'labour').reduce((a, l) => a + l.quantity, 0) || 4;
    const job = await createJob({
      customerId: q.customerId, locationId: q.locationId, equipmentIds: [], type: 'installation', priority: 'medium',
      technicianId: slot.technicianId || null, ...slot,
      estimatedDurationMinutes: Math.max(60, toMinutes(slot.endTime) - toMinutes(slot.startTime)),
      requiredSkills: [], title: `Installation per ${q.quoteNumber}`, description: `Installation work as agreed per Quotation ${q.quoteNumber}`,
      internalNotes: q.notes, labourHours, hourlyRate: rates.defaultHourlyRate, travelTimeMinutes: 30, travelCharge: rates.defaultTravelCharge,
      checklist: ['Pre-installation survey & isolate services', 'Position equipment on secure mounts', 'Connect pipework & leak test', 'Commissioning & customer handover']
        .map((label, i) => ({ id: `chk-${i + 1}`, category: 'general' as const, label, checked: false })),
      auditAction: 'Created from Quotation', auditDetails: `Generated from accepted quote ${q.quoteNumber}`,
    }, who, tx);
    await tx.quotation.update({ where: { id }, data: { convertedToJobId: job.id } });
    await audit(tx, 'quotation', id, who, 'converted to job', `${q.quoteNumber} → ${job.jobNumber}`);
    return { job, quotation: await getQuotation(id, tx) };
  });
  if (result.job.status === 'scheduled') await emailBookingConfirmed(result.job);
  return result;
}

export function convertToInvoice(id: string) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'quotations', id);
    const q = await getQuotation(id, tx);
    assertConvertible(q, q.convertedToJobId ?? q.convertedToInvoiceId);
    if (await tx.invoice.count({ where: { quoteId: id, stageLabel: { not: null }, status: { not: 'void' } } })) throw conflict('HAS_STAGES', `${q.quoteNumber} is being billed in stages: raise the final stage invoice instead`);
    const invoice = await fromQuotation(q, tx);
    await tx.quotation.update({ where: { id }, data: { convertedToInvoiceId: invoice.id } });
    return { invoice, quotation: await getQuotation(id, tx) };
  });
}

/** Daily sweep: sent/viewed quotations past expiry_date become expired (also done by pg_cron, see the migration). */
export async function expireQuotations(now = today()) {
  const { count } = await prisma.quotation.updateMany({ where: { status: { in: ['sent', 'viewed'] }, expiryDate: { lt: new Date(now) } }, data: { status: 'expired' } });
  return count;
}

/** Import ops (see importPartOps). Quotation ids are pre-assigned in `ids`; `link` runs after the invoices exist. */
export const importQuotationOps = (rows: any[], ids: Map<string, string>) => ({
  wipe: prisma.quotation.deleteMany(),
  create: rows.map((q) => {
    const at = `quotation ${q.id}`;
    return prisma.quotation.create({ data: {
      id: ids.get(q.id)!, legacyId: q.id, quoteNumber: q.quoteNumber, customerId: refer(ids, q.customerId, at), locationId: refer(ids, q.locationId, at),
      jobId: q.jobId ? refer(ids, q.jobId, at) : null, issueDate: new Date(q.issueDate), expiryDate: new Date(q.expiryDate), status: q.status ?? 'draft',
      subtotal: q.subtotal ?? 0, vatRatePercent: q.vatRatePercent ?? 0, vatAmount: q.vatAmount ?? 0, total: q.total ?? 0,
      terms: q.terms ?? '', notes: q.notes, acceptedAt: date(q.acceptedAt), acceptedBy: q.acceptedBy,
      convertedToJobId: q.convertedToJobId ? refer(ids, q.convertedToJobId, at) : null, createdAt: date(q.createdAt),
      items: { create: lineImport(q.items) },
    } });
  }),
  link: rows.filter((q) => q.convertedToInvoiceId).map((q) =>
    prisma.quotation.update({ where: { id: ids.get(q.id)! }, data: { convertedToInvoiceId: refer(ids, q.convertedToInvoiceId, `quotation ${q.id}`) } })),
});

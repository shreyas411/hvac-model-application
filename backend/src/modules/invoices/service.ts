import type { Prisma } from '@prisma/client';
import type { Invoice, Job, LineItem, PaymentRecord, Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { ApiError, conflict, notFound } from '../../common/errors.js';
import { addDays, today } from '../../common/dates.js';
import { round2, totals } from '../../common/money.js';
import { nextNumber } from '../../common/numbering.js';
import { date, isUuid, lockRow, plain, prisma, refer, type Tx } from '../../common/prisma.js';
import { getSettings } from '../settings/service.js';
import { getJob } from '../jobs/service.js';
import { assertLocation } from '../customers/service.js';

const include = {
  items: { orderBy: { position: 'asc' } },
  payments: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.InvoiceInclude;
type Row = Prisma.InvoiceGetPayload<{ include: typeof include }>;

export const toInvoice = ({ legacyId, items, payments, ...i }: Row) => ({
  ...plain(i, [], ['issueDate', 'dueDate']),
  items: items.map(({ quotationId, invoiceId, position, ...x }) => plain(x)),
  payments: payments.map(({ invoiceId, legacyId, createdAt, ...p }) => plain(p, [], ['date'])),
}) as unknown as Invoice;

export async function getInvoice(id: string, c: Tx = prisma) {
  const row = isUuid(id) ? await c.invoice.findUnique({ where: { id }, include }) : null;
  if (!row) throw notFound('Invoice');
  return toInvoice(row);
}
export const listInvoices = async () => (await prisma.invoice.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toInvoice);

export type ItemInput = Pick<LineItem, 'type' | 'description' | 'quantity' | 'unitPrice'>;
/** Line-item rows with server-computed amounts (client floats are never trusted). */
export const lineRows = (items: ItemInput[]) =>
  items.map((i, position) => ({ type: i.type, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: round2(i.quantity * i.unitPrice), position }));

export type InvoiceInput = {
  customerId: string; locationId: string; quoteId?: string; jobId?: string; items: ItemInput[];
  vatRatePercent?: number; issueDate?: string; paymentTermsDays?: number; dueDate?: string; notes?: string;
  status?: 'draft' | 'issued';
};

type Rows = ReturnType<typeof lineRows>;
type Totals = { subtotal: number; vatAmount: number; total: number };

async function insertInvoice(tx: Tx, i: Omit<InvoiceInput, 'items' | 'vatRatePercent'>, rows: Rows, vat: number, t: Totals) {
  await assertLocation(i.customerId, i.locationId);
  if (i.quoteId && (!isUuid(i.quoteId) || !(await tx.quotation.count({ where: { id: i.quoteId } })))) throw notFound('Quotation');
  if (i.jobId) await getJob(i.jobId, tx);
  const issueDate = i.issueDate ?? today();
  const terms = i.paymentTermsDays ?? 14;
  return toInvoice(await tx.invoice.create({
    include,
    data: {
      invoiceNumber: await nextNumber('invoice'), quoteId: i.quoteId, jobId: i.jobId, customerId: i.customerId, locationId: i.locationId,
      issueDate: new Date(issueDate), dueDate: new Date(i.dueDate ?? addDays(issueDate, terms)), status: i.status ?? 'issued',
      ...t, vatRatePercent: vat, amountPaid: 0, balanceDue: t.total, paymentTermsDays: terms, notes: i.notes,
      items: { create: rows },
    },
  }));
}

export async function createInvoice({ items, vatRatePercent, ...i }: InvoiceInput, tx?: Tx): Promise<Invoice> {
  if (!tx) return prisma.$transaction((t) => createInvoice({ items, vatRatePercent, ...i }, t));
  const rows = lineRows(items);
  const vat = vatRatePercent ?? (await getSettings()).defaultVatRate;
  return insertInvoice(tx, i, rows, vat, totals(rows.map((x) => x.amount), vat));
}

export function updateInvoice(id: string, patch: Partial<InvoiceInput>) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status === 'void') throw conflict('INVOICE_VOID', 'Invoice is void');
    const money = patch.items || patch.vatRatePercent !== undefined;
    if (money && inv.status !== 'draft') throw conflict('NOT_EDITABLE', 'Line items and VAT can only change while draft');
    const { items, vatRatePercent, dueDate, notes, paymentTermsDays, issueDate } = patch;
    const rows = lineRows(items ?? inv.items);
    const vat = vatRatePercent ?? inv.vatRatePercent;
    const t = totals(rows.map((x) => x.amount), vat);
    return toInvoice(await tx.invoice.update({
      where: { id }, include,
      data: {
        ...(dueDate && { dueDate: new Date(dueDate) }), ...(notes !== undefined && { notes }), ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(paymentTermsDays && { paymentTermsDays }), vatRatePercent: vat, ...t, balanceDue: round2(t.total - inv.amountPaid),
        ...(items && { items: { deleteMany: {}, create: rows } }),
      },
    }));
  });
}

export function issueInvoice(id: string) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status !== 'draft') throw conflict('NOT_DRAFT', 'Only draft invoices can be issued');
    return toInvoice(await tx.invoice.update({ where: { id }, data: { status: 'issued' }, include }));
  });
}

/** Row-locked, so concurrent payments can't both pass the overpayment check. */
export function recordPayment(id: string, p: Omit<PaymentRecord, 'id' | 'recordedBy'>, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status === 'draft' || inv.status === 'void') throw conflict('NOT_PAYABLE', `Cannot take payment on a ${inv.status} invoice`);
    if (p.amount > inv.balanceDue + 0.005) throw new ApiError(422, 'OVERPAYMENT', `Payment exceeds balance due (${inv.balanceDue.toFixed(2)})`);
    const amountPaid = round2(inv.amountPaid + p.amount);
    const balanceDue = round2(inv.total - amountPaid);
    await tx.payment.create({ data: { invoiceId: id, date: new Date(p.date), amount: p.amount, method: p.method, reference: p.reference, recordedBy: who.name, notes: p.notes } });
    return toInvoice(await tx.invoice.update({ where: { id }, include, data: { amountPaid, balanceDue, status: balanceDue <= 0.01 ? 'paid' : 'partially_paid' } }));
  });
}

export function voidInvoice(id: string) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.payments.length) throw conflict('HAS_PAYMENTS', 'Cannot void an invoice that has payments');
    if (inv.status === 'void') throw conflict('INVOICE_VOID', 'Invoice already void');
    return toInvoice(await tx.invoice.update({ where: { id }, data: { status: 'void' }, include }));
  });
}

export function generateFromJob(job: Job, who: Actor) {
  return prisma.$transaction(async (tx) => {
    // advisory lock: two simultaneous requests for one job can't both see "no invoice yet"
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice-job:${job.id}`}))`;
    if (await tx.invoice.count({ where: { jobId: job.id, status: { not: 'void' } } }))
      throw conflict('ALREADY_CONVERTED', `Job ${job.jobNumber} already has an invoice`);
    const items: ItemInput[] = [];
    if (job.labourHours > 0)
      items.push({ type: 'labour', description: `Engineering & Field Labour - ${job.type.replace('_', ' ')} (${job.labourHours} hrs @ £${job.hourlyRate.toFixed(2)}/hr)`, quantity: job.labourHours, unitPrice: job.hourlyRate });
    if (job.travelCharge > 0) items.push({ type: 'travel', description: 'Service Travel & Van Callout Charge', quantity: 1, unitPrice: job.travelCharge });
    for (const p of job.partsUsed) items.push({ type: 'part', description: `${p.partName} (${p.sku})`, quantity: p.quantity, unitPrice: p.unitPrice });
    return createInvoice({
      customerId: job.customerId, locationId: job.locationId, jobId: job.id, items,
      notes: `Invoice generated from completed Job ${job.jobNumber} by ${who.name}.`,
    }, tx);
  });
}

/** Items and totals are copied as-is so the invoice matches what the customer accepted. */
export async function fromQuotation(q: Quotation, tx: Tx) {
  const rows = q.items.map((x, position) => ({ type: x.type, description: x.description, quantity: x.quantity, unitPrice: x.unitPrice, amount: x.amount, position }));
  return insertInvoice(tx, {
    customerId: q.customerId, locationId: q.locationId, quoteId: q.id, jobId: q.jobId,
    notes: `Invoice generated for accepted Quotation ${q.quoteNumber}. Payment terms 14 days.`,
  }, rows, q.vatRatePercent, { subtotal: q.subtotal, vatAmount: q.vatAmount, total: q.total });
}

/** Daily sweep: issued / partially_paid past due_date become overdue (also done by pg_cron, see the migration). */
export async function markOverdue(now = today()) {
  const { count } = await prisma.invoice.updateMany({ where: { status: { in: ['issued', 'partially_paid'] }, dueDate: { lt: new Date(now) } }, data: { status: 'overdue' } });
  return count;
}

/**
 * Import ops (see importPartOps). Invoice ids are pre-assigned in `ids`. Quotations are created first, so `quoteId` is set here;
 * the reverse link (`convertedToInvoiceId`) is set by the quotation importer's `link`.
 */
export const importInvoiceOps = (rows: any[], ids: Map<string, string>) => ({
  wipe: [prisma.payment.deleteMany(), prisma.invoice.deleteMany()],
  create: rows.map((v) => {
    const at = `invoice ${v.id}`;
    return prisma.invoice.create({ data: {
      id: ids.get(v.id)!, legacyId: v.id, invoiceNumber: v.invoiceNumber,
      quoteId: v.quoteId ? refer(ids, v.quoteId, at) : null, jobId: v.jobId ? refer(ids, v.jobId, at) : null,
      customerId: refer(ids, v.customerId, at), locationId: refer(ids, v.locationId, at),
      issueDate: new Date(v.issueDate), dueDate: new Date(v.dueDate), status: v.status ?? 'issued',
      subtotal: v.subtotal ?? 0, vatRatePercent: v.vatRatePercent ?? 0, vatAmount: v.vatAmount ?? 0, total: v.total ?? 0,
      amountPaid: v.amountPaid ?? 0, balanceDue: v.balanceDue ?? v.total ?? 0, paymentTermsDays: v.paymentTermsDays ?? 14, notes: v.notes,
      createdAt: date(v.createdAt),
      items: { create: lineImport(v.items) },
      payments: { create: (v.payments ?? []).map((p: any) => ({
        legacyId: p.id, date: new Date(p.date), amount: p.amount, method: p.method, reference: p.reference ?? '', recordedBy: p.recordedBy ?? '', notes: p.notes,
      })) },
    } });
  }),
});

export const lineImport = (items: any[] = []) =>
  items.map((x, position) => ({ type: x.type, description: x.description ?? '', quantity: x.quantity ?? 1, unitPrice: x.unitPrice ?? 0, amount: x.amount ?? 0, position }));

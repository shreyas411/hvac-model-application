import type { Prisma } from '@prisma/client';
import type { Invoice, Job, LineItem, PaymentRecord, Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { ApiError, conflict, notFound, unprocessable } from '../../common/errors.js';
import { pageFrom } from '../../common/paginate.js';
import { audit } from '../../common/audit.js';
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
export const pageInvoices = (query: unknown) => pageFrom(query, prisma.invoice, { include, searchFields: ['invoiceNumber', 'notes'] }, toInvoice);
export const listInvoices = async () => (await prisma.invoice.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toInvoice);

export type ItemInput = Pick<LineItem, 'type' | 'description' | 'quantity' | 'unitPrice' | 'vatRatePercent'>;
/** Line-item rows with server-computed amounts (client floats are never trusted). */
export const lineRows = (items: ItemInput[]) =>
  items.map((i, position) => ({ type: i.type, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRatePercent: i.vatRatePercent, amount: round2(i.quantity * i.unitPrice), position }));

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
      invoiceNumber: await nextNumber('invoice', new Date(), tx), quoteId: i.quoteId, jobId: i.jobId, customerId: i.customerId, locationId: i.locationId,
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
  return insertInvoice(tx, i, rows, vat, totals(rows, vat));
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
    const t = totals(rows, vat);
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

export function issueInvoice(id: string, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status !== 'draft') throw conflict('NOT_DRAFT', 'Only draft invoices can be issued');
    if (inv.total <= 0) throw unprocessable('EMPTY_INVOICE', 'Cannot issue an invoice with a zero total');
    await audit(tx, 'invoice', id, who, 'issued', inv.invoiceNumber);
    return toInvoice(await tx.invoice.update({ where: { id }, data: { status: 'issued' }, include }));
  });
}

const sum = (n: { _sum: { amount: unknown } }) => Number(n._sum.amount ?? 0);
const creditedTotal = async (tx: Tx, invoiceId: string) => sum(await tx.creditNote.aggregate({ where: { invoiceId }, _sum: { amount: true } }));

/** Balance and status after payments/credits/refunds. `credited` = fully written off by credit notes. */
function settle(total: number, amountPaid: number, credited: number) {
  const balanceDue = Math.max(0, round2(total - credited - amountPaid));
  const status = credited >= total - 0.005 ? 'credited' as const : balanceDue <= 0.01 ? 'paid' as const : amountPaid > 0 ? 'partially_paid' as const : 'issued' as const;
  return { balanceDue, status };
}

/** Row-locked, so concurrent payments can't both pass the overpayment check. */
export function recordPayment(id: string, p: Omit<PaymentRecord, 'id' | 'recordedBy'>, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status === 'draft' || inv.status === 'void' || inv.status === 'credited') throw conflict('NOT_PAYABLE', `Cannot take payment on a ${inv.status} invoice`);
    if (p.amount > inv.balanceDue + 0.005) throw new ApiError(422, 'OVERPAYMENT', `Payment exceeds balance due (${inv.balanceDue.toFixed(2)})`);
    if (p.reference && (await tx.payment.count({ where: { invoiceId: id, reference: p.reference, refunded: false } })))
      throw conflict('DUPLICATE_PAYMENT_REFERENCE', `Payment reference ${p.reference} is already recorded on this invoice`);
    const amountPaid = round2(inv.amountPaid + p.amount);
    const { balanceDue, status } = settle(inv.total, amountPaid, await creditedTotal(tx, id));
    const pay = await tx.payment.create({ data: { invoiceId: id, date: new Date(p.date), amount: p.amount, method: p.method, reference: p.reference, recordedBy: who.name, notes: p.notes } });
    await audit(tx, 'invoice', id, who, 'payment recorded', `${p.amount.toFixed(2)} via ${p.method} (${pay.id})`);
    return toInvoice(await tx.invoice.update({ where: { id }, include, data: { amountPaid, balanceDue, status } }));
  });
}

/** Voiding needs a reason and is only for unpaid invoices; paid ones are corrected with a credit note. */
export function voidInvoice(id: string, reason: string, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.payments.length) throw conflict('HAS_PAYMENTS', 'Cannot void an invoice that has payments: issue a credit note instead');
    if (inv.status === 'void') throw conflict('INVOICE_VOID', 'Invoice already void');
    if (await tx.creditNote.count({ where: { invoiceId: id } })) throw conflict('HAS_CREDITS', 'Cannot void an invoice that has credit notes');
    await audit(tx, 'invoice', id, who, 'voided', reason);
    return toInvoice(await tx.invoice.update({ where: { id }, data: { status: 'void' }, include }));
  });
}

/** Credit note for part or all of an issued invoice. `amount` is gross (VAT inclusive); the cap is what's still creditable. */
export function creditInvoice(id: string, c: { amount: number; reason: string }, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status === 'draft' || inv.status === 'void') throw conflict('NOT_CREDITABLE', `Cannot credit a ${inv.status} invoice`);
    const already = await creditedTotal(tx, id);
    const room = round2(inv.total - already);
    if (c.amount > room + 0.005) throw unprocessable('OVER_CREDIT', `Only ${room.toFixed(2)} of ${inv.invoiceNumber} can still be credited`);
    // VAT is the credited share of the invoice's VAT (amount is gross)
    const vatAmount = inv.total ? round2((c.amount * inv.vatAmount) / inv.total) : 0;
    const credit = await tx.creditNote.create({ data: { creditNumber: await nextNumber('credit', new Date(), tx), invoiceId: id, amount: c.amount, vatAmount, reason: c.reason, createdBy: who.name } });
    const { balanceDue, status } = settle(inv.total, inv.amountPaid, round2(already + c.amount));
    await audit(tx, 'invoice', id, who, 'credit note', `${credit.creditNumber}: ${c.amount.toFixed(2)} (${c.reason})`);
    return { creditNote: { ...plain(credit), createdAt: credit.createdAt.toISOString() }, invoice: toInvoice(await tx.invoice.update({ where: { id }, include, data: { balanceDue, status } })) };
  });
}

/** Marks a payment refunded and re-opens the balance it had cleared. */
export function refundPayment(invoiceId: string, paymentId: string, reason: string, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', invoiceId);
    const inv = await getInvoice(invoiceId, tx);
    const pay = isUuid(paymentId) ? await tx.payment.findFirst({ where: { id: paymentId, invoiceId } }) : null;
    if (!pay) throw notFound('Payment');
    if (pay.refunded) throw conflict('ALREADY_REFUNDED', 'Payment already refunded');
    const amountPaid = round2(inv.amountPaid - Number(pay.amount));
    const { balanceDue, status } = settle(inv.total, amountPaid, await creditedTotal(tx, invoiceId));
    await tx.payment.update({ where: { id: paymentId }, data: { refunded: true } });
    await audit(tx, 'invoice', invoiceId, who, 'payment refunded', `${Number(pay.amount).toFixed(2)} (${paymentId}): ${reason}`);
    return toInvoice(await tx.invoice.update({ where: { id: invoiceId }, include, data: { amountPaid, balanceDue, status } }));
  });
}

/** Invoices a finished job. The job is read under a row lock inside the transaction, so labour/parts can't change between read and bill. */
export function generateFromJob(jobId: string, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'jobs', jobId);
    const job = await getJob(jobId, tx);
    if (job.status !== 'completed') throw conflict('JOB_NOT_COMPLETED', `Job ${job.jobNumber} is ${job.status}: only completed jobs can be invoiced`);
    if (await tx.invoice.count({ where: { jobId: job.id, status: { not: 'void' } } }))
      throw conflict('ALREADY_CONVERTED', `Job ${job.jobNumber} already has an invoice`);
    const items: ItemInput[] = [];
    if (job.labourHours > 0)
      items.push({ type: 'labour', description: `Engineering & Field Labour - ${job.type.replace('_', ' ')} (${job.labourHours} hrs @ ${job.hourlyRate.toFixed(2)}/hr)`, quantity: job.labourHours, unitPrice: job.hourlyRate });
    if (job.travelCharge > 0) items.push({ type: 'travel', description: 'Service Travel & Van Callout Charge', quantity: 1, unitPrice: job.travelCharge });
    for (const p of job.partsUsed) items.push({ type: 'part', description: `${p.partName} (${p.sku})`, quantity: p.quantity, unitPrice: p.unitPrice });
    if (!items.length) throw unprocessable('NOTHING_TO_INVOICE', `Job ${job.jobNumber} has no labour, travel or parts to bill`);
    await audit(tx, 'job', job.id, who, 'invoice generated', job.jobNumber);
    return createInvoice({
      customerId: job.customerId, locationId: job.locationId, jobId: job.id, items,
      notes: `Invoice generated from completed Job ${job.jobNumber} by ${who.name}.`,
    }, tx);
  });
}

/** Items and totals are copied as-is so the invoice matches what the customer accepted. */
export async function fromQuotation(q: Quotation, tx: Tx) {
  const rows = q.items.map((x, position) => ({ type: x.type, description: x.description, quantity: x.quantity, unitPrice: x.unitPrice, vatRatePercent: x.vatRatePercent, amount: x.amount, position }));
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
  items.map((x, position) => ({ type: x.type, description: x.description ?? '', quantity: x.quantity ?? 1, unitPrice: x.unitPrice ?? 0, vatRatePercent: x.vatRatePercent, amount: x.amount ?? 0, position }));

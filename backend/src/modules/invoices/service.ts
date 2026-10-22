import type { Prisma } from '@prisma/client';
import type { Invoice, Job, LineItem, PaymentRecord, Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { ApiError, conflict, notFound, unprocessable } from '../../common/errors.js';
import { pageFrom } from '../../common/paginate.js';
import { audit } from '../../common/audit.js';
import { addDays, today, ukDate } from '../../common/dates.js';
import { round2, totals } from '../../common/money.js';
import { nextNumber } from '../../common/numbering.js';
import { date, isUuid, lockRow, plain, prisma, refer, type Tx } from '../../common/prisma.js';
import { getSettings } from '../settings/service.js';
import { getJob } from '../jobs/service.js';
import { assertLocation } from '../customers/service.js';
import { createNotification } from '../notifications/service.js';
import { emailInvoiceIssued } from '../notifications/templates.js';

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
export const pageInvoices = (query: unknown) => pageFrom(query, prisma.invoice, { include, searchFields: ['invoiceNumber', 'notes', 'customer.name'], sorts: ['issueDate', 'dueDate', 'total', 'balanceDue', 'status'] }, toInvoice);
export const listInvoices = async () => (await prisma.invoice.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toInvoice);

export type ItemInput = Pick<LineItem, 'type' | 'description' | 'quantity' | 'unitPrice' | 'vatRatePercent' | 'option'>;
/** Line-item rows with server-computed amounts (client floats are never trusted). */
export const lineRows = (items: ItemInput[]) =>
  items.map((i, position) => ({ type: i.type, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRatePercent: i.vatRatePercent, ...(i.option && { option: i.option }), amount: round2(i.quantity * i.unitPrice), position }));

export type InvoiceInput = {
  customerId: string; locationId: string; quoteId?: string; jobId?: string; items: ItemInput[];
  vatRatePercent?: number; issueDate?: string; paymentTermsDays?: number; dueDate?: string; notes?: string;
  status?: 'draft' | 'issued';
  reverseCharge?: boolean; cisRatePercent?: number; retentionPercent?: number;
};

type Terms = Pick<InvoiceInput, 'reverseCharge' | 'cisRatePercent' | 'retentionPercent'>;
/**
 * Totals plus the amounts withheld from what the customer pays now. Reverse charge zeroes VAT; CIS is taken on labour lines only (ex VAT);
 * retention is a share of the gross total. ponytail: credit notes don't scale either, release retention before crediting if that matters.
 */
function priced(rows: Rows, vat: number, t: Terms) {
  const rate = t.reverseCharge ? 0 : vat;
  const tt = totals(rows.map((r) => ({ ...r, vatRatePercent: t.reverseCharge ? 0 : r.vatRatePercent })), rate);
  const labour = round2(rows.filter((r) => r.type === 'labour').reduce((a, r) => a + r.amount, 0));
  const cis = t.cisRatePercent ?? 0, ret = t.retentionPercent ?? 0;
  return { ...tt, vatRatePercent: rate, reverseCharge: !!t.reverseCharge, cisRatePercent: cis, cisDeduction: round2((labour * cis) / 100), retentionPercent: ret, retentionHeld: round2((tt.total * ret) / 100) };
}
const withheld = (i: { cisDeduction: number; retentionHeld: number }) => round2(i.cisDeduction + i.retentionHeld);

type Rows = ReturnType<typeof lineRows>;
type Totals = Pick<ReturnType<typeof priced>, 'subtotal' | 'vatAmount' | 'total'> & Partial<ReturnType<typeof priced>>;

async function insertInvoice(tx: Tx, i: Omit<InvoiceInput, 'items' | 'vatRatePercent' | keyof Terms>, rows: Rows, vat: number, t: Totals) {
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
      ...t, vatRatePercent: vat, amountPaid: 0, balanceDue: round2(t.total - round2((t.cisDeduction ?? 0) + (t.retentionHeld ?? 0))), paymentTermsDays: terms, notes: i.notes,
      items: { create: rows },
    },
  }));
}

/** Domestic reverse charge and CIS only exist between VAT-registered / CIS businesses; a householder or landlord (end user) must never get them. */
async function assertBusinessTerms(tx: Tx, customerId: string, t: Terms) {
  if (!t.reverseCharge && !t.cisRatePercent) return;
  if ((await tx.customer.findUnique({ where: { id: customerId }, select: { type: true } }))?.type !== 'commercial')
    throw unprocessable('RESIDENTIAL_TERMS', 'Reverse charge and CIS only apply to commercial customers');
}

export async function createInvoice({ items, vatRatePercent, reverseCharge, cisRatePercent, retentionPercent, ...i }: InvoiceInput, tx?: Tx): Promise<Invoice> {
  if (!tx) return prisma.$transaction((t) => createInvoice({ items, vatRatePercent, reverseCharge, cisRatePercent, retentionPercent, ...i }, t));
  await assertBusinessTerms(tx, i.customerId, { reverseCharge, cisRatePercent });
  const rows = lineRows(items);
  const vat = vatRatePercent ?? (await getSettings()).defaultVatRate;
  const t = priced(rows, vat, { reverseCharge, cisRatePercent, retentionPercent });
  return insertInvoice(tx, i, rows, t.vatRatePercent, t);
}

export function updateInvoice(id: string, patch: Partial<InvoiceInput>) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status === 'void') throw conflict('INVOICE_VOID', 'Invoice is void');
    const money = patch.items || patch.vatRatePercent !== undefined || patch.reverseCharge !== undefined || patch.cisRatePercent !== undefined || patch.retentionPercent !== undefined;
    if (money && inv.status !== 'draft') throw conflict('NOT_EDITABLE', 'Line items and VAT can only change while draft');
    const { items, vatRatePercent, dueDate, notes, paymentTermsDays, issueDate } = patch;
    if (money) await assertBusinessTerms(tx, inv.customerId, { reverseCharge: patch.reverseCharge ?? inv.reverseCharge, cisRatePercent: patch.cisRatePercent ?? inv.cisRatePercent });
    const rows = lineRows(items ?? inv.items);
    const t = priced(rows, vatRatePercent ?? inv.vatRatePercent, {
      reverseCharge: patch.reverseCharge ?? inv.reverseCharge, cisRatePercent: patch.cisRatePercent ?? inv.cisRatePercent, retentionPercent: patch.retentionPercent ?? inv.retentionPercent,
    });
    return toInvoice(await tx.invoice.update({
      where: { id }, include,
      data: {
        ...(dueDate && { dueDate: new Date(dueDate) }), ...(notes !== undefined && { notes }), ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(paymentTermsDays && { paymentTermsDays }), ...t, balanceDue: round2(t.total - withheld(t) - inv.amountPaid),
        ...(items && { items: { deleteMany: {}, create: rows } }),
      },
    }));
  });
}

export async function issueInvoice(id: string, who: Actor) {
  const issued = await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status !== 'draft') throw conflict('NOT_DRAFT', 'Only draft invoices can be issued');
    if (inv.total <= 0) throw unprocessable('EMPTY_INVOICE', 'Cannot issue an invoice with a zero total');
    await audit(tx, 'invoice', id, who, 'issued', inv.invoiceNumber);
    return toInvoice(await tx.invoice.update({ where: { id }, data: { status: 'issued' }, include }));
  });
  await emailInvoiceIssued(issued);
  return issued;
}

const sum = (n: { _sum: { amount: unknown } }) => Number(n._sum.amount ?? 0);
const creditedTotal = async (tx: Tx, invoiceId: string) => sum(await tx.creditNote.aggregate({ where: { invoiceId }, _sum: { amount: true } }));

/** Balance and status after payments/credits/refunds. `credited` = fully written off by credit notes. */
function settle(total: number, amountPaid: number, credited: number, held: number, dueDate?: string) {
  const balanceDue = Math.max(0, round2(total - credited - held - amountPaid));
  const status = credited >= total - 0.005 ? 'credited' as const : balanceDue <= 0.01 ? 'paid' as const : dueDate && dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' as const : amountPaid > 0 ? 'partially_paid' as const : 'issued' as const; // part-paid past its due date stays overdue
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
    const { balanceDue, status } = settle(inv.total, amountPaid, await creditedTotal(tx, id), withheld(inv), inv.dueDate);
    const pay = await tx.payment.create({ data: { invoiceId: id, date: new Date(p.date), amount: p.amount, method: p.method, reference: p.reference, recordedBy: who.name, notes: p.notes } });
    await audit(tx, 'invoice', id, who, 'payment recorded', `£${p.amount.toFixed(2)} via ${p.method}`);
    return toInvoice(await tx.invoice.update({ where: { id }, include, data: { amountPaid, balanceDue, status } }));
  });
}

/** Retention is paid out: it becomes due again (status/balance recomputed). The released amount is kept in the audit log. */
export function releaseRetention(id: string, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'invoices', id);
    const inv = await getInvoice(id, tx);
    if (inv.status === 'draft' || inv.status === 'void') throw conflict('NOT_PAYABLE', `Cannot release retention on a ${inv.status} invoice`);
    if (!inv.retentionHeld) throw conflict('NO_RETENTION', 'No retention is being held on this invoice');
    const { balanceDue, status } = settle(inv.total, inv.amountPaid, await creditedTotal(tx, id), inv.cisDeduction, inv.dueDate);
    await audit(tx, 'invoice', id, who, 'retention released', `£${inv.retentionHeld.toFixed(2)}`);
    return toInvoice(await tx.invoice.update({ where: { id }, include, data: { retentionHeld: 0, balanceDue, status } }));
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
    const { balanceDue, status } = settle(inv.total, inv.amountPaid, round2(already + c.amount), withheld(inv), inv.dueDate);
    await audit(tx, 'invoice', id, who, 'credit note', `${credit.creditNumber}: £${c.amount.toFixed(2)} (${c.reason})`);
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
    const { balanceDue, status } = settle(inv.total, amountPaid, await creditedTotal(tx, invoiceId), withheld(inv), inv.dueDate);
    await tx.payment.update({ where: { id: paymentId }, data: { refunded: true } });
    await audit(tx, 'invoice', invoiceId, who, 'payment refunded', `£${Number(pay.amount).toFixed(2)}: ${reason}`);
    return toInvoice(await tx.invoice.update({ where: { id: invoiceId }, include, data: { amountPaid, balanceDue, status } }));
  });
}

/** Invoices a finished job. The job is read under a row lock inside the transaction, so labour/parts can't change between read and bill. */
export function generateFromJob(jobId: string, vatRatePercent: number, who: Actor) {
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
      customerId: job.customerId, locationId: job.locationId, jobId: job.id, items, vatRatePercent,
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

/**
 * Deposit / stage / final invoice for an accepted quote, one invoice (row) per stage. Stages bill a percent of the quote subtotal as a single line;
 * the final invoice (remaining percent) is the full quote with each earlier stage deducted. ponytail: stage lines use the quote's document VAT rate, not per-line rates.
 */
export function createStageInvoice(quoteId: string, s: { percent?: number; label?: string; final?: boolean }) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'quotations', quoteId);
    const row = isUuid(quoteId) ? await tx.quotation.findUnique({ where: { id: quoteId }, include: { items: { orderBy: { position: 'asc' } } } }) : null;
    if (!row) throw notFound('Quotation');
    if (row.status !== 'accepted') throw conflict('NOT_ACCEPTED', 'Quotation must be accepted first');
    if (row.convertedToInvoiceId) throw conflict('ALREADY_CONVERTED', `${row.quoteNumber} is already fully invoiced`);
    const prior = await tx.invoice.findMany({ where: { quoteId, stageLabel: { not: null }, status: { not: 'void' } }, orderBy: { createdAt: 'asc' } });
    const remaining = round2(100 - prior.reduce((a, i) => a + Number(i.stagePercent), 0));
    const percent = s.final ? remaining : s.percent;
    if (!percent || percent > remaining) throw unprocessable('BAD_STAGE_PERCENT', `${row.quoteNumber} has ${remaining}% left to invoice`);
    const label = s.label?.trim() || (s.final ? 'Final' : `Stage ${prior.length + 1}`);
    const vat = Number(row.vatRatePercent);
    const base = { customerId: row.customerId, locationId: row.locationId, quoteId, jobId: row.jobId ?? undefined };
    let items: ItemInput[];
    if (s.final) {
      const q = row.items.map((x) => ({ type: x.type, description: x.description, quantity: Number(x.quantity), unitPrice: Number(x.unitPrice), vatRatePercent: x.vatRatePercent === null ? undefined : Number(x.vatRatePercent) }));
      items = [...q, ...prior.map((i) => ({ type: 'discount' as const, description: `Less ${i.stageLabel} (${i.invoiceNumber})`, quantity: 1, unitPrice: -Number(i.subtotal), vatRatePercent: Number(i.vatRatePercent) }))];
    } else items = [{ type: 'fee', description: `${label} - ${percent}% of Quotation ${row.quoteNumber}`, quantity: 1, unitPrice: round2((Number(row.subtotal) * percent) / 100) }];
    const rows = lineRows(items);
    const t = priced(rows, vat, {});
    const inv = await insertInvoice(tx, { ...base, notes: `${label} invoice (${percent}%) for accepted Quotation ${row.quoteNumber}.` }, rows, vat, t);
    await tx.invoice.update({ where: { id: inv.id }, data: { stageLabel: label, stagePercent: percent } });
    if (s.final) await tx.quotation.update({ where: { id: quoteId }, data: { convertedToInvoiceId: inv.id } });
    return getInvoice(inv.id, tx);
  });
}
/** Daily sweep: issued / partially_paid past due_date become overdue (also done by pg_cron, see the migration). */
/** Flips past-due invoices to overdue and drafts a payment reminder for each (staff approve it in Notifications; skipped without consent). */
export async function markOverdue(now = today()) {
  const where = { status: { in: ['issued', 'partially_paid'] as ('issued' | 'partially_paid')[] }, dueDate: { lt: new Date(now) } };
  const due = await prisma.invoice.findMany({ where, select: { id: true, invoiceNumber: true, customerId: true, balanceDue: true, dueDate: true } });
  const { count } = await prisma.invoice.updateMany({ where: { id: { in: due.map((i) => i.id) }, ...where }, data: { status: 'overdue' } });
  for (const i of due) {
    await createNotification({
      customerId: i.customerId, type: 'payment_reminder', channel: 'email', subject: `Payment reminder: invoice ${i.invoiceNumber}`,
      messageBody: `Invoice ${i.invoiceNumber} (balance £${i.balanceDue.toFixed(2)}) was due on ${ukDate(i.dueDate)}. Please arrange payment, or get in touch if you've already paid.`,
    }).catch(() => undefined); // no consent / other channel preferred: no reminder
  }
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

import { randomUUID } from 'node:crypto';
import type { Invoice, Job, LineItem, PaymentRecord, Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, ApiError } from '../../common/errors.js';
import { addDays, today } from '../../common/dates.js';
import { round2, totals } from '../../common/money.js';
import { nextNumber } from '../../common/numbering.js';
import { db, must } from '../../common/store.js';
import { assertLocation } from '../customers/service.js';

export const getInvoice = (id: string) => must(db.invoices, id, 'Invoice');

type ItemInput = Pick<LineItem, 'type' | 'description' | 'quantity' | 'unitPrice'>;
export const toLineItems = (items: ItemInput[]): LineItem[] =>
  items.map((i) => ({ ...i, id: randomUUID(), amount: round2(i.quantity * i.unitPrice) }));

export type InvoiceInput = {
  customerId: string; locationId: string; quoteId?: string; jobId?: string; items: ItemInput[];
  vatRatePercent?: number; issueDate?: string; paymentTermsDays?: number; dueDate?: string; notes?: string;
  status?: 'draft' | 'issued';
};

export function createInvoice(i: InvoiceInput): Invoice {
  assertLocation(i.customerId, i.locationId);
  if (i.quoteId) must(db.quotations, i.quoteId, 'Quotation');
  if (i.jobId) must(db.jobs, i.jobId, 'Job');
  const items = toLineItems(i.items);
  const vat = i.vatRatePercent ?? db.settings.defaultVatRate;
  const t = totals(items.map((x) => x.amount), vat);
  const issueDate = i.issueDate ?? today();
  const terms = i.paymentTermsDays ?? 14;
  return db.invoices.insert({
    invoiceNumber: nextNumber('invoice'), quoteId: i.quoteId, jobId: i.jobId, customerId: i.customerId, locationId: i.locationId,
    issueDate, dueDate: i.dueDate ?? addDays(issueDate, terms), status: i.status ?? 'issued', items,
    ...t, vatRatePercent: vat, payments: [], amountPaid: 0, balanceDue: t.total, paymentTermsDays: terms, notes: i.notes,
  });
}

export function updateInvoice(id: string, patch: Partial<InvoiceInput>) {
  const inv = getInvoice(id);
  if (inv.status === 'void') throw conflict('INVOICE_VOID', 'Invoice is void');
  const money = patch.items || patch.vatRatePercent !== undefined;
  if (money && inv.status !== 'draft') throw conflict('NOT_EDITABLE', 'Line items and VAT can only change while draft');
  const { items: rawItems, vatRatePercent, dueDate, notes, paymentTermsDays, issueDate } = patch;
  const items = rawItems ? toLineItems(rawItems) : inv.items;
  const vat = vatRatePercent ?? inv.vatRatePercent;
  const t = totals(items.map((x) => x.amount), vat);
  return db.invoices.update(id, {
    ...(dueDate && { dueDate }), ...(notes !== undefined && { notes }), ...(issueDate && { issueDate }),
    ...(paymentTermsDays && { paymentTermsDays }), items, vatRatePercent: vat, ...t,
    balanceDue: round2(t.total - inv.amountPaid),
  });
}

export function issueInvoice(id: string) {
  const inv = getInvoice(id);
  if (inv.status !== 'draft') throw conflict('NOT_DRAFT', 'Only draft invoices can be issued');
  return db.invoices.update(id, { status: 'issued' });
}

export function recordPayment(id: string, p: Omit<PaymentRecord, 'id' | 'recordedBy'>, who: Actor) {
  const inv = getInvoice(id);
  if (inv.status === 'draft' || inv.status === 'void') throw conflict('NOT_PAYABLE', `Cannot take payment on a ${inv.status} invoice`);
  if (p.amount > inv.balanceDue + 0.005) throw new ApiError(422, 'OVERPAYMENT', `Payment exceeds balance due (${inv.balanceDue.toFixed(2)})`);
  const amountPaid = round2(inv.amountPaid + p.amount);
  const balanceDue = round2(inv.total - amountPaid);
  return db.invoices.update(id, {
    payments: [...inv.payments, { ...p, id: randomUUID(), recordedBy: who.name }],
    amountPaid, balanceDue, status: balanceDue <= 0.01 ? 'paid' : 'partially_paid',
  });
}

export function voidInvoice(id: string) {
  const inv = getInvoice(id);
  if (inv.payments.length) throw conflict('HAS_PAYMENTS', 'Cannot void an invoice that has payments');
  if (inv.status === 'void') throw conflict('INVOICE_VOID', 'Invoice already void');
  return db.invoices.update(id, { status: 'void' });
}

export function generateFromJob(job: Job, who: Actor) {
  if (db.invoices.all().some((i) => i.jobId === job.id && i.status !== 'void'))
    throw conflict('ALREADY_CONVERTED', `Job ${job.jobNumber} already has an invoice`);
  const items: ItemInput[] = [];
  if (job.labourHours > 0)
    items.push({ type: 'labour', description: `Engineering & Field Labour - ${job.type.replace('_', ' ')} (${job.labourHours} hrs @ £${job.hourlyRate.toFixed(2)}/hr)`, quantity: job.labourHours, unitPrice: job.hourlyRate });
  if (job.travelCharge > 0) items.push({ type: 'travel', description: 'Service Travel & Van Callout Charge', quantity: 1, unitPrice: job.travelCharge });
  for (const p of job.partsUsed) items.push({ type: 'part', description: `${p.partName} (${p.sku})`, quantity: p.quantity, unitPrice: p.unitPrice });
  return createInvoice({
    customerId: job.customerId, locationId: job.locationId, jobId: job.id, items,
    notes: `Invoice generated from completed Job ${job.jobNumber} by ${who.name}.`,
  });
}

export function fromQuotation(q: Quotation) {
  // Items and totals are copied as-is so the invoice matches what the customer accepted.
  const inv = createInvoice({
    customerId: q.customerId, locationId: q.locationId, quoteId: q.id, jobId: q.jobId, items: q.items, vatRatePercent: q.vatRatePercent,
    notes: `Invoice generated for accepted Quotation ${q.quoteNumber}. Payment terms 14 days.`,
  });
  return db.invoices.update(inv.id, { items: q.items.map((i) => ({ ...i })), subtotal: q.subtotal, vatAmount: q.vatAmount, total: q.total, balanceDue: q.total });
}

/** Daily sweep: issued / partially_paid past due_date become overdue. */
export function markOverdue(now = today()) {
  const late = db.invoices.all().filter((i) => (i.status === 'issued' || i.status === 'partially_paid') && i.dueDate < now);
  late.forEach((i) => db.invoices.update(i.id, { status: 'overdue' }));
  return late.length;
}

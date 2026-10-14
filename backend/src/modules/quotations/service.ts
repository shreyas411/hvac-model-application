import type { Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict } from '../../common/errors.js';
import { toMinutes, today } from '../../common/dates.js';
import { totals } from '../../common/money.js';
import { nextNumber } from '../../common/numbering.js';
import { db, must } from '../../common/store.js';
import { assertLocation } from '../customers/service.js';
import { fromQuotation, toLineItems, type InvoiceInput } from '../invoices/service.js';
import { createJob } from '../jobs/service.js';

export const getQuotation = (id: string) => must(db.quotations, id, 'Quotation');

type Input = {
  customerId: string; locationId: string; jobId?: string; issueDate: string; expiryDate: string;
  items: InvoiceInput['items']; vatRatePercent?: number; terms?: string; notes?: string;
};

const priced = (i: Pick<Input, 'items' | 'vatRatePercent'>) => {
  const items = toLineItems(i.items);
  const vatRatePercent = i.vatRatePercent ?? db.settings.defaultVatRate;
  return { items, vatRatePercent, ...totals(items.map((x) => x.amount), vatRatePercent) };
};

export function createQuotation(i: Input) {
  assertLocation(i.customerId, i.locationId);
  if (i.jobId) must(db.jobs, i.jobId, 'Job');
  return db.quotations.insert({
    quoteNumber: nextNumber('quote'), customerId: i.customerId, locationId: i.locationId, jobId: i.jobId,
    issueDate: i.issueDate, expiryDate: i.expiryDate, status: 'draft', ...priced(i),
    terms: i.terms ?? db.settings.termsAndConditions, notes: i.notes,
  });
}

export function updateQuotation(id: string, patch: Partial<Input>) {
  const q = getQuotation(id);
  if (q.status !== 'draft' && q.status !== 'sent') throw conflict('NOT_EDITABLE', `A ${q.status} quotation cannot be edited`);
  const { items, vatRatePercent, ...rest } = patch;
  return db.quotations.update(id, { ...rest, ...(items || vatRatePercent !== undefined ? priced({ items: items ?? q.items, vatRatePercent: vatRatePercent ?? q.vatRatePercent }) : {}) });
}

const move = (id: string, from: Quotation['status'][], to: Quotation['status'], extra: Partial<Quotation> = {}) => {
  const q = getQuotation(id);
  if (!from.includes(q.status)) throw conflict('INVALID_TRANSITION', `Cannot move quotation from ${q.status} to ${to}`);
  return db.quotations.update(id, { status: to, ...extra });
};
export const send = (id: string) => move(id, ['draft'], 'sent');
export const reject = (id: string) => move(id, ['sent', 'viewed'], 'rejected');
export const accept = (id: string, acceptedBy: string) =>
  move(id, ['sent', 'viewed'], 'accepted', { acceptedAt: new Date().toISOString(), acceptedBy });

function assertConvertible(q: Quotation, already: string | undefined) {
  if (q.status !== 'accepted') throw conflict('NOT_ACCEPTED', 'Quotation must be accepted first');
  if (already) throw conflict('ALREADY_CONVERTED', `${q.quoteNumber} is already converted`);
}

export function convertToJob(id: string, slot: { appointmentDate: string; startTime: string; endTime: string; technicianId?: string | null }, who: Actor) {
  const q = getQuotation(id);
  assertConvertible(q, q.convertedToJobId);
  const labourHours = q.items.filter((i) => i.type === 'labour').reduce((a, l) => a + l.quantity, 0) || 4;
  const job = createJob({
    customerId: q.customerId, locationId: q.locationId, equipmentIds: [], type: 'installation', priority: 'medium',
    technicianId: slot.technicianId || null, ...slot,
    estimatedDurationMinutes: Math.max(60, toMinutes(slot.endTime) - toMinutes(slot.startTime)),
    requiredSkills: ['F-Gas Heat Pumps', 'Domestic Gas'], description: `Installation work as agreed per Quotation ${q.quoteNumber}`,
    internalNotes: q.notes, labourHours, hourlyRate: 85, travelTimeMinutes: 30, travelCharge: 35,
    checklist: ['Pre-installation survey & isolate services', 'Position equipment on secure mounts', 'Connect pipework & leak test', 'Commissioning & customer handover']
      .map((label, i) => ({ id: `chk-${i + 1}`, category: 'general' as const, label, checked: false })),
    auditAction: 'Created from Quotation', auditDetails: `Generated from accepted quote ${q.quoteNumber}`,
  }, who);
  return { job, quotation: db.quotations.update(id, { convertedToJobId: job.id }) };
}

export function convertToInvoice(id: string) {
  const q = getQuotation(id);
  assertConvertible(q, q.convertedToInvoiceId);
  const invoice = fromQuotation(q);
  return { invoice, quotation: db.quotations.update(id, { convertedToInvoiceId: invoice.id }) };
}

/** Daily sweep: sent/viewed quotations past expiry_date become expired. */
export function expireQuotations(now = today()) {
  const late = db.quotations.all().filter((q) => (q.status === 'sent' || q.status === 'viewed') && q.expiryDate < now);
  late.forEach((q) => db.quotations.update(q.id, { status: 'expired' }));
  return late.length;
}

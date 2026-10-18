import type { Invoice, Job, Quotation } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { prisma } from '../../common/prisma.js';
import { getSettings } from '../settings/service.js';
import { approveAndSend, createNotification } from './service.js';

type Input = Parameters<typeof createNotification>[0];
const SYSTEM = { name: 'System (auto-send)' } as Actor;

/**
 * Status-triggered customer email. Always created as a draft; with company setting `autoSendEmails` it is approved and sent at once,
 * otherwise staff approve it in Notifications. Never throws: a customer without consent / on SMS only simply gets no email.
 */
export async function queueEmail(i: Omit<Input, 'channel' | 'status'>) {
  try {
    const n = await createNotification({ ...i, channel: 'email' });
    if ((await getSettings()).autoSendEmails) await approveAndSend(n.id, SYSTEM);
  } catch { /* no consent / channel not preferred / delivery failure is recorded on the notification */ }
}

const gbp = (n: number) => `£${n.toFixed(2)}`;

export const emailInvoiceIssued = (inv: Invoice) => queueEmail({
  customerId: inv.customerId, type: 'invoice_issued', invoiceId: inv.id, subject: `Invoice ${inv.invoiceNumber}`,
  messageBody: `Please find invoice ${inv.invoiceNumber} attached. Total ${gbp(inv.total)}, due ${inv.dueDate}.`,
});

export const emailQuotationReady = (q: Quotation, link: string) => queueEmail({
  customerId: q.customerId, type: 'quotation_ready', quotationId: q.id, subject: `Quotation ${q.quoteNumber}`,
  messageBody: `Your quotation ${q.quoteNumber} (total ${gbp(q.total)}, valid until ${q.expiryDate}) is attached. Review and accept it online: ${link}`,
});

async function engineer(job: Job) {
  return job.technicianId ? (await prisma.technician.findUnique({ where: { id: job.technicianId }, select: { name: true } }))?.name : undefined;
}

/** Job has an engineer and a slot (scheduled). */
export async function emailBookingConfirmed(job: Job) {
  if (!job.technicianId) return;
  const eng = await engineer(job);
  await queueEmail({
    customerId: job.customerId, type: 'booking_confirmation', subject: `Appointment confirmed: ${job.jobNumber}`,
    messageBody: `Your appointment is booked for ${job.appointmentDate} at ${job.startTime}${eng ? `. ${eng} will be your attending engineer` : ''}. Reference ${job.jobNumber}.`,
  });
}

export async function emailEngineerOnTheWay(job: Job) {
  const eng = await engineer(job);
  await queueEmail({
    customerId: job.customerId, type: 'technician_arriving', subject: `Your engineer is on the way: ${job.jobNumber}`,
    messageBody: `${eng ?? 'Your engineer'} has been dispatched and is on the way for your ${job.startTime} appointment today (ref ${job.jobNumber}).`,
  });
}

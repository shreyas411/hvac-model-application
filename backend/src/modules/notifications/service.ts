import type { Prisma } from '@prisma/client';
import type { CustomerNotification } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, notFound, unprocessable } from '../../common/errors.js';
import { date, isUuid, plain, prisma, refer } from '../../common/prisma.js';
import { pageFrom } from '../../common/paginate.js';
import { config } from '../../config.js';
import { logger } from '../../common/logger.js';
import { getCustomer } from '../customers/service.js';

/** Delivery seam. v1 is log-only; swap in an email/SMS provider later. */
export interface Provider { send(n: CustomerNotification): Promise<void> }
export const logProvider: Provider = { async send(n) { logger.info({ id: n.id, channel: n.channel, to: n.recipient, subject: n.subject }, 'notification sent (log provider)'); } };
// Dynamic imports: the PDF services import modules that import this one.
const pdfFor = async (n: CustomerNotification) =>
  n.invoiceId ? { filename: 'invoice.pdf', pdf: await (await import('../invoices/pdf.service.js')).generateInvoicePdf(n.invoiceId) }
  : n.quotationId ? { filename: 'quotation.pdf', pdf: await (await import('../quotations/pdf.service.js')).generateQuotationPdf(n.quotationId) }
  : null;

/** Email via Resend's HTTP API (no SDK). Other channels stay log-only until an SMS provider is added. */
const resendProvider: Provider = { async send(n) {
  if (n.channel !== 'email') return logProvider.send(n);
  const attachment = await pdfFor(n);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${config.resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: config.mailFrom, to: [n.recipient], subject: n.subject, text: n.messageBody,
      ...(attachment && { attachments: [{ filename: attachment.filename, content: Buffer.from(attachment.pdf).toString('base64') }] }),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
} };
let provider: Provider = config.resendApiKey ? resendProvider : logProvider;
export const setProvider = (p: Provider) => { provider = p; };

const toNotification = (n: Prisma.NotificationGetPayload<object>) => plain(n, ['legacyId']) as unknown as CustomerNotification;

export async function getNotification(id: string) {
  const row = isUuid(id) ? await prisma.notification.findUnique({ where: { id } }) : null;
  if (!row) throw notFound('Notification');
  return toNotification(row);
}
export const pageNotifications = (query: unknown) => pageFrom(query, prisma.notification, { searchFields: ['subject', 'recipient', 'messageBody'] }, toNotification);
export const listNotifications = async () => (await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })).map(toNotification);

type Input = Pick<CustomerNotification, 'customerId' | 'type' | 'channel' | 'subject' | 'messageBody'> & { recipient?: string; invoiceId?: string; quotationId?: string; status?: 'draft' | 'ready_to_send' };

export async function createNotification(i: Input) {
  const c = await getCustomer(i.customerId);
  if (!c.gdprConsent) throw unprocessable('CONSENT_REQUIRED', 'Customer has not given GDPR consent');
  if (c.communicationPreference !== 'both' && c.communicationPreference !== i.channel)
    throw unprocessable('CHANNEL_NOT_PREFERRED', `Customer prefers ${c.communicationPreference}`);
  return toNotification(await prisma.notification.create({ data: {
    customerId: i.customerId, type: i.type, channel: i.channel, subject: i.subject, messageBody: i.messageBody, invoiceId: i.invoiceId, quotationId: i.quotationId,
    recipient: i.recipient ?? (i.channel === 'email' ? c.email : c.phone), status: i.status ?? 'draft',
  } }));
}

/**
 * Sends one ready_to_send notification. A conditional UPDATE claims it (ready_to_send -> sending), so a second caller
 * (the API and a separate worker, say) finds nothing to claim and a notification is never sent twice. The provider
 * runs outside any transaction, so a slow provider holds no database connection or lock.
 */
async function deliver(id: string) {
  const claim = await prisma.notification.updateMany({ where: { id, status: 'ready_to_send' }, data: { status: 'sending', claimedAt: new Date() } });
  if (claim.count) {
    const n = toNotification(await prisma.notification.findUniqueOrThrow({ where: { id } }));
    try {
      await provider.send(n);
      await prisma.notification.update({ where: { id }, data: { status: 'sent', sentAt: new Date() } });
    } catch (e) {
      logger.error({ id, err: e }, 'notification delivery failed');
      await prisma.notification.update({ where: { id }, data: { status: 'failed' } });
    }
  }
  return getNotification(id);
}

/** Staff approval; delivery happens right away, the worker retries anything left ready_to_send. */
export async function approveAndSend(id: string, who: Actor) {
  const { count } = isUuid(id) ? await prisma.notification.updateMany({ where: { id, status: { notIn: ['sent', 'sending'] } }, data: { status: 'ready_to_send', approvedBy: who.name } }) : { count: 0 };
  if (!count) {
    await getNotification(id); // 404 if missing
    throw conflict('ALREADY_SENT', 'Notification already sent');
  }
  return deliver(id);
}

const STUCK_SENDING_MS = 5 * 60_000;

export async function deliverApproved() {
  // A worker that died mid-send leaves `sending` rows behind: put them back in the queue (at-least-once for those rare rows).
  await prisma.notification.updateMany({ where: { status: 'sending', claimedAt: { lt: new Date(Date.now() - STUCK_SENDING_MS) } }, data: { status: 'ready_to_send' } });
  const queued = await prisma.notification.findMany({ where: { status: 'ready_to_send', approvedBy: { not: null } }, select: { id: true } });
  for (const { id } of queued) await deliver(id);
  return queued.length;
}

/** Import ops (see importPartOps). */
export const importNotificationOps = (rows: any[], ids: Map<string, string>) => ({
  wipe: prisma.notification.deleteMany(),
  create: rows.map((n) => prisma.notification.create({ data: {
    legacyId: n.id, customerId: refer(ids, n.customerId, `notification ${n.id}`), type: n.type, recipient: n.recipient ?? '', channel: n.channel,
    subject: n.subject ?? '', messageBody: n.messageBody ?? '', status: n.status ?? 'draft', sentAt: date(n.sentAt), approvedBy: n.approvedBy, createdAt: date(n.createdAt),
  } })),
});

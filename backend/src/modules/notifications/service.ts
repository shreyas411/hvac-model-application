import type { Prisma } from '@prisma/client';
import type { CustomerNotification } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, notFound, unprocessable } from '../../common/errors.js';
import { date, isUuid, plain, prisma, refer } from '../../common/prisma.js';
import { logger } from '../../common/logger.js';
import { getCustomer } from '../customers/service.js';

/** Delivery seam. v1 is log-only; swap in an email/SMS provider later. */
export interface Provider { send(n: CustomerNotification): Promise<void> }
export const logProvider: Provider = { async send(n) { logger.info({ id: n.id, channel: n.channel, to: n.recipient, subject: n.subject }, 'notification sent (log provider)'); } };
let provider: Provider = logProvider;
export const setProvider = (p: Provider) => { provider = p; };

const toNotification = (n: Prisma.NotificationGetPayload<object>) => plain(n, ['legacyId']) as unknown as CustomerNotification;

export async function getNotification(id: string) {
  const row = isUuid(id) ? await prisma.notification.findUnique({ where: { id } }) : null;
  if (!row) throw notFound('Notification');
  return toNotification(row);
}
export const listNotifications = async () => (await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })).map(toNotification);

type Input = Pick<CustomerNotification, 'customerId' | 'type' | 'channel' | 'subject' | 'messageBody'> & { recipient?: string; status?: 'draft' | 'ready_to_send' };

export async function createNotification(i: Input) {
  const c = await getCustomer(i.customerId);
  if (!c.gdprConsent) throw unprocessable('CONSENT_REQUIRED', 'Customer has not given GDPR consent');
  if (c.communicationPreference !== 'both' && c.communicationPreference !== i.channel)
    throw unprocessable('CHANNEL_NOT_PREFERRED', `Customer prefers ${c.communicationPreference}`);
  return toNotification(await prisma.notification.create({ data: {
    customerId: i.customerId, type: i.type, channel: i.channel, subject: i.subject, messageBody: i.messageBody,
    recipient: i.recipient ?? (i.channel === 'email' ? c.email : c.phone), status: i.status ?? 'draft',
  } }));
}

/**
 * Sends one ready_to_send notification. The row stays locked while the provider runs, and SKIP LOCKED makes a second
 * caller (the API and a separate worker, say) pass over it, so a notification is never sent twice.
 * ponytail: the lock is held for the provider call (30s cap); switch to a `sending` status if real providers are slow.
 */
async function deliver(id: string) {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<unknown[]>`SELECT 1 FROM customer_notifications WHERE id = ${id}::uuid AND status = 'ready_to_send' FOR UPDATE SKIP LOCKED`;
    if (!locked.length) return;
    const n = toNotification(await tx.notification.findUniqueOrThrow({ where: { id } }));
    try {
      await provider.send(n);
      await tx.notification.update({ where: { id }, data: { status: 'sent', sentAt: new Date() } });
    } catch (e) {
      logger.error({ id, err: e }, 'notification delivery failed');
      await tx.notification.update({ where: { id }, data: { status: 'failed' } });
    }
  }, { timeout: 30_000 });
  return getNotification(id);
}

/** Staff approval; delivery happens right away, the worker retries anything left ready_to_send. */
export async function approveAndSend(id: string, who: Actor) {
  const { count } = isUuid(id) ? await prisma.notification.updateMany({ where: { id, status: { not: 'sent' } }, data: { status: 'ready_to_send', approvedBy: who.name } }) : { count: 0 };
  if (!count) {
    await getNotification(id); // 404 if missing
    throw conflict('ALREADY_SENT', 'Notification already sent');
  }
  return deliver(id);
}

export async function deliverApproved() {
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

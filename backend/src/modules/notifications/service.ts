import type { CustomerNotification } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, unprocessable } from '../../common/errors.js';
import { db, must } from '../../common/store.js';
import { logger } from '../../common/logger.js';
import { getCustomer } from '../customers/service.js';

/** Delivery seam. v1 is log-only; swap in an email/SMS provider later. */
export interface Provider { send(n: CustomerNotification): Promise<void> }
export const logProvider: Provider = { async send(n) { logger.info({ id: n.id, channel: n.channel, to: n.recipient, subject: n.subject }, 'notification sent (log provider)'); } };
let provider: Provider = logProvider;
export const setProvider = (p: Provider) => { provider = p; };

export const getNotification = (id: string) => must(db.notifications, id, 'Notification');

type Input = Pick<CustomerNotification, 'customerId' | 'type' | 'channel' | 'subject' | 'messageBody'> & { recipient?: string; status?: 'draft' | 'ready_to_send' };

export function createNotification(i: Input) {
  const c = getCustomer(i.customerId);
  if (!c.gdprConsent) throw unprocessable('CONSENT_REQUIRED', 'Customer has not given GDPR consent');
  if (c.communicationPreference !== 'both' && c.communicationPreference !== i.channel)
    throw unprocessable('CHANNEL_NOT_PREFERRED', `Customer prefers ${c.communicationPreference}`);
  return db.notifications.insert({
    customerId: i.customerId, type: i.type, channel: i.channel, subject: i.subject, messageBody: i.messageBody,
    recipient: i.recipient ?? (i.channel === 'email' ? c.email : c.phone), status: i.status ?? 'draft',
  });
}

async function deliver(n: CustomerNotification) {
  try {
    await provider.send(n);
    return db.notifications.update(n.id, { status: 'sent', sentAt: new Date().toISOString() });
  } catch (e) {
    logger.error({ id: n.id, err: e }, 'notification delivery failed');
    return db.notifications.update(n.id, { status: 'failed' });
  }
}

/** Staff approval; delivery happens right away, the worker retries anything left ready_to_send. */
export function approveAndSend(id: string, who: Actor) {
  const n = getNotification(id);
  if (n.status === 'sent') throw conflict('ALREADY_SENT', 'Notification already sent');
  return deliver(db.notifications.update(id, { status: 'ready_to_send', approvedBy: who.name }));
}

export async function deliverApproved() {
  const queued = db.notifications.all().filter((n) => n.status === 'ready_to_send' && n.approvedBy);
  for (const n of queued) await deliver(n);
  return queued.length;
}

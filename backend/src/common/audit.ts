import type { Actor } from './auth.js';
import type { Tx } from './prisma.js';

/** Append-only trail for money/compliance actions (jobs keep their own JobAuditLog). Joins the caller's transaction. */
export const audit = (tx: Tx, entity: string, entityId: string, who: Actor, action: string, details = '') =>
  tx.auditLog.create({ data: { entity, entityId, action, details, userId: who.id, userName: who.name } });

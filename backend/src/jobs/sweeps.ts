import { logger } from '../common/logger.js';
import { markOverdue } from '../modules/invoices/service.js';
import { deliverApproved } from '../modules/notifications/service.js';
import { expireQuotations } from '../modules/quotations/service.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Notification delivery retries, plus the daily sweeps. On Supabase the sweeps also run in pg_cron (see the migration);
 * they're idempotent, so this is the fallback for databases without pg_cron (local dev).
 */
export function startWorker() {
  const sweep = async () => logger.info({ overdueInvoices: await markOverdue(), expiredQuotations: await expireQuotations() }, 'daily sweep');
  void sweep().catch((e) => logger.error(e));
  setInterval(() => void sweep().catch((e) => logger.error(e)), DAY).unref();
  setInterval(() => void deliverApproved().catch((e) => logger.error(e)), 30_000).unref();
}

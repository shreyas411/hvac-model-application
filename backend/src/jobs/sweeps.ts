import { logger } from '../common/logger.js';
import { markOverdue } from '../modules/invoices/service.js';
import { deliverApproved } from '../modules/notifications/service.js';
import { expireQuotations } from '../modules/quotations/service.js';

const DAY = 24 * 60 * 60 * 1000;

/** Daily sweeps (spec: pg_cron) + notification delivery retries. */
export function startWorker() {
  const sweep = () => logger.info({ overdueInvoices: markOverdue(), expiredQuotations: expireQuotations() }, 'daily sweep');
  sweep();
  setInterval(sweep, DAY).unref();
  setInterval(() => void deliverApproved().catch((e) => logger.error(e)), 30_000).unref();
}

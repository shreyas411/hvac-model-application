import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { authenticate } from './common/auth.js';
import { idempotency } from './common/idempotency.js';
import { errorHandler } from './common/errors.js';
import { logger } from './common/logger.js';
import { prisma } from './common/prisma.js';
import { config } from './config.js';
import { authRouter } from './modules/auth/routes.js';
import { customersRouter } from './modules/customers/routes.js';
import { dataRouter } from './modules/data/routes.js';
import { equipmentRouter } from './modules/equipment/routes.js';
import { inventoryRouter } from './modules/inventory/routes.js';
import { invoicesRouter } from './modules/invoices/routes.js';
import { jobsRouter } from './modules/jobs/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { publicQuotesRouter } from './modules/quotations/public.js';
import { quotationsRouter } from './modules/quotations/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { requestsRouter } from './modules/requests/routes.js';
import { certificatesRouter } from './modules/certificates/routes.js';
import { checklistsRouter } from './modules/checklists/routes.js';
import { maintenanceRouter } from './modules/maintenance/routes.js';
import { auditRouter } from './modules/audit/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { techniciansRouter } from './modules/technicians/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp() {
  const app = express();
  app.use(pinoHttp({ logger, genReqId: (req, res) => {
    const given = req.headers['x-request-id'];
    const id = typeof given === 'string' && /^[\w-]{1,64}$/.test(given) ? given : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  } }));
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use('/api', (_req, res, next) => (res.setHeader('cache-control', 'no-store'), next()));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));

  app.get('/healthz', (_req, res) => void res.json({ ok: true })); // liveness only; /readyz checks the DB
  app.get('/readyz', (_req, res) => void prisma.$queryRaw`SELECT 1`.then(() => res.json({ ok: true }), () => res.status(503).json({ ok: false })));

  const api = express.Router();
  // login/refresh/logout are public (small bodies, rate limited); /me authenticates itself
  api.use('/auth', rateLimit({ windowMs: 15 * 60_000, limit: config.appEnv === 'local' ? 300 : 30, standardHeaders: 'draft-8', legacyHeaders: false }), express.json({ limit: '100kb' }), authRouter);
  // customer quote approval: the emailed token is the credential; strict rate limit, small body (PNG signature)
  api.use('/public/quotes', rateLimit({ windowMs: 15 * 60_000, limit: config.appEnv === 'local' ? 300 : 60, standardHeaders: 'draft-8', legacyHeaders: false }), express.json({ limit: '600kb' }), publicQuotesRouter);
  api.use(authenticate);
  api.use(rateLimit({ windowMs: 60_000, limit: 600, keyGenerator: (req) => req.user.id, standardHeaders: 'draft-8', legacyHeaders: false, validate: { keyGeneratorIpFallback: false } }));
  api.use(express.json({ limit: '5mb' })); // signatures arrive as data URLs; only parsed for signed-in users
  api.use(idempotency);
  api.use('/users', usersRouter);
  api.use('/settings', settingsRouter);
  api.use('/audit', auditRouter);
  api.use('/certificates', certificatesRouter);
  api.use('/checklist-templates', checklistsRouter);
  api.use('/technicians', techniciansRouter);
  api.use('/customers', customersRouter);
  api.use('/equipment', equipmentRouter);
  api.use('/requests', requestsRouter);
  api.use('/jobs', jobsRouter);
  api.use('/maintenance-agreements', maintenanceRouter);
  api.use('/quotations', quotationsRouter);
  api.use('/invoices', invoicesRouter);
  api.use('/notifications', notificationsRouter);
  api.use(inventoryRouter); // /parts, /movements
  api.use(reportsRouter); // /reports/*, /dashboard
  api.use(dataRouter); // /export, /import
  app.use('/api/v1', api);

  app.use((_req, res) => void res.status(404).json({ title: 'NOT_FOUND', status: 404, code: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}

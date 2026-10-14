import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { authenticate } from './common/auth.js';
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
import { quotationsRouter } from './modules/quotations/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { requestsRouter } from './modules/requests/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { techniciansRouter } from './modules/technicians/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp() {
  const app = express();
  app.use(pinoHttp({ logger, genReqId: (req, res) => {
    const id = (req.headers['x-request-id'] as string) ?? randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  } }));
  app.use(cors({ origin: config.appUrl.split(',') }));
  app.use(express.json({ limit: '5mb' })); // signatures arrive as data URLs

  app.get('/healthz', (_req, res) => void res.json({ ok: true }));
  app.get('/readyz', (_req, res) => void prisma.$queryRaw`SELECT 1`.then(() => res.json({ ok: true }), () => res.status(503).json({ ok: false })));

  const api = express.Router();
  api.use('/auth', authRouter); // login/refresh/logout are public; /me authenticates itself
  api.use(authenticate);
  api.use('/users', usersRouter);
  api.use('/settings', settingsRouter);
  api.use('/technicians', techniciansRouter);
  api.use('/customers', customersRouter);
  api.use('/equipment', equipmentRouter);
  api.use('/requests', requestsRouter);
  api.use('/jobs', jobsRouter);
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

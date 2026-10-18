import { Router } from 'express';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { pageFrom } from '../../common/paginate.js';
import { prisma } from '../../common/prisma.js';

/** Read-only view of the append-only audit_log. `?q=` searches entity, action, details and user. */
export const auditRouter = Router();
auditRouter.get('/', allow('admin'), h((req) =>
  pageFrom(req.query, prisma.auditLog, { searchFields: ['entity', 'action', 'details', 'userName'] }, ({ createdAt, ...a }: any) => ({ ...a, timestamp: createdAt.toISOString() }))));

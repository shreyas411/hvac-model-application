import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { actor } from '../../common/auth.js';
import { crud } from '../../common/crud.js';
import { ApiError, forbidden, h } from '../../common/errors.js';
import { paginate } from '../../common/paginate.js';
import { getSettings } from '../settings/service.js';
import { money } from '../../common/zod.js';
import * as svc from './service.js';

const part = z.object({
  name: z.string().min(1), sku: z.string().min(1), description: z.string().default(''), category: z.string().min(1),
  unitCost: money, sellingPrice: money, stockQuantity: z.number().int().nonnegative().default(0),
  minStockLevel: z.number().int().nonnegative().default(0), location: z.string().default(''),
});
const adjust = z.object({
  delta: z.number().int(), type: z.enum(['used_on_job', 'stock_adjustment', 'restock_purchase']),
  notes: z.string().default(''), jobId: z.string().uuid().optional(),
});

/** Mounted at the API root: serves /parts/* and /movements. */
export const inventoryRouter = Router();
inventoryRouter.use(['/parts', '/movements'], (_req, _res, next) =>
  getSettings().then((s) => next(s.enableInventory ? undefined : new ApiError(403, 'FEATURE_DISABLED', 'Inventory is disabled in settings')), next));

const all = allow('admin', 'dispatcher', 'technician', 'accountant');
inventoryRouter.get('/movements', all, h(async (req) => {
  const { partId } = z.object({ partId: z.string().optional() }).parse(req.query);
  return paginate(await svc.listMovements(partId), req.query);
}));
inventoryRouter.post('/parts', allow('admin', 'dispatcher'), h((req) => svc.createPart(part.parse(req.body), actor(req)), 201));
// Technicians record parts only through POST /jobs/:id/parts, which ties the stock movement to a billable job line.
inventoryRouter.post('/parts/:id/adjust', allow('admin', 'dispatcher'), h((req) => {
  const b = adjust.parse(req.body);
  if (b.type === 'used_on_job') throw forbidden('Record parts used on a job via POST /jobs/:id/parts');
  return svc.adjustStock(req.params.id, b.delta, b.type, b.notes, actor(req), b.jobId);
}));
inventoryRouter.use('/parts', crud({
  repo: svc.partsRepo, label: 'Part', read: ['admin', 'dispatcher', 'technician', 'accountant'], write: ['admin', 'dispatcher'],
  create: part, update: part.omit({ stockQuantity: true }).partial(), // stock changes only via /parts/:id/adjust
  filter: (rows, q) => (q.lowStock === 'true' ? rows.filter(svc.isLowStock) : rows),
  page: (q) => (q.lowStock === 'true' ? undefined : svc.partsRepo.page(q, ['name', 'sku', 'category'])), // low stock compares two columns: in memory
}));

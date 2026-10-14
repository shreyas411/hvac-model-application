import type { InventoryMovement, PartItem } from '../../types.js';
import { ApiError, unprocessable } from '../../common/errors.js';
import { db, must } from '../../common/store.js';
import type { Actor } from '../../common/auth.js';

export type MovementType = InventoryMovement['type'];

export const getPart = (id: string) => must(db.parts, id, 'Part');
export const isLowStock = (p: PartItem) => p.stockQuantity <= p.minStockLevel;

/** The only writer of stock_quantity: updates the part and appends the ledger row together. */
export function adjustStock(partId: string, delta: number, type: MovementType, notes: string, who: Actor, jobId?: string) {
  const part = getPart(partId);
  if (!Number.isInteger(delta) || delta === 0) throw unprocessable('INVALID_QUANTITY', 'delta must be a non-zero integer');
  if (type === 'restock_purchase' && delta < 0) throw unprocessable('INVALID_QUANTITY', 'restock_purchase needs a positive delta');
  if (type === 'used_on_job' && delta > 0) throw unprocessable('INVALID_QUANTITY', 'used_on_job needs a negative delta');
  const qty = part.stockQuantity + delta;
  if (qty < 0) throw new ApiError(409, 'INSUFFICIENT_STOCK', `Only ${part.stockQuantity} of ${part.sku} in stock`);
  const movement = db.movements.insert({ partId, type, quantityDelta: delta, jobId, notes, timestamp: new Date().toISOString(), userName: who.name });
  return { part: db.parts.update(partId, { stockQuantity: qty }), movement };
}

export function createPart(data: Omit<PartItem, 'id' | 'createdAt'>, who: Actor) {
  if (db.parts.all().some((p) => p.sku === data.sku)) throw new ApiError(409, 'DUPLICATE_SKU', `SKU ${data.sku} already exists`);
  const { stockQuantity, ...rest } = data;
  const part = db.parts.insert({ ...rest, stockQuantity: 0 });
  return stockQuantity > 0 ? adjustStock(part.id, stockQuantity, 'stock_adjustment', 'Opening stock', who).part : part;
}

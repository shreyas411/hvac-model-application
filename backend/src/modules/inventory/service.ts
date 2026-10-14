import type { Prisma } from '@prisma/client';
import type { InventoryMovement, PartItem } from '../../types.js';
import { ApiError, notFound, unprocessable } from '../../common/errors.js';
import { date, isUuid, plain, prisma, prismaRepo, refer, type Tx } from '../../common/prisma.js';
import type { Actor } from '../../common/auth.js';

export type MovementType = InventoryMovement['type'];

export const partsRepo = prismaRepo<PartItem>(prisma.part);
const toPart = (r: Prisma.PartGetPayload<object>) => plain(r, ['legacyId', 'updatedAt']) as unknown as PartItem;
const toMovement = ({ createdAt, legacyId, ...m }: Prisma.InventoryMovementGetPayload<object>) =>
  ({ ...plain(m), timestamp: createdAt.toISOString() }) as unknown as InventoryMovement;

export const getPart = async (id: string, c: Tx = prisma) => {
  const row = isUuid(id) ? await c.part.findUnique({ where: { id } }) : null;
  if (!row) throw notFound('Part');
  return toPart(row);
};
export const isLowStock = (p: PartItem) => p.stockQuantity <= p.minStockLevel;

export async function listMovements(partId?: string) {
  if (partId && !isUuid(partId)) return [];
  return (await prisma.inventoryMovement.findMany({ where: { partId }, orderBy: { createdAt: 'desc' } })).map(toMovement);
}

/**
 * The only writer of stock_quantity: one conditional UPDATE (race-free, never below zero) plus the ledger row, in the caller's transaction.
 */
export async function adjustStockIn(c: Tx, partId: string, delta: number, type: MovementType, notes: string, who: Actor, jobId?: string) {
  const part = await getPart(partId, c);
  if (!Number.isInteger(delta) || delta === 0) throw unprocessable('INVALID_QUANTITY', 'delta must be a non-zero integer');
  if (type === 'restock_purchase' && delta < 0) throw unprocessable('INVALID_QUANTITY', 'restock_purchase needs a positive delta');
  if (type === 'used_on_job' && delta > 0) throw unprocessable('INVALID_QUANTITY', 'used_on_job needs a negative delta');
  const { count } = await c.part.updateMany({
    where: { id: partId, stockQuantity: { gte: delta < 0 ? -delta : 0 } },
    data: { stockQuantity: { increment: delta } },
  });
  if (!count) throw new ApiError(409, 'INSUFFICIENT_STOCK', `Only ${part.stockQuantity} of ${part.sku} in stock`);
  const movement = await c.inventoryMovement.create({ data: { partId, type, quantityDelta: delta, jobId, notes, userName: who.name } });
  return { part: await getPart(partId, c), movement: toMovement(movement) };
}
export const adjustStock = (...a: Parameters<typeof adjustStockIn> extends [Tx, ...infer R] ? R : never) =>
  prisma.$transaction((tx) => adjustStockIn(tx, ...a));

export async function createPart(data: Omit<PartItem, 'id' | 'createdAt'>, who: Actor) {
  if (await prisma.part.findUnique({ where: { sku: data.sku } })) throw new ApiError(409, 'DUPLICATE_SKU', `SKU ${data.sku} already exists`);
  const { stockQuantity, ...rest } = data;
  return prisma.$transaction(async (tx) => {
    const part = toPart(await tx.part.create({ data: { ...rest, stockQuantity: 0 } }));
    return stockQuantity > 0 ? (await adjustStockIn(tx, part.id, stockQuantity, 'stock_adjustment', 'Opening stock', who)).part : part;
  });
}

/** Import ops, run by the caller in one transaction: `wipe` first (children before parents), then `create`. */
export function importPartOps(rows: any[], ids: Map<string, string>) {
  return {
    wipe: prisma.part.deleteMany(),
    create: rows.map((p) => {
      const id = crypto.randomUUID();
      ids.set(p.id, id);
      return prisma.part.create({ data: {
        id, legacyId: p.id, name: p.name, sku: p.sku, description: p.description ?? '', category: p.category ?? '',
        unitCost: p.unitCost ?? 0, sellingPrice: p.sellingPrice ?? 0, stockQuantity: p.stockQuantity ?? 0, minStockLevel: p.minStockLevel ?? 0,
        location: p.location ?? '', createdAt: date(p.createdAt),
      } });
    }),
  };
}

export const importMovementOps = (rows: any[], ids: Map<string, string>) => ({
  wipe: prisma.inventoryMovement.deleteMany(),
  create: rows.map((m) => prisma.inventoryMovement.create({ data: {
    id: crypto.randomUUID(), legacyId: m.id, partId: refer(ids, m.partId, `movement ${m.id}`), type: m.type, quantityDelta: m.quantityDelta,
    jobId: m.jobId ? refer(ids, m.jobId, `movement ${m.id}`) : null, notes: m.notes ?? '', userName: m.userName ?? '', createdAt: date(m.timestamp),
  } })),
});

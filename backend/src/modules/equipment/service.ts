import type { Prisma } from '@prisma/client';
import type { Equipment, EquipmentServiceRecord } from '../../types.js';
import { pageFrom } from '../../common/paginate.js';
import { addMonths } from '../../common/dates.js';
import { conflict, notFound, unprocessable } from '../../common/errors.js';
import { date, isUuid, plain, prisma, refer, type Tx } from '../../common/prisma.js';
import { assertLocation } from '../customers/service.js';
import { getJob } from '../jobs/service.js';

const MONTHS = { quarterly: 3, biannual: 6, annual: 12 } as const;
const DATES = ['installationDate', 'warrantyExpiryDate', 'lastServiceDate', 'nextServiceDueDate'] as const;

const include = { serviceRecords: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] } } satisfies Prisma.EquipmentInclude;
type Row = Prisma.EquipmentGetPayload<{ include: typeof include }>;

const toEquipment = ({ legacyId, createdAt, updatedAt, serviceRecords, ...e }: Row) => ({
  ...plain(e, [], [...DATES]),
  serviceHistory: serviceRecords.map(({ equipmentId, legacyId, createdAt, ...r }) => plain(r, [], ['date'])),
}) as unknown as Equipment;

export async function getEquipment(id: string, c: Tx = prisma) {
  const row = isUuid(id) ? await c.equipment.findUnique({ where: { id }, include }) : null;
  if (!row) throw notFound('Equipment');
  return toEquipment(row);
}

/** Plugs into crud(): reads and delete only, writes go through the functions below. */
export const pageEquipment = (query: unknown) => pageFrom(query, prisma.equipment, { include, searchFields: ['brand', 'model', 'serialNumber'] }, toEquipment);
export const equipmentStore = {
  all: async () => (await prisma.equipment.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toEquipment),
  find: (id: string) => getEquipment(id).catch(() => undefined),
  insert: (d: any) => createEquipment(d),
  update: (id: string, d: any) => updateEquipment(id, d),
  remove: async (id: string) => { await prisma.equipment.delete({ where: { id } }); },
};

const dbDates = (d: Partial<Equipment>) => Object.fromEntries(DATES.filter((k) => d[k]).map((k) => [k, new Date(d[k]!)]));
const scalars = ({ serviceHistory, id, ...d }: Partial<Equipment>) => ({ ...d, ...dbDates(d) });

export async function createEquipment(data: Omit<Equipment, 'id' | 'serviceHistory' | 'nextServiceDueDate'> & { nextServiceDueDate?: string }) {
  await assertLocation(data.customerId, data.locationId);
  const next = data.nextServiceDueDate ?? addMonths(data.lastServiceDate ?? data.installationDate, MONTHS[data.maintenanceFrequency]);
  return toEquipment(await prisma.equipment.create({ data: scalars({ ...data, nextServiceDueDate: next }) as Prisma.EquipmentUncheckedCreateInput, include }));
}

export async function updateEquipment(id: string, patch: Partial<Equipment>) {
  const cur = await getEquipment(id);
  await assertLocation(patch.customerId ?? cur.customerId, patch.locationId ?? cur.locationId);
  return toEquipment(await prisma.equipment.update({ where: { id }, data: scalars(patch) as Prisma.EquipmentUncheckedUpdateInput, include }));
}

/** Records a visit, sets last_service_date and recomputes next_service_due_date from the maintenance frequency. */
export async function addServiceRecord(id: string, rec: Omit<EquipmentServiceRecord, 'id'>) {
  return prisma.$transaction(async (tx) => {
    const job = await getJob(rec.jobId, tx);
    if (!job.equipmentIds.includes(id)) throw unprocessable('EQUIPMENT_NOT_ON_JOB', 'That equipment is not attached to this job');
    if (job.status === 'cancelled') throw conflict('JOB_CLOSED', 'Cannot record service on a cancelled job');
    const eq = await getEquipment(id, tx);
    await tx.equipmentServiceRecord.create({ data: {
      equipmentId: id, date: new Date(rec.date), jobId: rec.jobId, technicianName: rec.technicianName, serviceType: rec.serviceType,
      findings: rec.findings, readings: rec.readings as Prisma.InputJsonObject | undefined, partsReplaced: rec.partsReplaced, recommendations: rec.recommendations,
    } });
    const last = !eq.lastServiceDate || rec.date > eq.lastServiceDate ? rec.date : eq.lastServiceDate;
    await tx.equipment.update({ where: { id }, data: { lastServiceDate: new Date(last), nextServiceDueDate: new Date(addMonths(last, MONTHS[eq.maintenanceFrequency])) } });
    return getEquipment(id, tx);
  });
}

/**
 * Import ops (see importPartOps). Service records point at jobs, so they're created after the jobs (`records`).
 * Historical records may name a job that isn't in the file: with `nulled` given they're imported without the link and listed there, otherwise it's a 422.
 */
export const importEquipmentOps = (rows: any[], ids: Map<string, string>, nulled?: string[]) => ({
  wipe: prisma.equipment.deleteMany(),
  create: rows.map((e) => {
    const at = `equipment ${e.id}`;
    return prisma.equipment.create({ data: {
      id: ids.get(e.id)!, legacyId: e.id, customerId: refer(ids, e.customerId, at), locationId: refer(ids, e.locationId, at),
      type: e.type, brand: e.brand ?? '', model: e.model ?? '', serialNumber: e.serialNumber ?? '',
      installationDate: date(e.installationDate), warrantyExpiryDate: date(e.warrantyExpiryDate), maintenanceFrequency: e.maintenanceFrequency,
      lastServiceDate: date(e.lastServiceDate), nextServiceDueDate: date(e.nextServiceDueDate), status: e.status ?? 'operational', locationNotes: e.locationNotes,
    } });
  }),
  records: rows.flatMap((e) => (e.serviceHistory ?? []).map((r: any) => prisma.equipmentServiceRecord.create({ data: {
    equipmentId: ids.get(e.id)!, legacyId: r.id, date: new Date(r.date), jobId: !r.jobId ? null : nulled && !ids.has(r.jobId) ? (nulled.push(`equipment ${e.id} service record ${r.id}: job ${r.jobId}`), null) : refer(ids, r.jobId, `equipment ${e.id} service record ${r.id}`),
    technicianName: r.technicianName ?? '', serviceType: r.serviceType ?? '', findings: r.findings ?? '', readings: r.readings,
    partsReplaced: r.partsReplaced ?? [], recommendations: r.recommendations,
  } }))),
});

import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { Job, JobStatus } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors.js';
import { toMinutes } from '../../common/dates.js';
import { nextNumber } from '../../common/numbering.js';
import { date, isUuid, plain, prisma, refer, type Tx } from '../../common/prisma.js';
import { assertLocation } from '../customers/service.js';
import { adjustStockIn, getPart } from '../inventory/service.js';
import { getSettings } from '../settings/service.js';
import { getTechnician } from '../technicians/service.js';

const include = {
  equipment: { select: { equipmentId: true } },
  partsUsed: { orderBy: { createdAt: 'asc' } },
  checklist: { orderBy: { position: 'asc' } },
  auditLog: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.JobInclude;
type Row = Prisma.JobGetPayload<{ include: typeof include }>;

const toJob = ({ legacyId, equipment, partsUsed, checklist, auditLog, ...j }: Row) => ({
  ...plain(j, [], ['appointmentDate']),
  technicianId: j.technicianId, // null is meaningful here: unassigned
  equipmentIds: equipment.map((e) => e.equipmentId),
  partsUsed: partsUsed.map(({ id, jobId, createdAt, ...p }) => plain(p)),
  checklist: checklist.map(({ jobId, position, ...c }) => plain(c)),
  auditTrail: auditLog.map((a) => ({ timestamp: a.createdAt.toISOString(), userId: a.userId, userName: a.userName, action: a.action, details: a.details })),
}) as unknown as Job;

export async function getJob(id: string, c: Tx = prisma) {
  const row = isUuid(id) ? await c.job.findUnique({ where: { id }, include }) : null;
  if (!row) throw notFound('Job');
  return toJob(row);
}

/** Newest first. `only` scopes to one technician (a technician with no linked profile sees nothing). */
export async function listJobs(only?: { technicianId?: string }) {
  if (only && !only.technicianId) return [];
  return (await prisma.job.findMany({ where: { technicianId: only?.technicianId }, include, orderBy: { createdAt: 'desc' } })).map(toJob);
}

// DECIDE (spec 6.2): default transition map, admins may override with `override: true`.
export const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  new: ['awaiting_approval', 'scheduled', 'cancelled'],
  awaiting_approval: ['new', 'scheduled', 'cancelled'],
  scheduled: ['new', 'dispatched', 'on_hold', 'cancelled'],
  dispatched: ['scheduled', 'in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['scheduled', 'dispatched', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};
const TECH_TARGETS: JobStatus[] = ['in_progress', 'on_hold', 'completed'];

const auditRow = (who: Actor, action: string, details: string) => ({ userId: who.id, userName: who.name, action, details });

/** First non-cancelled job of the technician that overlaps [start, end) on `day`. */
export async function findConflict(technicianId: string | null | undefined, day: string, start: string, end: string, excludeId?: string, c: Tx = prisma) {
  if (!isUuid(technicianId)) return null;
  const s = toMinutes(start), e = toMinutes(end);
  const rows = await c.job.findMany({
    where: { technicianId, appointmentDate: new Date(day), status: { not: 'cancelled' }, ...(isUuid(excludeId) && { id: { not: excludeId } }) },
    include,
  });
  const hit = rows.find((j) => s < toMinutes(j.endTime) && e > toMinutes(j.startTime));
  return hit ? toJob(hit) : null;
}

/** Conflict check inside the caller's transaction. The advisory lock serialises bookings for one technician-day, so two concurrent requests can't both pass. */
async function assertSlot(tx: Tx, j: Pick<Job, 'technicianId' | 'appointmentDate' | 'startTime' | 'endTime'>, excludeId?: string) {
  if (toMinutes(j.endTime) <= toMinutes(j.startTime)) throw unprocessable('INVALID_TIME', 'endTime must be after startTime');
  if (!j.technicianId) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${j.technicianId}:${j.appointmentDate}`}))`;
  const c = await findConflict(j.technicianId, j.appointmentDate, j.startTime, j.endTime, excludeId, tx);
  if (c) throw conflict('SCHEDULE_CONFLICT', `Technician already booked on ${c.jobNumber} (${c.startTime}-${c.endTime})`);
}

async function assertEquipment(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length && (!unique.every(isUuid) || (await prisma.equipment.count({ where: { id: { in: unique } } })) !== unique.length)) throw notFound('Equipment');
  return unique;
}

type ChecklistInput = Job['checklist'];
const checklistRows = (items: ChecklistInput) =>
  items.map((c, position) => ({ id: isUuid(c.id) ? c.id : randomUUID(), label: c.label, category: c.category, checked: c.checked, notes: c.notes, position }));

export type JobInput = Omit<Job, 'id' | 'jobNumber' | 'createdAt' | 'updatedAt' | 'auditTrail' | 'status' | 'partsUsed' | 'arrivalTime' | 'completionTime'> &
  { status?: Job['status']; auditAction?: string; auditDetails?: string };

/** Single entry point for creating jobs (direct, from request, from quotation). Numbering, refs, conflicts, audit. Joins `tx` when given. */
export async function createJob(input: JobInput, who: Actor, tx?: Tx): Promise<Job> {
  if (!tx) return prisma.$transaction((t) => createJob(input, who, t));
  const { auditAction, auditDetails, equipmentIds, checklist, appointmentDate, status, ...i } = input;
  await assertLocation(i.customerId, i.locationId);
  if (i.technicianId) await getTechnician(i.technicianId);
  const equipment = await assertEquipment(equipmentIds);
  await assertSlot(tx, input);
  return toJob(await tx.job.create({
    include,
    data: {
      ...i,
      appointmentDate: new Date(appointmentDate),
      status: status ?? (i.technicianId ? 'scheduled' : 'new'),
      jobNumber: await nextNumber('job'),
      equipment: { create: equipment.map((equipmentId) => ({ equipmentId })) },
      checklist: { create: checklistRows(checklist) },
      auditLog: { create: [auditRow(who, auditAction ?? 'Job Created', auditDetails ?? `Created by ${who.name}`)] },
    } as Prisma.JobUncheckedCreateInput,
  }));
}

const SCALARS = [
  'customerId', 'locationId', 'type', 'priority', 'technicianId', 'startTime', 'endTime', 'estimatedDurationMinutes', 'requiredSkills',
  'description', 'internalNotes', 'workPerformed', 'labourHours', 'hourlyRate', 'travelTimeMinutes', 'travelCharge', 'followUpRecommended', 'followUpNotes',
] as const;

export function updateJob(id: string, patch: Partial<Job>, who: Actor, action = 'Job updated') {
  return prisma.$transaction(async (tx) => {
    const cur = await getJob(id, tx);
    const next = { ...cur, ...patch };
    if (patch.technicianId !== undefined || patch.appointmentDate || patch.startTime || patch.endTime) await assertSlot(tx, next, id);
    if (patch.technicianId) await getTechnician(patch.technicianId);
    if (patch.customerId || patch.locationId) await assertLocation(next.customerId, next.locationId);
    const equipment = patch.equipmentIds && (await assertEquipment(patch.equipmentIds));
    return toJob(await tx.job.update({
      where: { id }, include,
      data: {
        ...Object.fromEntries(SCALARS.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]])),
        ...(patch.appointmentDate && { appointmentDate: new Date(patch.appointmentDate) }),
        ...(patch.customerSignature && { customerSignature: patch.customerSignature }),
        ...(equipment && { equipment: { deleteMany: {}, create: equipment.map((equipmentId) => ({ equipmentId })) } }),
        ...(patch.checklist && { checklist: { deleteMany: {}, create: checklistRows(patch.checklist) } }),
        auditLog: { create: [auditRow(who, action, `Updated by ${who.name}`)] },
      } as Prisma.JobUncheckedUpdateInput,
    }));
  });
}

export function changeStatus(id: string, status: JobStatus, who: Actor, opts: { note?: string; override?: boolean } = {}) {
  return prisma.$transaction(async (tx) => {
    const job = await getJob(id, tx);
    if (status === job.status) return job;
    if (opts.override && who.role !== 'admin') throw forbidden('Only admins may override the status workflow');
    if (!opts.override && !TRANSITIONS[job.status].includes(status))
      throw conflict('INVALID_TRANSITION', `Cannot move job from ${job.status} to ${status}`);
    const now = new Date();
    const text = opts.note ? `Status set to ${status}: ${opts.note}` : `Status updated to ${status}`;
    return toJob(await tx.job.update({
      where: { id }, include,
      data: {
        status,
        ...(status === 'in_progress' && !job.arrivalTime && { arrivalTime: now }),
        ...(status === 'completed' && !job.completionTime && { completionTime: now }),
        auditLog: { create: [auditRow(who, text, `Updated by ${who.name}`)] },
      },
    }));
  });
}

/** Technician-role guard: own jobs only, limited status targets. */
export function assertOwnJob(job: Job, who: { technicianId?: string }) {
  if (!who.technicianId || job.technicianId !== who.technicianId) throw forbidden('Not your job');
}
export const assertTechStatus = (status: JobStatus) => {
  if (!TECH_TARGETS.includes(status)) throw forbidden(`Technicians may only set: ${TECH_TARGETS.join(', ')}`);
};

/** Adds a part to the job and, when inventory is enabled, writes the used_on_job movement. All or nothing. */
export function addPartUsed(id: string, partId: string, quantity: number, who: Actor) {
  return prisma.$transaction(async (tx) => {
    const job = await getJob(id, tx);
    const part = await getPart(partId, tx);
    if ((await getSettings()).enableInventory) await adjustStockIn(tx, partId, -quantity, 'used_on_job', `Used on ${job.jobNumber}`, who, id);
    await tx.jobPartUsed.create({ data: { jobId: id, partId, partName: part.name, sku: part.sku, quantity, unitCost: part.unitCost, unitPrice: part.sellingPrice } });
    await tx.jobAuditLog.create({ data: { jobId: id, ...auditRow(who, `Added part ${part.name} x${quantity}`, `Updated by ${who.name}`) } });
    return getJob(id, tx);
  });
}

export const newId = randomUUID;

/** Import ops (see importPartOps). Request ids must already be in `ids` (they are assigned up front: jobs and requests point at each other). */
export function importJobOps(rows: any[], ids: Map<string, string>) {
  return {
    wipe: prisma.job.deleteMany(),
    create: rows.map((j) => {
      const at = `job ${j.id}`;
      return prisma.job.create({ data: {
        id: ids.get(j.id)!, legacyId: j.id, jobNumber: j.jobNumber,
        requestId: j.requestId ? refer(ids, j.requestId, at) : null,
        customerId: refer(ids, j.customerId, at), locationId: refer(ids, j.locationId, at),
        type: j.type, priority: j.priority ?? 'medium', status: j.status ?? 'new',
        technicianId: j.technicianId ? refer(ids, j.technicianId, at) : null,
        appointmentDate: new Date(j.appointmentDate), startTime: j.startTime, endTime: j.endTime,
        estimatedDurationMinutes: j.estimatedDurationMinutes ?? 60, requiredSkills: j.requiredSkills ?? [], description: j.description ?? '',
        internalNotes: j.internalNotes, workPerformed: j.workPerformed,
        labourHours: j.labourHours ?? 0, hourlyRate: j.hourlyRate ?? 0, travelTimeMinutes: j.travelTimeMinutes ?? 0, travelCharge: j.travelCharge ?? 0,
        customerSignature: j.customerSignature, followUpRecommended: j.followUpRecommended, followUpNotes: j.followUpNotes,
        arrivalTime: date(j.arrivalTime), completionTime: date(j.completionTime), createdAt: date(j.createdAt),
        equipment: { create: [...new Set<string>(j.equipmentIds ?? [])].map((e) => ({ equipmentId: refer(ids, e, at) })) },
        partsUsed: { create: (j.partsUsed ?? []).map((p: any) => ({
          partId: p.partId ? refer(ids, p.partId, at) : null, partName: p.partName ?? '', sku: p.sku ?? '',
          quantity: p.quantity ?? 1, unitCost: p.unitCost ?? 0, unitPrice: p.unitPrice ?? 0,
        })) },
        checklist: { create: (j.checklist ?? []).map((c: any, position: number) => ({ label: c.label, category: c.category, checked: !!c.checked, notes: c.notes, position })) },
        auditLog: { create: (j.auditTrail ?? []).map((a: any) => ({ userId: a.userId ?? '', userName: a.userName ?? '', action: a.action ?? '', details: a.details ?? '', createdAt: date(a.timestamp) })) },
      } });
    }),
  };
}

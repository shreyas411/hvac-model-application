import { randomUUID } from 'node:crypto';
import { emailBookingConfirmed, emailEngineerOnTheWay } from '../notifications/templates.js';
import type { Prisma } from '@prisma/client';
import type { Job, JobStatus } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors.js';
import { toMinutes, today } from '../../common/dates.js';
import { nextNumber } from '../../common/numbering.js';
import { date, isUuid, lockRow, plain, prisma, refer, type Tx } from '../../common/prisma.js';
import { pageFrom } from '../../common/paginate.js';
import { assertLocation } from '../customers/service.js';
import { adjustStockIn, getPart } from '../inventory/service.js';
import { getSettings } from '../settings/service.js';

const include = {
  equipment: { select: { equipmentId: true } },
  partsUsed: { orderBy: { createdAt: 'asc' } },
  checklist: { orderBy: { position: 'asc' } },
  auditLog: { orderBy: { createdAt: 'asc' } },
  refrigerantLogs: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.JobInclude;
type Row = Prisma.JobGetPayload<{ include: typeof include }>;

const toJob = ({ legacyId, equipment, partsUsed, checklist, auditLog, refrigerantLogs, ...j }: Row) => ({
  ...plain(j, [], ['appointmentDate']),
  slaBreached: !!j.slaDueAt && j.slaDueAt < new Date() && j.status === 'new',
  technicianId: j.technicianId, // null is meaningful here: unassigned
  equipmentIds: equipment.map((e) => e.equipmentId),
  refrigerantLogs: refrigerantLogs.map(({ jobId, ...l }) => plain(l)),
  partsUsed: partsUsed.map(({ jobId, createdAt, ...p }) => plain(p)),
  checklist: checklist.map(({ jobId, position, ...c }) => plain(c)),
  auditTrail: auditLog.map((a) => ({ timestamp: a.createdAt.toISOString(), userId: a.userId, userName: a.userName, action: a.action, details: a.details })),
}) as unknown as Job;

export async function getJob(id: string, c: Tx = prisma) {
  const row = isUuid(id) ? await c.job.findUnique({ where: { id }, include }) : null;
  if (!row) throw notFound('Job');
  return toJob(row);
}

/** Newest first. `only` scopes to one technician (a technician with no linked profile sees nothing). */
export async function listJobs(only?: { technicianId?: string | null }) {
  if (only && !only.technicianId) return [];
  return (await prisma.job.findMany({ where: { technicianId: only?.technicianId }, include, orderBy: { createdAt: 'desc' } })).map(toJob);
}

/** One page of jobs, filtered in SQL. Same scoping rule as listJobs. */
export async function pageJobs(query: unknown, only?: { technicianId?: string | null }) {
  if (only && !only.technicianId) return { data: [] as Job[], nextCursor: null };
  // ?from= / ?to= (YYYY-MM-DD, inclusive) bound the appointment date; anything malformed is ignored
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? new Date(v) : undefined);
  const { from, to } = (query ?? {}) as Record<string, unknown>;
  const range = day(from) || day(to) ? { appointmentDate: { gte: day(from), lte: day(to) } } : {};
  return pageFrom(query, prisma.job, { where: { ...(only && { technicianId: only.technicianId }), ...range }, include, searchFields: ['jobNumber', 'title', 'description', 'internalNotes', 'workPerformed'] }, toJob);
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
const TECH_TARGETS: JobStatus[] = ['dispatched', 'in_progress', 'on_hold', 'completed'];

const auditRow = (who: Actor, action: string, details: string) => ({ userId: who.id, userName: who.name, action, details });

/** First non-cancelled job of the technician that overlaps [start, end) on `day`. */
export async function findConflict(technicianId: string | null | undefined, day: string, start: string, end: string, excludeId?: string, c: Tx = prisma) {
  if (!isUuid(technicianId)) return null;
  const s = toMinutes(start), e = toMinutes(end);
  const rows = await c.job.findMany({
    where: { technicianId, appointmentDate: new Date(day), status: { not: 'cancelled' }, ...(isUuid(excludeId) && { id: { not: excludeId } }) },
    include,
  });
  
  // Find overlap: (StartA < EndB) AND (EndA > StartB)
  const hit = rows.find((job) => s < toMinutes(job.endTime) && e > toMinutes(job.startTime));

  return hit ? toJob(hit) : null;
}

/** Conflict check inside the caller's transaction. The advisory lock serialises bookings for one technician-day, so two concurrent requests can't both pass. */
async function assertSlot(tx: Tx, j: Pick<Job, 'technicianId' | 'appointmentDate' | 'startTime' | 'endTime'>, excludeId?: string) {
  if (toMinutes(j.endTime) <= toMinutes(j.startTime)) throw unprocessable('INVALID_TIME', 'endTime must be after startTime');
  if (!j.technicianId) return;

  // UK Industry Standard: Add 30m travel buffer to the check
  const BUFFER_MINS = 30;
  const s = toMinutes(j.startTime) - BUFFER_MINS;
  const e = toMinutes(j.endTime) + BUFFER_MINS;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${j.technicianId}:${j.appointmentDate}`}))`;

  // We use a modified check that accounts for the buffer
  const rows = await tx.job.findMany({
    where: {
      technicianId: j.technicianId,
      appointmentDate: new Date(j.appointmentDate),
      status: { not: 'cancelled' },
      ...(isUuid(excludeId) && { id: { not: excludeId } })
    },
  });

  const hit = rows.find((job) => s < toMinutes(job.endTime) && e > toMinutes(job.startTime));

  if (hit) {
    const isBufferConflict = (toMinutes(hit.endTime) <= toMinutes(j.startTime) || toMinutes(j.endTime) <= toMinutes(hit.startTime));
    const msg = isBufferConflict
      ? `Scheduling Conflict: This assignment is too close to ${hit.jobNumber}. Please allow a 30-minute travel buffer.`
      : `Scheduling Conflict: Technician already booked on ${hit.jobNumber} (${hit.startTime}-${hit.endTime})`;

    throw conflict('SCHEDULE_CONFLICT', msg);
  }
}

/** 
 * Guardrail: Ensures the technician possesses all required skills/certifications for the job.
 * Specifically checks Gas Safe and F-Gas licenses if required.
 */
async function assertCertifications(tx: Tx, technicianId: string, requiredSkills: string[]) {
  if (!requiredSkills || requiredSkills.length === 0) return;

  const tech = await tx.technician.findUnique({ where: { id: technicianId } });
  if (!tech) throw notFound('Technician');

  // GAS_SAFE / F_GAS are licences (number on file and not expired); anything else is a free-text skill.
  const LICENCES = { GAS_SAFE: ['Gas Safe', tech.gasSafeLicense, tech.gasSafeExpiry], F_GAS: ['F-Gas', tech.fGasLicense, tech.fGasExpiry] } as const;
  const missingSkills = requiredSkills.filter((skill) => !(skill in LICENCES) && !tech.skills.includes(skill));
  const missingLicenses = Object.entries(LICENCES).filter(([k]) => requiredSkills.includes(k)).flatMap(([, [label, no, expiry]]) =>
    !no ? [`${label} licence`] : expiry && expiry < new Date(today()) ? [`${label} licence (expired ${expiry.toISOString().slice(0, 10)})`] : []);

  if (missingSkills.length > 0 || missingLicenses.length > 0) {
    const details = [
      ...(missingSkills.length ? [`Missing skills: ${missingSkills.join(', ')}`] : []),
      ...(missingLicenses.length ? [`Missing licenses: ${missingLicenses.join(', ')}`] : [])
    ].join('; ');
    
    throw forbidden(`Technician is not qualified for this job. ${details}`);
  }
}

/** Equipment decides the certification: refrigerant systems need F-Gas, gas boilers Gas Safe. Merged into whatever skills the caller listed. */
const GAS_BOILERS = ['combi_boiler', 'system_boiler'];
const REFRIGERANT = ['heat_pump', 'air_conditioning', 'chiller'];
async function withEquipmentSkills(tx: Tx, equipmentIds: string[], skills: string[] = []) {
  const types = equipmentIds.length ? (await tx.equipment.findMany({ where: { id: { in: equipmentIds } }, select: { type: true } })).map((e) => e.type as string) : [];
  return [...new Set([...skills, ...(types.some((t) => GAS_BOILERS.includes(t)) ? ['GAS_SAFE'] : []), ...(types.some((t) => REFRIGERANT.includes(t)) ? ['F_GAS'] : [])])];
}

async function assertTechnician(tx: Tx, id: string) {
  if (!isUuid(id) || !(await tx.technician.count({ where: { id } }))) throw notFound('Technician');
}

async function assertEquipment(ids: string[], tx: Tx) {
  const unique = [...new Set(ids)];
  if (unique.length && (!unique.every(isUuid) || (await tx.equipment.count({ where: { id: { in: unique } } })) !== unique.length)) throw notFound('Equipment');
  return unique;
}

type ChecklistInput = Job['checklist'];
const checklistRows = (items: ChecklistInput) =>
  items.map((c, position) => ({ id: isUuid(c.id) ? c.id : randomUUID(), label: c.label, category: c.category, checked: c.checked, notes: c.notes, position }));

export type JobInput = Omit<Job, 'id' | 'jobNumber' | 'createdAt' | 'updatedAt' | 'auditTrail' | 'status' | 'partsUsed' | 'arrivalTime' | 'completionTime'> &
  { status?: Job['status']; auditAction?: string; auditDetails?: string };

/** Single entry point for creating jobs (direct, from request, from quotation). Numbering, refs, conflicts, audit. Joins `tx` when given. */
export async function createJob(input: JobInput, who: Actor, tx?: Tx): Promise<Job> {
  if (!tx) {
    const job = await prisma.$transaction((t) => createJob(input, who, t));
    if (job.status === 'scheduled') await emailBookingConfirmed(job); // after commit; callers that pass their own tx send it themselves
    return job;
  }
  const { auditAction, auditDetails, equipmentIds, checklist, appointmentDate, status, ...i } = input;
  await assertLocation(i.customerId, i.locationId, tx!);
  const equipment = await assertEquipment(equipmentIds, tx!);
  i.requiredSkills = await withEquipmentSkills(tx!, equipment, i.requiredSkills);
  if (i.technicianId) {
    await assertTechnician(tx!, i.technicianId);
    await assertCertifications(tx!, i.technicianId, i.requiredSkills);
  }
  await assertSlot(tx!, input);
  const sla = i.type === 'preventive_maintenance' ? null : await tx!.maintenanceAgreement.aggregate({ where: { customerId: i.customerId, locationId: i.locationId, active: true, slaResponseHours: { not: null } }, _min: { slaResponseHours: true } });
  const slaDueAt = sla?._min.slaResponseHours ? new Date(Date.now() + sla._min.slaResponseHours * 3_600_000) : undefined; // call-outs only: scheduled PM visits aren't response-timed
  return toJob(await tx!.job.create({

    include,
    data: {
      ...i, slaDueAt,
      appointmentDate: new Date(appointmentDate),
      status: status ?? (i.technicianId ? 'scheduled' : 'new'),
      jobNumber: await nextNumber('job', new Date(), tx!),
      equipment: { create: equipment.map((equipmentId) => ({ equipmentId })) },
      checklist: { create: checklistRows(checklist) },
      auditLog: { create: [auditRow(who, auditAction ?? 'Job Created', auditDetails ?? `Created by ${who.name}`)] },
    } as Prisma.JobUncheckedCreateInput,
  }));
}

const SCALARS = [
  'customerId', 'locationId', 'type', 'priority', 'technicianId', 'startTime', 'endTime', 'estimatedDurationMinutes', 'requiredSkills',
  'title', 'description', 'internalNotes', 'workPerformed', 'labourHours', 'hourlyRate', 'travelTimeMinutes', 'travelCharge', 'followUpRecommended', 'followUpNotes',
] as const;

export function updateJob(id: string, patch: Partial<Job>, who: Actor, action = 'Job updated') {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'jobs', id);
    const cur = await getJob(id, tx);
    // The work record is evidence: once closed only an admin may touch it (audited below).
    if ((cur.status === 'completed' || cur.status === 'cancelled') && who.role !== 'admin') throw conflict('JOB_CLOSED', `A ${cur.status} job is read-only`);
    if (who.role === 'technician' && cur.status !== 'dispatched' && cur.status !== 'in_progress') throw conflict('JOB_NOT_ACTIVE', 'Work record can only be edited while the job is dispatched or in progress');
    const equipment = patch.equipmentIds && (await assertEquipment(patch.equipmentIds, tx));
    const next = { ...cur, ...patch, requiredSkills: await withEquipmentSkills(tx, equipment ?? cur.equipmentIds, patch.requiredSkills ?? cur.requiredSkills) };
    if (equipment || patch.requiredSkills) patch = { ...patch, requiredSkills: next.requiredSkills };
    if (patch.technicianId !== undefined || patch.appointmentDate || patch.startTime || patch.endTime) await assertSlot(tx, next, id);
    if (patch.technicianId) {
      await assertTechnician(tx, patch.technicianId);
      await assertCertifications(tx, patch.technicianId, next.requiredSkills);
    } else if (equipment && cur.technicianId) await assertCertifications(tx, cur.technicianId, next.requiredSkills);
    if (patch.customerId || patch.locationId) await assertLocation(next.customerId, next.locationId, tx);

    return toJob(await tx.job.update({
      where: { id }, include,
      data: {
        ...Object.fromEntries(SCALARS.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]])),
        ...(patch.appointmentDate && { appointmentDate: new Date(patch.appointmentDate) }),
        ...(patch.customerSignature && { customerSignature: patch.customerSignature }),
        ...(equipment && { equipment: { deleteMany: {}, create: equipment.map((equipmentId) => ({ equipmentId })) } }),
        ...(patch.checklist && { checklist: { deleteMany: {}, create: checklistRows(patch.checklist) } }),
        auditLog: { create: [auditRow(who, action, cur.status === 'completed' || cur.status === 'cancelled' ? `Closed job edited by ${who.name}` : `Updated by ${who.name}`)] },
      } as Prisma.JobUncheckedUpdateInput,
    }));
  });
}

const SAFETY = ['gas_safety', 'electrical', 'refrigerant'];
const ACTIVE: JobStatus[] = ['scheduled', 'dispatched', 'in_progress'];

/** Compliance record required before a job can close: safety checklist ticked, work described, customer signed. Admin override skips it (audited). */
function assertCompletable(job: Job) {
  const open = job.checklist.filter((c) => SAFETY.includes(c.category) && !c.checked).map((c) => c.label);
  const missing = [
    ...(open.length ? [`unchecked safety items: ${open.join(', ')}`] : []),
    ...(job.checklist.some((c) => c.category === 'refrigerant') && !job.refrigerantLogs?.length ? ['refrigerant log entry'] : []),
    ...(job.workPerformed?.trim() ? [] : ['work performed']),
    ...(job.customerSignature ? [] : ['customer signature']),
  ];
  if (missing.length) throw unprocessable('NOT_COMPLETABLE', `Cannot complete job, missing: ${missing.join('; ')}`);
}

export async function changeStatus(id: string, status: JobStatus, who: Actor, opts: { note?: string; override?: boolean } = {}) {
  let from: JobStatus | undefined;
  const updated = await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'jobs', id); // serialises concurrent transitions: the second one re-reads the new status
    const job = await getJob(id, tx);
    if (status === job.status) return job;
    from = job.status;
    if (opts.override && who.role !== 'admin') throw forbidden('Only admins may override the status workflow');
    if (opts.override && !opts.note?.trim()) throw unprocessable('REASON_REQUIRED', 'A reason (note) is required for a status override');
    if (!opts.override && !TRANSITIONS[job.status].includes(status))
      throw conflict('INVALID_TRANSITION', `Cannot move job from ${job.status} to ${status}`);
    if (status === 'completed' && !opts.override) assertCompletable(job);
    // Re-activating a job (on_hold -> scheduled, admin override of cancelled...) must still fit the technician's day.
    if (ACTIVE.includes(status) && !ACTIVE.includes(job.status) && job.status !== 'new' && job.status !== 'awaiting_approval') await assertSlot(tx, job, id);
    if (status === 'cancelled' && job.partsUsed.length && !(await tx.invoice.count({ where: { jobId: id, status: { not: 'void' } } })) && (await getSettings()).enableInventory)
      for (const p of job.partsUsed) if (p.partId) await adjustStockIn(tx, p.partId, p.quantity, 'restock_purchase', `Returned: ${job.jobNumber} cancelled`, who, id);
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
  if (from && status === 'scheduled' && from !== 'scheduled') await emailBookingConfirmed(updated);
  if (from && status === 'dispatched' && from === 'scheduled') await emailEngineerOnTheWay(updated);
  return updated;
}

/** Technician-role guard: own jobs only, limited status targets. */
export function assertOwnJob(job: Job, who: { technicianId?: string | null }) {
  if (!who.technicianId || job.technicianId !== who.technicianId) throw forbidden('Not your job');
}
export const assertTechStatus = (status: JobStatus) => {
  if (!TECH_TARGETS.includes(status)) throw forbidden(`Technicians may only set: ${TECH_TARGETS.join(', ')}`);
};

/** Parts can only change while the job is open and not yet invoiced: the invoice is built from this list. */
async function assertPartsEditable(tx: Tx, job: Job) {
  if (job.status === 'completed' || job.status === 'cancelled') throw conflict('JOB_CLOSED', `Parts cannot change on a ${job.status} job`);
  if (await tx.invoice.count({ where: { jobId: job.id, status: { not: 'void' } } })) throw conflict('JOB_INVOICED', 'Parts cannot change once the job is invoiced');
}

/** Adds a part to the job and, when inventory is enabled, writes the used_on_job movement. All or nothing. */
export function addPartUsed(id: string, partId: string, quantity: number, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'jobs', id);
    const job = await getJob(id, tx);
    await assertPartsEditable(tx, job);
    const part = await getPart(partId, tx);
    if ((await getSettings()).enableInventory) await adjustStockIn(tx, partId, -quantity, 'used_on_job', `Used on ${job.jobNumber}`, who, id);
    await tx.jobPartUsed.create({ data: { jobId: id, partId, partName: part.name, sku: part.sku, quantity, unitCost: part.unitCost, unitPrice: part.sellingPrice } });
    await tx.jobAuditLog.create({ data: { jobId: id, ...auditRow(who, `Added part ${part.name} x${quantity}`, `Updated by ${who.name}`) } });
    return getJob(id, tx);
  });
}

/** Undoes a mis-keyed or unused part: removes the line and returns the stock in the same transaction. */
export function removePartUsed(id: string, usedId: string, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'jobs', id);
    const job = await getJob(id, tx);
    await assertPartsEditable(tx, job);
    const used = isUuid(usedId) ? await tx.jobPartUsed.findFirst({ where: { id: usedId, jobId: id } }) : null;
    if (!used) throw notFound('Part line');
    if (used.partId && (await getSettings()).enableInventory) await adjustStockIn(tx, used.partId, used.quantity, 'restock_purchase', `Returned from ${job.jobNumber}`, who, id);
    await tx.jobPartUsed.delete({ where: { id: usedId } });
    await tx.jobAuditLog.create({ data: { jobId: id, ...auditRow(who, `Removed part ${used.partName} x${used.quantity}`, `Updated by ${who.name}`) } });
    return getJob(id, tx);
  });
}

export type RefrigerantInput = { refrigerant: string; action: 'charge' | 'recover' | 'reclaim' | 'leak_check'; amountKg: number; cylinderId: string; certNumber: string; equipmentId?: string; notes?: string };

/** One handling record per charge/recovery/leak check: the evidence refrigerant regulations ask for. Only while the job is open. */
export function addRefrigerantLog(id: string, r: RefrigerantInput, who: Actor) {
  return prisma.$transaction(async (tx) => {
    await lockRow(tx, 'jobs', id);
    const job = await getJob(id, tx);
    if (job.status === 'completed' || job.status === 'cancelled') throw conflict('JOB_CLOSED', `Refrigerant log is closed on a ${job.status} job`);
    if (r.equipmentId && !job.equipmentIds.includes(r.equipmentId)) throw unprocessable('EQUIPMENT_NOT_ON_JOB', 'That equipment is not attached to this job');
    await tx.refrigerantLog.create({ data: { jobId: id, ...r, createdBy: who.name } });
    await tx.jobAuditLog.create({ data: { jobId: id, ...auditRow(who, `Refrigerant ${r.action}: ${r.amountKg} kg ${r.refrigerant}`, `Cylinder ${r.cylinderId || 'n/a'}, cert ${r.certNumber}`) } });
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
        estimatedDurationMinutes: j.estimatedDurationMinutes ?? 60, requiredSkills: j.requiredSkills ?? [], title: j.title ?? '', description: j.description ?? '',
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

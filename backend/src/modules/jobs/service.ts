import { randomUUID } from 'node:crypto';
import type { AuditLog, Job, JobStatus } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict, forbidden, unprocessable } from '../../common/errors.js';
import { toMinutes } from '../../common/dates.js';
import { nextNumber } from '../../common/numbering.js';
import { db, must } from '../../common/store.js';
import { assertLocation } from '../customers/service.js';
import { adjustStock } from '../inventory/service.js';

export const getJob = (id: string) => must(db.jobs, id, 'Job');

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

const audit = (who: Actor, action: string, details: string): AuditLog => ({
  timestamp: new Date().toISOString(), userId: who.id, userName: who.name, action, details,
});

/** First non-cancelled job of the technician that overlaps [start, end) on `date`. */
export function findConflict(technicianId: string | null | undefined, date: string, start: string, end: string, excludeId?: string) {
  if (!technicianId) return null;
  const s = toMinutes(start), e = toMinutes(end);
  return db.jobs.all().find((j) =>
    j.id !== excludeId && j.technicianId === technicianId && j.appointmentDate === date && j.status !== 'cancelled' &&
    s < toMinutes(j.endTime) && e > toMinutes(j.startTime)) ?? null;
}
function assertSlot(j: Pick<Job, 'technicianId' | 'appointmentDate' | 'startTime' | 'endTime'>, excludeId?: string) {
  if (toMinutes(j.endTime) <= toMinutes(j.startTime)) throw unprocessable('INVALID_TIME', 'endTime must be after startTime');
  const c = findConflict(j.technicianId, j.appointmentDate, j.startTime, j.endTime, excludeId);
  if (c) throw conflict('SCHEDULE_CONFLICT', `Technician already booked on ${c.jobNumber} (${c.startTime}-${c.endTime})`);
}

export type JobInput = Omit<Job, 'id' | 'jobNumber' | 'createdAt' | 'updatedAt' | 'auditTrail' | 'status' | 'partsUsed' | 'arrivalTime' | 'completionTime'> &
  { status?: Job['status']; auditAction?: string; auditDetails?: string };

/** Single entry point for creating jobs (direct, from request, from quotation). Numbering, refs, conflicts, audit. */
export function createJob({ auditAction, auditDetails, ...input }: JobInput, who: Actor): Job {
  assertLocation(input.customerId, input.locationId);
  if (input.technicianId) must(db.technicians, input.technicianId, 'Technician');
  input.equipmentIds.forEach((id) => must(db.equipment, id, 'Equipment'));
  assertSlot(input);
  return db.jobs.insert({
    ...input,
    status: input.status ?? (input.technicianId ? 'scheduled' : 'new'),
    jobNumber: nextNumber('job'),
    partsUsed: [],
    auditTrail: [audit(who, auditAction ?? 'Job Created', auditDetails ?? `Created by ${who.name}`)],
  });
}

export function updateJob(id: string, patch: Partial<Job>, who: Actor, action = 'Job updated') {
  const cur = getJob(id);
  const next = { ...cur, ...patch };
  if (patch.technicianId !== undefined || patch.appointmentDate || patch.startTime || patch.endTime) assertSlot(next, id);
  if (patch.technicianId) must(db.technicians, patch.technicianId, 'Technician');
  return db.jobs.update(id, { ...patch, auditTrail: [...cur.auditTrail, audit(who, action, `Updated by ${who.name}`)] });
}

export function changeStatus(id: string, status: JobStatus, who: Actor, opts: { note?: string; override?: boolean } = {}) {
  const job = getJob(id);
  if (status === job.status) return job;
  if (opts.override && who.role !== 'admin') throw forbidden('Only admins may override the status workflow');
  if (!opts.override && !TRANSITIONS[job.status].includes(status))
    throw conflict('INVALID_TRANSITION', `Cannot move job from ${job.status} to ${status}`);
  const now = new Date().toISOString();
  const patch: Partial<Job> = { status };
  if (status === 'in_progress' && !job.arrivalTime) patch.arrivalTime = now;
  if (status === 'completed' && !job.completionTime) patch.completionTime = now;
  const text = opts.note ? `Status set to ${status}: ${opts.note}` : `Status updated to ${status}`;
  return db.jobs.update(id, { ...patch, auditTrail: [...job.auditTrail, audit(who, text, `Updated by ${who.name}`)] });
}

/** Technician-role guard: own jobs only, limited status targets. */
export function assertOwnJob(job: Job, who: { technicianId?: string }) {
  if (!who.technicianId || job.technicianId !== who.technicianId) throw forbidden('Not your job');
}
export const assertTechStatus = (status: JobStatus) => {
  if (!TECH_TARGETS.includes(status)) throw forbidden(`Technicians may only set: ${TECH_TARGETS.join(', ')}`);
};

/** Adds a part to the job and, when inventory is enabled, writes the used_on_job movement. Stock is checked first so nothing is half-applied. */
export function addPartUsed(id: string, partId: string, quantity: number, who: Actor) {
  const job = getJob(id);
  const part = must(db.parts, partId, 'Part');
  if (db.settings.enableInventory) adjustStock(partId, -quantity, 'used_on_job', `Used on ${job.jobNumber}`, who, id);
  const used = { partId, partName: part.name, sku: part.sku, quantity, unitCost: part.unitCost, unitPrice: part.sellingPrice };
  return db.jobs.update(id, {
    partsUsed: [...job.partsUsed, used],
    auditTrail: [...job.auditTrail, audit(who, `Added part ${part.name} x${quantity}`, `Updated by ${who.name}`)],
  });
}

export const newId = randomUUID;

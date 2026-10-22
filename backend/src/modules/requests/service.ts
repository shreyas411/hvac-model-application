import type { ServiceRequest } from '../../types.js';
import { emailBookingConfirmed } from '../notifications/templates.js';
import type { Actor } from '../../common/auth.js';
import { conflict, notFound } from '../../common/errors.js';
import { toMinutes } from '../../common/dates.js';
import { nextNumber } from '../../common/numbering.js';
import { date, isUuid, plain, prisma, prismaRepo, refer, type Tx } from '../../common/prisma.js';
import { assertLocation } from '../customers/service.js';
import { getEquipment } from '../equipment/service.js';
import { getSettings } from '../settings/service.js';
import { createJob } from '../jobs/service.js';

export const requestsRepo = prismaRepo<ServiceRequest>(prisma.serviceRequest, ['legacyId']);
export const pageRequests = (query: unknown) => requestsRepo.page(query, ['requestNumber', 'reportedProblem'], ['priority', 'status', 'customer.name']);

export async function getRequest(id: string, c: Tx = prisma) {
  const r = isUuid(id) ? await c.serviceRequest.findUnique({ where: { id } }) : null;
  if (!r) throw notFound('Service request');
  return plain(r, ['legacyId']) as unknown as ServiceRequest;
}

type Input = Omit<ServiceRequest, 'id' | 'requestNumber' | 'createdAt' | 'updatedAt' | 'convertedJobId'>;

export async function createRequest(data: Input) {
  await assertLocation(data.customerId, data.locationId);
  if (data.equipmentId) await getEquipment(data.equipmentId);
  return requestsRepo.insert({ ...data, requestNumber: await nextNumber('request') });
}

export async function updateRequest(id: string, patch: Partial<Input>) {
  const cur = await getRequest(id);
  if (patch.customerId || patch.locationId) await assertLocation(patch.customerId ?? cur.customerId, patch.locationId ?? cur.locationId);
  if (patch.equipmentId) await getEquipment(patch.equipmentId);
  return requestsRepo.update(id, patch);
}

/** Marks the request converted and creates the job in one transaction; the status flip is a conditional UPDATE, so a double submit can't make two jobs. */
export async function convertToJob(id: string, slot: { appointmentDate: string; startTime: string; endTime: string; technicianId?: string | null }, who: Actor) {
  const job = await prisma.$transaction(async (tx) => {
    const r = await getRequest(id, tx);
    if (r.status === 'converted') throw conflict('ALREADY_CONVERTED', `${r.requestNumber} is already converted`);
    if (r.status === 'cancelled') throw conflict('REQUEST_CANCELLED', `${r.requestNumber} is cancelled`);
    const claim = await tx.serviceRequest.updateMany({ where: { id, status: { in: ['new', 'awaiting_approval'] } }, data: { status: 'converted' } });
    if (!claim.count) throw conflict('ALREADY_CONVERTED', `${r.requestNumber} is already converted`);
    const rates = await getSettings();
    const duration = Math.max(30, toMinutes(slot.endTime) - toMinutes(slot.startTime));
    const job = await createJob({
      requestId: r.id, customerId: r.customerId, locationId: r.locationId, equipmentIds: r.equipmentId ? [r.equipmentId] : [],
      type: r.priority === 'emergency' ? 'emergency_callout' : 'repair', priority: r.priority,
      technicianId: slot.technicianId || null, ...slot, estimatedDurationMinutes: duration,
      requiredSkills: [], title: r.reportedProblem.slice(0, 80), description: r.reportedProblem, internalNotes: r.internalNotes,
      labourHours: duration / 60, hourlyRate: rates.defaultHourlyRate, travelTimeMinutes: 30, travelCharge: rates.defaultTravelCharge,
      checklist: [
        'Initial visual inspection & safety check', 'Perform diagnostics & identify root cause', 'Test operation and log readings',
      ].map((label, i) => ({ id: `chk-${i + 1}`, category: 'general' as const, label, checked: false })),
      auditAction: 'Converted from Service Request', auditDetails: `Created from ${r.requestNumber}`,
    }, who, tx);
    await tx.serviceRequest.update({ where: { id }, data: { convertedJobId: job.id } });
    return job;
  });
  if (job.status === 'scheduled') await emailBookingConfirmed(job);
  return job;
}

/** Import ops (see importPartOps). `convertedJobId` is set after the jobs exist (jobs point back at requests). */
export function importRequestOps(rows: any[], ids: Map<string, string>) {
  return {
    wipe: prisma.serviceRequest.deleteMany(),
    create: rows.map((r) => {
      const at = `request ${r.id}`;
      return prisma.serviceRequest.create({ data: {
        id: ids.get(r.id)!, legacyId: r.id, requestNumber: r.requestNumber,
        customerId: refer(ids, r.customerId, at), locationId: refer(ids, r.locationId, at),
        equipmentId: r.equipmentId ? refer(ids, r.equipmentId, at) : null, reportedProblem: r.reportedProblem ?? '',
        priority: r.priority ?? 'medium', preferredSlot: r.preferredSlot ?? 'all_day', status: r.status ?? 'new',
        contactPerson: r.contactPerson, contactPhone: r.contactPhone, internalNotes: r.internalNotes, createdAt: date(r.createdAt),
      } });
    }),
    link: rows.filter((r) => r.convertedJobId).map((r) =>
      prisma.serviceRequest.update({ where: { id: ids.get(r.id)! }, data: { convertedJobId: refer(ids, r.convertedJobId, `request ${r.id}`) } })),
  };
}

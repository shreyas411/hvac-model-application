import type { ServiceRequest } from '../../types.js';
import type { Actor } from '../../common/auth.js';
import { conflict } from '../../common/errors.js';
import { toMinutes } from '../../common/dates.js';
import { nextNumber } from '../../common/numbering.js';
import { db, must } from '../../common/store.js';
import { assertLocation } from '../customers/service.js';
import { createJob } from '../jobs/service.js';

export const getRequest = (id: string) => must(db.requests, id, 'Service request');

export function createRequest(data: Omit<ServiceRequest, 'id' | 'requestNumber' | 'createdAt' | 'updatedAt' | 'convertedJobId'>) {
  assertLocation(data.customerId, data.locationId);
  if (data.equipmentId) must(db.equipment, data.equipmentId, 'Equipment');
  return db.requests.insert({ ...data, requestNumber: nextNumber('request') });
}

/** Creates the job and marks the request converted in one synchronous step (a DB transaction once Prisma lands). */
export function convertToJob(id: string, slot: { appointmentDate: string; startTime: string; endTime: string; technicianId?: string | null }, who: Actor) {
  const r = getRequest(id);
  if (r.status === 'converted') throw conflict('ALREADY_CONVERTED', `${r.requestNumber} is already converted`);
  if (r.status === 'cancelled') throw conflict('REQUEST_CANCELLED', `${r.requestNumber} is cancelled`);
  const duration = Math.max(30, toMinutes(slot.endTime) - toMinutes(slot.startTime));
  const job = createJob({
    requestId: r.id, customerId: r.customerId, locationId: r.locationId, equipmentIds: r.equipmentId ? [r.equipmentId] : [],
    type: r.priority === 'emergency' ? 'emergency_callout' : 'repair', priority: r.priority,
    technicianId: slot.technicianId || null, ...slot, estimatedDurationMinutes: duration,
    requiredSkills: ['System Diagnostics'], description: r.reportedProblem, internalNotes: r.internalNotes,
    labourHours: duration / 60, hourlyRate: 85, travelTimeMinutes: 30, travelCharge: 35,
    checklist: [
      'Initial visual inspection & safety check', 'Perform diagnostics & identify root cause', 'Test operation and log readings',
    ].map((label, i) => ({ id: `chk-${i + 1}`, category: 'general' as const, label, checked: false })),
    auditAction: 'Converted from Service Request', auditDetails: `Created from ${r.requestNumber}`,
  }, who);
  db.requests.update(id, { status: 'converted', convertedJobId: job.id });
  return job;
}

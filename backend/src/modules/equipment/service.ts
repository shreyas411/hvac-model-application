import { randomUUID } from 'node:crypto';
import type { Equipment, EquipmentServiceRecord } from '../../types.js';
import { addMonths } from '../../common/dates.js';
import { db, must } from '../../common/store.js';
import { assertLocation } from '../customers/service.js';

const MONTHS = { quarterly: 3, biannual: 6, annual: 12 } as const;

export function createEquipment(data: Omit<Equipment, 'id' | 'serviceHistory' | 'nextServiceDueDate'> & { nextServiceDueDate?: string }) {
  assertLocation(data.customerId, data.locationId);
  const next = data.nextServiceDueDate ?? addMonths(data.lastServiceDate ?? data.installationDate, MONTHS[data.maintenanceFrequency]);
  return db.equipment.insert({ ...data, nextServiceDueDate: next, serviceHistory: [] });
}

export function updateEquipment(id: string, patch: Partial<Equipment>) {
  const cur = must(db.equipment, id, 'Equipment');
  assertLocation(patch.customerId ?? cur.customerId, patch.locationId ?? cur.locationId);
  return db.equipment.update(id, patch);
}

/** Records a visit, sets last_service_date and recomputes next_service_due_date from the maintenance frequency. */
export function addServiceRecord(id: string, rec: Omit<EquipmentServiceRecord, 'id'>) {
  const eq = must(db.equipment, id, 'Equipment');
  must(db.jobs, rec.jobId, 'Job');
  const record = { ...rec, id: randomUUID() };
  const last = !eq.lastServiceDate || rec.date > eq.lastServiceDate ? rec.date : eq.lastServiceDate;
  return db.equipment.update(id, {
    lastServiceDate: last,
    nextServiceDueDate: addMonths(last, MONTHS[eq.maintenanceFrequency]),
    serviceHistory: [record, ...eq.serviceHistory],
  });
}

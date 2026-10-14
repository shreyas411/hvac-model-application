import { randomUUID } from 'node:crypto';
import type { Customer, ServiceLocation } from '../../types.js';
import { ApiError, notFound } from '../../common/errors.js';
import { db, must } from '../../common/store.js';

export const getCustomer = (id: string) => must(db.customers, id, 'Customer');

export function assertLocation(customerId: string, locationId: string) {
  const c = getCustomer(customerId);
  const loc = c.serviceLocations.find((l) => l.id === locationId);
  if (!loc) throw new ApiError(422, 'INVALID_LOCATION', 'Location does not belong to customer');
  return loc;
}

export const setArchived = (id: string, archived: boolean) => db.customers.update(getCustomer(id).id, { archived });

const withIds = (locs: Omit<ServiceLocation, 'id'>[]) => locs.map((l) => ({ ...l, id: randomUUID() }));
export const createCustomer = (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'serviceLocations'> & { serviceLocations: Omit<ServiceLocation, 'id'>[] }) =>
  db.customers.insert({ ...data, serviceLocations: withIds(data.serviceLocations) });

export function addLocation(customerId: string, loc: Omit<ServiceLocation, 'id'>) {
  const c = getCustomer(customerId);
  return db.customers.update(c.id, { serviceLocations: [...c.serviceLocations, ...withIds([loc])] });
}
export function updateLocation(customerId: string, locId: string, patch: Partial<ServiceLocation>) {
  const c = getCustomer(customerId);
  if (!c.serviceLocations.some((l) => l.id === locId)) throw notFound('Location');
  return db.customers.update(c.id, { serviceLocations: c.serviceLocations.map((l) => (l.id === locId ? { ...l, ...patch, id: locId } : l)) });
}
export function removeLocation(customerId: string, locId: string) {
  const c = getCustomer(customerId);
  if (db.jobs.all().some((j) => j.locationId === locId) || db.equipment.all().some((e) => e.locationId === locId))
    throw new ApiError(409, 'LOCATION_IN_USE', 'Location is referenced by jobs or equipment');
  return db.customers.update(c.id, { serviceLocations: c.serviceLocations.filter((l) => l.id !== locId) });
}

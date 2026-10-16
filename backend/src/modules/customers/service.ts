import { randomUUID } from 'node:crypto';
import { pageFrom } from '../../common/paginate.js';
import type { Prisma } from '@prisma/client';
import type { Customer, ServiceLocation } from '../../types.js';
import { ApiError, notFound } from '../../common/errors.js';
import { isUuid, plain, prisma } from '../../common/prisma.js';

const include = { locations: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.CustomerInclude;
type Row = Prisma.CustomerGetPayload<{ include: typeof include }>;

const toLocation = ({ customerId, legacyId, createdAt, updatedAt, ...l }: Row['locations'][number]) => plain(l) as unknown as ServiceLocation;
const toCustomer = ({ legacyId, locations, createdAt, updatedAt, ...c }: Row) =>
  ({ ...plain(c), serviceLocations: locations.map(toLocation), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() }) as unknown as Customer;

export async function getCustomer(id: string) {
  const row = isUuid(id) ? await prisma.customer.findUnique({ where: { id }, include }) : null;
  if (!row) throw notFound('Customer');
  return toCustomer(row);
}

export const pageCustomers = (query: unknown) => pageFrom(query, prisma.customer, { include, searchFields: ['name', 'email', 'phone'] }, toCustomer);
export const listCustomers = async () => (await prisma.customer.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toCustomer);

export async function assertLocation(customerId: string, locationId: string) {
  await getCustomer(customerId);
  const loc = isUuid(locationId) ? await prisma.serviceLocation.findFirst({ where: { id: locationId, customerId } }) : null;
  if (!loc) throw new ApiError(422, 'INVALID_LOCATION', 'Location does not belong to customer');
  return toLocation(loc);
}

type NewLocation = Omit<ServiceLocation, 'id'>;
export const createCustomer = async (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'serviceLocations'> & { serviceLocations: NewLocation[] }) => {
  const { serviceLocations, billingAddress, ...rest } = data;
  return toCustomer(await prisma.customer.create({ data: { ...rest, billingAddress, locations: { create: serviceLocations } }, include }));
};

export async function updateCustomer(id: string, patch: Partial<Omit<Customer, 'id' | 'serviceLocations' | 'createdAt' | 'updatedAt'>>) {
  await getCustomer(id);
  return toCustomer(await prisma.customer.update({ where: { id }, data: patch, include }));
}

export const setArchived = (id: string, archived: boolean) => updateCustomer(id, { archived });

export async function addLocation(customerId: string, loc: NewLocation) {
  await getCustomer(customerId);
  await prisma.serviceLocation.create({ data: { ...loc, customerId } });
  return getCustomer(customerId);
}
export async function updateLocation(customerId: string, locId: string, patch: Partial<NewLocation>) {
  await getCustomer(customerId);
  const { count } = isUuid(locId) ? await prisma.serviceLocation.updateMany({ where: { id: locId, customerId }, data: patch }) : { count: 0 };
  if (!count) throw notFound('Location');
  return getCustomer(customerId);
}
export async function removeLocation(customerId: string, locId: string) {
  await getCustomer(customerId);
  const where = { locationId: locId };
  if (isUuid(locId) && (await Promise.all([prisma.job.count({ where }), prisma.equipment.count({ where }), prisma.serviceRequest.count({ where })])).some(Boolean))
    throw new ApiError(409, 'LOCATION_IN_USE', 'Location is referenced by jobs or equipment');
  if (isUuid(locId)) await prisma.serviceLocation.deleteMany({ where: { id: locId, customerId } });
  return getCustomer(customerId);
}

/** Import ops (see importPartOps): replace all customers. Fills `ids` with oldId → new uuid for customers and locations. */
export function importCustomerOps(rows: any[], ids: Map<string, string>) {
  const newId = (old: string) => (ids.set(old, randomUUID()), ids.get(old)!);
  const data = rows.map((c) => ({
    id: newId(c.id), legacyId: c.id, type: c.type, name: c.name, companyName: c.companyName, phone: c.phone ?? '', email: c.email ?? '',
    billingAddress: c.billingAddress ?? {}, notes: c.notes, communicationPreference: c.communicationPreference ?? 'email',
    gdprConsent: !!c.gdprConsent, archived: !!c.archived,
    ...(c.createdAt && { createdAt: new Date(c.createdAt) }),
    locations: { create: (c.serviceLocations ?? []).map(({ id, ...l }: any) => ({ ...l, id: newId(id), legacyId: id })) },
  }));
  return { wipe: prisma.customer.deleteMany(), create: data.map((d) => prisma.customer.create({ data: d })) };
}

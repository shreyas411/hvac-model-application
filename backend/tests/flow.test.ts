import type { AddressInfo } from 'node:net';
import { beforeAll, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { seedDevUsers } from '../src/common/auth.js';
import { db } from '../src/common/store.js';

let base = '';
beforeAll(() => {
  seedDevUsers();
  base = `http://127.0.0.1:${(createApp().listen(0).address() as AddressInfo).port}/api/v1`;
});

const call = async (method: string, path: string, body?: unknown, as = 'admin') => {
  const res = await fetch(base + path, {
    method, headers: { 'content-type': 'application/json', 'x-dev-user': `dev-${as}` }, body: body && JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
};

test('request → job → conflict → status → parts → invoice → payment', async () => {
  const cust = (await call('POST', '/customers', {
    type: 'residential', name: 'A', phone: '1', email: 'a@x.co', gdprConsent: true,
    billingAddress: { line1: '1', city: 'c', postcode: 'p' },
  })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0];
  const tech = (await call('POST', '/technicians', { name: 'T', phone: '1', email: 't@x.co' })).body;
  const part = (await call('POST', '/parts', { name: 'Valve', sku: 'V1', category: 'x', unitCost: 5, sellingPrice: 10, stockQuantity: 3 })).body;
  expect(part.stockQuantity).toBe(3);

  const sr = (await call('POST', '/requests', { customerId: cust.id, locationId: loc.id, reportedProblem: 'cold', priority: 'emergency' })).body;
  expect(sr.requestNumber).toMatch(/^SR-\d+$/);
  const slot = { appointmentDate: '2026-11-02', startTime: '09:00', endTime: '10:30', technicianId: tech.id };
  const job = (await call('POST', `/requests/${sr.id}/convert`, slot)).body;
  expect(job).toMatchObject({ type: 'emergency_callout', status: 'scheduled', estimatedDurationMinutes: 90 });
  expect((await call('POST', `/requests/${sr.id}/convert`, slot)).body.code).toBe('ALREADY_CONVERTED');

  const clash = await call('POST', '/jobs', { customerId: cust.id, locationId: loc.id, type: 'repair', description: 'x', ...slot, startTime: '10:00', endTime: '11:00' });
  expect(clash.body.code).toBe('SCHEDULE_CONFLICT');

  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.code).toBe('INVALID_TRANSITION');
  await call('POST', `/jobs/${job.id}/status`, { status: 'dispatched' });
  const ip = (await call('POST', `/jobs/${job.id}/status`, { status: 'in_progress' })).body;
  expect(ip.arrivalTime).toBeTruthy();

  expect((await call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 5 })).body.code).toBe('INSUFFICIENT_STOCK');
  await call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 2 });
  expect(db.parts.find(part.id)!.stockQuantity).toBe(1);
  expect((await call('GET', `/movements?partId=${part.id}`)).body.data).toHaveLength(2);

  const inv = (await call('POST', `/jobs/${job.id}/invoice`, undefined, 'accountant')).body;
  // 1.5h * 85 + 35 travel + 2 * 10 = 182.5 net, 20% VAT
  expect(inv).toMatchObject({ subtotal: 182.5, vatAmount: 36.5, total: 219, status: 'issued' });
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 300, method: 'bacs' }, 'accountant')).body.code).toBe('OVERPAYMENT');
  const part1 = (await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 19, method: 'bacs' }, 'accountant')).body;
  expect(part1).toMatchObject({ status: 'partially_paid', balanceDue: 200 });
  expect((await call('POST', `/invoices/${inv.id}/void`, undefined, 'accountant')).body.code).toBe('HAS_PAYMENTS');
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 200, method: 'card' }, 'accountant')).body.status).toBe('paid');
});

test('rbac and technician scoping', async () => {
  expect((await call('GET', '/invoices', undefined, 'technician')).status).toBe(403);
  expect((await call('GET', '/users', undefined, 'dispatcher')).status).toBe(403);
  expect((await call('GET', '/jobs', undefined, 'technician')).body.data).toEqual([]); // no technicianId linked
  expect((await fetch(base + '/jobs')).status).toBe(401);
});

test('quotation must be accepted before conversion; sweeps', async () => {
  const cust = db.customers.all()[0];
  const q = (await call('POST', '/quotations', {
    customerId: cust.id, locationId: cust.serviceLocations[0].id, issueDate: '2020-01-01', expiryDate: '2020-02-01',
    items: [{ type: 'labour', description: 'l', quantity: 2, unitPrice: 100 }],
  })).body;
  expect(q).toMatchObject({ subtotal: 200, total: 240, status: 'draft' });
  expect((await call('POST', `/quotations/${q.id}/convert-to-invoice`)).body.code).toBe('NOT_ACCEPTED');
  await call('POST', `/quotations/${q.id}/send`);
  const { expireQuotations } = await import('../src/modules/quotations/service.js');
  expect(expireQuotations()).toBe(1);
  expect((await call('GET', `/quotations/${q.id}`)).body.status).toBe('expired');
});

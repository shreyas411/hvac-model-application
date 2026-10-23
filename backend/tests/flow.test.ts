import type { AddressInfo } from 'node:net';
import { beforeAll, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { DEV_COMPANY, seedDevUsers } from '../src/common/auth.js';
import { prisma as scoped, runAs, unscoped } from '../src/common/prisma.js';

// Every model query needs a company: run the test's direct DB calls as the dev company, like a request would.
let companyId = '';
const prisma = new Proxy(scoped, { get: (t: any, k: string) => typeof t[k] !== 'object' || k.startsWith('$') ? t[k] : new Proxy(t[k], { get: (m, op: string) => (...a: any[]) => runAs(companyId, async () => await m[op](...a)) }) });
import { crc32, deflateSync } from 'node:zlib';

// Real RGBA PNG like the signature pad's: transparent canvas, optional opaque "ink" pixels.
function pngUrl(w = 60, h = 30, ink = true) {
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(4); head.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), body])));
    return Buffer.concat([head, Buffer.from(type), body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc(h * (1 + w * 4)); // filter 0 + zeros = transparent
  if (ink) for (let x = 1; x < w - 1; x++) rows.set([15, 23, 42, 255], (h >> 1) * (1 + w * 4) + 1 + x * 4); // a stroke across the middle row
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString('base64')}`;
}
const SIG_PNG = pngUrl();

let base = '';
beforeAll(async () => {
  // tests wipe everything: only ever a local *_test database, never the dev data
  if (!/@(localhost|127\.0\.0\.1)[:/][^?]*_test(\?|$)/.test(process.env.DATABASE_URL ?? '')) throw new Error('Tests wipe their database: only a local *_test database is allowed, use `npm test`');
  await seedDevUsers();
  companyId = (await unscoped.company.findUniqueOrThrow({ where: { slug: DEV_COMPANY } })).id;
  await prisma.certificate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.maintenanceAgreement.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.job.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.user.deleteMany();
  await Promise.all([prisma.customer.deleteMany(), prisma.technician.deleteMany(), prisma.part.deleteMany(), prisma.counter.deleteMany()]);
  await prisma.companySettings.update({ where: { companyId }, data: { defaultVatRate: 20 } }); // the import test changes it
  await seedDevUsers();
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
    type: 'residential', name: 'A', phone: '01234 567890', email: 'a@x.co', gdprConsent: true,
    billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' },
  })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0];
  const tech = (await call('POST', '/technicians', { name: 'T', phone: '1', email: 't@x.co' })).body;
  const part = (await call('POST', '/parts', { name: 'Valve', sku: 'V1', category: 'x', unitCost: 5, sellingPrice: 10, stockQuantity: 3 })).body;
  expect(part.stockQuantity).toBe(3);

  const sr = (await call('POST', '/requests', { customerId: cust.id, locationId: loc.id, reportedProblem: 'cold', priority: 'emergency' })).body;
  expect(sr.requestNumber).toMatch(/^SR-\d+$/);
  const slot = { appointmentDate: '2026-11-02', startTime: '09:00', endTime: '10:30', technicianId: tech.id };
  const job = (await call('POST', `/requests/${sr.id}/convert`, slot)).body;
  expect(job).toMatchObject({ type: 'emergency_callout', status: 'scheduled', estimatedDurationMinutes: 90 });
  expect((await call('POST', `/requests/${sr.id}/convert`, slot)).body.code).toBe('ALREADY_CONVERTED');

  const clash = await call('POST', '/jobs', { customerId: cust.id, locationId: loc.id, type: 'repair', title: 't', description: 'x', ...slot, startTime: '10:00', endTime: '11:00' });
  expect(clash.body.code).toBe('SCHEDULE_CONFLICT');

  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.code).toBe('INVALID_TRANSITION');
  await call('POST', `/jobs/${job.id}/status`, { status: 'dispatched' });
  const ip = (await call('POST', `/jobs/${job.id}/status`, { status: 'in_progress' })).body;
  expect(ip.arrivalTime).toBeTruthy();

  expect((await call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 5 })).body.code).toBe('INSUFFICIENT_STOCK');
  await call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 2 });
  expect((await prisma.part.findUniqueOrThrow({ where: { id: part.id } })).stockQuantity).toBe(1);
  expect((await call('GET', `/movements?partId=${part.id}`)).body.data).toHaveLength(2);

  // invoicing needs a completed job, and completing needs the compliance record
  expect((await call('POST', `/jobs/${job.id}/invoice`, { vatRatePercent: 20 }, 'accountant')).body.code).toBe('JOB_NOT_COMPLETED');
  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.code).toBe('NOT_COMPLETABLE');
  const sig = { name: 'Cust', dataUrl: SIG_PNG, signedAt: '2026-11-02T10:00:00Z' };
  await call('PATCH', `/jobs/${job.id}`, { workPerformed: 'Replaced valve', customerSignature: sig });
  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.status).toBe('completed');
  expect((await call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 1 })).body.code).toBe('JOB_CLOSED');
  expect((await call('PATCH', `/jobs/${job.id}`, { workPerformed: 'x' }, 'technician')).status).toBeGreaterThanOrEqual(403);
  expect((await call('POST', `/jobs/${job.id}/invoice`, undefined, 'accountant')).status).toBe(400); // rate must be stated, never defaulted
  const inv = (await call('POST', `/jobs/${job.id}/invoice`, { vatRatePercent: 20 }, 'accountant')).body;
  // 1.5h * 85 + 35 travel + 2 * 10 = 182.5 net, 20% VAT
  expect(inv).toMatchObject({ subtotal: 182.5, vatAmount: 36.5, total: 219, status: 'issued' });
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 300, method: 'bacs' }, 'accountant')).body.code).toBe('OVERPAYMENT');
  const part1 = (await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 19, method: 'bacs' }, 'accountant')).body;
  expect(part1).toMatchObject({ status: 'partially_paid', balanceDue: 200 });
  expect((await call('POST', `/invoices/${inv.id}/void`, { reason: 'raised in error' }, 'accountant')).body.code).toBe('HAS_PAYMENTS');
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 200, method: 'card' }, 'accountant')).body.status).toBe('paid');
});

test('jobs list filters by appointment date range', async () => {
  const all = (await call('GET', '/jobs?limit=100')).body.data;
  const [a] = all.map((j: any) => j.appointmentDate).sort();
  const same = (await call('GET', `/jobs?from=${a}&to=${a}&limit=100`)).body.data;
  expect(same.length).toBeGreaterThan(0);
  expect(same.every((j: any) => j.appointmentDate === a)).toBe(true);
  expect((await call('GET', '/jobs?to=1999-01-01')).body.data).toEqual([]);
});

test('bulk assign: per-job results, conflicts skipped, unassign, office roles only', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'B', phone: '01234 567890', email: 'b@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0];
  const tech = (await call('POST', '/technicians', { name: 'Bulk', phone: '1', email: 'bulk@x.co' })).body;
  const mk = async (startTime: string, endTime: string) => (await call('POST', '/jobs', { customerId: cust.id, locationId: loc.id, type: 'repair', title: 't', description: 'x', appointmentDate: '2026-12-01', startTime, endTime })).body;
  const [j1, j2] = [await mk('09:00', '10:00'), await mk('09:30', '10:30')];
  expect(j1.status).toBe('new');
  expect((await call('POST', '/jobs/bulk-assign', { jobIds: [j1.id], technicianId: tech.id }, 'technician')).status).toBe(403);
  const r = (await call('POST', '/jobs/bulk-assign', { jobIds: [j1.id, j2.id], technicianId: tech.id })).body.results;
  expect(r[0]).toMatchObject({ id: j1.id, ok: true, job: { technicianId: tech.id, status: 'scheduled' } });
  expect(r[1]).toMatchObject({ id: j2.id, ok: false, error: { code: 'SCHEDULE_CONFLICT' } });
  const u = (await call('POST', '/jobs/bulk-assign', { jobIds: [j1.id], technicianId: null })).body.results;
  expect(u[0].job.technicianId).toBeNull();
});

test('bulk endpoints: one call, per-id results, bad ids reported, validation and roles enforced', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'BK', phone: '01234 567890', email: 'bk@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0];
  const r1 = (await call('POST', '/requests', { customerId: cust.id, locationId: loc.id, reportedProblem: 'a' })).body;
  const ghost = '00000000-0000-4000-8000-000000000000';
  const res = (await call('POST', '/requests/bulk-cancel', { ids: [r1.id, ghost, r1.id] })).body.results;
  expect(res).toMatchObject([{ id: r1.id, ok: true }, { id: ghost, ok: false, error: { code: 'NOT_FOUND' } }]); // duplicate id collapsed
  expect((await call('GET', `/requests/${r1.id}`)).body.status).toBe('cancelled');
  expect((await call('POST', '/requests/bulk-cancel', { ids: [] })).status).toBe(400);
  expect((await call('POST', '/requests/bulk-cancel', { ids: ['nope'] })).status).toBe(400);
  expect((await call('POST', '/customers/bulk-archive', { ids: [cust.id], archived: true })).body.results[0].ok).toBe(true);
  expect((await call('POST', '/customers/bulk-archive', { ids: [cust.id], archived: true }, 'technician')).status).toBe(403);
  expect((await call('POST', '/certificates/bulk-delete', { ids: [ghost] }, 'dispatcher')).status).toBe(403);
});

test('rbac and technician scoping', async () => {
  expect((await call('GET', '/invoices', undefined, 'technician')).status).toBe(403);
  expect((await call('GET', '/users', undefined, 'dispatcher')).status).toBe(403);
  expect((await call('GET', '/jobs', undefined, 'technician')).body.data).toEqual([]); // no technicianId linked
  expect((await call('GET', `/jobs?technicianId=${'00000000-0000-4000-8000-000000000000'}`, undefined, 'technician')).body.data).toEqual([]); // ?technicianId can't widen a technician's scope
  expect((await fetch(base + '/jobs')).status).toBe(401);
});

test('quote options: cheapest priced, customer must pick one, others dropped', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'O', phone: '01234 567890', email: 'o@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0];
  const line = (option: string | undefined, unitPrice: number) => ({ type: 'equipment', description: 'boiler', quantity: 1, unitPrice, vatRatePercent: 0, option });
  const q = (await call('POST', '/quotations', { customerId: cust.id, locationId: loc.id, issueDate: '2026-10-01', expiryDate: '2026-12-01', vatRatePercent: 0, items: [line(undefined, 100), line('Good', 1000), line('Best', 2000)] })).body;
  expect(q.subtotal).toBe(1100);
  await call('POST', `/quotations/${q.id}/send`);
  expect((await call('POST', `/quotations/${q.id}/accept`, { acceptedBy: 'C' })).body.code).toBe('OPTION_REQUIRED');
  const done = (await call('POST', `/quotations/${q.id}/accept`, { acceptedBy: 'C', option: 'Best' })).body;
  expect([done.status, done.subtotal, done.items.length]).toEqual(['accepted', 2100, 2]);
});

test('quotation must be accepted before conversion; sweeps', async () => {
  const cust = (await call('GET', '/customers')).body.data[0];
  const q = (await call('POST', '/quotations', {
    customerId: cust.id, locationId: cust.serviceLocations[0].id, issueDate: '2020-01-01', expiryDate: '2020-02-01',
    items: [{ type: 'labour', description: 'l', quantity: 2, unitPrice: 100 }],
  })).body;
  expect(q).toMatchObject({ subtotal: 200, total: 240, status: 'draft' });
  expect((await call('POST', `/quotations/${q.id}/convert-to-invoice`)).body.code).toBe('NOT_ACCEPTED');
  await call('POST', `/quotations/${q.id}/send`);
  const { expireQuotations } = await import('../src/modules/quotations/service.js');
  expect(await runAs(companyId, () => expireQuotations())).toBe(1);
  expect((await call('GET', `/quotations/${q.id}`)).body.status).toBe('expired');
});

const old = {
  customers: [{ id: 'cust-1', type: 'residential', name: 'Old', phone: '01234 567890', email: 'o@x.co', billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' },
    serviceLocations: [{ id: 'loc-1', label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' }] }],
  technicians: [{ id: 'tech-1', name: 'Imported', phone: '1', email: 't@x.co', skills: ['Gas'], color: '#000', active: true }],
  parts: [{ id: 'part-1', name: 'Valve', sku: 'IMP-1', category: 'x', unitCost: 5, sellingPrice: 10, stockQuantity: 4, minStockLevel: 1 }],
  equipment: [{ id: 'eq-1', customerId: 'cust-1', locationId: 'loc-1', type: 'heat_pump', brand: 'B', model: 'M', serialNumber: 'S', installationDate: '2024-01-01',
    warrantyExpiryDate: '2029-01-01', maintenanceFrequency: 'annual', nextServiceDueDate: '2026-12-01', status: 'operational',
    serviceHistory: [{ id: 'rec-1', date: '2025-12-01', jobId: 'job-1', technicianName: 'Imported', serviceType: 'Annual', findings: 'ok', partsReplaced: [] }] }],
  serviceRequests: [{ id: 'req-1', requestNumber: 'SR-5', customerId: 'cust-1', locationId: 'loc-1', equipmentId: 'eq-1', reportedProblem: 'cold', priority: 'high',
    preferredSlot: 'morning', status: 'converted', convertedJobId: 'job-1' }],
  jobs: [{ id: 'job-1', jobNumber: 'JOB-2026-0007', requestId: 'req-1', customerId: 'cust-1', locationId: 'loc-1', equipmentIds: ['eq-1'], type: 'repair', priority: 'high',
    status: 'scheduled', technicianId: 'tech-1', appointmentDate: '2026-11-05', startTime: '09:00', endTime: '10:00', description: 'd', labourHours: 1.6667, hourlyRate: 85,
    partsUsed: [{ partId: 'part-1', partName: 'Valve', sku: 'IMP-1', quantity: 1, unitCost: 5, unitPrice: 10 }],
    checklist: [{ id: 'chk-2', label: 'second', category: 'general', checked: false }, { id: 'chk-1', label: 'first', category: 'gas_safety', checked: true }],
    auditTrail: [{ timestamp: '2026-10-01T10:00:00.000Z', userId: 'u', userName: 'U', action: 'Job Created', details: 'x' }] }],
  inventoryMovements: [{ id: 'mov-1', partId: 'part-1', type: 'restock_purchase', quantityDelta: 4, jobId: 'job-1', notes: 'n', timestamp: '2026-10-01T10:00:00.000Z', userName: 'U' }],
  quotations: [{ id: 'q-1', quoteNumber: 'QTE-2026-0042', customerId: 'cust-1', locationId: 'loc-1', jobId: 'job-1', issueDate: '2026-10-01', expiryDate: '2026-11-01',
    status: 'accepted', items: [{ id: 'li-1', type: 'labour', description: 'work', quantity: 2.5, unitPrice: 80, amount: 200 }], subtotal: 200, vatRatePercent: 20,
    vatAmount: 40, total: 240, terms: 't', acceptedAt: '2026-10-02T09:00:00.000Z', acceptedBy: 'Cust', convertedToInvoiceId: 'inv-1' }],
  invoices: [{ id: 'inv-1', invoiceNumber: 'INV-2026-0119', quoteId: 'q-1', jobId: 'job-1', customerId: 'cust-1', locationId: 'loc-1', issueDate: '2026-10-03', dueDate: '2026-10-17',
    status: 'partially_paid', items: [{ id: 'li-1', type: 'labour', description: 'work', quantity: 2.5, unitPrice: 80, amount: 200 }], subtotal: 200, vatRatePercent: 20, vatAmount: 40,
    total: 240, payments: [{ id: 'pay-1', date: '2026-10-05', amount: 100, method: 'bacs', reference: 'r', recordedBy: 'Acc' }], amountPaid: 100, balanceDue: 140, paymentTermsDays: 14 }],
  notifications: [{ id: 'n-1', customerId: 'cust-1', type: 'invoice_issued', recipient: 'o@x.co', channel: 'email', subject: 's', messageBody: 'b', status: 'sent', sentAt: '2026-10-03T10:00:00.000Z', approvedBy: 'Acc' }],
  settings: { defaultVatRate: 5 },
};

test('import remaps old ids across Postgres collections; export round-trips', async () => {
  const res = await call('POST', '/import?confirm=wipe', old);
  expect(res.body.imported).toMatchObject({ technicians: 1, customers: 1, parts: 1, equipment: 1, serviceRequests: 1, jobs: 1, inventoryMovements: 1, quotations: 1, invoices: 1, notifications: 1 });
  const [cust] = (await call('GET', '/customers')).body.data;
  const loc = cust.serviceLocations[0].id;
  const [tech] = (await call('GET', '/technicians')).body.data;
  const [part] = (await call('GET', '/parts')).body.data;
  const [job] = (await call('GET', '/jobs')).body.data;
  const [eq] = (await call('GET', '/equipment')).body.data;
  const [req] = (await call('GET', '/requests')).body.data;
  expect(job).toMatchObject({
    jobNumber: 'JOB-2026-0007', customerId: cust.id, locationId: loc, technicianId: tech.id, equipmentIds: [eq.id], requestId: req.id,
    appointmentDate: '2026-11-05', labourHours: 1.6667, partsUsed: [{ partId: part.id, quantity: 1, unitPrice: 10 }],
    auditTrail: [{ action: 'Job Created', timestamp: '2026-10-01T10:00:00.000Z' }],
  });
  expect(job.checklist.map((c: any) => c.label)).toEqual(['second', 'first']); // order kept
  expect(req).toMatchObject({ convertedJobId: job.id, equipmentId: eq.id, requestNumber: 'SR-5' });
  expect(eq).toMatchObject({ customerId: cust.id, locationId: loc, installationDate: '2024-01-01', serviceHistory: [{ jobId: job.id, date: '2025-12-01' }] });
  expect((await call('GET', `/movements?partId=${part.id}`)).body.data[0]).toMatchObject({ quantityDelta: 4, jobId: job.id, timestamp: '2026-10-01T10:00:00.000Z' });
  const [quote] = (await call('GET', '/quotations')).body.data;
  const [inv0] = (await call('GET', '/invoices')).body.data;
  expect(quote).toMatchObject({ quoteNumber: 'QTE-2026-0042', jobId: job.id, convertedToInvoiceId: inv0.id, issueDate: '2026-10-01', acceptedAt: '2026-10-02T09:00:00.000Z',
    items: [{ quantity: 2.5, unitPrice: 80, amount: 200 }] });
  expect(inv0).toMatchObject({ invoiceNumber: 'INV-2026-0119', quoteId: quote.id, jobId: job.id, dueDate: '2026-10-17', balanceDue: 140, payments: [{ amount: 100, date: '2026-10-05', recordedBy: 'Acc' }] });
  expect((await call('GET', '/notifications')).body.data[0]).toMatchObject({ customerId: cust.id, status: 'sent', sentAt: '2026-10-03T10:00:00.000Z' });
  expect((await call('GET', '/jobs', undefined, 'technician')).body.data).toHaveLength(1); // dev technician user stays linked
  expect((await call('GET', '/settings')).body.defaultVatRate).toBe(5);
  expect((await call('GET', '/settings', undefined, 'accountant')).body.bankDetails).toBeDefined();
  for (const role of ['dispatcher', 'technician']) {
    const r = await call('GET', '/settings', undefined, role);
    expect(r.status).toBe(200);
    expect(r.body.bankDetails).toBeUndefined();
  }
  // numbering continues above imported numbers
  expect((await call('POST', '/requests', { customerId: cust.id, locationId: loc, reportedProblem: 'x' })).body.requestNumber).toBe('SR-6');
  expect((await call('POST', '/invoices', { customerId: cust.id, locationId: loc, items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 100 }] }, 'accountant')).body).toMatchObject({ vatAmount: 5, invoiceNumber: expect.stringMatching(/^INV-\d{4}-0120$/) });
  const exported = (await call('GET', '/export')).body;
  expect(exported).toMatchObject({ customers: [{ id: cust.id }], jobs: [{ id: job.id }], equipment: [{ id: eq.id }], inventoryMovements: [{ partId: part.id }], quotations: [{ id: quote.id }], invoices: [{ id: expect.any(String) }, { id: inv0.id }] });
});

test('bad imports write nothing', async () => {
  const before = (await call('GET', '/jobs')).body.data;
  const dangling = await call('POST', '/import?confirm=wipe', { ...old, jobs: [{ ...old.jobs[0], customerId: 'nope' }] });
  expect(dangling.status).toBe(422);
  expect(dangling.body.code).toBe('DANGLING_REFERENCE');
  expect((await call('POST', '/import?confirm=wipe', { customers: [{ id: 'x', type: 'bogus', name: 'n' }], jobs: [] })).status).toBe(500);
  expect((await call('GET', '/jobs')).body.data).toEqual(before);
  expect((await call('GET', '/technicians')).body.data).toHaveLength(1);
  expect((await call('GET', '/customers')).body.data).toHaveLength(1);
});

test('concurrent bookings of one slot: exactly one wins; stock never goes negative', async () => {
  const [cust] = (await call('GET', '/customers')).body.data;
  const [tech] = (await call('GET', '/technicians')).body.data;
  const body = { customerId: cust.id, locationId: cust.serviceLocations[0].id, type: 'repair', title: 't', description: 'd', technicianId: tech.id, appointmentDate: '2026-12-01', startTime: '09:00', endTime: '10:00' };
  const res = await Promise.all([1, 2, 3, 4, 5].map(() => call('POST', '/jobs', body)));
  expect(res.filter((r) => r.status === 201)).toHaveLength(1);
  expect(res.filter((r) => r.body.code === 'SCHEDULE_CONFLICT')).toHaveLength(4);

  const [job] = (await call('GET', '/jobs')).body.data;
  const [part] = (await call('GET', '/parts')).body.data; // 4 in stock
  const used = await Promise.all([1, 2, 3].map(() => call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 2 })));
  expect(used.filter((r) => r.status === 200)).toHaveLength(2);
  expect(used.filter((r) => r.body.code === 'INSUFFICIENT_STOCK')).toHaveLength(1);
  expect((await call('GET', `/parts/${part.id}`)).body.stockQuantity).toBe(0);
  expect((await call('GET', `/jobs/${job.id}`)).body.partsUsed.filter((p: any) => p.partId === part.id)).toHaveLength(job.partsUsed.filter((p: any) => p.partId === part.id).length + 2);
});

test('nullDangling imports old service records whose job is not in the file', async () => {
  const oldJob = { ...old.equipment[0], serviceHistory: [{ ...old.equipment[0].serviceHistory[0], jobId: 'JOB-2024-0001' }] };
  expect((await call('POST', '/import?confirm=wipe', { ...old, equipment: [oldJob] })).body.code).toBe('DANGLING_REFERENCE');
  const res = await call('POST', '/import?confirm=wipe&nullDangling=true', { ...old, equipment: [oldJob] });
  expect(res.body.nulledReferences).toEqual(['equipment eq-1 service record rec-1: job JOB-2024-0001']);
  const [eq] = (await call('GET', '/equipment')).body.data;
  expect(eq.serviceHistory).toHaveLength(1);
  expect(eq.serviceHistory[0].jobId).toBeUndefined();
  await call('POST', '/import?confirm=wipe', old); // restore for later tests
});

test('bad money/notification imports write nothing', async () => {
  const before = (await call('GET', '/invoices')).body.data;
  expect((await call('POST', '/import?confirm=wipe', { ...old, invoices: [{ ...old.invoices[0], quoteId: 'missing' }] })).body.code).toBe('DANGLING_REFERENCE');
  expect((await call('POST', '/import?confirm=wipe', { ...old, notifications: [{ ...old.notifications[0], customerId: 'missing' }] })).body.code).toBe('DANGLING_REFERENCE');
  expect((await call('GET', '/invoices')).body.data).toEqual(before);
});

test('concurrent payments cannot overpay; concurrent conversions make one invoice', async () => {
  const [cust] = (await call('GET', '/customers')).body.data;
  const loc = cust.serviceLocations[0].id;
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 100 }], vatRatePercent: 0 }, 'accountant')).body;
  const pay = await Promise.all([1, 2, 3, 4].map(() => call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 40, method: 'card' }, 'accountant')));
  expect(pay.filter((r) => r.status === 201)).toHaveLength(2);
  expect(pay.filter((r) => r.body.code === 'OVERPAYMENT')).toHaveLength(2);
  expect((await call('GET', `/invoices/${inv.id}`, undefined, 'accountant')).body).toMatchObject({ amountPaid: 80, balanceDue: 20, status: 'partially_paid' });

  const q = (await call('POST', '/quotations', { customerId: cust.id, locationId: loc, issueDate: '2026-10-01', expiryDate: '2026-12-01', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 50 }] })).body;
  await call('POST', `/quotations/${q.id}/send`);
  expect((await call('POST', `/quotations/${q.id}/accept`, { acceptedBy: 'Cust' })).body.status).toBe('accepted');
  const conv = await Promise.all([1, 2, 3].map(() => call('POST', `/quotations/${q.id}/convert-to-invoice`, undefined, 'admin')));
  expect(conv.filter((r) => r.status === 201)).toHaveLength(1);
  expect(conv.filter((r) => r.body.code === 'ALREADY_CONVERTED')).toHaveLength(2);
  const made = conv.find((r) => r.status === 201)!.body;
  expect(made.quotation.convertedToInvoiceId).toBe(made.invoice.id);
  expect((await call('GET', '/invoices')).body.data.filter((i: any) => i.quoteId === q.id)).toHaveLength(1);
});

test('one invoice per job even when requested twice at once', async () => {
  const [job] = (await call('GET', '/jobs')).body.data;
  const res = await Promise.all([1, 2, 3].map(() => call('POST', `/jobs/${job.id}/invoice`, { vatRatePercent: 20 }, 'accountant')));
  expect(res.filter((r) => r.status === 201).length + res.filter((r) => ['ALREADY_CONVERTED', 'JOB_NOT_COMPLETED'].includes(r.body.code)).length).toBe(3);
  expect(res.filter((r) => r.status === 201).length).toBeLessThanOrEqual(1); // the imported invoice already covers it, so normally 0
});

test('overdue sweep; notification consent and single delivery', async () => {
  const { markOverdue } = await import('../src/modules/invoices/service.js');
  const [cust] = (await call('GET', '/customers')).body.data;
  const loc = cust.serviceLocations[0].id;
  const late = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, issueDate: '2020-01-01', paymentTermsDays: 14, items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  const draft = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, issueDate: '2020-01-01', status: 'draft', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  expect(await runAs(companyId, () => markOverdue())).toBeGreaterThanOrEqual(1);
  expect((await call('GET', `/invoices/${late.id}`, undefined, 'accountant')).body.status).toBe('overdue');
  expect((await call('GET', `/invoices/${draft.id}`, undefined, 'accountant')).body.status).toBe('draft');

  const n = { customerId: cust.id, type: 'invoice_issued', channel: 'email', subject: 's', messageBody: 'b' };
  expect((await call('POST', '/notifications', n)).body.code).toBe('CONSENT_REQUIRED'); // imported customer never consented
  await prisma.customer.update({ where: { id: cust.id }, data: { gdprConsent: true } });
  expect((await call('POST', '/notifications', { ...n, channel: 'sms' })).body.code).toBe('CHANNEL_NOT_PREFERRED');

  const sent: string[] = [];
  const { setProvider, logProvider, deliverApproved } = await import('../src/modules/notifications/service.js');
  setProvider({ async send(x) { sent.push(x.id); await new Promise((r) => setTimeout(r, 50)); } });
  const made = (await call('POST', '/notifications', n)).body;
  expect(made).toMatchObject({ status: 'draft', recipient: 'o@x.co' });
  const res = await Promise.all([call('POST', `/notifications/${made.id}/approve-send`), call('POST', `/notifications/${made.id}/approve-send`), runAs(companyId, () => deliverApproved())]);
  expect(sent).toEqual([made.id]); // delivered exactly once, however many callers raced
  expect((await call('GET', '/notifications')).body.data.find((x: any) => x.id === made.id)).toMatchObject({ status: 'sent', approvedBy: 'Dev admin' });
  expect((await call('POST', `/notifications/${made.id}/approve-send`)).body.code).toBe('ALREADY_SENT');
  void res;
  setProvider(logProvider);
});

test('hardening: technician stock scope, body limits, signature, headers', async () => {
  const part = (await call('POST', '/parts', { name: 'Gasket', sku: 'G1', category: 'x', unitCost: 1, sellingPrice: 2, stockQuantity: 5 })).body;
  const adj = (body: object) => call('POST', `/parts/${part.id}/adjust`, body, 'technician');
  expect((await adj({ delta: 3, type: 'stock_adjustment' })).status).toBe(403);
  expect((await adj({ delta: -1, type: 'used_on_job' })).status).toBe(403); // no job given

  const big = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }) });
  expect(big.status).toBe(413);

  const jobId = (await call('GET', '/jobs')).body.data[0].id;
  const sig = (dataUrl: string) => call('PATCH', `/jobs/${jobId}`, { customerSignature: { name: 'A', dataUrl, signedAt: '2026-01-01T00:00:00Z' } });
  expect((await sig('javascript:alert(1)')).status).toBe(400);
  expect((await sig(SIG_PNG)).status).toBe(200);

  const res = await fetch(base + '/healthz'.replace('/api/v1', ''), { headers: { 'x-request-id': 'bad id\t!' } });
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('x-request-id')).toMatch(/^[\w-]{1,64}$/);
});

test('same x-idempotency-key creates once and replays the stored response', async () => {
  const post = () => fetch(base + '/customers', { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-user': 'dev-admin', 'x-idempotency-key': 'idem-1' }, body: JSON.stringify({ type: 'residential', name: 'Idem', phone: '01234 567890', email: 'idem@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } }) });
  const a = await post(), b = await post();
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  expect((await b.json()).id).toBe((await a.json()).id);
  expect(await prisma.customer.count({ where: { name: 'Idem' } })).toBe(1);
});

test('local passwords are stored salted+scrypt and verified', async () => {
  const { hashPassword, checkPassword } = await import('../src/common/auth.js');
  const h = hashPassword('Secret1$');
  expect(h).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
  expect(h).not.toContain('Secret1$');
  expect(checkPassword('Secret1$', h)).toBe(true);
  expect(checkPassword('wrong', h)).toBe(false);
  expect(checkPassword('Secret1$', 'Secret1$')).toBe(false); // legacy plaintext no longer accepted
  expect(checkPassword('x', null)).toBe(false);
});

test('credit notes, refunds, void reason, idempotency binding', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'CN', phone: '01234 567890', email: 'cn@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 100 }], vatRatePercent: 0 }, 'accountant')).body;
  const pay = (await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 60, method: 'bacs', reference: 'R1' }, 'accountant')).body;
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 1, method: 'bacs', reference: 'R1' }, 'accountant')).status).toBe(409);
  await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 40, method: 'bacs', reference: 'R2' }, 'accountant');
  expect((await call('POST', `/invoices/${inv.id}/credit-notes`, { amount: 150, reason: 'too much' }, 'accountant')).body.code).toBe('OVER_CREDIT');
  const cn = await call('POST', `/invoices/${inv.id}/credit-notes`, { amount: 40, reason: 'goodwill' }, 'accountant');
  expect(cn.status).toBe(201);
  expect(cn.body.creditNote.creditNumber).toMatch(/^CN-\d{4}-0001$/);
  expect(cn.body.invoice.status).toBe('paid');
  const ref = (await call('POST', `/invoices/${inv.id}/payments/${pay.payments[0].id}/refund`, { reason: 'dispute' }, 'accountant')).body;
  expect(ref).toMatchObject({ amountPaid: 40, balanceDue: 20, status: 'partially_paid' });
  expect((await call('POST', `/invoices/${inv.id}/payments/${pay.payments[0].id}/refund`, { reason: 'again' }, 'accountant')).body.code).toBe('ALREADY_REFUNDED');
  expect((await call('POST', `/invoices/${inv.id}/credit-notes`, { amount: 60, reason: 'rest' }, 'accountant')).body.invoice.status).toBe('credited');
  expect((await call('POST', `/invoices/${inv.id}/void`, {}, 'accountant')).status).toBe(400);

  // a quote can't be both invoiced and turned into a job
  const q = (await call('POST', '/quotations', { customerId: cust.id, locationId: loc, issueDate: '2026-10-01', expiryDate: '2026-12-01', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 50 }] })).body;
  await call('POST', `/quotations/${q.id}/send`);
  await call('POST', `/quotations/${q.id}/accept`, { acceptedBy: 'Cust' });
  await call('POST', `/quotations/${q.id}/convert-to-invoice`);
  const slot = { appointmentDate: '2026-12-02', startTime: '09:00', endTime: '10:00' };
  expect((await call('POST', `/quotations/${q.id}/convert-to-job`, slot)).body.code).toBe('ALREADY_CONVERTED');

  // idempotency key is bound to its request
  const withKey = (path: string, body: object) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-user': 'dev-admin', 'x-idempotency-key': 'bind-1' }, body: JSON.stringify(body) });
  const c = { type: 'residential', name: 'K', phone: '01234 567890', email: 'k@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } };
  expect((await withKey('/customers', c)).status).toBe(201);
  expect((await withKey('/customers', { ...c, name: 'Other' })).status).toBe(422);
});

test('licence expiry, equipment-derived skills, refrigerant log gate, rate card, technician privacy', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'RF', phone: '01234 567890', email: 'rf@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const eq = (await call('POST', '/equipment', { customerId: cust.id, locationId: loc, type: 'heat_pump', brand: 'b', model: 'm', serialNumber: 's1', installationDate: '2025-01-01', warrantyExpiryDate: '2030-01-01', maintenanceFrequency: 'annual' })).body;
  const expired = (await call('POST', '/technicians', { name: 'Old', phone: '1', email: 'old@x.co', fGasLicense: 'FG1', fGasExpiry: '2020-01-01' })).body;
  const valid = (await call('POST', '/technicians', { name: 'New', phone: '1', email: 'new@x.co', fGasLicense: 'FG2', fGasExpiry: '2099-01-01' })).body;
  const base = { customerId: cust.id, locationId: loc, equipmentIds: [eq.id], type: 'repair', title: 't', description: 'leak', appointmentDate: '2027-02-01', startTime: '09:00', endTime: '10:00',
    checklist: [{ id: 'c1', label: 'Leak test', category: 'refrigerant', checked: true }] };
  const bad = await call('POST', '/jobs', { ...base, technicianId: expired.id });
  expect(bad.status).toBe(403);
  expect(bad.body.detail).toMatch(/expired/);
  // no equipment attached: the wording alone must still demand Gas Safe
  const noGas = await call('POST', '/jobs', { ...base, equipmentIds: [], title: 'Boiler lockout', description: 'no hot water', technicianId: valid.id, startTime: '12:00', endTime: '13:00' });
  expect(noGas.status).toBe(403);
  expect(noGas.body.detail).toMatch(/Gas Safe/);
  const job =(await call('POST', '/jobs', { ...base, technicianId: valid.id })).body;
  expect(job.requiredSkills).toContain('F_GAS');
  expect(job.hourlyRate).toBe(85); // rate card default

  await call('POST', `/jobs/${job.id}/status`, { status: 'dispatched' });
  await call('POST', `/jobs/${job.id}/status`, { status: 'in_progress' });
  const sig = { name: 'C', dataUrl: SIG_PNG, signedAt: '2027-02-01T10:00:00Z' };
  await call('PATCH', `/jobs/${job.id}`, { workPerformed: 'Fixed leak', customerSignature: sig });
  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.detail).toMatch(/refrigerant log/);
  const log = await call('POST', `/jobs/${job.id}/refrigerant`, { refrigerant: 'R410A', action: 'charge', amountKg: 0.4, cylinderId: 'CYL-9', certNumber: 'FG2' });
  expect(log.status).toBe(201);
  expect(log.body.refrigerantLogs).toHaveLength(1);
  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.status).toBe('completed');
  expect((await call('POST', `/jobs/${job.id}/refrigerant`, { refrigerant: 'R410A', action: 'charge', amountKg: 1, certNumber: 'x' })).body.code).toBe('JOB_CLOSED');

  const techs = (await call('GET', '/technicians', undefined, 'technician')).body;
  expect(techs.data.length).toBeLessThanOrEqual(1);
  expect((await call('GET', `/technicians/${valid.id}`, undefined, 'technician')).status).toBe(404);
});

test('lists page in the database: limit, cursor, search, status', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'PG', phone: '01234 567890', email: 'pg@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  for (const d of ['alpha', 'beta', 'gamma']) await call('POST', '/jobs', { customerId: cust.id, locationId: loc, type: 'repair', title: 't', description: `pg-${d}`, appointmentDate: '2027-03-01', startTime: '09:00', endTime: '10:00' });
  const p1 = (await call('GET', '/jobs?limit=2&q=pg-')).body;
  expect(p1.data).toHaveLength(2);
  expect(p1.nextCursor).toBeTruthy();
  const p2 = (await call('GET', `/jobs?limit=2&q=pg-&cursor=${p1.nextCursor}`)).body;
  expect(p2.data).toHaveLength(1);
  expect(p2.nextCursor).toBeNull();
  expect(new Set([...p1.data, ...p2.data].map((j: any) => j.id)).size).toBe(3);
  expect((await call('GET', '/jobs?q=PG-BETA')).body.data).toHaveLength(1);
  expect((await call('GET', '/jobs?q=pg-&status=completed')).body.data).toHaveLength(0);

  // page + limit: offset paging with the filtered total, same rows as the cursor walk
  const pg1 = (await call('GET', '/jobs?limit=2&page=1&q=pg-')).body;
  const pg2 = (await call('GET', '/jobs?limit=2&page=2&q=pg-')).body;
  expect([pg1.data.length, pg2.data.length, pg1.total, pg2.total]).toEqual([2, 1, 3, 3]);
  expect([...pg1.data, ...pg2.data].map((j: any) => j.id)).toEqual([...p1.data, ...p2.data].map((j: any) => j.id));
  expect((await call('GET', '/jobs?limit=2&page=9&q=pg-')).body).toMatchObject({ data: [], total: 3 });
  expect((await call('GET', '/jobs?limit=2&q=pg-')).body.total).toBeUndefined(); // cursor mode skips the count

  // equality filters and related-field search
  expect((await call('GET', '/customers?page=1&q=PG&type=residential&archived=false')).body.data.some((c: any) => c.id === cust.id)).toBe(true);
  expect((await call('GET', '/customers?page=1&q=PG&archived=true')).body.data.some((c: any) => c.id === cust.id)).toBe(false);
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, items: [{ type: 'labour', description: 'x', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  expect((await call('GET', '/invoices?page=1&q=pg', undefined, 'accountant')).body.data.map((i: any) => i.id)).toContain(inv.id);
  expect((await call('GET', '/certificates?page=1&limit=10')).body).toMatchObject({ data: expect.any(Array), total: expect.any(Number) });
});

test('database refuses overlapping jobs for one technician even if the app check is bypassed', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'EX', phone: '01234 567890', email: 'ex@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const tech = (await call('POST', '/technicians', { name: 'Ex', phone: '1', email: 'ex-t@x.co' })).body;
  const mk = (startTime: string, endTime: string) => call('POST', '/jobs', { customerId: cust.id, locationId: loc, type: 'repair', title: 't', description: 'x', appointmentDate: '2027-04-01', startTime, endTime, technicianId: tech.id });
  await mk('08:00', '09:00');
  const far = (await mk('15:00', '16:00')).body;
  await expect(scoped.$executeRaw`UPDATE jobs SET start_time = '08:30', end_time = '09:30' WHERE id = ${far.id}::uuid`).rejects.toThrow(/jobs_technician_no_overlap/);
});

test('per-line VAT, credit-note VAT share, and paged customers/parts/equipment/requests', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'VATCo', phone: '01234 567890', email: 'vat@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, vatRatePercent: 20, items: [
    { type: 'labour', description: 'std', quantity: 1, unitPrice: 100 },
    { type: 'part', description: 'zero-rated', quantity: 1, unitPrice: 100, vatRatePercent: 0 },
  ] }, 'accountant')).body;
  expect(inv).toMatchObject({ subtotal: 200, vatAmount: 20, total: 220 });
  expect(inv.items.find((i: any) => i.description === 'zero-rated').vatRatePercent).toBe(0);
  const cn = (await call('POST', `/invoices/${inv.id}/credit-notes`, { amount: 110, reason: 'half back' }, 'accountant')).body;
  expect(cn.creditNote.vatAmount).toBe(10); // half of the invoice's 20 VAT

  const c = (await call('GET', '/customers?limit=1&q=vatco')).body;
  expect(c.data).toHaveLength(1);
  for (const path of ['/parts', '/equipment', '/requests']) expect(Array.isArray((await call('GET', `${path}?limit=1`)).body.data)).toBe(true);
});

test('maintenance agreement raises one preventive job per due date and advances', async () => {
  const { raiseMaintenanceJobs } = await import('../src/modules/maintenance/service.js');
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'MA', phone: '01234 567890', email: 'ma@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const ag = await call('POST', '/maintenance-agreements', { customerId: cust.id, locationId: loc, frequency: 'quarterly', nextDueDate: '2027-06-01' });
  expect(ag.status).toBe(201);
  expect(await runAs(companyId, () => raiseMaintenanceJobs('2027-01-01'))).toBe(0); // not within the lead window
  const [r1, r2] = await Promise.all([runAs(companyId, () => raiseMaintenanceJobs('2027-05-25')), runAs(companyId, () => raiseMaintenanceJobs('2027-05-25'))]);
  expect(r1 + r2).toBe(1);
  const jobs = (await call('GET', '/jobs?q=Scheduled quarterly')).body.data;
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ type: 'preventive_maintenance', appointmentDate: '2027-06-01', status: 'new' });
  expect((await call('GET', `/maintenance-agreements/${ag.body.id}`)).body.nextDueDate).toMatch(/^2027-09-01/);
});

test('service contract: auto-invoices each visit, rejects bad terms, deactivates past the end date', async () => {
  const { raiseMaintenanceJobs } = await import('../src/modules/maintenance/service.js');
  await prisma.maintenanceAgreement.deleteMany(); // earlier tests' agreements would also fall due
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'SC', phone: '01234 567890', email: 'sc@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const base = { customerId: cust.id, locationId: loc, frequency: 'quarterly', nextDueDate: '2028-06-01' };
  expect((await call('POST', '/maintenance-agreements', { ...base, autoInvoice: true })).status).toBe(422); // no price
  expect((await call('POST', '/maintenance-agreements', { ...base, endDate: '2028-01-01' })).status).toBe(422); // ends before first visit
  const ag = (await call('POST', '/maintenance-agreements', { ...base, annualPrice: 400, autoInvoice: true, slaResponseHours: 24, endDate: '2028-07-01' })).body;
  expect(await runAs(companyId, () => raiseMaintenanceJobs('2028-05-25'))).toBe(1);
  const inv = await prisma.invoice.findMany({ where: { customerId: cust.id } });
  expect(inv).toHaveLength(1);
  expect(inv[0]).toMatchObject({ status: 'issued' });
  expect(Number(inv[0].subtotal)).toBe(100);
  const mkJob = () => call('POST', '/jobs', { customerId: cust.id, locationId: loc, type: 'repair', priority: 'high', appointmentDate: '2028-06-02', startTime: '09:00', endTime: '10:00', estimatedDurationMinutes: 60, title: 't', description: 'callout', requiredSkills: [], labourHours: 0, hourlyRate: 50, travelTimeMinutes: 0, travelCharge: 0 });
  const co = await mkJob();
  expect(co.status).toBe(201);
  expect(Date.parse(co.body.slaDueAt) - Date.now()).toBeGreaterThan(23 * 3_600_000); // 24h SLA from the contract
  expect(co.body.slaBreached).toBe(false);
  await prisma.job.update({ where: { id: co.body.id }, data: { slaDueAt: new Date(Date.now() - 1000) } });
  expect((await call('GET', `/jobs/${co.body.id}`)).body.slaBreached).toBe(true);
  expect(await runAs(companyId, () => raiseMaintenanceJobs('2028-08-25'))).toBe(0); // next due 2028-09-01 is past the term
  expect((await call('GET', `/maintenance-agreements/${ag.id}`)).body.active).toBe(false);
  const rn = (await call('POST', '/maintenance-agreements', { ...base, nextDueDate: '2029-06-01', endDate: '2029-07-01', autoRenew: true })).body;
  expect(await runAs(companyId, () => raiseMaintenanceJobs('2029-05-25'))).toBe(1); // last in-term visit
  expect(await runAs(companyId, () => raiseMaintenanceJobs('2029-08-25'))).toBe(1); // 2029-09-01 is past the term, so it renews
  expect((await call('GET', `/maintenance-agreements/${rn.id}`)).body).toMatchObject({ active: true });
  expect((await call('GET', `/maintenance-agreements/${rn.id}`)).body.endDate).toMatch(/^2030-07-01/);
});

test('sessions are httpOnly cookies: no tokens in bodies, CSRF header required, refresh from cookie, logout clears', async () => {
  const { hashPassword } = await import('../src/common/auth.js');
  await prisma.user.update({ where: { companyId_email: { companyId, email: 'admin@dev.local' } }, data: { password: hashPassword('Secret1$') } });
  const post = (path: string, body: object | undefined, headers: Record<string, string> = {}) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) });
  const csrf = { 'x-requested-with': 'apexhvac' };
  const cookies = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0]);

  expect((await post('/auth/login', { company: 'default', email: 'admin@dev.local', password: 'Secret1$' })).status).toBe(403); // no CSRF header
  const login = await post('/auth/login', { company: 'default', email: 'admin@dev.local', password: 'Secret1$' }, csrf);
  expect(login.status).toBe(200);
  expect(Object.keys(await login.json())).toEqual(['expiresIn']);
  const set = login.headers.getSetCookie();
  expect(set.find((c) => c.startsWith('hvac_at='))).toMatch(/HttpOnly/i);
  expect(set.find((c) => c.startsWith('hvac_rt='))).toMatch(/Path=\/api\/v1\/auth/);
  expect((await post('/auth/login', { company: 'nope', email: 'admin@dev.local', password: 'Secret1$' }, csrf)).status).toBe(401); // right credentials, wrong company
  const jar = cookies(login).join('; ');

  expect((await fetch(base + '/auth/me', { headers: { cookie: jar } })).status).toBe(200);
  expect((await post('/customers', { type: 'residential' }, { cookie: jar })).status).toBe(403); // cookie write without CSRF header
  expect((await post('/customers', { type: 'residential' }, { cookie: jar, ...csrf })).status).toBe(400); // passes auth, fails validation
  const renewed = await post('/auth/refresh', undefined, { cookie: jar, ...csrf });
  expect(renewed.status).toBe(200);
  expect(renewed.headers.getSetCookie().some((c) => c.startsWith('hvac_at='))).toBe(true);
  const out = await post('/auth/logout', undefined, { cookie: jar, ...csrf });
  expect(out.status).toBe(204);
  expect(out.headers.getSetCookie().join(';')).toMatch(/hvac_at=;/);
});

test('overdue sweep drafts a payment reminder; invoice PDF route; part delete', async () => {
  const { markOverdue } = await import('../src/modules/invoices/service.js');
  const [cust] = (await call('GET', '/customers')).body.data;
  await prisma.customer.update({ where: { id: cust.id }, data: { gdprConsent: true, communicationPreference: 'email' } });
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: cust.serviceLocations[0].id, issueDate: '2020-02-01', paymentTermsDays: 14, items: [{ type: 'fee', description: 'late fee', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  await runAs(companyId, () => markOverdue());
  const reminder = await prisma.notification.findFirst({ where: { type: 'payment_reminder', customerId: cust.id, subject: { contains: inv.invoiceNumber } } });
  expect(reminder?.status).toBe('draft');

  const pdf = await fetch(`${base}/invoices/${inv.id}/pdf`, { headers: { 'x-dev-user': 'dev-accountant' } });
  expect(pdf.headers.get('content-type')).toContain('application/pdf');
  expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');

  const fresh = (await call('POST', '/parts', { name: 'Gone', sku: 'DEL-1', category: 'c', unitCost: 1, sellingPrice: 2 })).body;
  expect((await call('DELETE', `/parts/${fresh.id}`)).status).toBe(204);
});

test('issuing an invoice drafts an email linked to it; audit log is admin-only', async () => {
  const [cust] = (await call('GET', '/customers')).body.data;
  await prisma.customer.update({ where: { id: cust.id }, data: { gdprConsent: true, communicationPreference: 'email' } });
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: cust.serviceLocations[0].id, status: 'draft', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  await call('POST', `/invoices/${inv.id}/issue`, undefined, 'accountant');
  expect((await prisma.notification.findFirst({ where: { invoiceId: inv.id, type: 'invoice_issued' } }))?.status).toBe('draft');
  expect((await call('GET', '/audit?q=issued')).body.data.length).toBeGreaterThan(0);
  expect((await call('GET', '/audit', undefined, 'accountant')).status).toBe(403);
});

test('autoSendEmails toggle: draft by default, sent at once when on; quote PDF', async () => {
  const { setProvider, logProvider } = await import('../src/modules/notifications/service.js');
  const sent: { type: string; invoiceId?: string }[] = [];
  setProvider({ async send(n) { sent.push(n); } }); // never hit Resend from tests
  try {
    const [cust] = (await call('GET', '/customers')).body.data;
    await prisma.customer.update({ where: { id: cust.id }, data: { gdprConsent: true, communicationPreference: 'email' } });
    const mk = async () => (await call('POST', '/invoices', { customerId: cust.id, locationId: cust.serviceLocations[0].id, status: 'draft', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
    const a = await mk(); await call('POST', `/invoices/${a.id}/issue`, undefined, 'accountant');
    expect(sent).toHaveLength(0);
    expect((await prisma.notification.findFirst({ where: { invoiceId: a.id } }))?.status).toBe('draft');

    expect((await call('PATCH', '/settings', { autoSendEmails: true })).status).toBe(200);
    const b = await mk(); await call('POST', `/invoices/${b.id}/issue`, undefined, 'accountant');
    expect(sent).toEqual([expect.objectContaining({ type: 'invoice_issued', invoiceId: b.id })]);
    expect((await prisma.notification.findFirst({ where: { invoiceId: b.id } }))?.status).toBe('sent');

    const q = (await call('POST', '/quotations', { customerId: cust.id, locationId: cust.serviceLocations[0].id, issueDate: '2026-11-01', expiryDate: '2026-12-01', items: [{ type: 'fee', description: 'survey', quantity: 1, unitPrice: 50 }] })).body;
    const pdf = await fetch(`${base}/quotations/${q.id}/pdf`, { headers: { 'x-dev-user': 'dev-admin' } });
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
  } finally {
    await call('PATCH', '/settings', { autoSendEmails: false });
    setProvider(logProvider);
  }
});

test('gas safe certificates: engineer must be registered; CP12 expires in a year; PDF renders', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'Cert', phone: '01234 567890', email: 'c@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = cust.serviceLocations?.[0] ?? (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0];
  const mk = async (extra: object) => (await call('POST', '/technicians', { name: 'Eng', phone: '1', email: 'e@x.co', ...extra })).body;
  const [none, expired, ok] = [await mk({}), await mk({ gasSafeLicense: '111', gasSafeExpiry: '2020-01-01' }), await mk({ gasSafeLicense: '222', gasSafeExpiry: '2099-01-01' })];
  const today = new Date().toISOString().slice(0, 10), nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  const body = (technicianId: string) => ({
    type: 'cp12', customerId: cust.id, locationId: loc.id, technicianId, issueDate: today,
    data: { appliances: [{ description: 'Boiler', flueOperation: 'pass', ventilation: 'pass', safetyDevice: 'pass', gasTightness: 'pass', safeToUse: true }] },
  });
  expect((await call('POST', '/certificates', body(none.id))).body.code).toBe('NO_GAS_SAFE');
  expect((await call('POST', '/certificates', body(expired.id))).body.code).toBe('GAS_SAFE_EXPIRED');
  expect((await call('POST', '/certificates', { ...body(ok.id), data: { appliances: [] } })).status).toBe(400);
  const c = (await call('POST', '/certificates', body(ok.id))).body;
  expect(c).toMatchObject({ certNumber: expect.stringMatching(/^CERT-\d{4}-\d{4}$/), gasSafeNumber: '222', issueDate: today, expiryDate: nextYear });
  expect((await call('GET', '/certificates/expiring?days=365')).body.map((x: any) => x.id)).toContain(c.id);
  const pdf = await fetch(`${base}/certificates/${c.id}/pdf`, { headers: { 'x-dev-user': 'dev-admin' } });
  expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
});

test('job photos: webp only, validated by content, technician limited to own job, bytes round-trip', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'Ph', phone: '01234 567890', email: 'p@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0];
  const job = (await call('POST', '/jobs', { customerId: cust.id, locationId: loc.id, type: 'repair', title: 't', description: 'x', appointmentDate: '2026-12-01', startTime: '09:00', endTime: '10:00' })).body;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8L'), Buffer.alloc(30)]);
  const url = (b: Buffer, t = 'webp') => `data:image/${t};base64,${b.toString('base64')}`;
  expect((await call('POST', `/jobs/${job.id}/photos`, { dataUrl: url(png, 'png') })).status).toBe(400); // only webp data URLs
  expect((await call('POST', `/jobs/${job.id}/photos`, { dataUrl: url(png) })).body.code).toBe('BAD_IMAGE'); // png bytes labelled webp
  expect((await call('POST', `/jobs/${job.id}/photos`, { dataUrl: url(Buffer.concat([webp, Buffer.alloc(610_000)])) })).body.code).toBe('IMAGE_TOO_LARGE');
  const p = (await call('POST', `/jobs/${job.id}/photos`, { dataUrl: url(webp), caption: 'flue' })).body;
  expect(p).toMatchObject({ mime: 'image/webp', caption: 'flue' });
  expect((await call('GET', `/jobs/${job.id}/photos`)).body).toHaveLength(1);
  const raw = await fetch(`${base}/jobs/${job.id}/photos/${p.id}`, { headers: { 'x-dev-user': 'dev-admin' } });
  expect(raw.headers.get('content-type')).toContain('image/webp');
  expect(Buffer.from(await raw.arrayBuffer()).equals(webp)).toBe(true);
  expect((await call('GET', `/jobs/${job.id}/photos`, undefined, 'technician')).status).toBe(403); // not the technician's job
  expect((await call('DELETE', `/jobs/${job.id}/photos/${p.id}`)).status).toBe(204);
  expect((await call('GET', `/jobs/${job.id}/photos`)).body).toHaveLength(0);
});

test('customer approves a quote through the emailed link without logging in', async () => {
  const cust = (await call('GET', '/customers')).body.data[0];
  const loc = cust.serviceLocations[0].id;
  await prisma.customer.update({ where: { id: cust.id }, data: { gdprConsent: true } });
  const mk = async () => (await call('POST', '/quotations', { customerId: cust.id, locationId: loc, issueDate: '2026-10-01', expiryDate: '2099-01-01', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 50 }] })).body;
  const sendAndLink = async (q: { id: string }) => {
    await call('POST', `/quotations/${q.id}/send`);
    const n = (await call('GET', '/notifications')).body.data.find((x: any) => x.quotationId === q.id);
    return `/public/quotes/${n.messageBody.match(/\/quote\/([\w-]+)/)[1]}`;
  };
  const anon = (method: string, path: string, body?: unknown) => fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const png = SIG_PNG;

  const q = await mk();
  const link = await sendAndLink(q);
  expect((await anon('GET', '/public/quotes/nope')).status).toBe(404);
  const view = await (await anon('GET', link)).json();
  expect(view).toMatchObject({ quoteNumber: q.quoteNumber, status: 'viewed' });
  expect(view.id).toBeUndefined();
  expect((await call('GET', `/quotations/${q.id}`)).body.status).toBe('viewed');
  expect((await anon('POST', `${link}/accept`, { name: '' })).status).toBe(400);
  expect((await anon('POST', `${link}/accept`, { name: 'Cust', signature: 'javascript:x' })).status).toBe(400);
  expect((await anon('POST', `${link}/accept`, { name: 'Cust', signature: png })).status).toBe(200);
  expect((await anon('POST', `${link}/accept`, { name: 'Cust' })).status).toBe(409); // already decided
  const done = (await call('GET', `/quotations/${q.id}`)).body;
  expect(done).toMatchObject({ status: 'accepted', acceptedBy: 'Cust' });
  expect(done.acceptedSignature).toBeUndefined(); // staff payload carries neither signature nor token hash
  expect((await prisma.quotation.findUnique({ where: { id: q.id } }))!.acceptedSignature).toBe(png);

  const r = await mk();
  expect((await anon('POST', `${await sendAndLink(r)}/reject`)).status).toBe(200);
  expect((await call('GET', `/quotations/${r.id}`)).body.status).toBe('rejected');

  const e = await mk();
  const elink = await sendAndLink(e);
  await prisma.quotation.update({ where: { id: e.id }, data: { expiryDate: new Date('2026-01-01') } });
  expect((await (await anon('POST', `${elink}/accept`, { name: 'Cust' })).json()).code).toBe('EXPIRED');
});

test('technician site details come with the job; only an admin can set licences', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'Site Probe', phone: '01234 567890', email: 'sp@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '7 Acacia Rd', city: 'Leeds', postcode: 'LS1 4AB', accessNotes: 'Key safe 1234' })).body.serviceLocations[0].id;
  const t = (await call('POST', '/technicians', { name: 'Sited', phone: '1', email: 'sited@x.co' })).body;
  const j = (await call('POST', '/jobs', { customerId: cust.id, locationId: loc, type: 'repair', title: 'Visit', description: 'd', technicianId: t.id, appointmentDate: '2027-03-01', startTime: '09:00', endTime: '10:00' })).body;
  expect(j.site).toMatchObject({ customerName: 'Site Probe', addressLine1: '7 Acacia Rd', postcode: 'LS1 4AB', accessNotes: 'Key safe 1234' });
  expect(j.site.email).toBeUndefined();
  // dispatcher: may edit a technician, not their licence
  expect((await call('PATCH', `/technicians/${t.id}`, { vanRegistration: 'AB12 CDE' }, 'dispatcher')).status).toBe(200);
  const lic = await call('PATCH', `/technicians/${t.id}`, { gasSafeLicense: '123456', gasSafeExpiry: '2099-01-01' }, 'dispatcher');
  expect(lic.status).toBe(403);
  expect((await call('POST', '/technicians', { name: 'New', phone: '1', email: 'n2@x.co', fGasLicense: 'FG' }, 'dispatcher')).status).toBe(403);
  expect((await call('PATCH', `/technicians/${t.id}`, { gasSafeLicense: '123456', gasSafeExpiry: '2099-01-01' })).status).toBe(200);
});

test('signatures must be a real inked PNG; stubs and blank pads are refused', async () => {
  const job = (await call('GET', '/jobs')).body.data[0].id;
  const sign = (dataUrl: string) => call('PATCH', `/jobs/${job}`, { customerSignature: { name: 'A', dataUrl, signedAt: '2026-01-01T00:00:00Z' } });
  expect((await sign('data:image/png;base64,iVBORw0KGgo=')).status).toBe(400); // header only
  expect((await sign(pngUrl(60, 30, false))).status).toBe(400); // transparent, nothing drawn
  expect((await sign(pngUrl(10, 5))).status).toBe(400); // too small to be a signature
  expect((await sign('data:image/svg+xml;base64,PHN2Zy8+')).status).toBe(400); // pad only produces PNG
  expect((await sign(pngUrl())).status).toBe(200);
});

test('one active customer per email: create, edit and restore are refused; archived emails can return', async () => {
  const body = (name: string, email: string) => ({ type: 'residential', name, phone: '01234 567890', email, gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } });
  const a = await call('POST', '/customers', body('Alice', 'Alice.Smith@Example.com'));
  expect(a.status).toBe(201);
  expect(a.body.email).toBe('alice.smith@example.com'); // stored trimmed and lower-case
  const dup = await call('POST', '/customers', body('Alice Again', '  ALICE.SMITH@example.com '));
  expect(dup.status).toBe(409);
  expect(dup.body.code).toBe('DUPLICATE_CUSTOMER');
  expect(dup.body.detail).toMatch(/Alice already uses alice.smith@example.com/);
  const b = (await call('POST', '/customers', body('Bob', 'bob@example.com'))).body;
  expect((await call('PATCH', `/customers/${b.id}`, { email: 'alice.smith@example.com' })).body.code).toBe('DUPLICATE_CUSTOMER');
  expect((await call('PATCH', `/customers/${b.id}`, { name: 'Robert', email: 'BOB@example.com' })).status).toBe(200); // own email, other case: fine
  // archived customers free their email; restoring one that was since re-used is refused
  expect((await call('POST', `/customers/${a.body.id}/archive`)).status).toBe(200);
  const again = await call('POST', '/customers', body('Alice Returns', 'alice.smith@example.com'));
  expect(again.status).toBe(201);
  expect((await call('POST', `/customers/${a.body.id}/unarchive`)).body.code).toBe('DUPLICATE_CUSTOMER');
});

test('postcodes must be real UK postcodes and are stored tidy', async () => {
  const mk = (postcode: string) => call('POST', '/customers', { type: 'residential', name: 'PC', phone: '01234 567890', email: `pc${Math.random().toString(36).slice(2)}@x.co`, gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode } });
  for (const bad of ['ZZZZ 999', 'p', '123 132', 'TEST 232', 'QV1 1AA', 'AA1 1CC', 'LS1', '']) expect((await mk(bad)).status, bad).toBe(400);
  for (const [good, stored] of [['SW1A 1AA', 'SW1A 1AA'], ['ls14ab', 'LS1 4AB'], ['  m1   1ae ', 'M1 1AE'], ['B33 8TH', 'B33 8TH'], ['DN551PT', 'DN55 1PT'], ['EC1A 1BB', 'EC1A 1BB'], ['W1A 0AX', 'W1A 0AX']]) {
    const r = await mk(good);
    expect(r.status, good).toBe(201);
    expect(r.body.billingAddress.postcode).toBe(stored);
  }
  const c = (await mk('LS1 4AB')).body;
  const site = { label: 'Site', addressLine1: '1', city: 'c' };
  expect((await call('POST', `/customers/${c.id}/locations`, { ...site, postcode: 'nope' })).status).toBe(400);
  expect((await call('POST', `/customers/${c.id}/locations`, { ...site, postcode: 'cr2 6xh' })).body.serviceLocations[0].postcode).toBe('CR2 6XH');
  expect((await call('PATCH', '/settings', { postcode: 'bad' })).status).toBe(400);
  expect((await call('PATCH', '/settings', { postcode: '' })).status).toBe(200); // not filled in yet is allowed
});

test('landlord customers: own type and filter, no reverse charge; refrigerant charge stored on equipment', async () => {
  const body = { phone: '01234 567890', email: 'll@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } };
  const ll = (await call('POST', '/customers', { ...body, type: 'landlord', name: 'Letting Agent' })).body;
  expect(ll.type).toBe('landlord');
  expect((await call('GET', '/customers?type=landlord')).body.data.map((c: { id: string }) => c.id)).toContain(ll.id);
  const loc = (await call('POST', `/customers/${ll.id}/locations`, { label: 'Rental', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const items = [{ type: 'labour', description: 'l', quantity: 1, unitPrice: 100 }];
  expect((await call('POST', '/invoices', { customerId: ll.id, locationId: loc, items, reverseCharge: true }, 'accountant')).body.code).toBe('RESIDENTIAL_TERMS');
  const eq = (await call('POST', '/equipment', { customerId: ll.id, locationId: loc, type: 'heat_pump', brand: 'b', model: 'm', serialNumber: 's9', installationDate: '2025-01-01', warrantyExpiryDate: '2030-01-01', maintenanceFrequency: 'annual', refrigerantType: 'R410A', refrigerantChargeKg: 3 })).body;
  expect(eq.refrigerantType).toBe('R410A');
  expect(eq.refrigerantChargeKg).toBe(3);
});

test('reverse charge, CIS on labour only, retention held until released', async () => {
  const cust = (await call('POST', '/customers', { type: 'commercial', name: 'CIS', phone: '01234 567890', email: 'cis@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Site', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const items = [{ type: 'labour', description: 'l', quantity: 1, unitPrice: 1000 }, { type: 'part', description: 'p', quantity: 1, unitPrice: 500 }];
  const home = (await call('POST', '/customers', { type: 'residential', name: 'Homeowner', phone: '01234 567890', email: 'home@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const homeLoc = (await call('POST', `/customers/${home.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const refused = await call('POST', '/invoices', { customerId: home.id, locationId: homeLoc, items, reverseCharge: true }, 'accountant');
  expect(refused.body.code).toBe('RESIDENTIAL_TERMS');
  const inv = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, items, reverseCharge: true, cisRatePercent: 20, retentionPercent: 5 }, 'accountant')).body;
  // no VAT; CIS = 20% of 1000 labour; retention = 5% of 1500
  expect(inv).toMatchObject({ vatAmount: 0, total: 1500, cisDeduction: 200, retentionHeld: 75, balanceDue: 1225 });
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 1225, method: 'bacs' }, 'accountant')).body).toMatchObject({ status: 'paid', balanceDue: 0 });
  expect((await call('POST', `/invoices/${inv.id}/release-retention`, undefined, 'accountant')).body).toMatchObject({ status: 'partially_paid', balanceDue: 75, retentionHeld: 0 });
  expect((await call('POST', `/invoices/${inv.id}/release-retention`, undefined, 'accountant')).body.code).toBe('NO_RETENTION');
});

test('deposit and stage invoices are their own rows; the final invoice deducts them', async () => {
  const cust = (await call('POST', '/customers', { type: 'commercial', name: 'Stage', phone: '01234 567890', email: 'stage@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Site', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const q = (await call('POST', '/quotations', { customerId: cust.id, locationId: loc, issueDate: '2026-10-01', expiryDate: '2026-12-01', vatRatePercent: 20, items: [{ type: 'part', description: 'unit', quantity: 1, unitPrice: 1000 }] })).body;
  expect((await call('POST', '/invoices/stage', { quoteId: q.id, percent: 25 }, 'accountant')).body.code).toBe('NOT_ACCEPTED');
  await call('POST', `/quotations/${q.id}/send`);
  await call('POST', `/quotations/${q.id}/accept`, { acceptedBy: 'Cust' });
  const dep = (await call('POST', '/invoices/stage', { quoteId: q.id, percent: 25, label: 'Deposit' }, 'accountant')).body;
  expect(dep).toMatchObject({ stageLabel: 'Deposit', stagePercent: 25, subtotal: 250, total: 300 });
  expect((await call('POST', `/quotations/${q.id}/convert-to-invoice`, undefined, 'admin')).body.code).toBe('HAS_STAGES');
  expect((await call('POST', '/invoices/stage', { quoteId: q.id, percent: 80 }, 'accountant')).body.code).toBe('BAD_STAGE_PERCENT');
  const fin = (await call('POST', '/invoices/stage', { quoteId: q.id, final: true }, 'accountant')).body;
  expect(fin).toMatchObject({ stageLabel: 'Final', stagePercent: 75, subtotal: 750, total: 900 });
  expect((await call('POST', '/invoices/stage', { quoteId: q.id, final: true }, 'accountant')).body.code).toBe('ALREADY_CONVERTED');
});

test('delete is soft: hidden from reads, blocked while in use, row kept; inactive and expired flags', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'Soft', phone: '01234 567890', email: 'soft@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const part = (await call('POST', '/parts', { name: 'Gasket', sku: 'SOFT1', category: 'x', unitCost: 1, sellingPrice: 2 })).body;
  expect((await call('PATCH', `/parts/${part.id}`, { inactive: true })).body.inactive).toBe(true);
  expect((await call('GET', '/parts?inactive=true')).body.data.map((p: any) => p.id)).toContain(part.id);
  expect((await call('DELETE', `/parts/${part.id}`)).status).toBe(204);
  expect((await call('GET', `/parts/${part.id}`)).status).toBe(404);
  expect((await call('GET', '/parts')).body.data.map((p: any) => p.id)).not.toContain(part.id);
  expect(await prisma.part.findFirst({ where: { id: part.id, isDeleted: undefined } })).toMatchObject({ isDeleted: true });
  expect((await call('POST', '/parts', { name: 'Gasket', sku: 'SOFT1', category: 'x', unitCost: 1, sellingPrice: 2 })).body.code).toBe('DUPLICATE_SKU');
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Site', addressLine1: '1', city: 'c', postcode: 'LS1 4AB' })).body.serviceLocations[0].id;
  const q = (await call('POST', '/quotations', { customerId: cust.id, locationId: loc, issueDate: '2020-01-01', expiryDate: '2020-02-01', items: [{ type: 'part', description: 'x', quantity: 1, unitPrice: 10 }] })).body;
  expect(q.expired).toBe(true);
  expect((await call('DELETE', `/customers/${cust.id}`)).body.code).toBe('IN_USE');
  expect((await call('DELETE', `/quotations/${q.id}`)).status).toBe(204);
  expect((await call('GET', `/quotations/${q.id}`)).status).toBe(404);
  expect((await call('DELETE', `/customers/${cust.id}`)).status).toBe(204);
  expect((await call('GET', `/customers/${cust.id}`)).status).toBe(404);
});

test('custom fields: admin defines, values are validated on customers and equipment', async () => {
  await unscoped.customFieldDefinition.deleteMany(); // the test DB persists: start (and finish) with none, required fields would fail other tests
  const pr = { type: 'residential', name: 'CF', phone: '01234 567890', email: 'cf@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } };
  expect((await call('POST', '/custom-fields', { entity: 'customer', label: 'Gate code' }, 'dispatcher')).status).toBe(403);
  expect((await call('POST', '/custom-fields', { entity: 'customer', label: 'Tier', type: 'select' })).status).toBe(400); // dropdown needs options
  const tier = (await call('POST', '/custom-fields', { entity: 'customer', label: 'Tier', type: 'select', options: ['Gold', 'Silver'], required: true })).body;
  const seats = (await call('POST', '/custom-fields', { entity: 'customer', label: 'Seats', type: 'number' })).body;
  expect((await call('POST', '/customers', pr)).body.code).toBe('CUSTOM_FIELD_REQUIRED');
  expect((await call('POST', '/customers', { ...pr, customFields: { [tier.id]: 'Bronze' } })).body.code).toBe('INVALID_CUSTOM_FIELD');
  expect((await call('POST', '/customers', { ...pr, customFields: { [tier.id]: 'Gold', [seats.id]: '5' } })).body.code).toBe('INVALID_CUSTOM_FIELD');
  const c = (await call('POST', '/customers', { ...pr, customFields: { [tier.id]: 'Gold', [seats.id]: 5, nope: 1 } })).body;
  expect(c.customFields).toEqual({ [tier.id]: 'Gold', [seats.id]: 5 });
  expect((await call('PATCH', `/customers/${c.id}`, { notes: 'x' })).body.customFields).toEqual(c.customFields); // untouched when not sent
  expect((await call('GET', '/custom-fields', undefined, 'technician')).body.data.map((d: any) => d.id)).toEqual(expect.arrayContaining([tier.id, seats.id]));
  expect((await call('PATCH', `/custom-fields/${tier.id}`, { inactive: true })).body.inactive).toBe(true); // inactive no longer required
  expect((await call('PATCH', `/custom-fields/${tier.id}`, { type: 'text' })).status).toBe(400); // type is fixed
  expect((await call('DELETE', `/custom-fields/${seats.id}`)).status).toBe(204);
  expect((await call('POST', '/customers', { ...pr, email: 'cf2@x.co' })).status).toBe(201);

  // other modules: same rules, plus ordering within a module
  const sku = (await call('POST', '/custom-fields', { entity: 'part', label: 'Bin', type: 'text', required: true })).body;
  const sku2 = (await call('POST', '/custom-fields', { entity: 'part', label: 'Shelf', type: 'text' })).body;
  const part = { name: 'CF part', sku: 'CF-1', category: 'x', unitCost: 1, sellingPrice: 2 };
  expect((await call('POST', '/parts', part)).body.code).toBe('CUSTOM_FIELD_REQUIRED');
  const p = (await call('POST', '/parts', { ...part, customFields: { [sku.id]: 'A1' } })).body;
  expect(p.customFields).toEqual({ [sku.id]: 'A1' });
  expect((await call('PATCH', `/parts/${p.id}`, { customFields: { [sku.id]: 'B2', [sku2.id]: 'top' } })).body.customFields).toEqual({ [sku.id]: 'B2', [sku2.id]: 'top' });
  const jf = (await call('POST', '/custom-fields', { entity: 'job', label: 'PO number', type: 'text' })).body;
  const cu = (await call('GET', '/customers')).body.data.find((x: any) => x.serviceLocations.length);
  const rq = (await call('POST', '/requests', { customerId: cu.id, locationId: cu.serviceLocations[0].id, reportedProblem: 'leak', customFields: { [jf.id]: 'x' } })).body;
  expect(rq.customFields).toEqual({}); // a request field is a different module: the job field id is ignored
  expect((await call('POST', '/custom-fields/reorder', { ids: [sku2.id, sku.id] })).status).toBe(204);
  expect((await call('GET', '/custom-fields')).body.data.filter((d: any) => d.entity === 'part').map((d: any) => d.id)).toEqual([sku2.id, sku.id]);
  await unscoped.customFieldDefinition.deleteMany();
});

test('companies are isolated: same email, own data, own numbering', async () => {
  const other = await unscoped.company.upsert({ where: { slug: 'other' }, update: {}, create: { slug: 'other', name: 'Other Co' } });
  await unscoped.companySettings.upsert({ where: { companyId: other.id }, update: {}, create: { companyId: other.id, companyName: 'Other Co', availableVatRates: [20] } });
  await unscoped.user.upsert({ where: { companyId_email: { companyId: other.id, email: 'admin@dev.local' } }, update: {}, create: { id: crypto.randomUUID(), companyId: other.id, name: 'Other admin', email: 'admin@dev.local', role: 'admin' } });
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'Mine', phone: '01234 567890', email: 'mine@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'LS1 4AB' } })).body;
  const theirs = (id: string) => fetch(base + `/customers/${id}`, { headers: { 'x-dev-user': 'dev-admin', 'x-dev-company': 'other' } });
  expect((await theirs(cust.id)).status).toBe(404);
  const list = await (await fetch(base + '/customers', { headers: { 'x-dev-user': 'dev-admin', 'x-dev-company': 'other' } })).json();
  expect(JSON.stringify(list)).not.toContain('Mine');
  await unscoped.company.delete({ where: { id: other.id } }).catch(() => {}); // fails while its rows exist: leave them
});

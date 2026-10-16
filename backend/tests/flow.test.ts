import type { AddressInfo } from 'node:net';
import { beforeAll, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { seedDevUsers } from '../src/common/auth.js';
import { prisma } from '../src/common/prisma.js';

let base = '';
beforeAll(async () => {
  // tests wipe everything: only ever a local *_test database, never the dev data
  if (!/@(localhost|127\.0\.0\.1)[:/][^?]*_test(\?|$)/.test(process.env.DATABASE_URL ?? '')) throw new Error('Tests wipe their database: only a local *_test database is allowed, use `npm test`');
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
  await prisma.companySettings.update({ where: { id: 1 }, data: { defaultVatRate: 20 } }); // the import test changes it
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
  expect((await prisma.part.findUniqueOrThrow({ where: { id: part.id } })).stockQuantity).toBe(1);
  expect((await call('GET', `/movements?partId=${part.id}`)).body.data).toHaveLength(2);

  // invoicing needs a completed job, and completing needs the compliance record
  expect((await call('POST', `/jobs/${job.id}/invoice`, undefined, 'accountant')).body.code).toBe('JOB_NOT_COMPLETED');
  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.code).toBe('NOT_COMPLETABLE');
  const sig = { name: 'Cust', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', signedAt: '2026-11-02T10:00:00Z' };
  await call('PATCH', `/jobs/${job.id}`, { workPerformed: 'Replaced valve', customerSignature: sig });
  expect((await call('POST', `/jobs/${job.id}/status`, { status: 'completed' })).body.status).toBe('completed');
  expect((await call('POST', `/jobs/${job.id}/parts`, { partId: part.id, quantity: 1 })).body.code).toBe('JOB_CLOSED');
  expect((await call('PATCH', `/jobs/${job.id}`, { workPerformed: 'x' }, 'technician')).status).toBeGreaterThanOrEqual(403);
  const inv = (await call('POST', `/jobs/${job.id}/invoice`, undefined, 'accountant')).body;
  // 1.5h * 85 + 35 travel + 2 * 10 = 182.5 net, 20% VAT
  expect(inv).toMatchObject({ subtotal: 182.5, vatAmount: 36.5, total: 219, status: 'issued' });
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 300, method: 'bacs' }, 'accountant')).body.code).toBe('OVERPAYMENT');
  const part1 = (await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 19, method: 'bacs' }, 'accountant')).body;
  expect(part1).toMatchObject({ status: 'partially_paid', balanceDue: 200 });
  expect((await call('POST', `/invoices/${inv.id}/void`, { reason: 'raised in error' }, 'accountant')).body.code).toBe('HAS_PAYMENTS');
  expect((await call('POST', `/invoices/${inv.id}/payments`, { date: '2026-11-03', amount: 200, method: 'card' }, 'accountant')).body.status).toBe('paid');
});

test('rbac and technician scoping', async () => {
  expect((await call('GET', '/invoices', undefined, 'technician')).status).toBe(403);
  expect((await call('GET', '/users', undefined, 'dispatcher')).status).toBe(403);
  expect((await call('GET', '/jobs', undefined, 'technician')).body.data).toEqual([]); // no technicianId linked
  expect((await fetch(base + '/jobs')).status).toBe(401);
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
  expect(await expireQuotations()).toBe(1);
  expect((await call('GET', `/quotations/${q.id}`)).body.status).toBe('expired');
});

const old = {
  customers: [{ id: 'cust-1', type: 'residential', name: 'Old', phone: '1', email: 'o@x.co', billingAddress: { line1: '1', city: 'c', postcode: 'p' },
    serviceLocations: [{ id: 'loc-1', label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' }] }],
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
  const body = { customerId: cust.id, locationId: cust.serviceLocations[0].id, type: 'repair', description: 'd', technicianId: tech.id, appointmentDate: '2026-12-01', startTime: '09:00', endTime: '10:00' };
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
  const res = await Promise.all([1, 2, 3].map(() => call('POST', `/jobs/${job.id}/invoice`, undefined, 'accountant')));
  expect(res.filter((r) => r.status === 201).length + res.filter((r) => ['ALREADY_CONVERTED', 'JOB_NOT_COMPLETED'].includes(r.body.code)).length).toBe(3);
  expect(res.filter((r) => r.status === 201).length).toBeLessThanOrEqual(1); // the imported invoice already covers it, so normally 0
});

test('overdue sweep; notification consent and single delivery', async () => {
  const { markOverdue } = await import('../src/modules/invoices/service.js');
  const [cust] = (await call('GET', '/customers')).body.data;
  const loc = cust.serviceLocations[0].id;
  const late = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, issueDate: '2020-01-01', paymentTermsDays: 14, items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  const draft = (await call('POST', '/invoices', { customerId: cust.id, locationId: loc, issueDate: '2020-01-01', status: 'draft', items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 10 }] }, 'accountant')).body;
  expect(await markOverdue()).toBeGreaterThanOrEqual(1);
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
  const res = await Promise.all([call('POST', `/notifications/${made.id}/approve-send`), call('POST', `/notifications/${made.id}/approve-send`), deliverApproved()]);
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
  expect((await sig('data:image/png;base64,iVBORw0KGgo=')).status).toBe(200);

  const res = await fetch(base + '/healthz'.replace('/api/v1', ''), { headers: { 'x-request-id': 'bad id\t!' } });
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('x-request-id')).toMatch(/^[\w-]{1,64}$/);
});

test('same x-idempotency-key creates once and replays the stored response', async () => {
  const post = () => fetch(base + '/customers', { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-user': 'dev-admin', 'x-idempotency-key': 'idem-1' }, body: JSON.stringify({ type: 'residential', name: 'Idem', phone: '1', email: 'idem@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } }) });
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
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'CN', phone: '1', email: 'cn@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0].id;
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
  const c = { type: 'residential', name: 'K', phone: '1', email: 'k@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } };
  expect((await withKey('/customers', c)).status).toBe(201);
  expect((await withKey('/customers', { ...c, name: 'Other' })).status).toBe(422);
});

test('licence expiry, equipment-derived skills, refrigerant log gate, rate card, technician privacy', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'RF', phone: '1', email: 'rf@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0].id;
  const eq = (await call('POST', '/equipment', { customerId: cust.id, locationId: loc, type: 'heat_pump', brand: 'b', model: 'm', serialNumber: 's1', installationDate: '2025-01-01', warrantyExpiryDate: '2030-01-01', maintenanceFrequency: 'annual' })).body;
  const expired = (await call('POST', '/technicians', { name: 'Old', phone: '1', email: 'old@x.co', fGasLicense: 'FG1', fGasExpiry: '2020-01-01' })).body;
  const valid = (await call('POST', '/technicians', { name: 'New', phone: '1', email: 'new@x.co', fGasLicense: 'FG2', fGasExpiry: '2099-01-01' })).body;
  const base = { customerId: cust.id, locationId: loc, equipmentIds: [eq.id], type: 'repair', description: 'leak', appointmentDate: '2027-02-01', startTime: '09:00', endTime: '10:00',
    checklist: [{ id: 'c1', label: 'Leak test', category: 'refrigerant', checked: true }] };
  const bad = await call('POST', '/jobs', { ...base, technicianId: expired.id });
  expect(bad.status).toBe(403);
  expect(bad.body.detail).toMatch(/expired/);
  const job = (await call('POST', '/jobs', { ...base, technicianId: valid.id })).body;
  expect(job.requiredSkills).toContain('F_GAS');
  expect(job.hourlyRate).toBe(85); // rate card default

  await call('POST', `/jobs/${job.id}/status`, { status: 'dispatched' });
  await call('POST', `/jobs/${job.id}/status`, { status: 'in_progress' });
  const sig = { name: 'C', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', signedAt: '2027-02-01T10:00:00Z' };
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
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'PG', phone: '1', email: 'pg@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0].id;
  for (const d of ['alpha', 'beta', 'gamma']) await call('POST', '/jobs', { customerId: cust.id, locationId: loc, type: 'repair', description: `pg-${d}`, appointmentDate: '2027-03-01', startTime: '09:00', endTime: '10:00' });
  const p1 = (await call('GET', '/jobs?limit=2&q=pg-')).body;
  expect(p1.data).toHaveLength(2);
  expect(p1.nextCursor).toBeTruthy();
  const p2 = (await call('GET', `/jobs?limit=2&q=pg-&cursor=${p1.nextCursor}`)).body;
  expect(p2.data).toHaveLength(1);
  expect(p2.nextCursor).toBeNull();
  expect(new Set([...p1.data, ...p2.data].map((j: any) => j.id)).size).toBe(3);
  expect((await call('GET', '/jobs?q=PG-BETA')).body.data).toHaveLength(1);
  expect((await call('GET', '/jobs?q=pg-&status=completed')).body.data).toHaveLength(0);
});

test('database refuses overlapping jobs for one technician even if the app check is bypassed', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'EX', phone: '1', email: 'ex@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0].id;
  const tech = (await call('POST', '/technicians', { name: 'Ex', phone: '1', email: 'ex-t@x.co' })).body;
  const mk = (startTime: string, endTime: string) => call('POST', '/jobs', { customerId: cust.id, locationId: loc, type: 'repair', description: 'x', appointmentDate: '2027-04-01', startTime, endTime, technicianId: tech.id });
  await mk('08:00', '09:00');
  const far = (await mk('15:00', '16:00')).body;
  await expect(prisma.$executeRaw`UPDATE jobs SET start_time = '08:30', end_time = '09:30' WHERE id = ${far.id}::uuid`).rejects.toThrow(/jobs_technician_no_overlap/);
});

test('per-line VAT, credit-note VAT share, and paged customers/parts/equipment/requests', async () => {
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'VATCo', phone: '1', email: 'vat@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0].id;
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
  const cust = (await call('POST', '/customers', { type: 'residential', name: 'MA', phone: '1', email: 'ma@x.co', gdprConsent: true, billingAddress: { line1: '1', city: 'c', postcode: 'p' } })).body;
  const loc = (await call('POST', `/customers/${cust.id}/locations`, { label: 'Home', addressLine1: '1', city: 'c', postcode: 'p' })).body.serviceLocations[0].id;
  const ag = await call('POST', '/maintenance-agreements', { customerId: cust.id, locationId: loc, frequency: 'quarterly', nextDueDate: '2027-06-01' });
  expect(ag.status).toBe(201);
  expect(await raiseMaintenanceJobs('2027-01-01')).toBe(0); // not within the lead window
  const [r1, r2] = await Promise.all([raiseMaintenanceJobs('2027-05-25'), raiseMaintenanceJobs('2027-05-25')]);
  expect(r1 + r2).toBe(1);
  const jobs = (await call('GET', '/jobs?q=Scheduled quarterly')).body.data;
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ type: 'preventive_maintenance', appointmentDate: '2027-06-01', status: 'new' });
  expect((await call('GET', `/maintenance-agreements/${ag.body.id}`)).body.nextDueDate).toMatch(/^2027-09-01/);
});

test('sessions are httpOnly cookies: no tokens in bodies, CSRF header required, refresh from cookie, logout clears', async () => {
  const { hashPassword } = await import('../src/common/auth.js');
  await prisma.user.update({ where: { email: 'admin@dev.local' }, data: { password: hashPassword('Secret1$') } });
  const post = (path: string, body: object | undefined, headers: Record<string, string> = {}) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) });
  const csrf = { 'x-requested-with': 'apexhvac' };
  const cookies = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0]);

  expect((await post('/auth/login', { email: 'admin@dev.local', password: 'Secret1$' })).status).toBe(403); // no CSRF header
  const login = await post('/auth/login', { email: 'admin@dev.local', password: 'Secret1$' }, csrf);
  expect(login.status).toBe(200);
  expect(Object.keys(await login.json())).toEqual(['expiresIn']);
  const set = login.headers.getSetCookie();
  expect(set.find((c) => c.startsWith('hvac_at='))).toMatch(/HttpOnly/i);
  expect(set.find((c) => c.startsWith('hvac_rt='))).toMatch(/Path=\/api\/v1\/auth/);
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

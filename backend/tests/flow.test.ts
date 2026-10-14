import type { AddressInfo } from 'node:net';
import { beforeAll, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { seedDevUsers } from '../src/common/auth.js';
import { prisma } from '../src/common/prisma.js';

let base = '';
beforeAll(async () => {
  // tests wipe customers: never against a remote database
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')) throw new Error('Tests need the local docker Postgres, use `npm test`');
  await prisma.notification.deleteMany();
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
  const res = await call('POST', '/import', old);
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
  // numbering continues above imported numbers
  expect((await call('POST', '/requests', { customerId: cust.id, locationId: loc, reportedProblem: 'x' })).body.requestNumber).toBe('SR-6');
  expect((await call('POST', '/invoices', { customerId: cust.id, locationId: loc, items: [{ type: 'fee', description: 'f', quantity: 1, unitPrice: 100 }] }, 'accountant')).body).toMatchObject({ vatAmount: 5, invoiceNumber: expect.stringMatching(/^INV-\d{4}-0120$/) });
  const exported = (await call('GET', '/export')).body;
  expect(exported).toMatchObject({ customers: [{ id: cust.id }], jobs: [{ id: job.id }], equipment: [{ id: eq.id }], inventoryMovements: [{ partId: part.id }], quotations: [{ id: quote.id }], invoices: [{ id: expect.any(String) }, { id: inv0.id }] });
});

test('bad imports write nothing', async () => {
  const before = (await call('GET', '/jobs')).body.data;
  const dangling = await call('POST', '/import', { ...old, jobs: [{ ...old.jobs[0], customerId: 'nope' }] });
  expect(dangling.status).toBe(422);
  expect(dangling.body.code).toBe('DANGLING_REFERENCE');
  expect((await call('POST', '/import', { customers: [{ id: 'x', type: 'bogus', name: 'n' }], jobs: [] })).status).toBe(500);
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
  expect((await call('POST', '/import', { ...old, equipment: [oldJob] })).body.code).toBe('DANGLING_REFERENCE');
  const res = await call('POST', '/import?nullDangling=true', { ...old, equipment: [oldJob] });
  expect(res.body.nulledReferences).toEqual(['equipment eq-1 service record rec-1: job JOB-2024-0001']);
  const [eq] = (await call('GET', '/equipment')).body.data;
  expect(eq.serviceHistory).toHaveLength(1);
  expect(eq.serviceHistory[0].jobId).toBeUndefined();
  await call('POST', '/import', old); // restore for later tests
});

test('bad money/notification imports write nothing', async () => {
  const before = (await call('GET', '/invoices')).body.data;
  expect((await call('POST', '/import', { ...old, invoices: [{ ...old.invoices[0], quoteId: 'missing' }] })).body.code).toBe('DANGLING_REFERENCE');
  expect((await call('POST', '/import', { ...old, notifications: [{ ...old.notifications[0], customerId: 'missing' }] })).body.code).toBe('DANGLING_REFERENCE');
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
  expect(res.filter((r) => r.status === 201).length + res.filter((r) => r.body.code === 'ALREADY_CONVERTED').length).toBe(3);
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

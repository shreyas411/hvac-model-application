import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { isUuid } from '../../common/prisma.js';
import { hhmm, isoDate, money, priority } from '../../common/zod.js';
import { getSettings } from '../settings/service.js';
import { generateFromJob } from '../invoices/service.js';
import * as svc from './service.js';
import * as photos from './photos.js';

const jobType = z.enum(['installation', 'repair', 'inspection', 'emergency_callout', 'preventive_maintenance']);
const jobStatus = z.enum(['new', 'awaiting_approval', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled']);
const checklist = z.array(z.object({
  id: z.string().default(() => svc.newId()), label: z.string().min(1),
  category: z.enum(['gas_safety', 'electrical', 'refrigerant', 'general']), checked: z.boolean().default(false), notes: z.string().optional(),
}));
const signature = z.object({ name: z.string().min(1), dataUrl: z.string().max(1_000_000).regex(/^data:image\/(png|jpeg|svg\+xml)[;,]/), signedAt: z.string() });

const job = z.object({
  requestId: z.string().optional(),
  customerId: z.string().min(1), locationId: z.string().min(1), equipmentIds: z.array(z.string()).default([]),
  type: jobType, priority: priority.default('medium'),
  status: z.enum(['new', 'awaiting_approval', 'scheduled']).optional(),
  technicianId: z.string().nullable().default(null),
  appointmentDate: isoDate, startTime: hhmm, endTime: hhmm,
  estimatedDurationMinutes: z.number().int().positive().optional(),
  requiredSkills: z.array(z.string()).default([]), title: z.string().trim().min(1).max(200), description: z.string().min(1),
  internalNotes: z.string().optional(), workPerformed: z.string().optional(),
  labourHours: z.number().nonnegative().default(0), hourlyRate: money.optional(),
  travelTimeMinutes: z.number().int().nonnegative().default(0), travelCharge: money.default(0),
  customerSignature: signature.optional(), checklist: checklist.default([]),
  followUpRecommended: z.boolean().optional(), followUpNotes: z.string().optional(),
});
// Technicians may only touch the work record.
const techPatch = job.pick({ workPerformed: true, labourHours: true, customerSignature: true, checklist: true, followUpRecommended: true, followUpNotes: true }).partial().strict();
const dispatchPatch = job.omit({ status: true, requestId: true }).partial();

const mins = (j: { startTime: string; endTime: string }) => {
  const [a, b] = [j.startTime, j.endTime].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
  return Math.max(0, b - a);
};

export const jobsRouter = Router();
const staff = allow('admin', 'dispatcher');
const field = allow('admin', 'dispatcher', 'technician');

// Technicians only ever see their own jobs.
// Office roles may narrow to one technician with ?technicianId=; a technician's own scope can never be overridden.
jobsRouter.get('/', field, h(async (req) => {
  const tech = typeof req.query.technicianId === 'string' && isUuid(req.query.technicianId) ? req.query.technicianId : undefined;
  return svc.pageJobs(req.query, req.user.role === 'technician' ? { technicianId: req.user.technicianId } : tech ? { technicianId: tech } : undefined);
}));

jobsRouter.get('/conflicts', staff, h(async (req) => {
  const q = z.object({ technicianId: z.string(), date: isoDate, startTime: hhmm, endTime: hhmm, excludeJobId: z.string().optional() }).parse(req.query);
  return { conflict: await svc.findConflict(q.technicianId, q.date, q.startTime, q.endTime, q.excludeJobId) };
}));

jobsRouter.get('/:id', field, h(async (req) => {
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') svc.assertOwnJob(j, req.user);
  return j;
}));

jobsRouter.post('/', staff, h(async (req) => {
  const d = job.parse(req.body);
  return svc.createJob({ ...d, hourlyRate: d.hourlyRate ?? (await getSettings()).defaultHourlyRate, estimatedDurationMinutes: d.estimatedDurationMinutes ?? mins(d) }, actor(req));
}, 201));

jobsRouter.patch('/:id', field, h(async (req) => {
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') {
    svc.assertOwnJob(j, req.user);
    return svc.updateJob(j.id, techPatch.parse(req.body) as any, actor(req), 'Work record updated');
  }
  return svc.updateJob(j.id, dispatchPatch.parse(req.body) as any, actor(req));
}));

jobsRouter.post('/:id/status', field, h(async (req) => {
  const b = z.object({ status: jobStatus, note: z.string().optional(), override: z.boolean().default(false) }).parse(req.body);
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') { svc.assertOwnJob(j, req.user); svc.assertTechStatus(b.status); }
  return svc.changeStatus(j.id, b.status, actor(req), b);
}));

jobsRouter.post('/:id/parts', field, h(async (req) => {
  const b = z.object({ partId: z.string().min(1), quantity: z.number().int().positive() }).parse(req.body);
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') svc.assertOwnJob(j, req.user);
  return svc.addPartUsed(j.id, b.partId, b.quantity, actor(req));
}));

jobsRouter.post('/:id/refrigerant', field, h(async (req) => {
  const b = z.object({
    refrigerant: z.string().trim().min(1), action: z.enum(['charge', 'recover', 'reclaim', 'leak_check']), amountKg: z.number().nonnegative().max(10_000),
    cylinderId: z.string().default(''), certNumber: z.string().trim().min(1), equipmentId: z.string().uuid().optional(), notes: z.string().optional(),
  }).parse(req.body);
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') svc.assertOwnJob(j, req.user);
  return svc.addRefrigerantLog(j.id, b, actor(req));
}, 201));

jobsRouter.delete('/:id/parts/:usedId', field, h(async (req) => {
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') svc.assertOwnJob(j, req.user);
  return svc.removePartUsed(j.id, req.params.usedId, actor(req));
}));

// Photos: JSON upload ({ dataUrl, caption }); bytes come back from GET /:photoId with the right content type.
const ownJob = async (req: import('express').Request) => {
  const j = await svc.getJob(req.params.id);
  if (req.user.role === 'technician') svc.assertOwnJob(j, req.user);
  return j;
};
jobsRouter.get('/:id/photos', field, h(async (req) => photos.listPhotos((await ownJob(req)).id)));
jobsRouter.post('/:id/photos', field, h(async (req) => {
  const b = z.object({ dataUrl: z.string().max(850_000).regex(/^data:image\/webp;base64,/), caption: z.string().trim().max(200).default('') }).parse(req.body);
  return photos.addPhoto((await ownJob(req)).id, b.dataUrl, b.caption, actor(req));
}, 201));
jobsRouter.get('/:id/photos/:photoId', field, async (req, res, next) => {
  try {
    const p = await photos.getPhoto((await ownJob(req)).id, req.params.photoId);
    res.type(p.mime).send(Buffer.from(p.data));
  } catch (e) { next(e); }
});
jobsRouter.delete('/:id/photos/:photoId', field, h(async (req) => photos.removePhoto((await ownJob(req)).id, req.params.photoId)));

jobsRouter.post('/:id/invoice', allow('admin', 'accountant'), h(async (req) => generateFromJob(req.params.id, actor(req)), 201));

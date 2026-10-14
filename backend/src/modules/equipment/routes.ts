import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { crud } from '../../common/crud.js';
import { h } from '../../common/errors.js';
import { db } from '../../common/store.js';
import { isoDate } from '../../common/zod.js';
import * as svc from './service.js';

const equipment = z.object({
  customerId: z.string().min(1), locationId: z.string().min(1),
  type: z.enum(['combi_boiler', 'system_boiler', 'heat_pump', 'air_conditioning', 'ventilation', 'chiller']),
  brand: z.string().min(1), model: z.string().min(1), serialNumber: z.string().min(1),
  installationDate: isoDate, warrantyExpiryDate: isoDate,
  maintenanceFrequency: z.enum(['quarterly', 'biannual', 'annual']),
  lastServiceDate: isoDate.optional(), nextServiceDueDate: isoDate.optional(),
  status: z.enum(['operational', 'requires_attention', 'decommissioned']).default('operational'),
  locationNotes: z.string().optional(),
});
const record = z.object({
  date: isoDate, jobId: z.string().min(1), technicianName: z.string().min(1), serviceType: z.string().min(1),
  findings: z.string(),
  readings: z.object({
    flowTempC: z.number(), returnTempC: z.number(), pressureBar: z.number(), coPpm: z.number(),
    co2Percent: z.number(), refrigerantPsi: z.number(), deltaTC: z.number(),
  }).partial().optional(),
  partsReplaced: z.array(z.string()).default([]), recommendations: z.string().optional(),
});

export const equipmentRouter = Router();
equipmentRouter.post('/', allow('admin', 'dispatcher'), h((req) => svc.createEquipment(equipment.parse(req.body) as any), 201));
equipmentRouter.patch('/:id', allow('admin', 'dispatcher'), h((req) => svc.updateEquipment(req.params.id, equipment.partial().parse(req.body))));
equipmentRouter.post('/:id/service-records', allow('admin', 'dispatcher', 'technician'), h((req) => svc.addServiceRecord(req.params.id, record.parse(req.body)), 201));
equipmentRouter.use(crud({
  repo: db.equipment, label: 'Equipment', read: ['admin', 'dispatcher', 'technician'], write: ['admin', 'dispatcher'],
  create: equipment, update: equipment.partial(), del: true,
}));

import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { paginate } from '../../common/paginate.js';
import * as svc from './service.js';

const notification = z.object({
  customerId: z.string().min(1),
  type: z.enum(['booking_confirmation', 'appointment_reminder', 'technician_arriving', 'quotation_ready', 'invoice_issued']),
  channel: z.enum(['email', 'sms']), recipient: z.string().optional(),
  subject: z.string().min(1), messageBody: z.string().min(1),
  status: z.enum(['draft', 'ready_to_send']).optional(),
});

export const notificationsRouter = Router();
notificationsRouter.use(allow('admin', 'dispatcher'));
notificationsRouter.get('/', h(async (req) => paginate(await svc.listNotifications(), req.query)));
notificationsRouter.post('/', h((req) => svc.createNotification(notification.parse(req.body)), 201));
notificationsRouter.post('/:id/approve-send', h((req) => svc.approveAndSend(req.params.id, actor(req))));

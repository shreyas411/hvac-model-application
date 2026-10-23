import { Router } from 'express';
import { z } from 'zod';
import { actor, allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { prisma, removeRecord } from '../../common/prisma.js';
import { bulk, bulkIds } from '../../common/bulk.js';
import * as svc from './service.js';
import { generateCertificatePdf } from './pdf.service.js';

export const certificatesRouter = Router();
// Technicians issue certificates for their own jobs; office staff can issue for any.
certificatesRouter.use(allow('admin', 'dispatcher', 'technician'));
certificatesRouter.get('/', h((req) => svc.pageCertificates(req.query)));
certificatesRouter.get('/expiring', h((req) => svc.expiringCertificates(z.coerce.number().int().positive().max(365).default(60).parse(req.query.days))));
certificatesRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const c = await svc.getCertificate(req.params.id);
    res.type('application/pdf').attachment(`${c.certNumber}.pdf`).send(Buffer.from(await generateCertificatePdf(c.id)));
  } catch (e) { next(e); }
});
certificatesRouter.get('/:id', h((req) => svc.getCertificate(req.params.id)));
certificatesRouter.delete('/:id', allow('admin'), h((req) => removeRecord(prisma.certificate, req.params.id, 'Certificate')));
certificatesRouter.post('/bulk-delete', allow('admin'), h((req) => bulk(z.object({ ids: bulkIds }).parse(req.body).ids, (id) => removeRecord(prisma.certificate, id, 'Certificate'))));
certificatesRouter.post('/', h((req) => svc.issueCertificate(svc.certificateInput.parse(req.body), { ...actor(req), technicianId: req.user.technicianId }), 201));

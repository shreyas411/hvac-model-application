import { isPast } from '../../common/dates.js';
import { z } from 'zod';
import { audit } from '../../common/audit.js';
import type { Actor } from '../../common/auth.js';
import { notFound, unprocessable } from '../../common/errors.js';
import { pageFrom } from '../../common/paginate.js';
import { nextNumber } from '../../common/numbering.js';
import { isUuid, plain, prisma } from '../../common/prisma.js';
import { isoDate } from '../../common/zod.js';
import { assertLocation } from '../customers/service.js';
import { assertOwnJob, getJob } from '../jobs/service.js';

const check = z.enum(['pass', 'fail', 'na']);
const appliance = z.object({
  description: z.string().trim().min(1), location: z.string().default(''), make: z.string().default(''), model: z.string().default(''),
  flueOperation: check, ventilation: check, safetyDevice: check, gasTightness: check, safeToUse: z.boolean(),
});

// Per-type payload. CP12 = landlord gas safety record, service_record = annual service, commissioning = Benchmark-style.
export const certificateData = {
  cp12: z.object({ appliances: z.array(appliance).min(1), defects: z.string().default(''), warningNoticeIssued: z.boolean().default(false) }),
  service_record: z.object({ workCarried: z.string().trim().min(1), checks: z.array(z.object({ item: z.string().trim().min(1), ok: z.boolean() })).default([]), notes: z.string().default('') }),
  commissioning: z.object({
    applianceMake: z.string().trim().min(1), applianceModel: z.string().default(''), serialNumber: z.string().default(''),
    inletPressureMbar: z.number().nonnegative(), burnerPressureMbar: z.number().nonnegative(),
    coPpm: z.number().nonnegative(), co2Percent: z.number().nonnegative(), flueTestPassed: z.boolean(), notes: z.string().default(''),
  }),
};
export const certificateInput = z.object({
  type: z.enum(['cp12', 'service_record', 'commissioning']), jobId: z.string().uuid().optional(),
  customerId: z.string().uuid(), locationId: z.string().uuid(), technicianId: z.string().uuid().optional(),
  issueDate: isoDate.optional(), data: z.unknown(),
});
export type CertificateInput = z.infer<typeof certificateInput>;

const out = (r: any) => ({ ...plain(r, [], ['issueDate', 'expiryDate']), expired: isPast(r.expiryDate) }) as any;
const addYear = (d: string) => { const x = new Date(d); x.setUTCFullYear(x.getUTCFullYear() + 1); return x; };

export async function getCertificate(id: string) {
  const row = isUuid(id) ? await prisma.certificate.findUnique({ where: { id } }) : null;
  if (!row) throw notFound('Certificate');
  return out(row);
}

/** Newest first; `?customerId&jobId&type` filter, `?q` searches the number, engineer and Gas Safe number. */
export const pageCertificates = (query: unknown) =>
  pageFrom(query, prisma.certificate, { searchFields: ['certNumber', 'engineerName', 'gasSafeNumber'], sorts: ['type', 'issueDate', 'expiryDate'], filters: ['customerId', 'jobId', 'type'] }, out);

/** Certificates still valid but expiring within `days` (CP12 renewals). Latest per location only. */
export async function expiringCertificates(days = 60) {
  const horizon = new Date(Date.now() + days * 864e5);
  const rows = await prisma.certificate.findMany({ where: { type: 'cp12', expiryDate: { not: null } }, orderBy: { issueDate: 'desc' } });
  const latest = new Map(rows.map((r) => [r.locationId, r] as const).reverse());
  return [...latest.values()].filter((r) => r.expiryDate! <= horizon).sort((a, b) => +a.expiryDate! - +b.expiryDate!).map(out);
}

/** Issue a certificate. The engineer must hold an unexpired Gas Safe registration; their details are copied onto the record. */
export async function issueCertificate(input: CertificateInput, who: Actor & { technicianId?: string | null }) {
  const data = certificateData[input.type].parse(input.data);
  await assertLocation(input.customerId, input.locationId);
  const technicianId = who.role === 'technician' ? who.technicianId : input.technicianId;
  if (!technicianId) throw unprocessable('TECHNICIAN_REQUIRED', 'Choose the engineer issuing this certificate');
  if (input.jobId) {
    const job = await getJob(input.jobId);
    if (job.customerId !== input.customerId || job.locationId !== input.locationId) throw unprocessable('JOB_MISMATCH', 'Job belongs to a different customer or site');
    if (who.role === 'technician') assertOwnJob(job, who);
  }
  const tech = isUuid(technicianId) ? await prisma.technician.findUnique({ where: { id: technicianId } }) : null;
  if (!tech) throw notFound('Technician');
  const issueDate = input.issueDate ?? new Date().toISOString().slice(0, 10);
  if (!tech.gasSafeLicense) throw unprocessable('NO_GAS_SAFE', `${tech.name} has no Gas Safe registration number on file`);
  if (tech.gasSafeExpiry && tech.gasSafeExpiry < new Date(issueDate)) throw unprocessable('GAS_SAFE_EXPIRED', `${tech.name}'s Gas Safe registration expired on ${tech.gasSafeExpiry.toISOString().slice(0, 10)}`);
  return out(await prisma.$transaction(async (tx) => {
    const row = await tx.certificate.create({ data: {
      certNumber: await nextNumber('certificate', new Date(issueDate), tx), type: input.type, jobId: input.jobId, customerId: input.customerId, locationId: input.locationId,
      technicianId, engineerName: tech.name, gasSafeNumber: tech.gasSafeLicense!, issueDate: new Date(issueDate), expiryDate: input.type === 'cp12' ? addYear(issueDate) : null, data,
    } });
    await audit(tx, 'certificate', row.id, who, 'issued', `${row.certNumber} (${row.type})`);
    return row;
  }));
}

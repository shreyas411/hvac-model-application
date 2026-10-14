import type { TechnicianProfile } from '../../types.js';
import { notFound } from '../../common/errors.js';
import { prisma, prismaRepo } from '../../common/prisma.js';

export const techniciansRepo = prismaRepo<TechnicianProfile>(prisma.technician, ['legacyId', 'createdAt', 'updatedAt']);

export async function getTechnician(id: string) {
  const t = await techniciansRepo.find(id);
  if (!t) throw notFound('Technician');
  return t;
}

/** Import ops (see importPartOps). Users linked to a technician keep the link when its old id is in the payload. */
export async function importTechnicianOps(rows: any[], ids: Map<string, string>) {
  const linked = (await prisma.user.findMany({ where: { technicianId: { not: null } }, select: { id: true, technician: { select: { legacyId: true } } } }))
    .filter((u) => u.technician?.legacyId && rows.some((r) => r.id === u.technician!.legacyId));
  const creates = rows.map((t) => {
    const id = crypto.randomUUID();
    ids.set(t.id, id);
    return prisma.technician.create({ data: {
      id, legacyId: t.id, name: t.name, phone: t.phone ?? '', email: t.email ?? '', gasSafeLicense: t.gasSafeLicense, fGasLicense: t.fGasLicense,
      skills: t.skills ?? [], color: t.color ?? '#0ea5e9', active: t.active ?? true, vanRegistration: t.vanRegistration,
    } });
  });
  return {
    wipe: prisma.technician.deleteMany(),
    create: [...creates, ...linked.map((u) => prisma.user.update({ where: { id: u.id }, data: { technicianId: ids.get(u.technician!.legacyId!) } }))],
  };
}

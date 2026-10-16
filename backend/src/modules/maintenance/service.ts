import { addDays, addMonths, today } from '../../common/dates.js';
import { prisma } from '../../common/prisma.js';
import { getSettings } from '../settings/service.js';
import { createJob } from '../jobs/service.js';

const MONTHS = { quarterly: 3, biannual: 6, annual: 12 } as const;
const LEAD_DAYS = 14; // raise the job this long before it's due, so it can be scheduled
const SYSTEM = { id: 'system', name: 'Maintenance scheduler', role: 'admin' as const };

/**
 * Daily sweep: each active agreement due within LEAD_DAYS gets one unassigned preventive_maintenance job and moves to its next due date.
 * The date move is a conditional UPDATE inside the same transaction, so two replicas can't both raise the job.
 */
export async function raiseMaintenanceJobs(now = today()) {
  const due = await prisma.maintenanceAgreement.findMany({ where: { active: true, nextDueDate: { lte: new Date(addDays(now, LEAD_DAYS)) } } });
  let raised = 0;
  for (const a of due) {
    await prisma.$transaction(async (tx) => {
      const next = addMonths(a.nextDueDate.toISOString().slice(0, 10), MONTHS[a.frequency as keyof typeof MONTHS]);
      const claim = await tx.maintenanceAgreement.updateMany({ where: { id: a.id, nextDueDate: a.nextDueDate }, data: { nextDueDate: new Date(next) } });
      if (!claim.count) return;
      const rates = await getSettings();
      const checklist = (await tx.checklistTemplate.findMany({ where: { jobType: 'preventive_maintenance' }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }))
        .map((t, i) => ({ id: `chk-${i + 1}`, label: t.label, category: t.category as 'gas_safety' | 'electrical' | 'refrigerant' | 'general', checked: false }));
      await createJob({
        customerId: a.customerId, locationId: a.locationId, equipmentIds: a.equipmentId ? [a.equipmentId] : [], type: 'preventive_maintenance', priority: 'medium',
        technicianId: null, appointmentDate: a.nextDueDate.toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00', estimatedDurationMinutes: 60,
        requiredSkills: [], description: `Scheduled ${a.frequency} maintenance${a.notes ? `: ${a.notes}` : ''}`, labourHours: 0, hourlyRate: rates.defaultHourlyRate,
        travelTimeMinutes: 0, travelCharge: 0, checklist, auditAction: 'Created by maintenance agreement', auditDetails: `Agreement ${a.id}`,
      }, SYSTEM, tx);
      raised++;
    });
  }
  return raised;
}

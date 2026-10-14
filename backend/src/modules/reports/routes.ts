import { Router } from 'express';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { round2 } from '../../common/money.js';
import { addDays, today } from '../../common/dates.js';
import { prisma } from '../../common/prisma.js';
import { isLowStock, partsRepo } from '../inventory/service.js';
import { techniciansRepo } from '../technicians/service.js';

const sum = (n: number[]) => round2(n.reduce((a, b) => a + b, 0));
const n = (d: { toNumber(): number } | null) => round2(d?.toNumber() ?? 0);

export async function financial() {
  const [inv, quotes, accepted] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: { not: 'void' } }, _sum: { total: true, amountPaid: true } }),
    prisma.quotation.aggregate({ _sum: { total: true } }),
    prisma.quotation.aggregate({ where: { status: 'accepted' }, _sum: { total: true } }),
  ]);
  const invoiced = n(inv._sum.total), collected = n(inv._sum.amountPaid);
  return {
    invoicedRevenue: invoiced, recordedPayments: collected, outstandingBalance: round2(invoiced - collected),
    estimatedPipeline: n(quotes._sum.total), acceptedQuotesValue: n(accepted._sum.total),
    completedJobs: await prisma.job.count({ where: { status: 'completed' } }),
    openJobs: await prisma.job.count({ where: { status: { notIn: ['completed', 'cancelled'] } } }),
  };
}

export async function technicianUtilisation() {
  const all = await prisma.job.findMany({ where: { technicianId: { not: null } }, select: { technicianId: true, status: true, labourHours: true, hourlyRate: true } });
  return (await techniciansRepo.all()).map((tech) => {
    const jobs = all.filter((j) => j.technicianId === tech.id).map((j) => ({ status: j.status, labourHours: j.labourHours.toNumber(), hourlyRate: j.hourlyRate.toNumber() }));
    return {
      technicianId: tech.id, name: tech.name, totalJobs: jobs.length,
      completedJobs: jobs.filter((j) => j.status === 'completed').length,
      totalHours: sum(jobs.map((j) => j.labourHours)), billableLabour: sum(jobs.map((j) => j.labourHours * j.hourlyRate)),
    };
  });
}

export async function dashboard(now = today()) {
  const day = new Date(now);
  const [total, todayCount, inProgress, completed, cancelled, overdue, newRequests, maintenanceDue, outstandingQuotes, unpaidInvoices, collected, outstanding] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { appointmentDate: day } }),
    prisma.job.count({ where: { status: 'in_progress' } }),
    prisma.job.count({ where: { status: 'completed' } }),
    prisma.job.count({ where: { status: 'cancelled' } }),
    prisma.job.count({ where: { appointmentDate: { lt: day }, status: { notIn: ['completed', 'cancelled'] } } }),
    prisma.serviceRequest.count({ where: { status: 'new' } }),
    prisma.equipment.count({ where: { status: { not: 'decommissioned' }, nextServiceDueDate: { lte: new Date(addDays(now, 5)) } } }),
    prisma.quotation.count({ where: { status: { in: ['sent', 'draft'] } } }),
    prisma.invoice.count({ where: { status: { in: ['issued', 'overdue', 'partially_paid'] } } }),
    prisma.invoice.aggregate({ _sum: { amountPaid: true } }),
    prisma.invoice.aggregate({ where: { status: { not: 'void' } }, _sum: { balanceDue: true } }),
  ]);
  return {
    jobs: { total, today: todayCount, inProgress, completed, cancelled, overdue },
    newRequests,
    outstandingQuotes, unpaidInvoices, collectedRevenue: n(collected._sum.amountPaid), outstandingRevenue: n(outstanding._sum.balanceDue),
    maintenanceDue,
  };
}

export const reportsRouter = Router();
const fin = allow('admin', 'accountant');
reportsRouter.get('/reports/financial', fin, h(financial));
reportsRouter.get('/reports/technicians', fin, h(technicianUtilisation));
reportsRouter.get('/reports/low-stock', fin, h(async () => (await partsRepo.all()).filter(isLowStock)));
reportsRouter.get('/dashboard', allow('admin', 'dispatcher', 'accountant'), h(() => dashboard()));

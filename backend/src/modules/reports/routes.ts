import { Router } from 'express';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { round2 } from '../../common/money.js';
import { addDays, today } from '../../common/dates.js';
import { db } from '../../common/store.js';
import { isLowStock } from '../inventory/service.js';

const sum = (n: number[]) => round2(n.reduce((a, b) => a + b, 0));

export function financial() {
  const inv = db.invoices.all().filter((i) => i.status !== 'void');
  const q = db.quotations.all();
  const invoiced = sum(inv.map((i) => i.total)), collected = sum(inv.map((i) => i.amountPaid));
  return {
    invoicedRevenue: invoiced, recordedPayments: collected, outstandingBalance: round2(invoiced - collected),
    estimatedPipeline: sum(q.map((x) => x.total)),
    acceptedQuotesValue: sum(q.filter((x) => x.status === 'accepted').map((x) => x.total)),
    completedJobs: db.jobs.all().filter((j) => j.status === 'completed').length,
    openJobs: db.jobs.all().filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length,
  };
}

export function technicianUtilisation() {
  return db.technicians.all().map((tech) => {
    const jobs = db.jobs.all().filter((j) => j.technicianId === tech.id);
    return {
      technicianId: tech.id, name: tech.name, totalJobs: jobs.length,
      completedJobs: jobs.filter((j) => j.status === 'completed').length,
      totalHours: sum(jobs.map((j) => j.labourHours)), billableLabour: sum(jobs.map((j) => j.labourHours * j.hourlyRate)),
    };
  });
}

export function dashboard(now = today()) {
  const jobs = db.jobs.all();
  const open = (s: string) => s !== 'completed' && s !== 'cancelled';
  const invoices = db.invoices.all();
  return {
    jobs: {
      total: jobs.length, today: jobs.filter((j) => j.appointmentDate === now).length,
      inProgress: jobs.filter((j) => j.status === 'in_progress').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      cancelled: jobs.filter((j) => j.status === 'cancelled').length,
      overdue: jobs.filter((j) => j.appointmentDate < now && open(j.status)).length,
    },
    newRequests: db.requests.all().filter((r) => r.status === 'new').length,
    outstandingQuotes: db.quotations.all().filter((q) => q.status === 'sent' || q.status === 'draft').length,
    unpaidInvoices: invoices.filter((i) => ['issued', 'overdue', 'partially_paid'].includes(i.status)).length,
    collectedRevenue: sum(invoices.map((i) => i.amountPaid)),
    outstandingRevenue: sum(invoices.filter((i) => i.status !== 'void').map((i) => i.balanceDue)),
    maintenanceDue: db.equipment.all().filter((e) => e.status !== 'decommissioned' && e.nextServiceDueDate <= addDays(now, 5)).length,
  };
}

export const reportsRouter = Router();
const fin = allow('admin', 'accountant');
reportsRouter.get('/reports/financial', fin, h(financial));
reportsRouter.get('/reports/technicians', fin, h(technicianUtilisation));
reportsRouter.get('/reports/low-stock', fin, h(() => db.parts.all().filter(isLowStock)));
reportsRouter.get('/dashboard', allow('admin', 'dispatcher', 'accountant'), h(() => dashboard()));

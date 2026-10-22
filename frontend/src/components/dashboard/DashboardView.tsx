import React, { useState, useMemo, useEffect } from 'react';
import { services } from '../../services';
import type { Certificate } from '../../services';
import { EmptyState } from '../common/EmptyState';
import { canRead } from '../../store/useDataStore';
import { quickCreateRoles } from '../../routes';
import { useApp } from '../../context/AppContext';
import { addDaysISO, formatDateUK, formatGBP, getTodayISO } from '../../utils/formatters';
import { IconAlertCircle, IconArrowRight, IconCalendarPlus, IconCircleCheck, IconFileText, IconFilter, IconFlame, IconReceipt, IconTool } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';
import { DateRangePicker } from '../common/DatePicker';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenQuickAction: (action: 'customer' | 'job' | 'request' | 'quote' | 'invoice') => void;
  onOpenWorkflowGuide: () => void;
  onSelectJob?: (jobId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenQuickAction,
  onOpenWorkflowGuide,
  onSelectJob,
}) => {
  const { 
    jobs, 
    serviceRequests, 
    quotations, 
    invoices, 
    technicians, 
    customers, 
    equipment,
    currentUser,
    switchUserRole,
    realAuth,
    settings,
    customerById,
  } = useApp(['jobs', 'serviceRequests', 'quotations', 'invoices', 'technicians', 'customers', 'equipment', 'currentUser', 'switchUserRole', 'realAuth', 'settings', 'customerById']);

  // Filters
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterTechnicianId, setFilterTechnicianId] = useState<string>('all');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('all');

  // Compliance: latest CP12 per site expiring in 60 days (server) plus engineers' Gas Safe / F-Gas dates.
  const todayISO = getTodayISO();
  const [cp12Due, setCp12Due] = useState<Certificate[]>([]);
  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'dispatcher') return; // the API refuses accountants
    services.certificates.expiring(60).then(setCp12Due).catch(() => setCp12Due([]));
  }, [currentUser?.role]);
  const missingProfile = settings ? ([['VAT number', settings.vatNumber], ['address', settings.addressLine1], ['postcode', settings.postcode], ['bank details', settings.bankDetails?.sortCode && settings.bankDetails?.accountNumber]] as const).filter(([, v]) => !v).map(([k]) => k) : [];
  const complianceDue = useMemo(() => {
    const limit = addDaysISO(todayISO, 60);
    const rows = cp12Due.filter((c) => c.expiryDate).map((c) => ({ key: c.id, date: c.expiryDate!.slice(0, 10), label: `CP12 ${c.certNumber} · ${customerById.get(c.customerId)?.name ?? 'Customer'}` }));
    for (const t of technicians) {
      if (t.active === false) continue;
      for (const [no, exp, name] of [[t.gasSafeLicense, t.gasSafeExpiry, 'Gas Safe'], [t.fGasLicense, t.fGasExpiry, 'F-Gas']] as const) {
        if (no && exp && exp.slice(0, 10) <= limit) rows.push({ key: `${t.id}-${name}`, date: exp.slice(0, 10), label: `${name} · ${t.name}` });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [cp12Due, technicians, customerById, todayISO]);

  // Today / this week (Mon-Sun) / next 7 days, all in local time
  const today = getTodayISO();
  const weekStart = addDaysISO(today, -((new Date(`${today}T00:00`).getDay() + 6) % 7));
  const weekEnd = addDaysISO(weekStart, 6);
  const soon = addDaysISO(today, 7);
  const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Filtered jobs calculation
  const filteredJobs = useMemo(() => {
    const todayStr = today;
    return jobs.filter((job) => {
      if (filterTechnicianId !== 'all' && job.technicianId !== filterTechnicianId) return false;
      if (job.status !== 'scheduled') return false;
      if (filterCustomerId !== 'all' && job.customerId !== filterCustomerId) return false;

      if (filterDateRange === 'today') {
        if (job.appointmentDate !== todayStr) return false;
      } else if (filterDateRange === 'this_week') {
        // approx week range
        if (job.appointmentDate < weekStart || job.appointmentDate > weekEnd) return false;
      } else if (filterDateRange === 'this_month') {
        if (!job.appointmentDate.startsWith(todayStr.slice(0, 7))) return false;
      } else if (filterDateRange === 'custom') {
        if ((customFrom && job.appointmentDate < customFrom) || (customTo && job.appointmentDate > customTo)) return false;
      }
      return true;
    }).sort((a, b) => `${a.appointmentDate} ${a.startTime}`.localeCompare(`${b.appointmentDate} ${b.startTime}`));
  }, [jobs, today, weekStart, weekEnd, filterDateRange, customFrom, customTo, filterTechnicianId, filterCustomerId]);

  // Overall KPI counts
  const {
    totalJobsCount, jobsTodayCount, inProgressCount, completedJobsCount, cancelledJobsCount, newRequestsCount, overdueJobs,
    outstandingQuotes, unpaidInvoices, totalCollectedRevenue, totalOutstandingRevenue, maintenanceDueEquipments,
  } = useMemo(() => ({
    totalJobsCount: jobs.length,
    jobsTodayCount: jobs.filter((j) => j.appointmentDate === today).length,
    inProgressCount: jobs.filter((j) => j.status === 'in_progress').length,
    completedJobsCount: jobs.filter((j) => j.status === 'completed').length,
    cancelledJobsCount: jobs.filter((j) => j.status === 'cancelled').length,
    newRequestsCount: serviceRequests.filter((r) => r.status === 'new').length,
    overdueJobs: jobs.filter((j) => j.appointmentDate < today && j.status !== 'completed' && j.status !== 'cancelled'),
    outstandingQuotes: quotations.filter((q) => q.status === 'sent' || q.status === 'draft'),
    unpaidInvoices: invoices.filter((i) => i.status === 'issued' || i.status === 'overdue' || i.status === 'partially_paid'),
    totalCollectedRevenue: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
    totalOutstandingRevenue: invoices.filter((inv) => ['issued', 'overdue', 'partially_paid'].includes(inv.status)).reduce((sum, inv) => sum + inv.balanceDue, 0),
    maintenanceDueEquipments: equipment.filter((eq) => eq.nextServiceDueDate <= soon),
  }), [jobs, serviceRequests, quotations, invoices, equipment, today, soon]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Top Banner / Welcome with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Operations & Dispatch Overview
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>{settings.companyName}</span>
            <span aria-hidden="true">·</span>
            <span>{settings.city}</span>
            <span aria-hidden="true">·</span>
            <span>{new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}</span>
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div className="flex items-center gap-2 flex-wrap">
          {quickCreateRoles.request.includes(currentUser.role) && (
            <button
              onClick={() => onOpenQuickAction('request')}
              className="px-3 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted border border-border rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <IconAlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              <span>Service Request</span>
            </button>
          )}
          {quickCreateRoles.job.includes(currentUser.role) && (
            <button
              onClick={() => onOpenQuickAction('job')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <IconCalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Book Job</span>
            </button>
          )}
          {quickCreateRoles.quote.includes(currentUser.role) && (
            <button
              onClick={() => onOpenQuickAction('quote')}
              className="px-3 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted border border-border rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <IconFileText className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>New Quote</span>
            </button>
          )}
          {quickCreateRoles.invoice.includes(currentUser.role) && (
            <button
              onClick={() => onOpenQuickAction('invoice')}
              className="px-3 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted border border-border rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <IconReceipt className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
              <span>New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {currentUser?.role === 'admin' && missingProfile.length > 0 && (
        <div role="region" aria-label="Company profile incomplete" className="p-3.5 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between gap-3">
          <span className="text-xs text-sky-900">
            <strong>Finish your company profile.</strong> Missing: {missingProfile.join(', ')}. Invoices and quotes print these, and a VAT invoice must show your VAT number if you charge VAT.
          </span>
          <Button variant="link" size="xs" onClick={() => onNavigateTab('settings')}>Open Settings</Button>
        </div>
      )}

      {complianceDue.length > 0 && (
        <div role="region" aria-label="Compliance due" className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><IconAlertCircle className="w-4 h-4" aria-hidden="true" />Compliance due within 60 days</span>
            <Button variant="link" size="xs" onClick={() => onNavigateTab('certificates')}>Gas Certificates</Button>
          </div>
          <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-amber-900">
            {complianceDue.map((d) => (
              <li key={d.key} className="flex justify-between gap-2"><span className="truncate">{d.label}</span><span className={`tabular-nums tabular-nums shrink-0 ${d.date < todayISO ? 'text-rose-700 font-semibold' : ''}`}>{d.date < todayISO ? 'Expired ' : ''}{formatDateUK(d.date)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Numerical Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {canRead(currentUser?.role, 'jobs') && (
          <div className="p-3.5 bg-card border border-border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground block">Today's Jobs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tabular-nums tabular-nums text-foreground">{jobsTodayCount}</span>
              <span className="text-[11px] text-muted-foreground font-medium">scheduled</span>
            </div>
            <span className="text-[11px] text-sky-700 mt-1 block font-medium">
              {inProgressCount} active on site
            </span>
          </div>
        )}

        {canRead(currentUser?.role, 'requests') && (
          <div className="p-3.5 bg-card border border-border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground block">Awaiting Dispatch</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tabular-nums tabular-nums text-amber-600">{newRequestsCount}</span>
              <span className="text-[11px] text-muted-foreground font-medium">enquiries</span>
            </div>
            <Button variant="link" size="xs" onClick={() => onNavigateTab('requests')}>
              Triage requests →
            </Button>
          </div>
        )}

        {canRead(currentUser?.role, 'jobs') && (
          <div className="p-3.5 bg-card border border-border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground block">Completed Jobs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tabular-nums tabular-nums text-emerald-600">{completedJobsCount}</span>
              <span className="text-[11px] text-muted-foreground font-medium">signed off</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block font-medium">
              {cancelledJobsCount} cancelled
            </span>
          </div>
        )}

        {canRead(currentUser?.role, 'quotations') && (
          <div className="p-3.5 bg-card border border-border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground block">Open Quotations</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tabular-nums tabular-nums text-foreground">{outstandingQuotes.length}</span>
              <span className="text-[11px] text-muted-foreground font-medium">pending</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block tabular-nums tabular-nums">
              {formatGBP(outstandingQuotes.reduce((acc, q) => acc + q.total, 0))} est.
            </span>
          </div>
        )}

        {canRead(currentUser?.role, 'invoices') && (
          <div className="p-3.5 bg-card border border-border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground block">Unpaid Invoices</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tabular-nums tabular-nums text-rose-600">{unpaidInvoices.length}</span>
              <span className="text-[11px] text-muted-foreground font-medium">awaiting pay</span>
            </div>
            <span className="text-[11px] text-rose-700 mt-1 block tabular-nums tabular-nums font-semibold">
              {formatGBP(totalOutstandingRevenue)}
            </span>
          </div>
        )}

        {canRead(currentUser?.role, 'invoices') && (
          <div className="p-3.5 bg-card border border-border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground block">Revenue Collected</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-semibold tabular-nums tabular-nums text-foreground">
                {formatGBP(totalCollectedRevenue)}
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
              Payments confirmed
            </span>
          </div>
        )}
      </div>

      {canRead(currentUser?.role, 'jobs') ? (
      <>
        {/* IconFilter Toolbar */}
        <div className="bg-card p-3 border border-border rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground shrink-0">
            <IconFilter className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-semibold text-foreground">Filter View:</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            {/* Date range filter */}
            <Select value={filterDateRange} onValueChange={(v) => setFilterDateRange(v as any)}>
              <SelectTrigger aria-label="Date range" size="sm" className="text-xs w-full sm:w-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today Only</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">{monthLabel}</SelectItem>
              <SelectItem value="custom">Custom range…</SelectItem>
            </SelectContent>
            </Select>
            {filterDateRange === 'custom' && (
              <DateRangePicker value={{ from: customFrom, to: customTo }} onChange={(r) => { setCustomFrom(r.from); setCustomTo(r.to); }} />
            )}

            {/* Technician filter */}
            <Select value={filterTechnicianId} onValueChange={(v) => setFilterTechnicianId(v)}>
              <SelectTrigger aria-label="Technician" size="sm" className="text-xs w-full sm:w-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
            </Select>

            {/* Customer filter */}
            <Select value={filterCustomerId} onValueChange={(v) => setFilterCustomerId(v)}>
              <SelectTrigger aria-label="Customer" size="sm" className="text-xs w-full sm:w-auto col-span-2 sm:col-span-1"><SelectValue /></SelectTrigger>
              <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
            </Select>

            {(filterDateRange !== 'today' || filterTechnicianId !== 'all' || filterCustomerId !== 'all') && (
              <button
                onClick={() => {
                  setFilterDateRange('today');
                  setFilterTechnicianId('all');
                  setFilterCustomerId('all');
                }}
                className="text-xs text-sky-700 hover:text-sky-900 font-medium px-2 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (2 Cols): Active Schedule & Filtered Job Queue */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            
            {/* Today's Technician Field Roster */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <IconTool className="w-4 h-4 text-sky-700" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-foreground">
                    Technician Availability & Live Van Status
                  </h2>
                </div>
                <Button variant="link" size="xs" onClick={() => onNavigateTab('dispatch')}>
                  <span>Dispatch Board</span>
                  <IconArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {technicians.map((tech) => {
                  const assignedToday = jobs.filter(
                    (j) => j.technicianId === tech.id && j.appointmentDate === today
                  );
                  const activeJob = assignedToday.find((j) => j.status === 'in_progress');

                  return (
                    <div
                      key={tech.id}
                      className="p-3 rounded-lg border border-border bg-muted/50 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tech.color }} 
                            />
                            <span className="text-xs font-bold text-foreground">{tech.name}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {tech.vanRegistration || 'Van'}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                          {tech.skills.join(' · ')}
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {assignedToday.length} {assignedToday.length === 1 ? 'job' : 'jobs'} today
                        </span>
                        {activeJob ? (
                          <span className="font-semibold text-sky-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping motion-reduce:animate-none" />
                            On Site ({activeJob.jobNumber})
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Available</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Job Queue Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Scheduled Jobs Queue ({filteredJobs.length})
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Showing {Math.min(filteredJobs.length, 10)} of {filteredJobs.length} scheduled jobs
                  </p>
                </div>
                <Button variant="link" size="xs" onClick={() => onNavigateTab('dispatch')}>
                  View Full Calendar
                </Button>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No jobs match the selected filters. Clear filters to see all appointments.
                </div>
              ) : (
                <div className="divide-y divide-border overflow-x-auto">
                  <Table className="w-full text-left text-xs">
                    <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border">
                      <TableRow>
                        <TableHead scope="col" className="py-2.5 px-3">Job / Type</TableHead>
                        <TableHead scope="col" className="py-2.5 px-3">Customer & Location</TableHead>
                        <TableHead scope="col" className="py-2.5 px-3">Date & Time</TableHead>
                        <TableHead scope="col" className="py-2.5 px-3">Technician</TableHead>
                        <TableHead scope="col" className="py-2.5 px-3">Status</TableHead>
                        <TableHead scope="col" className="py-2.5 px-3 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border">
                      {filteredJobs.slice(0, 10).map((job) => {
                        const customer = customerById.get(job.customerId);
                        const tech = technicians.find((t) => t.id === job.technicianId);
                        const loc = customer?.serviceLocations.find((l) => l.id === job.locationId);

                        const statusColors: Record<string, string> = {
                          new: 'text-foreground bg-muted',
                          scheduled: 'text-sky-700 bg-sky-50 border border-sky-200',
                          dispatched: 'text-purple-700 bg-purple-50 border border-purple-200',
                          in_progress: 'text-amber-800 bg-amber-50 border border-amber-200 font-semibold',
                          completed: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
                          cancelled: 'text-muted-foreground bg-muted',
                        };

                        return (
                          <TableRow key={job.id} className="hover:bg-muted/70 transition-colors">
                            <TableCell className="py-3 px-3">
                              <span className="tabular-nums font-semibold text-foreground block">
                                {job.jobNumber}
                              </span>
                              {job.title && <span className="text-[11px] font-medium text-foreground block">{job.title}</span>}
                              <span className="text-[11px] text-muted-foreground capitalize">
                                {job.type.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3 max-w-[200px]">
                              <span className="font-semibold text-foreground block truncate">
                                {customer?.name || 'Unknown'}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate block">
                                {[loc?.city, loc?.postcode].filter(Boolean).join(', ')}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3 whitespace-nowrap">
                              <span className="text-foreground font-medium block">
                                {formatDateUK(job.appointmentDate)}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {job.startTime} - {job.endTime}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3">
                              {tech ? (
                                <div className="flex items-center gap-1.5">
                                  <div 
                                    className="w-2 h-2 rounded-full shrink-0" 
                                    style={{ backgroundColor: tech.color }} 
                                  />
                                  <span className="text-foreground font-medium whitespace-nowrap">
                                    {tech.name.split(' ')[0]}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-amber-600 font-medium italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 px-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${statusColors[job.status] || 'text-muted-foreground'}`}>
                                {job.status.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  if (onSelectJob) onSelectJob(job.id);
                                  onNavigateTab('dispatch');
                                }}
                                aria-label={`Manage ${job.jobNumber}`} className="px-2 py-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                              >
                                Manage
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Urgent Action Queues & Workflow Shortcuts */}
          <div className="space-y-6">
            
            {/* Urgent Action Queue (Service Requests & Overdue items) */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <IconAlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-foreground">Action Queue</h2>
                </div>
                <span className="text-xs tabular-nums tabular-nums text-muted-foreground">
                  {newRequestsCount + overdueJobs.length + maintenanceDueEquipments.length} pending
                </span>
              </div>

              {/* Service Requests Awaiting Booking */}
              {serviceRequests.filter((r) => r.status === 'new').map((req) => {
                const cust = customerById.get(req.customerId);
                return (
                  <div 
                    key={req.id}
                    className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold tabular-nums text-amber-900">{req.requestNumber}</span>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                        {req.priority}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">{cust?.name}</p>
                    <p className="text-muted-foreground line-clamp-2">{req.reportedProblem}</p>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Slot: {req.preferredSlot}</span>
                      <Button variant="link" size="xs" onClick={() => onNavigateTab('requests')}>
                        Convert to Job
                      </Button>
                    </div>
                  </div>
                );
              })}

              {newRequestsCount + overdueJobs.length + maintenanceDueEquipments.length === 0 && (
                <EmptyState icon={IconCircleCheck} compact>Nothing needs attention.</EmptyState>
              )}

              {/* Overdue jobs (counted in the header above) */}
              {overdueJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="p-3 bg-card border rounded-lg text-xs space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tabular-nums text-foreground">{job.jobNumber}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-rose-700 bg-rose-100">Overdue</span>
                  </div>
                  {job.title && <p className="font-medium text-foreground line-clamp-2 [overflow-wrap:anywhere]">{job.title}</p>}
                  <p className="text-muted-foreground">{customerById.get(job.customerId)?.name}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground tabular-nums">Was due: {formatDateUK(job.appointmentDate)}</span>
                    <button
                      onClick={() => { onSelectJob?.(job.id); onNavigateTab('dispatch'); }}
                      aria-label={`Manage overdue ${job.jobNumber}`}
                      className="text-sky-700 hover:text-sky-900 font-semibold text-[11px]"
                    >
                      Manage →
                    </button>
                  </div>
                </div>
              ))}

              {/* Upcoming / Overdue Equipment Maintenance Reminders */}
              {maintenanceDueEquipments.slice(0, 2).map((eq) => {
                const cust = customerById.get(eq.customerId);
                const isOverdue = eq.nextServiceDueDate < today;
                return (
                  <div 
                    key={eq.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      isOverdue 
                        ? 'bg-rose-50/80 border-rose-200' 
                        : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{eq.brand} {eq.model}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isOverdue ? 'text-rose-700 bg-rose-100' : 'text-muted-foreground bg-muted'
                      }`}>
                        {isOverdue ? 'Overdue' : 'Due Soon'}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{cust?.name}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        Due: {formatDateUK(eq.nextServiceDueDate)}
                      </span>
                      <Button variant="link" size="xs" onClick={() => onNavigateTab('equipment')}>
                        Schedule Service →
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Workflow Interactive Shortcuts (Section 16 End-to-End Workflows) */}
            {!realAuth && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                    Guided Test Scenarios
                  </span>
                  <IconFlame className="w-4 h-4 text-amber-400" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  End-to-End HVAC Business Workflows
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Step through realistic UK HVAC business operations: enquiry to cash, multi-split installation quotes, heat pump annual compliance, and on-site repair authorizations.
                </p>
                <div className="pt-2">
                  <button
                    onClick={onOpenWorkflowGuide}
                    className="w-full py-2 px-3 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg shadow-sm transition-colors text-center"
                  >
                    Launch Workflow Simulator
                  </button>
                </div>
              </div>
            )}

            {/* Company Compliance Information Card */}
            <div className="bg-card border border-border rounded-lg p-4 text-xs space-y-2">
              <h3 className="font-bold text-foreground">Regulatory Certifications</h3>
              <div className="space-y-1.5 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Gas Safe Register:</span>
                  <span className="tabular-nums font-semibold text-foreground">{settings.gasSafeRegisterNo ? `#${settings.gasSafeRegisterNo}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Refcom F-Gas Certificate:</span>
                  <span className="tabular-nums font-semibold text-foreground">{settings.fGasCertNo ? `#${settings.fGasCertNo}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>HMRC VAT Number:</span>
                  <span className="tabular-nums font-semibold text-foreground">{settings.vatNumber || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Default UK VAT Rate:</span>
                  <span className="font-semibold text-foreground">{settings.defaultVatRate}%</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </>
      ) : (
        <p className="text-xs text-muted-foreground py-2">Jobs and dispatch are not part of your role. Use the menu for quotations, invoices and reports.</p>
      )}

    </div>
  );
};

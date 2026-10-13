import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  UserPlus, 
  CalendarPlus, 
  FileText, 
  Receipt, 
  Wrench, 
  Flame, 
  TrendingUp, 
  ArrowRight,
  Filter,
  Check,
  AlertTriangle
} from 'lucide-react';

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
    switchUserRole
  } = useApp();

  // Filters
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [filterTechnicianId, setFilterTechnicianId] = useState<string>('all');
  const [filterJobStatus, setFilterJobStatus] = useState<string>('all');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('all');

  // Filtered jobs calculation
  const filteredJobs = useMemo(() => {
    const todayStr = '2026-10-13'; // App runtime reference date
    return jobs.filter((job) => {
      if (filterTechnicianId !== 'all' && job.technicianId !== filterTechnicianId) return false;
      if (filterJobStatus !== 'all' && job.status !== filterJobStatus) return false;
      if (filterCustomerId !== 'all' && job.customerId !== filterCustomerId) return false;

      if (filterDateRange === 'today') {
        if (job.appointmentDate !== todayStr) return false;
      } else if (filterDateRange === 'this_week') {
        // approx week range
        if (job.appointmentDate < '2026-10-12' || job.appointmentDate > '2026-10-18') return false;
      } else if (filterDateRange === 'this_month') {
        if (!job.appointmentDate.startsWith('2026-10')) return false;
      }
      return true;
    });
  }, [jobs, filterDateRange, filterTechnicianId, filterJobStatus, filterCustomerId]);

  // Overall KPI counts
  const totalJobsCount = jobs.length;
  const jobsTodayCount = jobs.filter((j) => j.appointmentDate === '2026-10-13').length;
  const inProgressCount = jobs.filter((j) => j.status === 'in_progress').length;
  const completedJobsCount = jobs.filter((j) => j.status === 'completed').length;
  const cancelledJobsCount = jobs.filter((j) => j.status === 'cancelled').length;

  const newRequestsCount = serviceRequests.filter((r) => r.status === 'new').length;
  const overdueJobs = jobs.filter(
    (j) => j.appointmentDate < '2026-10-13' && j.status !== 'completed' && j.status !== 'cancelled'
  );

  const outstandingQuotes = quotations.filter((q) => q.status === 'sent' || q.status === 'draft');
  const unpaidInvoices = invoices.filter((i) => i.status === 'issued' || i.status === 'overdue' || i.status === 'partially_paid');

  const totalCollectedRevenue = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstandingRevenue = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

  // Maintenance due equipment
  const maintenanceDueEquipments = equipment.filter((eq) => eq.nextServiceDueDate <= '2026-10-18');

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner / Welcome with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Operations & Dispatch Overview
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Apex Climate Solutions Ltd</span>
            <span aria-hidden="true">·</span>
            <span>London & South East Depot</span>
            <span aria-hidden="true">·</span>
            <span>Tuesday, 13 October 2026</span>
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenQuickAction('request')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Service Request</span>
          </button>
          <button
            onClick={() => onOpenQuickAction('job')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Book Job</span>
          </button>
          <button
            onClick={() => onOpenQuickAction('quote')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>New Quote</span>
          </button>
          <button
            onClick={() => onOpenQuickAction('invoice')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-600" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI Numerical Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-500 block">Today's Jobs</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">{jobsTodayCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">scheduled</span>
          </div>
          <span className="text-[11px] text-sky-700 mt-1 block font-medium">
            {inProgressCount} active on site
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-500 block">Awaiting Dispatch</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-600">{newRequestsCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">enquiries</span>
          </div>
          <button 
            onClick={() => onNavigateTab('requests')}
            className="text-[11px] text-amber-700 hover:underline mt-1 block font-medium"
          >
            Triage requests →
          </button>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-500 block">Completed Jobs</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600">{completedJobsCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">signed off</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block font-medium">
            {cancelledJobsCount} cancelled
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-500 block">Open Quotations</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">{outstandingQuotes.length}</span>
            <span className="text-[11px] text-slate-500 font-medium">pending</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block font-mono tabular-nums">
            {formatGBP(outstandingQuotes.reduce((acc, q) => acc + q.total, 0))} est.
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-500 block">Unpaid Invoices</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-600">{unpaidInvoices.length}</span>
            <span className="text-[11px] text-slate-500 font-medium">awaiting pay</span>
          </div>
          <span className="text-[11px] text-rose-700 mt-1 block font-mono tabular-nums font-semibold">
            {formatGBP(totalOutstandingRevenue)}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs font-medium text-slate-500 block">Revenue Collected</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {formatGBP(totalCollectedRevenue)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
            Payments confirmed
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-semibold text-slate-700">Filter View:</span>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {/* Date range filter */}
          <select
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today Only (13 Oct)</option>
            <option value="this_week">This Week</option>
            <option value="this_month">October 2026</option>
          </select>

          {/* Technician filter */}
          <select
            value={filterTechnicianId}
            onChange={(e) => setFilterTechnicianId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterJobStatus}
            onChange={(e) => setFilterJobStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Job Statuses</option>
            <option value="new">New</option>
            <option value="scheduled">Scheduled</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Customer filter */}
          <select
            value={filterCustomerId}
            onChange={(e) => setFilterCustomerId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-800 text-xs focus:ring-1 focus:ring-sky-500 col-span-2 sm:col-span-1"
          >
            <option value="all">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {(filterDateRange !== 'all' || filterTechnicianId !== 'all' || filterJobStatus !== 'all' || filterCustomerId !== 'all') && (
            <button
              onClick={() => {
                setFilterDateRange('all');
                setFilterTechnicianId('all');
                setFilterJobStatus('all');
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
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Technician Field Roster */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-sky-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  Technician Availability & Live Van Status
                </h2>
              </div>
              <button
                onClick={() => onNavigateTab('dispatch')}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1"
              >
                <span>Dispatch Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {technicians.map((tech) => {
                const assignedToday = jobs.filter(
                  (j) => j.technicianId === tech.id && j.appointmentDate === '2026-10-13'
                );
                const activeJob = assignedToday.find((j) => j.status === 'in_progress');

                return (
                  <div
                    key={tech.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tech.color }} 
                          />
                          <span className="text-xs font-bold text-slate-900">{tech.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {tech.vanRegistration || 'Van'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {tech.skills.join(' · ')}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        {assignedToday.length} {assignedToday.length === 1 ? 'job' : 'jobs'} today
                      </span>
                      {activeJob ? (
                        <span className="font-semibold text-sky-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping" />
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
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Scheduled Jobs Queue ({filteredJobs.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing matches based on active filters
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('dispatch')}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
              >
                View Full Calendar
              </button>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No jobs match the selected filters. Clear filters to see all appointments.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Job / Type</th>
                      <th className="py-2.5 px-3">Customer & Location</th>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Technician</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredJobs.map((job) => {
                      const customer = customers.find((c) => c.id === job.customerId);
                      const tech = technicians.find((t) => t.id === job.technicianId);
                      const loc = customer?.serviceLocations.find((l) => l.id === job.locationId);

                      const statusColors: Record<string, string> = {
                        new: 'text-slate-700 bg-slate-100',
                        scheduled: 'text-sky-700 bg-sky-50 border border-sky-200',
                        dispatched: 'text-purple-700 bg-purple-50 border border-purple-200',
                        in_progress: 'text-amber-800 bg-amber-50 border border-amber-200 font-semibold',
                        completed: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
                        cancelled: 'text-slate-400 bg-slate-50',
                      };

                      return (
                        <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-mono font-semibold text-slate-900 block">
                              {job.jobNumber}
                            </span>
                            <span className="text-[11px] text-slate-500 capitalize">
                              {job.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-[200px]">
                            <span className="font-semibold text-slate-900 block truncate">
                              {customer?.name || 'Unknown'}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate block">
                              {loc?.city || 'London'}, {loc?.postcode}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="text-slate-900 font-medium block">
                              {job.appointmentDate}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {job.startTime} - {job.endTime}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {tech ? (
                              <div className="flex items-center gap-1.5">
                                <div 
                                  className="w-2 h-2 rounded-full shrink-0" 
                                  style={{ backgroundColor: tech.color }} 
                                />
                                <span className="text-slate-800 font-medium whitespace-nowrap">
                                  {tech.name.split(' ')[0]}
                                </span>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-medium italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] ${statusColors[job.status] || 'text-slate-600'}`}>
                              {job.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                if (onSelectJob) onSelectJob(job.id);
                                onNavigateTab('dispatch');
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded transition-colors"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Urgent Action Queues & Workflow Shortcuts */}
        <div className="space-y-6">
          
          {/* Urgent Action Queue (Service Requests & Overdue items) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">Action Queue</h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {newRequestsCount + overdueJobs.length + maintenanceDueEquipments.length} pending
              </span>
            </div>

            {/* Service Requests Awaiting Booking */}
            {serviceRequests.filter((r) => r.status === 'new').map((req) => {
              const cust = customers.find((c) => c.id === req.customerId);
              return (
                <div 
                  key={req.id}
                  className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-amber-900">{req.requestNumber}</span>
                    <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      {req.priority}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{cust?.name}</p>
                  <p className="text-slate-600 line-clamp-2">{req.reportedProblem}</p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Slot: {req.preferredSlot}</span>
                    <button
                      onClick={() => onNavigateTab('requests')}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-[11px]"
                    >
                      Convert to Job
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Upcoming / Overdue Equipment Maintenance Reminders */}
            {maintenanceDueEquipments.slice(0, 2).map((eq) => {
              const cust = customers.find((c) => c.id === eq.customerId);
              const isOverdue = eq.nextServiceDueDate < '2026-10-13';
              return (
                <div 
                  key={eq.id}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    isOverdue 
                      ? 'bg-rose-50/80 border-rose-200' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{eq.brand} {eq.model}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isOverdue ? 'text-rose-700 bg-rose-100' : 'text-slate-600 bg-slate-200'
                    }`}>
                      {isOverdue ? 'Overdue' : 'Due Soon'}
                    </span>
                  </div>
                  <p className="text-slate-600">{cust?.name}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Due: {eq.nextServiceDueDate}
                    </span>
                    <button
                      onClick={() => onNavigateTab('equipment')}
                      className="text-sky-700 hover:text-sky-900 font-semibold text-[11px]"
                    >
                      Schedule Service →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workflow Interactive Shortcuts (Section 16 End-to-End Workflows) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Guided Test Scenarios
              </span>
              <Flame className="w-4 h-4 text-amber-400" />
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

          {/* Company Compliance Information Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs space-y-2">
            <h3 className="font-bold text-slate-900">Regulatory Certifications</h3>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex items-center justify-between">
                <span>Gas Safe Register:</span>
                <span className="font-mono font-semibold text-slate-800">#649201</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Refcom F-Gas Certificate:</span>
                <span className="font-mono font-semibold text-slate-800">#REF1039841</span>
              </div>
              <div className="flex items-center justify-between">
                <span>HMRC VAT Number:</span>
                <span className="font-mono font-semibold text-slate-800">GB 384 9201 44</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Default UK VAT Rate:</span>
                <span className="font-semibold text-slate-800">20% (Standard)</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

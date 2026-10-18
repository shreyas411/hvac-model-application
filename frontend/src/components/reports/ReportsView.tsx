import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { IconDownload } from '@tabler/icons-react';

export const ReportsView: React.FC = () => {
  const { jobs: allJobs, technicians, invoices: allInvoices, quotations: allQuotations, customers } = useApp(['jobs', 'technicians', 'invoices', 'quotations', 'customers']);

  const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'all'>('this_month');

  // Inclusive YYYY-MM-DD bounds for the selected range ('all' = unbounded).
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const from = dateRange === 'all' ? '' : ymd(new Date(now.getFullYear(), now.getMonth() - (dateRange === 'last_month' ? 1 : 0), 1));
  const to = dateRange === 'all' ? '9999-12-31' : ymd(new Date(now.getFullYear(), now.getMonth() + (dateRange === 'last_month' ? 0 : 1), 0));
  const inRange = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const jobs = useMemo(() => allJobs.filter((j) => inRange(j.appointmentDate)), [allJobs, from, to]); // eslint-disable-line react-hooks/exhaustive-deps -- inRange only reads from/to
  const invoices = useMemo(() => allInvoices.filter((i) => inRange(i.issueDate)), [allInvoices, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const quotations = useMemo(() => allQuotations.filter((q) => inRange(q.createdAt)), [allQuotations, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const repeatCustomers = useMemo(() => {
    const jobCount = new Map<string, number>();
    for (const j of jobs) jobCount.set(j.customerId, (jobCount.get(j.customerId) ?? 0) + 1);
    return customers.filter((c) => (jobCount.get(c.id) ?? 0) > 1).length;
  }, [jobs, customers]);

  // Job profitability. Labour cost isn't tracked, so margin = labour billed + parts price - parts cost.
  const profitability = useMemo(() => jobs
    .filter((j) => j.status === 'completed')
    .map((j) => {
      const labour = (j.labourHours || 0) * (j.hourlyRate || 0);
      const partsRevenue = j.partsUsed.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
      const partsCost = j.partsUsed.reduce((s, p) => s + p.quantity * p.unitCost, 0);
      const revenue = labour + partsRevenue;
      return { job: j, revenue, partsCost, margin: revenue - partsCost };
    })
    .sort((a, b) => b.margin - a.margin), [jobs]);

  // Aged debtors: unpaid balance by days past due (all time, not range-filtered).
  const todayYmd = ymd(now);
  const buckets = [['Current', -Infinity, 0], ['1-30', 1, 30], ['31-60', 31, 60], ['61-90', 61, 90], ['90+', 91, Infinity]] as const;
  const daysLate = (due: string) => Math.floor((Date.parse(todayYmd) - Date.parse(due.slice(0, 10))) / 86_400_000);
  const aged = useMemo(() => {
    const owing = allInvoices.filter((i) => i.balanceDue > 0 && ['issued', 'overdue', 'partially_paid'].includes(i.status));
    return buckets.map(([label, lo, hi]) => ({
      label,
      amount: owing.filter((i) => daysLate(i.dueDate) >= lo && daysLate(i.dueDate) <= hi).reduce((s, i) => s + i.balanceDue, 0),
    }));
  }, [allInvoices, todayYmd]); // eslint-disable-line react-hooks/exhaustive-deps -- buckets/daysLate only read todayYmd

  // Revenue distinctions
  const invoicedRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const recordedPayments = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const estimatedQuotesValue = quotations.reduce((sum, q) => sum + q.total, 0);
  const acceptedQuotesValue = quotations
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + q.total, 0);

  // Technician utilisation
  const techPerformance = useMemo(() => technicians.map((tech) => {
    const techJobs = jobs.filter((j) => j.technicianId === tech.id);
    const completed = techJobs.filter((j) => j.status === 'completed');
    const totalHours = techJobs.reduce((sum, j) => sum + (j.labourHours || 0), 0);
    const billableLabour = techJobs.reduce(
      (sum, j) => sum + (j.labourHours || 0) * (j.hourlyRate || 0),
      0
    );

    return {
      tech,
      totalJobs: techJobs.length,
      completedJobs: completed.length,
      totalHours,
      billableLabour,
    };
  }), [technicians, jobs]);

  // Export report to CSV
  const handleExportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Period', dateRange],
      ['Invoiced Revenue (£)', invoicedRevenue.toFixed(2)],
      ['Recorded Payments (£)', recordedPayments.toFixed(2)],
      ['Outstanding Balance (£)', (invoicedRevenue - recordedPayments).toFixed(2)],
      ['Estimated Pipeline (£)', estimatedQuotesValue.toFixed(2)],
      ['Accepted Quotes (£)', acceptedQuotesValue.toFixed(2)],
      ['Total Completed Jobs', jobs.filter((j) => j.status === 'completed').length],
      ['Total Open Jobs', jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length],
    ];

    const csv = rows.map((e) => e.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); // BOM so Excel reads £ correctly
    Object.assign(document.createElement('a'), { href: url, download: `ApexHVAC_Financial_Report_${Date.now()}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Reports & Business Insights
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Clear separation of invoiced revenue, recorded payments, pipeline estimates, and field technician utilisation
          </p>
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Report period"
        >
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="all">All time</option>
        </select>
        <button
          onClick={handleExportCsv}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <IconDownload className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export Summary (CSV)</span>
        </button>
      </div>

      {/* Primary Financial Trio (Explicitly distinguishing Invoiced, Payments, Pipeline) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            1. Invoiced Revenue
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {formatGBP(invoicedRevenue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Total gross value of official VAT invoices issued across all completed work.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            2. Recorded Payments (Collected)
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-600">
            {formatGBP(recordedPayments)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Reconciled bank funds verified through BACS, debit cards, or cheque receipts.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            3. Estimated Pipeline (Quotes)
          </span>
          <p className="text-2xl font-bold font-mono text-sky-700">
            {formatGBP(estimatedQuotesValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Proposals in flight ({formatGBP(acceptedQuotesValue)} accepted & pending job conversion).
          </p>
        </div>
      </div>

      {/* Technician Utilisation Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Field Technician Utilisation & Output</h2>
            <p className="text-xs text-slate-500">Billable labour generated and appointment completion velocity</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{technicians.length} Active Engineers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th scope="col" className="py-2.5 px-3">Engineer Name</th>
                <th scope="col" className="py-2.5 px-3">Certification / Core Skills</th>
                <th scope="col" className="py-2.5 px-3 text-center">Assigned Jobs</th>
                <th scope="col" className="py-2.5 px-3 text-center">Completed</th>
                <th scope="col" className="py-2.5 px-3 text-right">Logged Hours</th>
                <th scope="col" className="py-2.5 px-3 text-right">Billable Labour Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {techPerformance.map(({ tech, totalJobs, completedJobs, totalHours, billableLabour }) => (
                <tr key={tech.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tech.color }} />
                      <span className="font-bold text-slate-900">{tech.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {tech.skills.slice(0, 2).join(' · ')}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-medium">{totalJobs}</td>
                  <td className="py-3 px-3 text-center font-mono text-emerald-700 font-bold">{completedJobs}</td>
                  <td className="py-3 px-3 text-right font-mono">{totalHours.toFixed(1)} hrs</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatGBP(billableLabour)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job profitability */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Job Profitability</h2>
          <p className="text-xs text-slate-500">Completed jobs in period: labour billed + parts price, less parts cost</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th scope="col" className="py-2.5 px-3">Job</th>
                <th scope="col" className="py-2.5 px-3 text-right">Revenue</th>
                <th scope="col" className="py-2.5 px-3 text-right">Parts cost</th>
                <th scope="col" className="py-2.5 px-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profitability.length === 0 && (
                <tr><td colSpan={4} className="py-4 px-3 text-center text-slate-400">No completed jobs in this period</td></tr>
              )}
              {profitability.map(({ job, revenue, partsCost, margin }) => (
                <tr key={job.id}>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{job.jobNumber} <span className="text-slate-400 font-normal">{formatDateUK(job.appointmentDate)}</span></td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatGBP(revenue)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatGBP(partsCost)}</td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatGBP(margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aged debtors */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-slate-900">Aged Debtors</h2>
        <p className="text-xs text-slate-500 mb-3">Unpaid balances by days past due date</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {aged.map((b) => (
            <div key={b.label} className="p-3 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block">{b.label}{b.label !== 'Current' && ' days'}</span>
              <span className="font-mono font-bold text-slate-900">{formatGBP(b.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Ratios Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 block">Job Completion Rate</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {jobs.length > 0 ? `${Math.round((jobs.filter((j) => j.status === 'completed').length / jobs.length) * 100)}%` : '0%'}
          </span>
          <span className="text-slate-400 text-[11px]">Completed / Total</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 block">Quote Conversion Rate</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            {quotations.length > 0 ? `${Math.round((quotations.filter((q) => q.status === 'accepted').length / quotations.length) * 100)}%` : '0%'}
          </span>
          <span className="text-slate-400 text-[11px]">Accepted / Issued</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 block">Invoice Collection Rate</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {invoicedRevenue > 0 ? `${Math.round((recordedPayments / invoicedRevenue) * 100)}%` : '0%'}
          </span>
          <span className="text-slate-400 text-[11px]">Paid / Invoiced</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <span className="text-slate-500 block">Repeat Customer Ratio</span>
          <span className="text-xl font-bold font-mono text-sky-800 mt-1 block">
            {customers.length > 0
              ? `${Math.round(
                  (repeatCustomers / customers.length) * 100
                )}%`
              : '0%'}
          </span>
          <span className="text-slate-400 text-[11px]">Clients with &gt;1 job</span>
        </div>
      </div>

    </div>
  );
};

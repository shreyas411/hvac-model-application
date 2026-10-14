import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { 
  TrendingUp, 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { jobs, technicians, invoices, quotations, parts, customers } = useApp();

  const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'all'>('this_month');

  // Revenue distinctions
  const invoicedRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const recordedPayments = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const estimatedQuotesValue = quotations.reduce((sum, q) => sum + q.total, 0);
  const acceptedQuotesValue = quotations
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + q.total, 0);

  // Technician utilisation
  const techPerformance = technicians.map((tech) => {
    const techJobs = jobs.filter((j) => j.technicianId === tech.id);
    const completed = techJobs.filter((j) => j.status === 'completed');
    const totalHours = techJobs.reduce((sum, j) => sum + (j.labourHours || 0), 0);
    const billableLabour = techJobs.reduce(
      (sum, j) => sum + (j.labourHours || 0) * (j.hourlyRate || 85),
      0
    );

    return {
      tech,
      totalJobs: techJobs.length,
      completedJobs: completed.length,
      totalHours,
      billableLabour,
    };
  });

  // Export report to CSV
  const handleExportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Invoiced Revenue (£)', invoicedRevenue.toFixed(2)],
      ['Recorded Payments (£)', recordedPayments.toFixed(2)],
      ['Outstanding Balance (£)', (invoicedRevenue - recordedPayments).toFixed(2)],
      ['Estimated Pipeline (£)', estimatedQuotesValue.toFixed(2)],
      ['Accepted Quotes (£)', acceptedQuotesValue.toFixed(2)],
      ['Total Completed Jobs', jobs.filter((j) => j.status === 'completed').length],
      ['Total Open Jobs', jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ApexHVAC_Financial_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
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
          <span className="text-xs font-mono text-slate-500">4 Active Engineers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th className="py-2.5 px-3">Engineer Name</th>
                <th className="py-2.5 px-3">Certification / Core Skills</th>
                <th className="py-2.5 px-3 text-center">Assigned Jobs</th>
                <th className="py-2.5 px-3 text-center">Completed</th>
                <th className="py-2.5 px-3 text-right">Logged Hours</th>
                <th className="py-2.5 px-3 text-right">Billable Labour Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {techPerformance.map(({ tech, totalJobs, completedJobs, totalHours, billableLabour }) => (
                <tr key={tech.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tech.color }} />
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
                  (customers.filter((c) => jobs.filter((j) => j.customerId === c.id).length > 1).length /
                    customers.length) *
                    100
                )}%`
              : '0%'}
          </span>
          <span className="text-slate-400 text-[11px]">Clients with &gt;1 job</span>
        </div>
      </div>

    </div>
  );
};

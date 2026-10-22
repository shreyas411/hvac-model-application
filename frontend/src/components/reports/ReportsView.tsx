import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { IconDownload } from '@tabler/icons-react';
import { DateRangePicker } from '../common/DatePicker';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

export const ReportsView: React.FC = () => {
  const { jobs: allJobs, technicians, invoices: allInvoices, quotations: allQuotations, customers } = useApp(['jobs', 'technicians', 'invoices', 'quotations', 'customers']);

  const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'all' | 'custom'>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Inclusive YYYY-MM-DD bounds for the selected range ('all' = unbounded).
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const from = dateRange === 'custom' ? customFrom : dateRange === 'all' ? '' : ymd(new Date(now.getFullYear(), now.getMonth() - (dateRange === 'last_month' ? 1 : 0), 1));
  const to = dateRange === 'custom' ? customTo || '9999-12-31' : dateRange === 'all' ? '9999-12-31' : ymd(new Date(now.getFullYear(), now.getMonth() + (dateRange === 'last_month' ? 0 : 1), 0));
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
  const unconverted = quotations.filter((q) => !q.convertedToJobId && !q.convertedToInvoiceId);
  const outstanding = invoices.filter((i) => ['issued', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i) => s + i.balanceDue, 0);
  const estimatedQuotesValue = unconverted.reduce((sum, q) => sum + q.total, 0);
  const acceptedQuotesValue = unconverted
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
      ['Period', { this_month: 'This month', last_month: 'Last month', all: 'All time', custom: `${customFrom || 'start'} to ${customTo || 'today'}` }[dateRange]],
      ['Invoiced Revenue (£)', invoicedRevenue.toFixed(2)],
      ['Recorded Payments (£)', recordedPayments.toFixed(2)],
      ['Outstanding Balance (£)', outstanding.toFixed(2)],
      ['Estimated Pipeline (£)', estimatedQuotesValue.toFixed(2)],
      ['Accepted Quotes (£)', acceptedQuotesValue.toFixed(2)],
      ['Total Completed Jobs', jobs.filter((j) => j.status === 'completed').length],
      ['Total Open Jobs', jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length],
    ];

    const csv = rows.map((e) => e.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); // BOM so Excel reads £ correctly
    Object.assign(document.createElement('a'), { href: url, download: `ApexHVAC_Financial_Report_${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Reports & Business Insights
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clear separation of invoiced revenue, recorded payments, pipeline estimates, and field technician utilisation
          </p>
        </div>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          <SelectTrigger aria-label="Report period" size="sm" className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_month">Last month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="custom">Custom range…</SelectItem>
          </SelectContent>
        </Select>
        {dateRange === 'custom' && (
          <DateRangePicker value={{ from: customFrom, to: customTo }} onChange={(r) => { setCustomFrom(r.from); setCustomTo(r.to); }} />
        )}
        <Button variant="outline" size="sm" onClick={handleExportCsv} className="shrink-0">
          <IconDownload className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export Summary (CSV)</span>
        </Button>
      </div>

      {/* Primary Financial Trio (Explicitly distinguishing Invoiced, Payments, Pipeline) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            1. Invoiced Revenue
          </span>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatGBP(invoicedRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total gross value of official VAT invoices issued across all completed work.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            2. Recorded Payments (Collected)
          </span>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600">
            {formatGBP(recordedPayments)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Reconciled bank funds verified through BACS, debit cards, or cheque receipts.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            3. Estimated Pipeline (Quotes)
          </span>
          <p className="text-2xl font-semibold tabular-nums text-sky-700">
            {formatGBP(estimatedQuotesValue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Proposals in flight ({formatGBP(acceptedQuotesValue)} accepted & pending job conversion).
          </p>
        </div>
      </div>

      {/* Technician Utilisation Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Field Technician Utilisation & Output</h2>
            <p className="text-xs text-muted-foreground">Billable labour generated and appointment completion velocity</p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{technicians.length} Active Engineers</span>
        </div>

        <div className="overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <TableHeader className="bg-muted/50 text-muted-foreground border-b border-border font-medium">
              <TableRow>
                <TableHead scope="col" className="py-2.5 px-3">Engineer Name</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 hidden md:table-cell">Certification / Core Skills</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-center hidden md:table-cell">Assigned Jobs</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-center">Completed</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-right hidden md:table-cell">Logged Hours</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-right">Billable Labour Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {techPerformance.map(({ tech, totalJobs, completedJobs, totalHours, billableLabour }) => (
                <TableRow key={tech.id} className="hover:bg-muted/70 transition-colors">
                  <TableCell className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tech.color }} />
                      <span className="font-bold text-foreground">{tech.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-3 hidden md:table-cell text-muted-foreground">
                    {tech.skills.slice(0, 2).join(' · ')}
                  </TableCell>
                  <TableCell className="py-3 px-3 hidden md:table-cell text-center tabular-nums font-medium">{totalJobs}</TableCell>
                  <TableCell className="py-3 px-3 text-center tabular-nums text-emerald-700 font-bold">{completedJobs}</TableCell>
                  <TableCell className="py-3 px-3 hidden md:table-cell text-right tabular-nums">{totalHours.toFixed(1)} hrs</TableCell>
                  <TableCell className="py-3 px-3 text-right tabular-nums font-semibold text-foreground">{formatGBP(billableLabour)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Job profitability */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Job Profitability</h2>
          <p className="text-xs text-muted-foreground">Completed jobs in period: labour billed + parts price, less parts cost</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full text-left text-xs">
            <TableHeader className="bg-muted/50 text-muted-foreground border-b border-border font-medium">
              <TableRow>
                <TableHead scope="col" className="py-2.5 px-3">Job</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-right">Revenue</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-right hidden md:table-cell">Parts cost</TableHead>
                <TableHead scope="col" className="py-2.5 px-3 text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {profitability.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-4 px-3 text-center text-muted-foreground">No completed jobs in this period</TableCell></TableRow>
              )}
              {profitability.map(({ job, revenue, partsCost, margin }) => (
                <TableRow key={job.id}>
                  <TableCell className="py-2.5 px-3 font-medium text-foreground">{job.jobNumber} <span className="text-muted-foreground font-normal">{formatDateUK(job.appointmentDate)}</span></TableCell>
                  <TableCell className="py-2.5 px-3 text-right tabular-nums">{formatGBP(revenue)}</TableCell>
                  <TableCell className="py-2.5 px-3 hidden md:table-cell text-right tabular-nums">{formatGBP(partsCost)}</TableCell>
                  <TableCell className={`py-2.5 px-3 text-right tabular-nums font-semibold ${margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatGBP(margin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Aged debtors */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-bold text-foreground">Aged Debtors</h2>
        <p className="text-xs text-muted-foreground mb-3">Unpaid balances by days past due date</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {aged.map((b) => (
            <div key={b.label} className="p-3 border border-border rounded-lg">
              <span className="text-muted-foreground block">{b.label}{b.label !== 'Current' && ' days'}</span>
              <span className="tabular-nums font-semibold text-foreground">{formatGBP(b.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Ratios Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-card border border-border rounded-lg">
          <span className="text-muted-foreground block">Job Completion Rate</span>
          <span className="text-xl font-semibold tabular-nums text-foreground mt-1 block">
            {jobs.length > 0 ? `${Math.round((jobs.filter((j) => j.status === 'completed').length / jobs.length) * 100)}%` : '0%'}
          </span>
          <span className="text-muted-foreground text-[11px]">Completed / Total</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg">
          <span className="text-muted-foreground block">Quote Conversion Rate</span>
          <span className="text-xl font-semibold tabular-nums text-emerald-700 mt-1 block">
            {quotations.length > 0 ? `${Math.round((quotations.filter((q) => q.status === 'accepted').length / quotations.length) * 100)}%` : '0%'}
          </span>
          <span className="text-muted-foreground text-[11px]">Accepted / Issued</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg">
          <span className="text-muted-foreground block">Invoice Collection Rate</span>
          <span className="text-xl font-semibold tabular-nums text-foreground mt-1 block">
            {invoicedRevenue > 0 ? `${Math.round((recordedPayments / invoicedRevenue) * 100)}%` : '0%'}
          </span>
          <span className="text-muted-foreground text-[11px]">Paid / Invoiced</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg">
          <span className="text-muted-foreground block">Repeat Customer Ratio</span>
          <span className="text-xl font-semibold tabular-nums text-sky-800 mt-1 block">
            {customers.length > 0
              ? `${Math.round(
                  (repeatCustomers / customers.length) * 100
                )}%`
              : '0%'}
          </span>
          <span className="text-muted-foreground text-[11px]">Clients with &gt;1 job</span>
        </div>
      </div>

    </div>
  );
};

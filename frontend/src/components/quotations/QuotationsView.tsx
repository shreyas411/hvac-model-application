import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { useApp } from '../../context/AppContext';
import { Quotation, LineItem, QuotationStatus } from '../../types';
import { formatGBP, formatDateUK, tierPrices, getTodayISO, joinParts, regLine } from '../../utils/formatters';
import { IconBriefcase, IconCircleCheck, IconDownload, IconEye, IconFileInvoice, IconFileText, IconPencil, IconPlus, IconPrinter, IconReceipt, IconSearch, IconSend, IconThumbDown, IconTrash, IconX } from '@tabler/icons-react';
import { downloadCsv } from '../../utils/csv';
import { BulkBar, SelectAllHead, SelectCell, useRowSelection } from '../common/BulkSelect';
import { DatePicker } from '../common/DatePicker';
import { DetailDrawer } from '../common/DetailDrawer';
import { CustomFieldBox } from '../common/CustomFields';
import { useCustomFields } from '../../data/customFields';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { FormDialog } from '../common/FormDialog';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { SortHead, useServerPaged } from '../common/Pager';

interface QuotationsViewProps {
  onOpenQuickAction: (action: 'quote') => void;
  onEditQuote: (q: Quotation) => void;
  onNavigateTab: (tab: string) => void;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({
  onOpenQuickAction,
  onEditQuote,
  onNavigateTab,
}) => {
  const { 
    quotations, 
    invoices,
    customers, 
    settings, 
    technicians,
    acceptQuotation, 
    sendQuotation,
    rejectQuotation,
    bulkQuotations,
    showToast,
    convertQuotationToJob, 
    convertQuotationToInvoice,
    addStageInvoice,
    addQuotation,
    updateQuotation,
    customerById,
    checkScheduleConflict,
    deleteRecord,
    confirmToast,
    currentUser,
  } = useApp(['quotations', 'invoices', 'customers', 'settings', 'technicians', 'acceptQuotation', 'sendQuotation', 'rejectQuotation', 'bulkQuotations', 'showToast', 'convertQuotationToJob', 'convertQuotationToInvoice', 'addStageInvoice', 'addQuotation', 'updateQuotation', 'customerById', 'checkScheduleConflict', 'deleteRecord', 'confirmToast', 'currentUser']);

  // Mirrors the backend: jobs are dispatch work, invoices are accounts work.
  const canJob = ['admin', 'dispatcher'].includes(currentUser.role);
  const canInvoice = ['admin', 'accountant'].includes(currentUser.role);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const { active: customDefs } = useCustomFields('quotation');
  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicate jobs/invoices)

  // Deposit / stage invoice modal
  const [stageQuote, setStageQuote] = useState<Quotation | null>(null);
  const [stagePercent, setStagePercent] = useState('');
  const [stageLabel, setStageLabel] = useState('');
  const stagesOf = (quoteId: string) => invoices.filter((i) => i.quoteId === quoteId && i.stageLabel && i.status !== 'void');
  const billedPercent = (quoteId: string) => stagesOf(quoteId).reduce((a, i) => a + (i.stagePercent ?? 0), 0);
  const openStage = (q: Quotation) => { setStageQuote(q); setStagePercent(''); setStageLabel(''); };
  const submitStage = async (final: boolean) => {
    if (!stageQuote) return;
    setBusy(true);
    const ok = await addStageInvoice(stageQuote.id, final ? 'final' : Number(stagePercent), stageLabel.trim() || undefined);
    setBusy(false);
    if (ok) { setStageQuote(null); onNavigateTab('invoices'); }
  };

  // Convert to Job Modal State
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState('');
  const [jobDate, setJobDate] = useState(getTodayISO());
  const [jobStartTime, setJobStartTime] = useState('08:30');
  const [jobEndTime, setJobEndTime] = useState('16:30');
  const [jobTechId, setJobTechId] = useState(technicians[0]?.id || '');

  // Record acceptance modal
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [acceptedByName, setAcceptedByName] = useState('');
  const [acceptOption, setAcceptOption] = useState('');
  const acceptTiers = [...new Set((quotations.find((q) => q.id === acceptingQuoteId)?.items ?? []).flatMap((i) => (i.option ? [i.option] : [])))];

  const paged = useServerPaged<Quotation>('/quotations', { q: searchTerm.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter }, quotations);

  const sel = useRowSelection(paged.rows);
  const drafts = sel.selected.filter((q) => q.status === 'draft');
  const open = sel.selected.filter((q) => q.status === 'sent' || q.status === 'viewed');
  const bulk = async (rows: Quotation[], action: 'send' | 'reject') => {
    setBusy(true);
    const failed = await bulkQuotations(rows.map((q) => q.id), action);
    setBusy(false);
    sel.clear();
    const bad = rows.filter((q) => failed[q.id]);
    if (bad.length) showToast(`${rows.length - bad.length} of ${rows.length} done. Skipped: ${bad.map((q) => `${q.quoteNumber}: ${failed[q.id]}`).join('; ')}`, 'error');
  };
  const plural = (n: number) => `${n} quotation${n === 1 ? '' : 's'}`;
  const exportSelected = () => downloadCsv(`quotations-${getTodayISO()}.csv`, [
    ['Quote', 'Customer', 'Status', 'Issue date', 'Expiry date', 'Subtotal', 'VAT', 'Total'],
    ...sel.selected.map((q) => [q.quoteNumber, customerById.get(q.customerId)?.name, q.status, q.issueDate, q.expiryDate, q.subtotal, q.vatAmount, q.total]),
  ]);

  const handleRecordAcceptance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingQuoteId) return;
    setBusy(true);
    const ok = await acceptQuotation(acceptingQuoteId, acceptedByName, acceptOption || undefined);
    setBusy(false);
    if (ok) setAcceptingQuoteId(null);
  };

  const handleExecuteConvertToJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingQuoteId) return;
    const clash = checkScheduleConflict(jobTechId, jobDate, jobStartTime, jobEndTime);
    const msg = clash && `Technician already has ${clash.jobNumber} (${clash.startTime}–${clash.endTime}) on ${jobDate}. Press Book again to double-book anyway.`;
    if (msg && conflictMsg !== msg) return setConflictMsg(msg);
    setBusy(true);
    const job = await convertQuotationToJob(convertingQuoteId, jobDate, jobStartTime, jobEndTime, jobTechId);
    setBusy(false);
    if (!job) return;
    setConvertingQuoteId(null);
    onNavigateTab('dispatch');
  };

  const handleExecuteConvertToInvoice = async (quoteId: string) => {
    setBusy(true);
    const inv = await convertQuotationToInvoice(quoteId);
    setBusy(false);
    if (inv) onNavigateTab('invoices');
  };

  const statusBadgeMap: Record<QuotationStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-muted', text: 'text-foreground' },
    sent: { bg: 'bg-sky-50 border-sky-200 border', text: 'text-sky-800' },
    viewed: { bg: 'bg-purple-50 border-purple-200 border', text: 'text-purple-800' },
    accepted: { bg: 'bg-emerald-50 border-emerald-200 border', text: 'text-emerald-800' },
    rejected: { bg: 'bg-rose-50 border-rose-200 border', text: 'text-rose-800' },
    expired: { bg: 'bg-muted/50 border-border border', text: 'text-muted-foreground' },
  };
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">
            Quotations & Estimates
          </h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'quotation' : 'quotations'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create professional HVAC installation proposals, track approvals, and convert directly to jobs or invoices
          </p>
        </div>

        <Button size="sm" onClick={() => onOpenQuickAction('quote')} className="shrink-0">
          <IconPlus aria-hidden="true" />
          <span>New Quotation</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search quotations" name="search" autoComplete="off" placeholder="Search quote number or notes…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" aria-label="Quotation status" className="w-40 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['all', 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'].map((st) => <SelectItem key={st} value={st} className="capitalize">{st === 'all' ? 'All statuses' : st}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || statusFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      <BulkBar count={sel.selected.length} onClear={sel.clear}>
        {drafts.length > 0 && <Button type="button" size="xs" disabled={busy} onClick={() => confirmToast(`Send ${plural(drafts.length)} to customers?`, () => void bulk(drafts, 'send'))}><IconSend aria-hidden="true" />Send {drafts.length}</Button>}
        {open.length > 0 && <Button type="button" size="xs" variant="destructive" disabled={busy} onClick={() => confirmToast(`Mark ${plural(open.length)} as rejected?`, () => void bulk(open, 'reject'))}><IconThumbDown aria-hidden="true" />Reject {open.length}</Button>}
        <Button type="button" size="xs" variant="secondary" onClick={exportSelected}><IconDownload aria-hidden="true" />Export CSV</Button>
      </BulkBar>

      {/* Quotations Table */}
      <div style={{ '--table-offset': '19.5rem' } as React.CSSProperties}><TableCard footer={paged.pager}>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <SelectAllHead sel={sel} label="quotations" />
              <SortHead paged={paged} by="quoteNumber">Quote Number</SortHead>
              <SortHead paged={paged} by="customer.name" className="hidden md:table-cell">Customer / Site</SortHead>
              <SortHead paged={paged} by="issueDate" className="hidden md:table-cell">Issued Date</SortHead>
              <SortHead paged={paged} by="expiryDate" className="hidden md:table-cell">Expiry Date</SortHead>
              <SortHead paged={paged} by="total">Total Amount</SortHead>
              <SortHead paged={paged} by="status" className="hidden md:table-cell">Status</SortHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((quote) => {
              const cust = customerById.get(quote.customerId);
              const loc = cust?.serviceLocations.find((l) => l.id === quote.locationId);
              const st = statusBadgeMap[quote.status];

              return (
                <TableRow key={quote.id} data-state={sel.has(quote.id) ? 'selected' : undefined}>
                  <SelectCell sel={sel} row={quote} label={quote.quoteNumber} />
                  <TableCell className="tabular-nums font-semibold">
                    <button type="button" onClick={() => setSelectedQuote(quote)} className="rounded hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{quote.quoteNumber}</button>
                    <span className="block max-w-[110px] truncate text-[11px] font-normal text-muted-foreground md:hidden">{cust?.name}</span>
                    <Badge variant="outline" className={`mt-1 flex w-fit capitalize md:hidden ${st.bg} ${st.text}`}>{quote.status}</Badge>
                  </TableCell>

                  <TableCell className="hidden md:table-cell max-w-[220px]">
                    <span className="font-semibold block truncate">{cust?.name}</span>
                    <span className="text-[11px] text-muted-foreground block truncate">{loc?.city}, {loc?.postcode}</span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">{formatDateUK(quote.issueDate)}</TableCell>

                  <TableCell className="hidden md:table-cell text-muted-foreground">{formatDateUK(quote.expiryDate)}</TableCell>

                  <TableCell className="tabular-nums font-semibold">
                    {formatGBP(quote.total)}
                    <span className="text-[10px] text-muted-foreground block font-normal">
                      ex VAT {formatGBP(quote.subtotal)}
                    </span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={`capitalize ${st.bg} ${st.text}`}>{quote.status}</Badge>
                    {quote.expired && quote.status !== 'expired' && <Badge variant="outline" className="ml-1 bg-amber-50 text-amber-700 border-amber-200">Expired</Badge>}
                  </TableCell>

                  <TableCell>
                    <RowActions subject={quote.quoteNumber} actions={[
                      { icon: IconEye, label: 'Preview', onClick: () => setSelectedQuote(quote) },
                      { icon: IconPencil, label: 'Edit', hidden: quote.status !== 'draft' && quote.status !== 'sent', onClick: () => onEditQuote(quote) },
                      { icon: IconSend, label: 'Send to customer', tone: 'info', hidden: quote.status !== 'draft', onClick: () => confirmToast(`Send ${quote.quoteNumber} to ${cust?.name}?`, () => void sendQuotation(quote.id)) },
                      { icon: IconCircleCheck, label: 'Record acceptance', tone: 'success', hidden: quote.status !== 'sent' && quote.status !== 'viewed', onClick: () => { setAcceptingQuoteId(quote.id); setAcceptedByName(cust?.name || ''); } },
                      { icon: IconThumbDown, label: 'Mark rejected', destructive: true, hidden: quote.status !== 'sent' && quote.status !== 'viewed',
                        onClick: () => confirmToast(`Mark ${quote.quoteNumber} as rejected?`, () => void rejectQuotation(quote.id)) },
                      { icon: IconBriefcase, label: 'Convert to job', tone: 'info', hidden: !canJob || quote.status !== 'accepted' || !!quote.convertedToJobId, onClick: () => setConvertingQuoteId(quote.id) },
                      { icon: IconReceipt, label: 'Deposit / stage invoice', tone: 'success', hidden: !canInvoice || quote.status !== 'accepted' || !!quote.convertedToInvoiceId, onClick: () => openStage(quote) },
                      { icon: IconFileInvoice, label: 'Convert to invoice', tone: 'info', hidden: !canInvoice || quote.status !== 'accepted' || !!quote.convertedToInvoiceId || stagesOf(quote.id).length > 0 || busy, onClick: () => void handleExecuteConvertToInvoice(quote.id) },
                      { icon: IconTrash, label: 'Delete', destructive: true, hidden: !canJob || quote.status === 'accepted' || !!quote.convertedToJobId || !!quote.convertedToInvoiceId,
                        onClick: () => confirmToast(`Delete ${quote.quoteNumber}?`, () => void deleteRecord('quotations', quote.id, 'Quotation')) },
                    ]} />
                  </TableCell>
                </TableRow>
              );
            })}

            {paged.rows.length === 0 && !paged.loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-6"><EmptyState icon={IconFileText}>No quotations found for this filter.</EmptyState></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableCard></div>

      {/* Quotation Detail / Printable Document Drawer */}
      {selectedQuote && (
        <DetailDrawer size="detail" onClose={() => setSelectedQuote(null)} title={`Quotation Preview - ${selectedQuote.quoteNumber}`} description="Printable quotation"
          footer={<>
            <span className="mr-auto text-[11px] text-muted-foreground tabular-nums">Valid until {formatDateUK(selectedQuote.expiryDate)}</span>
            <Button variant="outline" size="sm" onClick={(e) => downloadSheet(e.currentTarget, `${selectedQuote.quoteNumber}.pdf`)}><IconDownload aria-hidden="true" /><span>Download PDF</span></Button>
            <Button size="sm" onClick={(e) => printSheet(e.currentTarget)}><IconPrinter aria-hidden="true" /><span>Print Quote</span></Button>
          </>}>
            {/* Printable Document Sheet */}
            <div data-pdf-sheet className="-m-5 p-8 space-y-6 text-xs font-sans">
              
              {/* Header block with Company Branding */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{settings.companyName}</h2>
                  <p className="text-slate-600 mt-1">{settings.addressLine1}</p>
                  <p className="text-slate-600">{joinParts([settings.city, settings.postcode], ', ')}</p>
                  <p className="text-slate-500 tabular-nums mt-1">
                    {regLine(settings)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold tabular-nums text-slate-900 block">
                    {selectedQuote.quoteNumber}
                  </span>
                  <span className="text-slate-500 block">Date: {formatDateUK(selectedQuote.issueDate)}</span>
                  <span className="text-slate-500 block">Expires: {formatDateUK(selectedQuote.expiryDate)}</span>
                  <span className={`mt-2 inline-block px-2.5 py-0.5 rounded text-[11px] font-bold capitalize ${statusBadgeMap[selectedQuote.status].bg} ${statusBadgeMap[selectedQuote.status].text}`}>
                    Status: {selectedQuote.status}
                  </span>
                </div>
              </div>

              {/* Client info */}
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
                  Quotation Prepared For:
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {customerById.get(selectedQuote.customerId)?.name}
                </p>
                <p className="text-slate-600">
                  {customerById.get(selectedQuote.customerId)?.serviceLocations.find((l) => l.id === selectedQuote.locationId)?.addressLine1}
                </p>
                <p className="text-slate-600">
                  {customerById.get(selectedQuote.customerId)?.serviceLocations.find((l) => l.id === selectedQuote.locationId)?.city},{' '}
                  {customerById.get(selectedQuote.customerId)?.serviceLocations.find((l) => l.id === selectedQuote.locationId)?.postcode}
                </p>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Description</th>
                      <th scope="col" className="py-2.5 px-3 text-center">Type</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Qty</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Unit Price</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Amount (GBP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedQuote.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.option && <span className="mr-1.5 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">{item.option}</span>}{item.description}</td>
                        <td className="py-2.5 px-3 text-center capitalize text-slate-500 text-[11px]">{item.type}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatGBP(item.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900">{formatGBP(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & VAT Breakdown */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  {tierPrices(selectedQuote.items, selectedQuote.vatRatePercent).length > 0 && selectedQuote.status !== 'accepted' && (
                    <div className="mb-2 p-2 bg-sky-50 border border-sky-200 rounded text-xs">
                      <div className="font-semibold text-sky-900 mb-1">Price per option (inc. VAT)</div>
                      {tierPrices(selectedQuote.items, selectedQuote.vatRatePercent).map((t) => (
                        <div key={t.name} className="flex justify-between"><span>{t.name}</span><span className="tabular-nums font-semibold">{formatGBP(t.total)}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal (Net):</span>
                    <span className="tabular-nums font-medium">{formatGBP(selectedQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>UK VAT ({selectedQuote.vatRatePercent}%):</span>
                    <span className="tabular-nums font-medium">{formatGBP(selectedQuote.vatAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total (Inc VAT):</span>
                    <span className="tabular-nums text-sky-900">{formatGBP(selectedQuote.total)}</span>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] space-y-1">
                <span className="font-bold text-slate-900 block">Terms & Conditions:</span>
                <p>{selectedQuote.terms}</p>
                {selectedQuote.acceptedBy && (
                  <p className="text-emerald-800 font-semibold mt-1">
                    Accepted by: {selectedQuote.acceptedBy} on {formatDateUK(selectedQuote.acceptedAt || '')}
                  </p>
                )}
              </div>
            </div>

        <div className="mt-4"><CustomFieldBox defs={customDefs} values={selectedQuote.customFields} /></div>
        </DetailDrawer>
      )}

      {/* Record Acceptance Modal */}
      {acceptingQuoteId && (
        <FormDialog onClose={() => setAcceptingQuoteId(null)} onSubmit={handleRecordAcceptance} busy={busy} disabled={acceptTiers.length > 0 && !acceptOption} submitLabel={busy ? 'Saving…' : 'Confirm Acceptance'} title="Record Customer Acceptance" description="Confirm that the customer authorized work according to the quotation terms.">
            <div className="space-y-1.5">
              <Label htmlFor="q-acc-name" className="text-xs">Authorized Signatory Name *</Label>
              <Input type="text" required id="q-acc-name" autoComplete="name" value={acceptedByName} onChange={(e) => setAcceptedByName(e.target.value)} />
            </div>
            {acceptTiers.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="q-acc-opt" className="text-xs">Option chosen *</Label>
                <Select value={acceptOption} onValueChange={setAcceptOption} required>
                  <SelectTrigger id="q-acc-opt" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {acceptTiers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormDialog>
      )}

      {/* Deposit / stage invoice drawer */}
      {stageQuote && (
        <FormDialog onClose={() => setStageQuote(null)} busy={busy} disabled={!(Number(stagePercent) > 0)} submitLabel="Create stage invoice"
          onSubmit={(e) => { e.preventDefault(); submitStage(false); }}
          title={`Deposit / stage invoice - ${stageQuote.quoteNumber}`} description={`${billedPercent(stageQuote.id)}% already invoiced, ${100 - billedPercent(stageQuote.id)}% left`}
          actions={<Button type="button" variant="outline" size="sm" disabled={busy || billedPercent(stageQuote.id) >= 100} onClick={() => submitStage(true)} title="Remaining percent, with earlier stages deducted"><IconReceipt aria-hidden="true" /> Final invoice</Button>}>
          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="q-st-pct" className="text-xs">Percent of quote</Label>
              <Input id="q-st-pct" inputMode="numeric" type="number" min="1" max={100 - billedPercent(stageQuote.id)} value={stagePercent} onChange={(e) => setStagePercent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-st-lbl" className="text-xs">Label (optional)</Label>
              <Input id="q-st-lbl" name="label" autoComplete="off" value={stageLabel} onChange={(e) => setStageLabel(e.target.value)} placeholder="Deposit" />
            </div>
          </div>
        </FormDialog>
      )}

      {/* Convert to Job Modal (Workflow B) */}
      {convertingQuoteId && (
        <DetailDrawer onClose={() => setConvertingQuoteId(null)} title="Convert Accepted Quote into Scheduled Job" description="Automatically transfers quote details and books engineering team"
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConvertingQuoteId(null)}>Cancel</Button>
            <Button type="submit" form="convert-quote-form" size="sm" disabled={busy}>{busy ? 'Booking…' : 'Book Installation Job'}</Button>
          </>}>
          <form id="convert-quote-form" onSubmit={handleExecuteConvertToJob} className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="q-j-tech" className="text-xs">Lead Technician *</Label>
              <Select value={jobTechId} onValueChange={setJobTechId}>
                <SelectTrigger id="q-j-tech" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.skills[0]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-j-date" className="text-xs">Installation Date *</Label>
              <div><DatePicker id="q-j-date" min={getTodayISO()} value={jobDate} onChange={setJobDate} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-j-start" className="text-xs">Start Time</Label>
                <Input type="time" required id="q-j-start" value={jobStartTime} onChange={(e) => setJobStartTime(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-j-end" className="text-xs">End Time</Label>
                <Input type="time" required id="q-j-end" value={jobEndTime} onChange={(e) => setJobEndTime(e.target.value)} className="tabular-nums" />
              </div>
            </div>

            {conflictMsg && <p role="alert" className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold">{conflictMsg}</p>}
          </form>
        </DetailDrawer>
      )}

    </div>
  );
};

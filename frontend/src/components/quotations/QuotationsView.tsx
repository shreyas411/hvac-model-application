import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { useApp } from '../../context/AppContext';
import { Quotation, LineItem, QuotationStatus } from '../../types';
import { formatGBP, formatDateUK, tierPrices, getTodayISO } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconDownload, IconFileText, IconPlus, IconPrinter, IconReceipt, IconX } from '@tabler/icons-react';
import { useServerPaged } from '../common/Pager';

interface QuotationsViewProps {
  onOpenQuickAction: (action: 'quote') => void;
  onNavigateTab: (tab: string) => void;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { 
    quotations, 
    invoices,
    customers, 
    settings, 
    technicians,
    acceptQuotation, 
    convertQuotationToJob, 
    convertQuotationToInvoice,
    addStageInvoice,
    addQuotation,
    updateQuotation,
    customerById,
  } = useApp(['quotations', 'invoices', 'customers', 'settings', 'technicians', 'acceptQuotation', 'convertQuotationToJob', 'convertQuotationToInvoice', 'addStageInvoice', 'addQuotation', 'updateQuotation', 'customerById']);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
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
  const [jobDate, setJobDate] = useState(getTodayISO());
  const [jobStartTime, setJobStartTime] = useState('08:30');
  const [jobEndTime, setJobEndTime] = useState('16:30');
  const [jobTechId, setJobTechId] = useState(technicians[0]?.id || '');

  // Record acceptance modal
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [acceptedByName, setAcceptedByName] = useState('');
  const [acceptOption, setAcceptOption] = useState('');
  const acceptTiers = [...new Set((quotations.find((q) => q.id === acceptingQuoteId)?.items ?? []).flatMap((i) => (i.option ? [i.option] : [])))];

  const paged = useServerPaged<Quotation>('/quotations', { status: statusFilter === 'all' ? undefined : statusFilter }, quotations);

  useEscape(!!(selectedQuote || acceptingQuoteId || stageQuote || convertingQuoteId), () => { setSelectedQuote(null); setAcceptingQuoteId(null); setStageQuote(null); setConvertingQuoteId(null); });

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
    draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
    sent: { bg: 'bg-sky-50 border-sky-200 border', text: 'text-sky-800' },
    viewed: { bg: 'bg-purple-50 border-purple-200 border', text: 'text-purple-800' },
    accepted: { bg: 'bg-emerald-50 border-emerald-200 border', text: 'text-emerald-800' },
    rejected: { bg: 'bg-rose-50 border-rose-200 border', text: 'text-rose-800' },
    expired: { bg: 'bg-slate-50 border-slate-200 border', text: 'text-slate-400' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Quotations & Estimates
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create professional HVAC installation proposals, track approvals, and convert directly to jobs or invoices
          </p>
        </div>

        <button
          onClick={() => onOpenQuickAction('quote')}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        {['all', 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            aria-pressed={statusFilter === st}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${
              statusFilter === st
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {st} ({st === 'all' ? quotations.length : quotations.filter((q) => q.status === st).length})
          </button>
        ))}
      </div>

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="py-2.5 px-3">Quote Number</th>
                <th scope="col" className="py-2.5 px-3">Customer / Site</th>
                <th scope="col" className="py-2.5 px-3">Issued Date</th>
                <th scope="col" className="py-2.5 px-3">Expiry Date</th>
                <th scope="col" className="py-2.5 px-3">Total Amount</th>
                <th scope="col" className="py-2.5 px-3">Status</th>
                <th scope="col" className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.rows.map((quote) => {
                const cust = customerById.get(quote.customerId);
                const loc = cust?.serviceLocations.find((l) => l.id === quote.locationId);
                const st = statusBadgeMap[quote.status];

                return (
                  <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {quote.quoteNumber}
                    </td>

                    <td className="py-3 px-3 max-w-[220px]">
                      <span className="font-semibold text-slate-900 block truncate">{cust?.name}</span>
                      <span className="text-[11px] text-slate-500 block truncate">{loc?.city}, {loc?.postcode}</span>
                    </td>

                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {formatDateUK(quote.issueDate)}
                    </td>

                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {formatDateUK(quote.expiryDate)}
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatGBP(quote.total)}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        ex VAT {formatGBP(quote.subtotal)}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${st.bg} ${st.text}`}>
                        {quote.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          aria-label={`Preview ${quote.quoteNumber}`} className="px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          Preview
                        </button>

                        {quote.status === 'sent' && (
                          <button
                            onClick={() => {
                              setAcceptingQuoteId(quote.id);
                              setAcceptedByName(cust?.name || '');
                            }}
                            aria-label={`Record acceptance of ${quote.quoteNumber}`} className="px-2 py-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            Accept
                          </button>
                        )}

                        {quote.status === 'accepted' && !quote.convertedToJobId && (
                          <button
                            onClick={() => setConvertingQuoteId(quote.id)}
                            aria-label={`Convert ${quote.quoteNumber} to job`} className="px-2 py-1 text-sky-700 hover:text-sky-800 bg-sky-50 border border-sky-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            title="Workflow B: Convert to Scheduled Job"
                          >
                            Convert to Job
                          </button>
                        )}

                        {quote.status === 'accepted' && !quote.convertedToInvoiceId && (
                          <button
                            onClick={() => openStage(quote)}
                            aria-label={`Create stage invoice for ${quote.quoteNumber}`} className="px-2 py-1 text-slate-700 hover:text-slate-800 bg-slate-50 border border-slate-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            title="Deposit / stage payment: its own invoice"
                          >
                            Stage
                          </button>
                        )}

                        {quote.status === 'accepted' && !quote.convertedToInvoiceId && !stagesOf(quote.id).length && (
                          <button
                            onClick={() => handleExecuteConvertToInvoice(quote.id)}
                            disabled={busy} aria-label={`Invoice ${quote.quoteNumber}`} className="px-2 py-1 text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded font-semibold text-xs disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paged.rows.length === 0 && !paged.loading && (
                <tr>
                  <td colSpan={7} className="py-6"><EmptyState icon={IconFileText}>No quotations found for this filter.</EmptyState></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {paged.pager}
      </div>

      {/* Quotation Detail / Printable Document Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Quotation preview">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                Quotation Preview - {selectedQuote.quoteNumber}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => downloadSheet(e.currentTarget, `${selectedQuote.quoteNumber}.pdf`)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
                >
                  <IconDownload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>IconDownload PDF</span>
                </button>
                <button
                  onClick={(e) => printSheet(e.currentTarget)}
                  className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <IconPrinter className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print Quote</span>
                </button>
                <button
                  onClick={() => setSelectedQuote(null)}
                  aria-label="Close preview" className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div data-pdf-sheet className="p-8 overflow-y-auto space-y-6 text-xs font-sans">
              
              {/* Header block with Company Branding */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{settings.companyName}</h2>
                  <p className="text-slate-600 mt-1">{settings.addressLine1}</p>
                  <p className="text-slate-600">{settings.city}, {settings.postcode}</p>
                  <p className="text-slate-500 font-mono mt-1">
                    VAT Reg: {settings.vatNumber} · Gas Safe: #{settings.gasSafeRegisterNo}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-slate-900 block">
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
                        <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatGBP(item.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatGBP(item.amount)}</td>
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
                        <div key={t.name} className="flex justify-between"><span>{t.name}</span><span className="font-mono font-bold">{formatGBP(t.total)}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal (Net):</span>
                    <span className="font-mono font-medium">{formatGBP(selectedQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>UK VAT ({selectedQuote.vatRatePercent}%):</span>
                    <span className="font-mono font-medium">{formatGBP(selectedQuote.vatAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total (Inc VAT):</span>
                    <span className="font-mono text-sky-900">{formatGBP(selectedQuote.total)}</span>
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

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Valid until {formatDateUK(selectedQuote.expiryDate)}
              </span>
              <button
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Acceptance Modal */}
      {acceptingQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Record customer acceptance">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Record Customer Acceptance</h3>
            <p className="text-slate-600">
              Confirm that the customer authorized work according to the quotation terms.
            </p>
            <form onSubmit={handleRecordAcceptance} className="space-y-3">
              <div>
                <label htmlFor="q-acc-name" className="block font-semibold text-slate-700 mb-1">
                  Authorized Signatory Name \*
                </label>
                <input
                  type="text"
                  required
                  id="q-acc-name" autoComplete="name" value={acceptedByName}
                  onChange={(e) => setAcceptedByName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>
              {acceptTiers.length > 0 && (
                <div>
                  <label htmlFor="q-acc-opt" className="block font-semibold text-slate-700 mb-1">Option chosen *</label>
                  <select id="q-acc-opt" required value={acceptOption} onChange={(e) => setAcceptOption(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs">
                    <option value="">Select…</option>
                    {acceptTiers.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAcceptingQuoteId(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Confirm Acceptance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stageQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Deposit or stage invoice">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4 text-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Deposit / stage invoice - {stageQuote.quoteNumber}</h3>
              <p className="text-slate-500 mt-0.5">{billedPercent(stageQuote.id)}% already invoiced, {100 - billedPercent(stageQuote.id)}% left</p>
            </div>
            <div>
              <label htmlFor="q-st-pct" className="block font-semibold text-slate-700 mb-1">Percent of quote</label>
              <input id="q-st-pct" inputMode="numeric" type="number" min="1" max={100 - billedPercent(stageQuote.id)} value={stagePercent} onChange={(e) => setStagePercent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs" />
            </div>
            <div>
              <label htmlFor="q-st-lbl" className="block font-semibold text-slate-700 mb-1">Label (optional)</label>
              <input id="q-st-lbl" name="label" autoComplete="off" value={stageLabel} onChange={(e) => setStageLabel(e.target.value)} placeholder="Deposit" className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs" />
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button onClick={() => setStageQuote(null)} className="px-3 py-2 border border-slate-300 rounded-md font-semibold inline-flex items-center gap-1.5"><IconX className="w-4 h-4" aria-hidden="true" /> Cancel</button>
              <div className="flex gap-2">
                <button disabled={busy || billedPercent(stageQuote.id) >= 100} onClick={() => submitStage(true)} className="px-3 py-2 border border-slate-300 rounded-md font-semibold disabled:opacity-40 inline-flex items-center gap-1.5" title="Remaining percent, with earlier stages deducted"><IconReceipt className="w-4 h-4" aria-hidden="true" /> Final invoice</button>
                <button disabled={busy || !(Number(stagePercent) > 0)} onClick={() => submitStage(false)} className="px-3 py-2 bg-sky-600 text-white rounded-md font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" aria-hidden="true" /> Create stage invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Job Modal (Workflow B) */}
      {convertingQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Convert quote to job">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4 text-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Convert Accepted Quote into Scheduled Job
              </h3>
              <p className="text-slate-500 mt-0.5">
                Automatically transfers quote details and books engineering team
              </p>
            </div>

            <form onSubmit={handleExecuteConvertToJob} className="space-y-3">
              <div>
                <label htmlFor="q-j-tech" className="block font-semibold text-slate-700 mb-1">Lead Technician *</label>
                <select
                  id="q-j-tech" value={jobTechId}
                  onChange={(e) => setJobTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.skills[0]})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="q-j-date" className="block font-semibold text-slate-700 mb-1">Installation Date *</label>
                <input
                  type="date"
                  required
                  id="q-j-date" min={getTodayISO()} value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="q-j-start" className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    id="q-j-start" value={jobStartTime}
                    onChange={(e) => setJobStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="q-j-end" className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    id="q-j-end" value={jobEndTime}
                    onChange={(e) => setJobEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConvertingQuoteId(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Booking…' : 'Book Installation Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

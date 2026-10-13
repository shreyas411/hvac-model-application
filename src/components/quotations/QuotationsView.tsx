import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Quotation, LineItem, QuotationStatus } from '../../types';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  Calendar, 
  Printer, 
  Trash2, 
  ArrowRight,
  Send,
  Building,
  Wrench,
  X
} from 'lucide-react';

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
    customers, 
    settings, 
    technicians,
    acceptQuotation, 
    convertQuotationToJob, 
    convertQuotationToInvoice,
    addQuotation,
    updateQuotation
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);

  // Convert to Job Modal State
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);
  const [jobDate, setJobDate] = useState('2026-10-15');
  const [jobStartTime, setJobStartTime] = useState('08:30');
  const [jobEndTime, setJobEndTime] = useState('16:30');
  const [jobTechId, setJobTechId] = useState(technicians[0]?.id || '');

  // Record acceptance modal
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [acceptedByName, setAcceptedByName] = useState('Nigel Edwards');

  const filteredQuotes = quotations.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    return true;
  });

  const handleRecordAcceptance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingQuoteId) return;
    acceptQuotation(acceptingQuoteId, acceptedByName);
    setAcceptingQuoteId(null);
  };

  const handleExecuteConvertToJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingQuoteId) return;
    convertQuotationToJob(convertingQuoteId, jobDate, jobStartTime, jobEndTime, jobTechId);
    setConvertingQuoteId(null);
    onNavigateTab('dispatch');
  };

  const handleExecuteConvertToInvoice = (quoteId: string) => {
    convertQuotationToInvoice(quoteId);
    onNavigateTab('invoices');
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
          <Plus className="w-3.5 h-3.5" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        {['all', 'draft', 'sent', 'accepted', 'rejected'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
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
                <th className="py-2.5 px-3">Quote Number</th>
                <th className="py-2.5 px-3">Customer / Site</th>
                <th className="py-2.5 px-3">Issued Date</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3">Total Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.map((quote) => {
                const cust = customers.find((c) => c.id === quote.customerId);
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
                          className="px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded font-semibold text-xs"
                        >
                          Preview
                        </button>

                        {quote.status === 'sent' && (
                          <button
                            onClick={() => {
                              setAcceptingQuoteId(quote.id);
                              setAcceptedByName(cust?.name || '');
                            }}
                            className="px-2 py-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded font-semibold text-xs"
                          >
                            Accept
                          </button>
                        )}

                        {quote.status === 'accepted' && !quote.convertedToJobId && (
                          <button
                            onClick={() => setConvertingQuoteId(quote.id)}
                            className="px-2 py-1 text-sky-700 hover:text-sky-800 bg-sky-50 border border-sky-200 rounded font-semibold text-xs"
                            title="Workflow B: Convert to Scheduled Job"
                          >
                            Convert to Job
                          </button>
                        )}

                        {quote.status === 'accepted' && !quote.convertedToInvoiceId && (
                          <button
                            onClick={() => handleExecuteConvertToInvoice(quote.id)}
                            className="px-2 py-1 text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded font-semibold text-xs"
                          >
                            Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No quotations found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quotation Detail / Printable Document Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                Quotation Preview - {selectedQuote.quoteNumber}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Quote</span>
                </button>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs font-sans">
              
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
                  {customers.find((c) => c.id === selectedQuote.customerId)?.name}
                </p>
                <p className="text-slate-600">
                  {customers.find((c) => c.id === selectedQuote.customerId)?.serviceLocations[0]?.addressLine1}
                </p>
                <p className="text-slate-600">
                  {customers.find((c) => c.id === selectedQuote.customerId)?.serviceLocations[0]?.city},{' '}
                  {customers.find((c) => c.id === selectedQuote.customerId)?.serviceLocations[0]?.postcode}
                </p>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-center">Type</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Amount (GBP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedQuote.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
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
                Valid for 30 days from date of issue
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Record Customer Acceptance</h3>
            <p className="text-slate-600">
              Confirm that the customer authorized work according to the quotation terms.
            </p>
            <form onSubmit={handleRecordAcceptance} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authorized Signatory Name *
                </label>
                <input
                  type="text"
                  required
                  value={acceptedByName}
                  onChange={(e) => setAcceptedByName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>
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
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Confirm Acceptance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Job Modal (Workflow B) */}
      {convertingQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
                <label className="block font-semibold text-slate-700 mb-1">Lead Technician *</label>
                <select
                  value={jobTechId}
                  onChange={(e) => setJobTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.skills[0]})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Installation Date *</label>
                <input
                  type="date"
                  required
                  value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={jobStartTime}
                    onChange={(e) => setJobStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={jobEndTime}
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
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg"
                >
                  Book Installation Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

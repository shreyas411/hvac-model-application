import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, PaymentRecord } from '../../types';
import { formatGBP, formatDateUK, getTodayISO } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { IconDownload, IconPlus, IconPrinter, IconReceipt, IconSearch } from '@tabler/icons-react';
import { useServerPaged } from '../common/Pager';

interface InvoicesViewProps {
  onOpenQuickAction: (action: 'invoice') => void;
  onNavigateTab: (tab: string) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { 
    invoices, 
    customers, 
    settings, 
    recordPayment,
    releaseRetention,
    currentUser,
    customerById,
  } = useApp(['invoices', 'customers', 'settings', 'recordPayment', 'releaseRetention', 'currentUser', 'customerById']);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false); // guards double-submit (would record a payment twice)

  // Record payment modal
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bacs' | 'card' | 'cheque' | 'cash'>('bacs');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const payingInvoice = invoices.find((i) => i.id === payingInvoiceId);

  const handleOpenPayment = (inv: Invoice) => {
    setPayingInvoiceId(inv.id);
    setPaymentAmount(inv.balanceDue.toFixed(2));
    setPaymentMethod('bacs');
    setPaymentReference(''); // a real bank reference, not an invented one
    setPaymentNotes('');
  };

  useEscape(!!(selectedInvoice || payingInvoiceId), () => { setSelectedInvoice(null); setPayingInvoiceId(null); });

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoiceId) return;

    setBusy(true);
    const ok = await recordPayment(payingInvoiceId, {
      date: getTodayISO(),
      amount: Number(paymentAmount),
      method: paymentMethod,
      reference: paymentReference,
      notes: paymentNotes,
    });
    setBusy(false);
    if (!ok) return;

    setPayingInvoiceId(null);
  };

  // Status and search (invoice number, notes, customer name) run on the server so paging covers the whole list
  const paged = useServerPaged<Invoice>('/invoices', { q: searchTerm.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter }, invoices);

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  const statusBadgeMap: Record<InvoiceStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
    issued: { bg: 'bg-sky-50 border border-sky-200', text: 'text-sky-800' },
    partially_paid: { bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-800' },
    paid: { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-800' },
    overdue: { bg: 'bg-rose-50 border border-rose-200', text: 'text-rose-800 font-bold' },
    void: { bg: 'bg-slate-50 border border-slate-200', text: 'text-slate-400' },
    credited: { bg: 'bg-violet-50 border border-violet-200', text: 'text-violet-800' },
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Invoicing & Payment Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            UK VAT invoices, BACS bank reconciliations, partial payment tracking, and debtor ledgers
          </p>
        </div>

        <button
          onClick={() => onOpenQuickAction('invoice')}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500">Collected Revenue (Payments)</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            {formatGBP(totalPaid)}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Bank reconciled via receipts</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500">Outstanding Balance (Debtors)</span>
          <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
            {formatGBP(totalOutstanding)}
          </p>
          <span className="text-[11px] text-rose-700 mt-0.5 block font-medium">
            {invoices.filter((i) => i.status === 'overdue').length} overdue invoices
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500">VAT Output</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {formatGBP(invoices.reduce((sum, i) => sum + i.vatAmount, 0))}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">HMRC VAT liability reserve</span>
        </div>
      </div>

      {/* Filter and IconSearch Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search invoices" name="search" autoComplete="off" placeholder="Search invoice number or customer…"
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'draft', 'issued', 'partially_paid', 'overdue', 'paid', 'credited', 'void'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              aria-pressed={statusFilter === st}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="py-2.5 px-3">Invoice Number</th>
                <th scope="col" className="py-2.5 px-3">Customer Client</th>
                <th scope="col" className="py-2.5 px-3">Issue Date</th>
                <th scope="col" className="py-2.5 px-3">Due Date</th>
                <th scope="col" className="py-2.5 px-3 text-right">Total (GBP)</th>
                <th scope="col" className="py-2.5 px-3 text-right">Balance Due</th>
                <th scope="col" className="py-2.5 px-3">Status</th>
                <th scope="col" className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.rows.map((inv) => {
                const cust = customerById.get(inv.customerId);
                const st = statusBadgeMap[inv.status];

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
                      {inv.stageLabel && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">{inv.stageLabel} {inv.stagePercent}%</span>}
                    </td>

                    <td className="py-3 px-3 max-w-[200px]">
                      <span className="font-semibold text-slate-900 block truncate">{cust?.name}</span>
                      <span className="text-[11px] text-slate-500 block truncate">{cust?.billingAddress.city}</span>
                    </td>

                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {formatDateUK(inv.issueDate)}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={inv.status === 'overdue' ? 'text-rose-700 font-bold' : 'text-slate-600'}>
                        {formatDateUK(inv.dueDate)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatGBP(inv.total)}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        VAT {formatGBP(inv.vatAmount)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={inv.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                        {formatGBP(inv.balanceDue)}
                      </span>
                      {inv.amountPaid > 0 && (
                        <span className="text-[10px] text-emerald-700 block font-normal">
                          Paid {formatGBP(inv.amountPaid)}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${st.bg} ${st.text}`}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          aria-label={`View ${inv.invoiceNumber}`} className="px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          View Sheet
                        </button>

                        {inv.balanceDue > 0 && (
                          <button
                            onClick={() => handleOpenPayment(inv)}
                            aria-label={`Record payment for ${inv.invoiceNumber}`} className="px-2.5 py-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paged.rows.length === 0 && !paged.loading && (
                <tr>
                  <td colSpan={8} className="py-6"><EmptyState icon={IconReceipt}>No invoices found matching criteria.</EmptyState></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {paged.pager}
      </div>

      {/* Invoice Detail / Printable Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Invoice sheet">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                Invoice - {selectedInvoice.invoiceNumber}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => downloadSheet(e.currentTarget, `${selectedInvoice.invoiceNumber}.pdf`)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
                >
                  <IconDownload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={(e) => printSheet(e.currentTarget)}
                  className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <IconPrinter className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print Invoice</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>

            {/* Document sheet */}
            <div data-pdf-sheet className="p-8 overflow-y-auto space-y-6 text-xs font-sans">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{settings.companyName}</h2>
                  <p className="text-slate-600 mt-1">{settings.addressLine1}</p>
                  <p className="text-slate-600">{settings.city}, {settings.postcode}</p>
                  <p className="text-slate-500 font-mono mt-1">
                    VAT Reg: {settings.vatNumber} · Company: {settings.companyNumber}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-slate-900 block">
                    {selectedInvoice.invoiceNumber}
                  </span>
                  {selectedInvoice.stageLabel && <span className="text-slate-500 block">{selectedInvoice.stageLabel} - {selectedInvoice.stagePercent}% of quotation</span>}
                  <span className="text-slate-500 block">Date: {formatDateUK(selectedInvoice.issueDate)}</span>
                  <span className="text-slate-500 block">Due Date: {formatDateUK(selectedInvoice.dueDate)}</span>
                  <span className={`mt-2 inline-block px-2.5 py-0.5 rounded text-[11px] font-bold capitalize ${statusBadgeMap[selectedInvoice.status].bg} ${statusBadgeMap[selectedInvoice.status].text}`}>
                    {selectedInvoice.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Billed to */}
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
                  Billed To:
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {customerById.get(selectedInvoice.customerId)?.name}
                </p>
                <p className="text-slate-600">
                  {customerById.get(selectedInvoice.customerId)?.billingAddress.line1}
                </p>
                <p className="text-slate-600">
                  {customerById.get(selectedInvoice.customerId)?.billingAddress.city},{' '}
                  {customerById.get(selectedInvoice.customerId)?.billingAddress.postcode}
                </p>
              </div>

              {/* Items table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Description</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Quantity</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Unit Price</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Amount (GBP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatGBP(item.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatGBP(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary and Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Bank details for BACS */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-900 block">Bank Transfer (BACS) Details:</span>
                  <p>Bank: <strong>{settings.bankDetails.bankName}</strong></p>
                  <p>Account Name: <strong>{settings.bankDetails.accountName}</strong></p>
                  <p>Sort Code: <strong className="font-mono">{settings.bankDetails.sortCode}</strong></p>
                  <p>Account No: <strong className="font-mono">{settings.bankDetails.accountNumber}</strong></p>
                  <p>Payment Reference: <strong className="font-mono">{selectedInvoice.invoiceNumber}</strong></p>
                </div>

                {/* Subtotals & Balances */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatGBP(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{selectedInvoice.reverseCharge ? 'VAT (domestic reverse charge)' : `UK VAT (${selectedInvoice.vatRatePercent}%)`}:</span>
                    <span className="font-mono">{formatGBP(selectedInvoice.vatAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Invoice Total:</span>
                    <span className="font-mono">{formatGBP(selectedInvoice.total)}</span>
                  </div>
                  {!!selectedInvoice.cisDeduction && (
                    <div className="flex justify-between text-slate-600">
                      <span>Less CIS deduction ({selectedInvoice.cisRatePercent}% of labour):</span>
                      <span className="font-mono">-{formatGBP(selectedInvoice.cisDeduction)}</span>
                    </div>
                  )}
                  {!!selectedInvoice.retentionHeld && (
                    <div className="flex justify-between text-slate-600 items-center">
                      <span>
                        Retention held ({selectedInvoice.retentionPercent}%):{' '}
                        <button disabled={busy} aria-label={`Release retention on ${selectedInvoice.invoiceNumber}`} onClick={async () => { setBusy(true); const ok = await releaseRetention(selectedInvoice.id); setBusy(false); if (ok) setSelectedInvoice(null); }} className="ml-1 px-1.5 py-0.5 disabled:opacity-60 text-sky-700 bg-sky-50 border border-sky-200 rounded text-[10px] font-semibold">Release</button>
                      </span>
                      <span className="font-mono">-{formatGBP(selectedInvoice.retentionHeld)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Total Amount Paid:</span>
                    <span className="font-mono">-{formatGBP(selectedInvoice.amountPaid)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-rose-700">
                    <span>Balance Due:</span>
                    <span className="font-mono">{formatGBP(selectedInvoice.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Payment ledger history on this invoice */}
              {selectedInvoice.payments.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-bold text-slate-900 block">Recorded Payments History:</span>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-[11px]">
                    {selectedInvoice.payments.map((p) => (
                      <div key={p.id} className="p-2 flex justify-between bg-emerald-50/50">
                        <span>
                          {formatDateUK(p.date)} · <strong className="uppercase">{p.method}</strong> · Ref: {p.reference} (by {p.recordedBy})
                        </span>
                        <span className="font-mono font-bold text-emerald-800">
                          {formatGBP(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {settings.termsAndConditions}
              </span>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Record payment">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4 text-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Record Payment for {payingInvoice.invoiceNumber}
              </h3>
              <p className="text-slate-500 mt-0.5">
                Total: {formatGBP(payingInvoice.total)} · Outstanding: {formatGBP(payingInvoice.balanceDue)}
              </p>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3">
              <div>
                <label htmlFor="pay-amt" className="block font-semibold text-slate-700 mb-1">
                  Payment Amount \(£\) \*
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payingInvoice.balanceDue}
                  required
                  id="pay-amt" name="amount" inputMode="decimal" value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  You can enter a partial amount to record an instalment.
                </span>
              </div>

              <div>
                <label htmlFor="pay-method" className="block font-semibold text-slate-700 mb-1">
                  Payment Method \*
                </label>
                <select
                  id="pay-method" value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="bacs">BACS Bank Transfer</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label htmlFor="pay-ref" className="block font-semibold text-slate-700 mb-1">
                  Payment Reference / Bank Transaction ID \*
                </label>
                <input
                  type="text"
                  required
                  id="pay-ref" name="reference" autoComplete="off" spellCheck={false} value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. BACS-849102"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div>
                <label htmlFor="pay-notes" className="block font-semibold text-slate-700 mb-1">Internal Notes</label>
                <input
                  type="text"
                  id="pay-notes" name="notes" autoComplete="off" value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cleared in Barclays account statement"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingInvoiceId(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Recording…' : 'Confirm & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, PaymentRecord } from '../../types';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { 
  Receipt, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Printer, 
  CreditCard, 
  Building2, 
  X,
  Search,
  FileText
} from 'lucide-react';

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
    currentUser 
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Record payment modal
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'bacs' | 'card' | 'cheque' | 'cash'>('bacs');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const payingInvoice = invoices.find((i) => i.id === payingInvoiceId);

  const handleOpenPayment = (inv: Invoice) => {
    setPayingInvoiceId(inv.id);
    setPaymentAmount(inv.balanceDue);
    setPaymentMethod('bacs');
    setPaymentReference(`BACS-${Date.now().toString().slice(-5)}`);
    setPaymentNotes('');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoiceId) return;

    const ok = await recordPayment(payingInvoiceId, {
      date: new Date().toISOString().split('T')[0],
      amount: Number(paymentAmount),
      method: paymentMethod,
      reference: paymentReference,
      notes: paymentNotes,
    });
    if (!ok) return;

    setPayingInvoiceId(null);
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const cust = customers.find((c) => c.id === inv.customerId);
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        cust?.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  const statusBadgeMap: Record<InvoiceStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
    issued: { bg: 'bg-sky-50 border border-sky-200', text: 'text-sky-800' },
    partially_paid: { bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-800' },
    paid: { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-800' },
    overdue: { bg: 'bg-rose-50 border border-rose-200', text: 'text-rose-800 font-bold' },
    void: { bg: 'bg-slate-50 border border-slate-200', text: 'text-slate-400' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
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
          <Plus className="w-3.5 h-3.5" />
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
          <span className="text-xs font-medium text-slate-500">UK Standard VAT (20%) Output</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {formatGBP(invoices.reduce((sum, i) => sum + i.vatAmount, 0))}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">HMRC VAT liability reserve</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice number or customer..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'issued', 'partially_paid', 'overdue', 'paid'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
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
                <th className="py-2.5 px-3">Invoice Number</th>
                <th className="py-2.5 px-3">Customer Client</th>
                <th className="py-2.5 px-3">Issue Date</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3 text-right">Total (GBP)</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const cust = customers.find((c) => c.id === inv.customerId);
                const st = statusBadgeMap[inv.status];

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
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
                          className="px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded font-semibold text-xs"
                        >
                          View Sheet
                        </button>

                        {inv.balanceDue > 0 && (
                          <button
                            onClick={() => handleOpenPayment(inv)}
                            className="px-2.5 py-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded font-semibold text-xs"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No invoices found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail / Printable Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                Invoice - {selectedInvoice.invoiceNumber}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document sheet */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs font-sans">
              
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
                  {customers.find((c) => c.id === selectedInvoice.customerId)?.name}
                </p>
                <p className="text-slate-600">
                  {customers.find((c) => c.id === selectedInvoice.customerId)?.billingAddress.line1}
                </p>
                <p className="text-slate-600">
                  {customers.find((c) => c.id === selectedInvoice.customerId)?.billingAddress.city},{' '}
                  {customers.find((c) => c.id === selectedInvoice.customerId)?.billingAddress.postcode}
                </p>
              </div>

              {/* Items table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Amount (GBP)</th>
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
                    <span>UK VAT ({selectedInvoice.vatRatePercent}%):</span>
                    <span className="font-mono">{formatGBP(selectedInvoice.vatAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Invoice Total:</span>
                    <span className="font-mono">{formatGBP(selectedInvoice.total)}</span>
                  </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount (£) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payingInvoice.balanceDue}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  You can enter a partial amount to record an instalment.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Reference / Bank Transaction ID *
                </label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. BACS-849102"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
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
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Confirm & Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

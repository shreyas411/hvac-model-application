import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, PaymentRecord } from '../../types';
import { formatGBP, formatDateUK, getTodayISO, joinParts, regLine } from '../../utils/formatters';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { IconCash, IconDownload, IconEye, IconPlus, IconPrinter, IconReceipt, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { DetailDrawer } from '../common/DetailDrawer';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { SortHead, useServerPaged } from '../common/Pager';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

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
    creditInvoice,
    currentUser,
    customerById,
    deleteRecord,
    confirmToast,
  } = useApp(['invoices', 'customers', 'settings', 'recordPayment', 'releaseRetention', 'creditInvoice', 'currentUser', 'customerById', 'deleteRecord', 'confirmToast']);

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

  const [crediting, setCrediting] = useState<Invoice | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const payingInvoice = invoices.find((i) => i.id === payingInvoiceId);

  const handleOpenPayment = (inv: Invoice) => {
    setPayingInvoiceId(inv.id);
    setPaymentAmount(inv.balanceDue.toFixed(2));
    setPaymentMethod('bacs');
    setPaymentReference(''); // a real bank reference, not an invented one
    setPaymentNotes('');
  };

  // bank/card payments have a transaction ID to reconcile against; cheque and cash may not
  const refRequired = paymentMethod === 'bacs' || paymentMethod === 'card';

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

  const handleConfirmCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crediting) return;
    setBusy(true);
    const ok = await creditInvoice(crediting.id, Number(creditAmount), creditReason.trim());
    setBusy(false);
    if (ok) setCrediting(null);
  };

  // Status and search (invoice number, notes, customer name) run on the server so paging covers the whole list
  const paged = useServerPaged<Invoice>('/invoices', { q: searchTerm.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter }, invoices);

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  const statusBadgeMap: Record<InvoiceStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-muted', text: 'text-foreground' },
    issued: { bg: 'bg-sky-50 border border-sky-200', text: 'text-sky-800' },
    partially_paid: { bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-800' },
    paid: { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-800' },
    overdue: { bg: 'bg-rose-50 border border-rose-200', text: 'text-rose-800 font-bold' },
    void: { bg: 'bg-muted/50 border border-border', text: 'text-muted-foreground' },
    credited: { bg: 'bg-violet-50 border border-violet-200', text: 'text-violet-800' },
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">
            Invoicing & Payment Ledger
          </h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'invoice' : 'invoices'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            UK VAT invoices, BACS bank reconciliations, partial payment tracking, and debtor ledgers
          </p>
        </div>

        <Button size="sm" onClick={() => onOpenQuickAction('invoice')} className="shrink-0">
          <IconPlus aria-hidden="true" />
          <span>New Invoice</span>
        </Button>
      </div>

      {/* Financial summary: one compact strip */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-xs">
        <span className="text-muted-foreground">Collected <strong className="ml-1 text-sm tabular-nums text-emerald-700">{formatGBP(totalPaid)}</strong></span>
        <span className="text-muted-foreground">Outstanding <strong className="ml-1 text-sm tabular-nums text-rose-700">{formatGBP(totalOutstanding)}</strong> <span className="text-rose-700">({invoices.filter((i) => i.status === 'overdue').length} overdue)</span></span>
        <span className="text-muted-foreground">VAT output <strong className="ml-1 text-sm tabular-nums text-foreground">{formatGBP(invoices.reduce((sum, i) => sum + i.vatAmount, 0))}</strong></span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search invoices" name="search" autoComplete="off" placeholder="Search invoice number or customer…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" aria-label="Invoice status" className="w-44 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['all', 'draft', 'issued', 'partially_paid', 'overdue', 'paid', 'credited', 'void'].map((st) => <SelectItem key={st} value={st} className="capitalize">{st === 'all' ? 'All statuses' : st.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || statusFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      {/* Invoices List Table */}
      <div style={{ '--table-offset': '22.5rem' } as React.CSSProperties}><TableCard footer={paged.pager}>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <SortHead paged={paged} by="invoiceNumber">Invoice Number</SortHead>
              <SortHead paged={paged} by="customer.name" className="hidden md:table-cell">Customer Client</SortHead>
              <SortHead paged={paged} by="issueDate" className="hidden md:table-cell">Issue Date</SortHead>
              <SortHead paged={paged} by="dueDate" className="hidden md:table-cell">Due Date</SortHead>
              <SortHead paged={paged} by="total" className="text-right hidden md:table-cell">Total (GBP)</SortHead>
              <SortHead paged={paged} by="balanceDue" className="text-right">Balance Due</SortHead>
              <SortHead paged={paged} by="status" className="hidden md:table-cell">Status</SortHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((inv) => {
              const cust = customerById.get(inv.customerId);
              const st = statusBadgeMap[inv.status];

              return (
                <TableRow key={inv.id}>
                  <TableCell className="tabular-nums font-semibold">
                    {inv.invoiceNumber}
                    {inv.stageLabel && <Badge variant="secondary" className="text-[10px] max-md:mt-1 max-md:flex max-md:w-fit md:ml-1.5">{inv.stageLabel} {inv.stagePercent}%</Badge>}
                    <span className="block max-w-[110px] truncate text-[11px] font-normal text-muted-foreground md:hidden">{cust?.name}</span>
                    <Badge variant="outline" className={`mt-1 flex w-fit capitalize md:hidden ${st.bg} ${st.text}`}>{inv.status.replace('_', ' ')}</Badge>
                  </TableCell>

                  <TableCell className="hidden md:table-cell max-w-[200px]">
                    <span className="font-semibold block truncate">{cust?.name}</span>
                    <span className="text-[11px] text-muted-foreground block truncate">{cust?.billingAddress.city}</span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell text-muted-foreground">{formatDateUK(inv.issueDate)}</TableCell>

                  <TableCell className="hidden md:table-cell">
                    <span className={inv.status === 'overdue' ? 'text-rose-700 font-bold' : 'text-muted-foreground'}>
                      {formatDateUK(inv.dueDate)}
                    </span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell text-right tabular-nums font-semibold">
                    {formatGBP(inv.total)}
                    <span className="text-[10px] text-muted-foreground block font-normal">
                      VAT {formatGBP(inv.vatAmount)}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums font-semibold">
                    <span className={inv.status === 'void' ? 'text-muted-foreground line-through' : inv.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                      {formatGBP(inv.balanceDue)}
                    </span>
                    {inv.amountPaid > 0 && (
                      <span className="text-[10px] text-emerald-700 block font-normal">
                        Paid {formatGBP(inv.amountPaid)}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={`capitalize ${st.bg} ${st.text}`}>{inv.status.replace('_', ' ')}</Badge>
                  </TableCell>

                  <TableCell>
                    <RowActions subject={inv.invoiceNumber} actions={[
                      { icon: IconEye, label: 'View', onClick: () => setSelectedInvoice(inv) },
                      { icon: IconCash, label: 'Record payment', tone: 'success', hidden: !(inv.balanceDue > 0 && !['draft', 'void', 'credited'].includes(inv.status)), onClick: () => handleOpenPayment(inv) },
                      { icon: IconTrash, label: 'Delete', destructive: true, hidden: !((inv.status === 'draft' || inv.status === 'void') && currentUser?.role === 'admin'),
                        onClick: () => confirmToast(`Delete ${inv.invoiceNumber}?`, () => void deleteRecord('invoices', inv.id, 'Invoice')) },
                    ]} />
                  </TableCell>
                </TableRow>
              );
            })}

            {paged.rows.length === 0 && !paged.loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-6"><EmptyState icon={IconReceipt}>No invoices found matching criteria.</EmptyState></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableCard></div>

      {/* Invoice Detail / Printable Drawer */}
      {selectedInvoice && (
        <DetailDrawer size="detail" onClose={() => setSelectedInvoice(null)} title={`Invoice - ${selectedInvoice.invoiceNumber}`} description="Printable invoice"
          footer={<>
            {currentUser.role !== 'technician' && !['draft', 'void', 'credited'].includes(selectedInvoice.status) && (
              <Button variant="outline" size="sm" onClick={() => { setCrediting(selectedInvoice); setCreditAmount(selectedInvoice.total.toFixed(2)); setCreditReason(''); }} className="mr-auto text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">Raise Credit Note</Button>
            )}
            <Button variant="outline" size="sm" onClick={(e) => downloadSheet(e.currentTarget, `${selectedInvoice.invoiceNumber}.pdf`)}><IconDownload aria-hidden="true" /><span>Download PDF</span></Button>
            <Button size="sm" onClick={(e) => printSheet(e.currentTarget)}><IconPrinter aria-hidden="true" /><span>Print Invoice</span></Button>
          </>}>
            {/* Document sheet */}
            <div data-pdf-sheet className="-m-5 p-8 space-y-6 text-xs font-sans">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-border pb-5">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{settings.companyName}</h2>
                  <p className="text-muted-foreground mt-1">{settings.addressLine1}</p>
                  <p className="text-muted-foreground">{joinParts([settings.city, settings.postcode], ', ')}</p>
                  <p className="text-muted-foreground tabular-nums mt-1">
                    {regLine(settings, true)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold tabular-nums text-foreground block">
                    {selectedInvoice.invoiceNumber}
                  </span>
                  {selectedInvoice.stageLabel && <span className="text-muted-foreground block">{selectedInvoice.stageLabel} - {selectedInvoice.stagePercent}% of quotation</span>}
                  <span className="text-muted-foreground block">Date: {formatDateUK(selectedInvoice.issueDate)}</span>
                  <span className="text-muted-foreground block">Due Date: {formatDateUK(selectedInvoice.dueDate)}</span>
                  <span className={`mt-2 inline-block px-2.5 py-0.5 rounded text-[11px] font-bold capitalize ${statusBadgeMap[selectedInvoice.status].bg} ${statusBadgeMap[selectedInvoice.status].text}`}>
                    {selectedInvoice.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Billed to */}
              <div>
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] block mb-1">
                  Billed To:
                </span>
                <p className="text-sm font-bold text-foreground">
                  {customerById.get(selectedInvoice.customerId)?.name}
                </p>
                <p className="text-muted-foreground">
                  {customerById.get(selectedInvoice.customerId)?.billingAddress.line1}
                </p>
                <p className="text-muted-foreground">
                  {customerById.get(selectedInvoice.customerId)?.billingAddress.city},{' '}
                  {customerById.get(selectedInvoice.customerId)?.billingAddress.postcode}
                </p>
              </div>

              {/* Items table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border font-semibold">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Description</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Quantity</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Unit Price</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Amount (GBP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedInvoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-foreground">{item.description}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatGBP(item.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-foreground">{formatGBP(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary and Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Bank details for BACS */}
                <div className="p-3.5 bg-muted/50 border border-border rounded-lg space-y-1 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground block">Bank Transfer (BACS) Details:</span>
                  <p>Bank: <strong>{settings.bankDetails.bankName}</strong></p>
                  <p>Account Name: <strong>{settings.bankDetails.accountName}</strong></p>
                  <p>Sort Code: <strong className="tabular-nums">{settings.bankDetails.sortCode}</strong></p>
                  <p>Account No: <strong className="tabular-nums">{settings.bankDetails.accountNumber}</strong></p>
                  <p>Payment Reference: <strong className="tabular-nums">{selectedInvoice.invoiceNumber}</strong></p>
                </div>

                {/* Subtotals & Balances */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="tabular-nums">{formatGBP(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{selectedInvoice.reverseCharge ? 'VAT (domestic reverse charge)' : `UK VAT (${selectedInvoice.vatRatePercent}%)`}:</span>
                    <span className="tabular-nums">{formatGBP(selectedInvoice.vatAmount)}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm text-foreground">
                    <span>Invoice Total:</span>
                    <span className="tabular-nums">{formatGBP(selectedInvoice.total)}</span>
                  </div>
                  {!!selectedInvoice.cisDeduction && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Less CIS deduction ({selectedInvoice.cisRatePercent}% of labour):</span>
                      <span className="tabular-nums">-{formatGBP(selectedInvoice.cisDeduction)}</span>
                    </div>
                  )}
                  {!!selectedInvoice.retentionHeld && (
                    <div className="flex justify-between text-muted-foreground items-center">
                      <span>
                        Retention held ({selectedInvoice.retentionPercent}%):{' '}
                        <Button variant="outline" size="xs" disabled={busy} aria-label={`Release retention on ${selectedInvoice.invoiceNumber}`} onClick={async () => { setBusy(true); const ok = await releaseRetention(selectedInvoice.id); setBusy(false); if (ok) setSelectedInvoice(null); }} className="ml-1 h-5 px-1.5 text-[10px] text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100 hover:text-sky-800">Release</Button>
                      </span>
                      <span className="tabular-nums">-{formatGBP(selectedInvoice.retentionHeld)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Total Amount Paid:</span>
                    <span className="tabular-nums">-{formatGBP(selectedInvoice.amountPaid)}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm text-rose-700">
                    <span>Balance Due:</span>
                    <span className="tabular-nums">{formatGBP(selectedInvoice.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Payment ledger history on this invoice */}
              {selectedInvoice.payments.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-bold text-foreground block">Recorded Payments History:</span>
                  <div className="border border-border rounded-lg divide-y divide-border text-[11px]">
                    {selectedInvoice.payments.map((p) => (
                      <div key={p.id} className="p-2 flex justify-between bg-emerald-50/50">
                        <span>
                          {formatDateUK(p.date)} · <strong className="uppercase">{p.method}</strong> · Ref: {p.reference} (by {p.recordedBy})
                        </span>
                        <span className="tabular-nums font-semibold text-emerald-800">
                          {formatGBP(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

        <p className="mt-10 text-[11px] text-muted-foreground">{settings.termsAndConditions}</p>
        </DetailDrawer>
      )}

      {/* Credit note drawer */}
      {crediting && (
        <DetailDrawer onClose={() => setCrediting(null)} title={<>Credit Note for {crediting.invoiceNumber}</>} description={<>Invoice total: {formatGBP(crediting.total)} (VAT inclusive). The amount can't exceed what's still creditable.</>}
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCrediting(null)}>Cancel</Button>
                <Button type="submit" form="crediting-form" size="sm" variant="destructive" disabled={busy}>Raise Credit Note</Button>
          </>}>
          <form id="crediting-form" onSubmit={handleConfirmCredit} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="credit-amt" className="text-xs">Credit amount (£) *</Label>
                <Input id="credit-amt" type="number" step="0.01" min="0.01" max={crediting.total} required inputMode="decimal" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-reason" className="text-xs">Reason *</Label>
                <Input id="credit-reason" required minLength={3} value={creditReason} onChange={(e) => setCreditReason(e.target.value)} />
              </div>
              </form>
        </DetailDrawer>
      )}

      {/* Record payment drawer */}
      {payingInvoice && (
        <DetailDrawer onClose={() => setPayingInvoiceId(null)} title={<>Record Payment for {payingInvoice.invoiceNumber}</>} description={<>Total: {formatGBP(payingInvoice.total)} · Outstanding: {formatGBP(payingInvoice.balanceDue)}</>}
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPayingInvoiceId(null)}>Cancel</Button>
                <Button type="submit" form="payingInvoice-form" size="sm" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">{busy ? 'Recording…' : 'Confirm & Reconcile'}</Button>
          </>}>
          <form id="payingInvoice-form" onSubmit={handleConfirmPayment} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="pay-amt" className="text-xs">Payment Amount (£) *</Label>
                <Input
                  type="number" step="0.01" min="0.01" max={payingInvoice.balanceDue} required
                  id="pay-amt" name="amount" inputMode="decimal" value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="tabular-nums"
                />
                <span className="text-[11px] text-muted-foreground block">
                  You can enter a partial amount to record an instalment.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-method" className="text-xs">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                  <SelectTrigger id="pay-method" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bacs">BACS Bank Transfer</SelectItem>
                    <SelectItem value="card">Debit / Credit Card</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-ref" className="text-xs">
                  {{ bacs: 'Bank Transaction ID', card: 'Card Transaction ID', cheque: 'Cheque Number', cash: 'Receipt Reference' }[paymentMethod]}
                  {refRequired ? ' *' : ' (optional)'}
                </Label>
                <Input
                  type="text" required={refRequired}
                  id="pay-ref" name="reference" autoComplete="off" spellCheck={false} value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={{ bacs: 'e.g. BACS-849102', card: 'e.g. last 4 digits or terminal ref', cheque: 'e.g. 001234', cash: 'e.g. receipt book number' }[paymentMethod]}
                  className="tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-notes" className="text-xs">Internal Notes</Label>
                <Input
                  type="text"
                  id="pay-notes" name="notes" autoComplete="off" value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cleared in Barclays account statement"
                />
              </div>

              </form>
        </DetailDrawer>
      )}

    </div>
  );
};

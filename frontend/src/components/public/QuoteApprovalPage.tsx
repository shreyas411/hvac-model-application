import React, { useEffect, useState } from 'react';
import { tierPrices } from '../../utils/formatters';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Toast, ToastState } from '../common/Toast';
import { SignaturePad } from '../technician/SignaturePad';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/src/components/ui/radio-group';
import { Label } from '@/src/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

const API = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/public/quotes`;
const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' });

type View = {
  quoteNumber: string; status: string; issueDate: string; expiryDate: string; companyName: string;
  items: { option?: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number; vatAmount: number; vatRatePercent: number; total: number; terms: string; acceptedBy?: string;
};

/** Customer-facing quote page opened from the emailed link; the token in the URL is the only credential. */
export const QuoteApprovalPage: React.FC<{ token: string }> = ({ token }) => {
  const [quote, setQuote] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [option, setOption] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let stale = false;
    fetch(`${API}/${token}`).then(async (r) => { const q = r.ok ? await r.json() : null; if (!stale) q ? setQuote(q) : setError('This quotation link is not valid.'); }, () => !stale && setError('Could not load the quotation.'));
    return () => { stale = true; };
  }, [token]);

  const decide = async (action: 'accept' | 'reject') => {
    setBusy(true);
    setError('');
    const res = await fetch(`${API}/${token}/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action === 'accept' ? { name, ...(option && { option }), ...(signature && { signature }) } : {}),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setQuote((q) => q && { ...q, status: action === 'accept' ? 'accepted' : 'rejected', acceptedBy: name });
    else setError((await res?.json().catch(() => null))?.detail ?? 'Something went wrong. Please try again.');
  };

  if (!quote) return <p role={error ? 'alert' : 'status'} className="p-8 text-center text-slate-600">{error || 'Loading…'}</p>;
  const prices = tierPrices(quote.items, quote.vatRatePercent);
  const tiers = prices.map((p) => p.name);
  const decided = quote.status === 'accepted' || quote.status === 'rejected';
  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-8 text-slate-900">
      <h1 className="text-2xl font-bold">Quotation {quote.quoteNumber}</h1>
      <p className="text-sm text-slate-500 mb-6">{quote.companyName} · valid until {day(quote.expiryDate)}</p>
      <Table className="w-full text-sm mb-4">
        <TableHeader><TableRow className="text-left border-b border-slate-200"><TableHead scope="col" className="py-2">Item</TableHead><TableHead scope="col">Qty</TableHead><TableHead scope="col" className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>{quote.items.map((i, n) => (
          <TableRow key={n} className="border-b border-slate-100"><TableCell className="py-2 whitespace-normal">{i.option && <b className="mr-1.5 text-sky-700">{i.option}</b>}{i.description}</TableCell><TableCell className="tabular-nums">{i.quantity}</TableCell><TableCell className="text-right tabular-nums">{gbp(i.amount)}</TableCell></TableRow>
        ))}</TableBody>
      </Table>
      {tiers.length > 0 && !decided && <p className="text-xs text-slate-500 mb-2">Each option's price is shown below; the totals underneath are the cheapest option and update once you accept.</p>}
      <div className="text-right text-sm space-y-1 mb-6 tabular-nums">
        <div>Subtotal {gbp(quote.subtotal)}</div><div>VAT ({quote.vatRatePercent}%) {gbp(quote.vatAmount)}</div>
        <div className="text-lg font-bold">Total {gbp(quote.total)}</div>
      </div>
      {quote.terms && <p className="text-xs text-slate-500 whitespace-pre-line mb-6">{quote.terms}</p>}
      {decided ? (
        <p role="status" className="p-4 rounded-lg bg-slate-100 font-semibold">
          {quote.status === 'accepted' ? `Accepted${quote.acceptedBy ? ` by ${quote.acceptedBy}` : ''}. Thank you, we will be in touch to book the work.` : 'You declined this quotation.'}
        </p>
      ) : (
        <section className="space-y-3">
          <Label className="block text-sm font-semibold">Your full name
            <Input name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </Label>
          {tiers.length > 0 && (
            <RadioGroup value={option} onValueChange={setOption} aria-label="Choose your option" className="gap-1 text-sm">
              <p className="font-semibold">Choose your option</p>
              {prices.map((p) => <Label key={p.name} className="gap-2 font-normal"><RadioGroupItem value={p.name} />{p.name} <span className="font-semibold">{gbp(p.total)}</span> inc. VAT</Label>)}
            </RadioGroup>
          )}
          <SignaturePad onChange={setSignature} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button size="lg" className="flex-1" disabled={busy || !name.trim() || (tiers.length > 0 && !option)} onClick={() => decide('accept')}><IconCheck className="w-4 h-4" aria-hidden="true" />{busy ? 'Sending…' : 'Accept Quotation'}</Button>
            <Button variant="outline" size="lg" disabled={busy} onClick={() => setToast({ text: 'Decline this quotation? This cannot be undone.', type: 'info', onConfirm: () => decide('reject') })}><IconX className="w-4 h-4" aria-hidden="true" /> Decline</Button>
          </div>
        </section>
      )}
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </main>
  );
};

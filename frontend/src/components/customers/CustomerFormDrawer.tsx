import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerType } from '../../types';
import { AddressInput } from '../common/AddressInput';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { DetailDrawer } from '../common/DetailDrawer';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/src/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';

interface CustomerFormDrawerProps {
  customer: Customer | null; // null = add
  onClose: () => void;
  onSaved?: (id: string) => void;
}

// Add/Edit customer side drawer; mounted fresh per open, so state initialises from `customer`.
export const CustomerFormDrawer: React.FC<CustomerFormDrawerProps> = ({ customer, onClose, onSaved }) => {
  const { addCustomer, updateCustomer, customers } = useApp(['addCustomer', 'updateCustomer', 'customers']);
  const [busy, setBusy] = useState(false); // guards double-submit
  const c = customer;
  const [formType, setFormType] = useState<CustomerType>(c?.type ?? 'residential');
  const [formName, setFormName] = useState(c?.name ?? '');
  const [formCompanyName, setFormCompanyName] = useState(c?.companyName ?? '');
  const [formPhone, setFormPhone] = useState(c?.phone ?? '');
  const [formEmail, setFormEmail] = useState(c?.email ?? '');
  const [formBillingLine1, setFormBillingLine1] = useState(c?.billingAddress.line1 ?? '');
  const [formBillingLine2, setFormBillingLine2] = useState(c?.billingAddress.line2 ?? '');
  const [formBillingCity, setFormBillingCity] = useState(c?.billingAddress.city ?? '');
  const [formBillingPostcode, setFormBillingPostcode] = useState(c?.billingAddress.postcode ?? '');
  const [formNotes, setFormNotes] = useState(c?.notes ?? '');
  const [formPref, setFormPref] = useState<'email' | 'sms' | 'both'>(c?.communicationPreference ?? 'email'); // SMS isn't delivered yet, so don't default to it
  const [formGdpr, setFormGdpr] = useState(c?.gdprConsent ?? false); // consent must be an affirmative tick, never pre-ticked

  const initial = useRef(JSON.stringify([formType, formName, formCompanyName, formPhone, formEmail, formBillingLine1, formBillingLine2, formBillingCity, formBillingPostcode, formNotes, formPref, formGdpr])).current;
  const dirty = !busy && initial !== JSON.stringify([formType, formName, formCompanyName, formPhone, formEmail, formBillingLine1, formBillingLine2, formBillingCity, formBillingPostcode, formNotes, formPref, formGdpr]);

  // An email identifies a customer: refuse a second active record with the same address (the server enforces it too).
  const duplicate = formEmail.trim() ? customers.find((x) => !x.archived && x.id !== customer?.id && x.email.toLowerCase() === formEmail.trim().toLowerCase()) : undefined;

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicate) return; // the message under the email field says why; the server refuses it too

    setBusy(true);
    let ok = true;
    if (customer) {
      ok = await updateCustomer(customer.id, {
        type: formType,
        name: formName,
        companyName: formType !== 'residential' ? formCompanyName : undefined,
        phone: formPhone,
        email: formEmail,
        billingAddress: {
          line1: formBillingLine1,
          line2: formBillingLine2 || undefined,
          city: formBillingCity,
          postcode: formBillingPostcode.toUpperCase(),
        },
        notes: formNotes,
        communicationPreference: formPref,
        gdprConsent: formGdpr,
      });
    } else {
      // Create new customer with primary service location
      const newCustomer = await addCustomer({
        type: formType,
        name: formName,
        companyName: formType !== 'residential' ? formCompanyName : undefined,
        phone: formPhone,
        email: formEmail,
        billingAddress: {
          line1: formBillingLine1,
          line2: formBillingLine2 || undefined,
          city: formBillingCity,
          postcode: formBillingPostcode.toUpperCase(),
        },
        serviceLocations: [
          {
            label: formType === 'commercial' ? 'Primary Site / HQ' : formType === 'landlord' ? 'Rental Property' : 'Main Residence',
            addressLine1: formBillingLine1,
            city: formBillingCity,
            postcode: formBillingPostcode.toUpperCase(),
            contactName: formName,
            contactPhone: formPhone,
          },
        ],
        notes: formNotes,
        communicationPreference: formPref,
        gdprConsent: formGdpr,
      });
      ok = !!newCustomer;
      if (newCustomer) onSaved?.(newCustomer.id);
    }

    setBusy(false);
    if (ok) onClose(); // stay open on failure so the form isn't lost
  };

  return (
    <DetailDrawer onClose={onClose} dirty={dirty} title={customer ? `Edit Customer (${customer.name})` : 'Add New Customer'} description={customer ? 'Edit customer details' : 'Enter the new customer details'}
      footer={<>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="customer-form" size="sm" disabled={busy}>{customer ? 'Update Customer' : 'Create Customer'}</Button>
      </>}>
        <form id="customer-form" onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <span id="cu-type" className="block font-semibold">Customer Type</span>
            <RadioGroup aria-labelledby="cu-type" value={formType} onValueChange={(v) => setFormType(v as CustomerType)} className="flex gap-4">
              {([['residential', 'Residential'], ['commercial', 'Commercial'], ['landlord', 'Landlord / Agent']] as const).map(([v, label]) => (
                <Label key={v} className="text-xs font-normal"><RadioGroupItem value={v} />{label}</Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-1" className="text-xs">Primary Contact Name *</Label>
            <Input id="cu-1" required name="name" autoComplete="off" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Dr. Alistair Finch or Nigel Edwards" />
          </div>

          {formType !== 'residential' && (
            <div className="space-y-1.5">
              <Label htmlFor="cu-2" className="text-xs">{formType === 'landlord' ? 'Company / Agency Name' : 'Company / Trading Name *'}</Label>
              <Input id="cu-2" required={formType === 'commercial'} name="company" autoComplete="off" value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} placeholder="e.g. Crown Hospitality Group Ltd" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cu-3" className="text-xs">Phone Number *</Label>
              <Input id="cu-3" type="tel" required name="phone" autoComplete="off" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. 020 8940 3392" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-4" className="text-xs">Email Address *</Label>
              <Input id="cu-4" type="email" required name="email" autoComplete="off" spellCheck={false} value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. client@example.co.uk" aria-invalid={!!duplicate} aria-describedby={duplicate ? 'cu-4-err' : undefined} />
              {duplicate && <p id="cu-4-err" role="alert" className="text-[11px] text-destructive"><strong>{duplicate.name}</strong> already uses this email. Open that customer instead of adding another.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-5" className="text-xs">Billing Street Address *</Label>
            <AddressInput id="cu-5" required name="line1" value={formBillingLine1} onChange={setFormBillingLine1}
              onPick={(a) => { setFormBillingLine1(a.line1); setFormBillingLine2(a.line2); setFormBillingCity(a.city); setFormBillingPostcode(a.postcode); }}
              placeholder="Start typing the address, e.g. 9 Heron Court" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-6" className="text-xs">Address Line 2</Label>
            <Input id="cu-6" name="line2" autoComplete="off" value={formBillingLine2} onChange={(e) => setFormBillingLine2(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cu-7" className="text-xs">City / Borough *</Label>
              <Input id="cu-7" required name="city" autoComplete="off" value={formBillingCity} onChange={(e) => setFormBillingCity(e.target.value)} placeholder="e.g. London / Surrey" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-8" className="text-xs">UK Postcode *</Label>
              <Input id="cu-8" required name="postcode" autoComplete="off" spellCheck={false} value={formBillingPostcode} onChange={(e) => setFormBillingPostcode(e.target.value)}
                pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" title="Enter a UK postcode, e.g. TW9 1NW" placeholder="e.g. TW9 1NW" className="tabular-nums uppercase" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-9" className="text-xs">Notes</Label>
            <Textarea id="cu-9" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-10" className="text-xs">Communication Preference</Label>
            <Select value={formPref} onValueChange={(v) => setFormPref(v as typeof formPref)}>
              <SelectTrigger id="cu-10" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email Only</SelectItem>
                <SelectItem value="both" disabled={formPref !== 'both'}>Both Email & SMS (SMS not available yet)</SelectItem>
                <SelectItem value="sms" disabled={formPref !== 'sms'}>SMS Only (not available yet)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Label className="pt-1 text-xs font-normal">
            <Checkbox checked={formGdpr} onCheckedChange={(v) => setFormGdpr(v === true)} />
            Customer consented to service communication (UK GDPR)
          </Label>
        </form>
    </DetailDrawer>
  );
};

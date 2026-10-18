import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerType } from '../../types';
import { useEscape } from '../../utils/useEscape';

interface CustomerFormModalProps {
  customer: Customer | null; // null = add
  onClose: () => void;
  onSaved?: (id: string) => void;
}

// Add/Edit customer dialog; mounted fresh per open, so state initialises from `customer`.
export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ customer, onClose, onSaved }) => {
  const { addCustomer, updateCustomer } = useApp(['addCustomer', 'updateCustomer']);
  const [busy, setBusy] = useState(false); // guards double-submit
  useEscape(true, onClose);
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
  const [formPref, setFormPref] = useState<'email' | 'sms' | 'both'>(c?.communicationPreference ?? 'both');
  const [formGdpr, setFormGdpr] = useState(c?.gdprConsent ?? false); // consent must be an affirmative tick, never pre-ticked

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    setBusy(true);
    let ok = true;
    if (customer) {
      ok = await updateCustomer(customer.id, {
        type: formType,
        name: formName,
        companyName: formType === 'commercial' ? formCompanyName : undefined,
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
        companyName: formType === 'commercial' ? formCompanyName : undefined,
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
            label: formType === 'commercial' ? 'Primary Site / HQ' : 'Main Residence',
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
    <div role="dialog" aria-modal="true" aria-label={customer ? 'Edit customer' : 'Add customer'} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            {customer ? `Edit Customer (${customer.name})` : 'Add New Customer'}
          </h3>
          <button
            onClick={() => onClose()}
            aria-label="Close" className="text-slate-400 hover:text-slate-600 p-1"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <form onSubmit={handleSaveCustomer} className="p-5 space-y-3 overflow-y-auto text-xs">
          <div>
            <span id="cu-type" className="block font-semibold text-slate-700 mb-1">Customer Type</span>
            <div role="radiogroup" aria-labelledby="cu-type" className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="custType"
                  checked={formType === 'residential'}
                  onChange={() => setFormType('residential')}
                />
                <span>Residential</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="custType"
                  checked={formType === 'commercial'}
                  onChange={() => setFormType('commercial')}
                />
                <span>Commercial</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="cu-1" className="block font-semibold text-slate-700 mb-1">Primary Contact Name *</label>
            <input id="cu-1"
              type="text"
              required
              name="name" autoComplete="off" value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Dr. Alistair Finch or Nigel Edwards"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {formType === 'commercial' && (
            <div>
              <label htmlFor="cu-2" className="block font-semibold text-slate-700 mb-1">Company / Trading Name *</label>
              <input id="cu-2"
                type="text"
                required
                name="company" autoComplete="off" value={formCompanyName}
                onChange={(e) => setFormCompanyName(e.target.value)}
                placeholder="e.g. Crown Hospitality Group Ltd"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cu-3" className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input id="cu-3"
                type="tel"
                required
                name="phone" autoComplete="off" value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. 020 8940 3392"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>
            <div>
              <label htmlFor="cu-4" className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input id="cu-4"
                type="email"
                required
                name="email" autoComplete="off" spellCheck={false} value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. client@example.co.uk"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cu-5" className="block font-semibold text-slate-700 mb-1">Billing Street Address</label>
            <input id="cu-5"
              type="text"
              required
              name="line1" autoComplete="off" value={formBillingLine1}
              onChange={(e) => setFormBillingLine1(e.target.value)}
              placeholder="e.g. 9 Heron Court, Richmond Green"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
            />
          </div>

          <div>
            <label htmlFor="cu-6" className="block font-semibold text-slate-700 mb-1">Address Line 2</label>
            <input id="cu-6"
              type="text"
              name="line2" autoComplete="off" value={formBillingLine2}
              onChange={(e) => setFormBillingLine2(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cu-7" className="block font-semibold text-slate-700 mb-1">City / Borough</label>
              <input id="cu-7"
                type="text"
                required
                name="city" autoComplete="off" value={formBillingCity}
                onChange={(e) => setFormBillingCity(e.target.value)}
                placeholder="e.g. London / Surrey"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>
            <div>
              <label htmlFor="cu-8" className="block font-semibold text-slate-700 mb-1">UK Postcode *</label>
              <input id="cu-8"
                type="text"
                required
                name="postcode" autoComplete="off" spellCheck={false} value={formBillingPostcode}
                onChange={(e) => setFormBillingPostcode(e.target.value)}
                placeholder="e.g. TW9 1NW"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cu-9" className="block font-semibold text-slate-700 mb-1">Notes</label>
            <textarea id="cu-9"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
            />
          </div>

          <div>
            <label htmlFor="cu-10" className="block font-semibold text-slate-700 mb-1">Communication Preference</label>
            <select id="cu-10"
              value={formPref}
              onChange={(e) => setFormPref(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
            >
              <option value="both">Both Email & SMS</option>
              <option value="email">Email Only</option>
              <option value="sms">SMS Only</option>
            </select>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={formGdpr}
              onChange={(e) => setFormGdpr(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-slate-700">Customer consented to service communication (UK GDPR)</span>
          </label>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy} className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-60"
            >
              {customer ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomFieldValues, Invoice } from '../../types';
import { useCustomFields } from '../../data/customFields';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { CustomFieldInputs } from '../common/CustomFields';
import { DetailDrawer } from '../common/DetailDrawer';

/** Edits the parts of an invoice that stay changeable once issued: notes and custom fields. Lines and VAT are fixed after drafting. Mounted fresh per open. */
export const InvoiceEditDrawer: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
  const { updateInvoice } = useApp(['updateInvoice']);
  const { active: defs } = useCustomFields('invoice');
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [custom, setCustom] = useState<CustomFieldValues>(invoice.customFields ?? {});
  const [busy, setBusy] = useState(false);
  const initial = useRef(JSON.stringify([notes, custom])).current;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await updateInvoice(invoice.id, { notes, customFields: custom });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <DetailDrawer onClose={onClose} dirty={!busy && initial !== JSON.stringify([notes, custom])} title={`Edit ${invoice.invoiceNumber}`} description="Notes and custom fields. Line items and VAT are fixed once an invoice is created"
      footer={<>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="invoice-edit-form" size="sm" disabled={busy}>Save Changes</Button>
      </>}>
      <form id="invoice-edit-form" onSubmit={save} className="space-y-3 text-xs">
        <div className="space-y-1.5">
          <Label htmlFor="ie-notes" className="text-xs">Notes</Label>
          <Textarea id="ie-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <CustomFieldInputs defs={defs} values={custom} onChange={setCustom} />
      </form>
    </DetailDrawer>
  );
};

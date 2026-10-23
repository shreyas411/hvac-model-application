import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomFieldValues, Priority, ServiceRequest } from '../../types';
import { useCustomFields } from '../../data/customFields';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { CustomFieldInputs } from '../common/CustomFields';
import { DetailDrawer } from '../common/DetailDrawer';

const SLOTS = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['all_day', 'All day'], ['urgent', 'Urgent']] as const;

/** Edit a request that has not been converted or cancelled; customer and site are fixed once logged. Mounted fresh per open. */
export const RequestEditDrawer: React.FC<{ request: ServiceRequest; onClose: () => void }> = ({ request: r, onClose }) => {
  const { updateServiceRequest } = useApp(['updateServiceRequest']);
  const { active: defs } = useCustomFields('request');
  const [problem, setProblem] = useState(r.reportedProblem);
  const [priority, setPriority] = useState<Priority>(r.priority);
  const [slot, setSlot] = useState(r.preferredSlot);
  const [person, setPerson] = useState(r.contactPerson ?? '');
  const [phone, setPhone] = useState(r.contactPhone ?? '');
  const [notes, setNotes] = useState(r.internalNotes ?? '');
  const [custom, setCustom] = useState<CustomFieldValues>(r.customFields ?? {});
  const [busy, setBusy] = useState(false);
  const state = () => JSON.stringify([problem, priority, slot, person, phone, notes, custom]);
  const initial = useRef(state()).current;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await updateServiceRequest(r.id, { reportedProblem: problem, priority, preferredSlot: slot, contactPerson: person, contactPhone: phone, internalNotes: notes, customFields: custom });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <DetailDrawer onClose={onClose} dirty={!busy && initial !== state()} title={`Edit ${r.requestNumber}`} description="Customer and site can't be changed once logged"
      footer={<>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="request-edit-form" size="sm" disabled={busy}>Save Changes</Button>
      </>}>
      <form id="request-edit-form" onSubmit={save} className="space-y-3 text-xs">
        <div className="space-y-1.5">
          <Label htmlFor="re-problem" className="text-xs">Reported problem *</Label>
          <Textarea id="re-problem" required rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="re-priority" className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger id="re-priority" className="w-full capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{(['low', 'medium', 'high', 'emergency'] as const).map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-slot" className="text-xs">Preferred slot</Label>
            <Select value={slot} onValueChange={(v) => setSlot(v as typeof slot)}>
              <SelectTrigger id="re-slot" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{SLOTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="re-person" className="text-xs">Contact person</Label>
            <Input id="re-person" autoComplete="off" value={person} onChange={(e) => setPerson(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-phone" className="text-xs">Contact phone</Label>
            <Input id="re-phone" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="re-notes" className="text-xs">Internal notes</Label>
          <Textarea id="re-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <CustomFieldInputs defs={defs} values={custom} onChange={setCustom} />
      </form>
    </DetailDrawer>
  );
};

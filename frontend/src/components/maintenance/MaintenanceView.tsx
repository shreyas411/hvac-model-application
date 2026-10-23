import React, { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { services, type BulkResults } from '../../services';
import { MaintenanceAgreement, CustomFieldValues } from '../../types';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { formatDateUK, formatGBP } from '../../utils/formatters';
import { IconCalendarRepeat, IconEye, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { BulkBar, SelectAllHead, SelectCell, useRowSelection } from '../common/BulkSelect';
import { Combobox } from '../common/Combobox';
import { DatePicker } from '../common/DatePicker';
import { DetailDrawer } from '../common/DetailDrawer';
import { CustomFieldInputs } from '../common/CustomFields';
import { useCustomFields } from '../../data/customFields';
import { RecordDetails } from '../common/RecordDetails';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tip } from '@/src/components/common/Tip';

const FREQ: MaintenanceAgreement['frequency'][] = ['quarterly', 'biannual', 'annual'];
const blank = { customerId: '', locationId: '', equipmentId: '', frequency: 'annual' as MaintenanceAgreement['frequency'], nextDueDate: '', notes: '', annualPrice: '', endDate: '', slaResponseHours: '', autoInvoice: false, autoRenew: false };
const input = 'w-full sm:w-auto h-8 text-xs';
const full = '[&>span]:flex [&_button:first-child]:flex-1';

/** Labelled Select; an empty `value` shows the placeholder. */
const Pick: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][]; required?: boolean; disabled?: boolean; className?: string }> = ({ label, value, onChange, placeholder, options, required, disabled, className }) => (
  <Select value={value} onValueChange={onChange} required={required} disabled={disabled}>
    <SelectTrigger aria-label={label} size="sm" className={`w-full sm:w-auto text-xs ${className ?? ''}`}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
  </Select>
);

/** Recurring preventive-maintenance contracts; the daily sweep raises a job when one falls due. */
export const MaintenanceView: React.FC = () => {
  const { showToast, confirmToast, customers, equipment, currentUser, customerById } = useApp(['showToast', 'confirmToast', 'customers', 'equipment', 'currentUser', 'customerById']);
  const canWrite = currentUser.role === 'admin' || currentUser.role === 'dispatcher';
  const [rows, setRows] = useState<MaintenanceAgreement[]>([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [custom, setCustom] = useState<CustomFieldValues>({});
  const [viewing, setViewing] = useState<MaintenanceAgreement | null>(null);
  const { active: customDefs } = useCustomFields('maintenance');
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [freqFilter, setFreqFilter] = useState('all');
  const put = (k: keyof typeof blank, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === 'customerId' && { locationId: '', equipmentId: '' }), ...(k === 'locationId' && { equipmentId: '' }) }));
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => put(k, e.target.value);

  const reload = useCallback(() => services.maintenance.list().then(setRows).catch((e) => showToast(e.message ?? 'Could not load agreements', 'error')), []);
  useEffect(() => { void reload(); }, [reload]);
  // resolves true on success so the form is only cleared when the save worked
  const run = (p: Promise<unknown>) => p.then(reload).then(() => true, (e) => { showToast(e.message ?? 'Request failed', 'error'); return false; });

  const customer = customerById.get(form.customerId);
  const name = (r: MaintenanceAgreement) => {
    const c = customerById.get(r.customerId);
    return [c?.name ?? 'Unknown customer', c?.serviceLocations.find((l) => l.id === r.locationId)?.label].filter(Boolean).join(' · ');
  };
  const assetName = (id?: string | null) => { const e = equipment.find((x) => x.id === id); return e ? `${e.brand} ${e.model}` : 'All equipment at site'; };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const { equipmentId, notes, annualPrice, endDate, slaResponseHours, ...rest } = form;
    const body = { ...rest, equipmentId: equipmentId || null, notes: notes.trim(), annualPrice: Number(annualPrice) || 0, endDate: endDate || null, slaResponseHours: slaResponseHours ? Number(slaResponseHours) : null, customFields: custom };
    if (!form.customerId || !form.locationId || !form.nextDueDate) return showToast('Pick the customer, site and first visit date.', 'error');
    void run(editId ? services.maintenance.update(editId, body) : services.maintenance.create(body)).then((ok) => ok && cancel());
  };
  const cancel = () => { setEditId(null); setForm(blank); setCustom({}); setOpen(false); };
  const startEdit = (r: MaintenanceAgreement) => {
    setEditId(r.id);
    setOpen(true);
    setCustom(r.customFields ?? {});
    setForm({ customerId: r.customerId, locationId: r.locationId, equipmentId: r.equipmentId ?? '', frequency: r.frequency, nextDueDate: r.nextDueDate.slice(0, 10), notes: r.notes ?? '',
      annualPrice: r.annualPrice ? String(r.annualPrice) : '', endDate: r.endDate?.slice(0, 10) ?? '', slaResponseHours: r.slaResponseHours ? String(r.slaResponseHours) : '', autoInvoice: r.autoInvoice, autoRenew: r.autoRenew });
  };
  const today = new Date().toISOString().slice(0, 10);
  const shown = rows.filter((r) => (freqFilter === 'all' || r.frequency === freqFilter) && (!searchTerm.trim() || `${name(r)} ${assetName(r.equipmentId)} ${r.notes ?? ''}`.toLowerCase().includes(searchTerm.trim().toLowerCase())));

  const sel = useRowSelection(shown);
  const [busy, setBusy] = useState(false);
  // One bulk request; the server validates each agreement and reports the ones it skipped.
  const bulk = async (verb: string, call: (ids: string[]) => Promise<BulkResults>) => {
    const rows = sel.selected;
    let bad: string[];
    setBusy(true);
    try {
      bad = (await call(rows.map((r) => r.id))).results.filter((r) => !r.ok).map((r) => `${name(rows.find((x) => x.id === r.id)!)}: ${r.error?.message}`);
    } catch (e) { bad = rows.map((r) => `${name(r)}: ${(e as Error).message}`); }
    await reload();
    setBusy(false);
    sel.clear();
    if (bad.length) showToast(`${rows.length - bad.length} of ${rows.length} ${verb}. Skipped: ${bad.join('; ')}`, 'error');
    else showToast(`${rows.length} agreement${rows.length === 1 ? '' : 's'} ${verb}`);
  };
  const setActive = (active: boolean) => bulk(active ? 'activated' : 'paused', (ids) => services.maintenance.bulkSetActive(ids, active));

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      {canWrite && (
        <BulkBar count={sel.selected.length} onClear={sel.clear}>
          <Button type="button" size="xs" variant="secondary" disabled={busy} onClick={() => void setActive(true)}><IconPlayerPlay aria-hidden="true" />Activate</Button>
          <Button type="button" size="xs" variant="secondary" disabled={busy} onClick={() => void setActive(false)}><IconPlayerPause aria-hidden="true" />Pause</Button>
          <Button type="button" size="xs" variant="destructive" disabled={busy} onClick={() => confirmToast(`Delete ${sel.selected.length} agreement${sel.selected.length === 1 ? '' : 's'}?`, () => void bulk('deleted', services.maintenance.bulkDelete), { confirmLabel: 'Delete' })}><IconTrash aria-hidden="true" />Delete {sel.selected.length}</Button>
        </BulkBar>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">Maintenance Agreements</h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${shown.length} ${shown.length === 1 ? 'agreement' : 'agreements'}`}>{shown.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">A job is raised automatically as each agreement's next due date approaches.</p>
        </div>
        {canWrite && <Button size="sm" onClick={() => { setEditId(null); setForm(blank); setOpen(true); }} className="shrink-0"><IconPlus aria-hidden="true" />Add Agreement</Button>}
      </div>

      {open && canWrite && (
        <DetailDrawer onClose={cancel} dirty={!!form.customerId} title={editId ? 'Edit Agreement' : 'Add Agreement'} description="Recurring preventive-maintenance contract"
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
            <Button type="submit" form="agreement-form" size="sm">{editId ? 'Save' : <><IconPlus aria-hidden="true" /> Add</>}</Button>
          </>}>
          <form id="agreement-form" onSubmit={add} className="space-y-3 text-xs">
            <div className="space-y-1.5"><span className="font-semibold">Customer *</span>
              <Combobox value={form.customerId} onChange={(v) => put('customerId', v)} placeholder="Customer…" searchPlaceholder="Search customers…" options={customers.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name, hint: c.type }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><span className="font-semibold">Site *</span>
                <Pick label="Site" required disabled={!customer} value={form.locationId} onChange={(v) => put('locationId', v)} placeholder="Site…" className="sm:w-full" options={(customer?.serviceLocations ?? []).map((l) => [l.id, l.label])} /></div>
              <div className="space-y-1.5"><span className="font-semibold">Equipment</span>
                <Pick label="Equipment" disabled={!form.locationId} value={form.equipmentId || 'all'} onChange={(v) => put('equipmentId', v === 'all' ? '' : v)} placeholder="All equipment at site" className="sm:w-full" options={[['all', 'All equipment at site'], ...equipment.filter((q) => q.locationId === form.locationId).map((q): [string, string] => [q.id, `${q.brand} ${q.model}`])]} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><span className="font-semibold">Frequency</span>
                <Pick label="Frequency" value={form.frequency} onChange={(v) => put('frequency', v)} placeholder="Frequency" className="sm:w-full capitalize" options={FREQ.map((f) => [f, f[0].toUpperCase() + f.slice(1)])} /></div>
              <div className="space-y-1.5"><span className="font-semibold">Annual price</span><Input type="number" min="0" step="0.01" value={form.annualPrice} onChange={set('annualPrice')} placeholder="£" aria-label="Annual price" className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><span className="font-semibold">First visit due *</span>
                <div className={full}><DatePicker value={form.nextDueDate} min={editId ? undefined : today} onChange={(v) => put('nextDueDate', v)} /></div></div>
              <div className="space-y-1.5"><span className="font-semibold">Term end</span><div className={full}><DatePicker clearable value={form.endDate} onChange={(v) => put('endDate', v)} /></div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><span className="font-semibold">SLA response (hours)</span><Input type="number" min="1" value={form.slaResponseHours} onChange={set('slaResponseHours')} aria-label="SLA response hours" className="h-8 text-xs" /></div>
              <div className="space-y-2 pt-5">
              <Label className="text-xs font-normal"><Checkbox checked={form.autoInvoice} onCheckedChange={(v) => put('autoInvoice', v === true)} /> Auto-invoice visits</Label>
              <Label className="text-xs font-normal"><Checkbox checked={form.autoRenew} onCheckedChange={(v) => put('autoRenew', v === true)} /> Auto-renew term</Label>
              </div>
            </div>
            <Input aria-label="Notes" autoComplete="off" value={form.notes} onChange={set('notes')} placeholder="Notes…" className="h-8 text-xs" />
            <CustomFieldInputs defs={customDefs} values={custom} onChange={setCustom} />
          </form>
        </DetailDrawer>
      )}

      {viewing && (
        <RecordDetails title="Maintenance agreement" description={name(viewing)} defs={customDefs} values={viewing.customFields} onClose={() => setViewing(null)}
          onEdit={canWrite ? () => { startEdit(viewing); setViewing(null); } : undefined}
          rows={[['Equipment', assetName(viewing.equipmentId)], ['Frequency', viewing.frequency], ['Next due', formatDateUK(viewing.nextDueDate)], ['Term end', viewing.endDate && formatDateUK(viewing.endDate)],
            ['Annual price', viewing.annualPrice > 0 ? formatGBP(viewing.annualPrice) : undefined], ['SLA response', viewing.slaResponseHours && `${viewing.slaResponseHours} hours`],
            ['Auto-invoice', viewing.autoInvoice ? 'Yes' : 'No'], ['Auto-renew', viewing.autoRenew ? 'Yes' : 'No'], ['Status', viewing.active ? 'Active' : 'Inactive'], ['Notes', viewing.notes]]} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search agreements" autoComplete="off" placeholder="Search customer, site, equipment…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger size="sm" aria-label="Frequency" className="w-40 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {FREQ.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || freqFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setFreqFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      <div style={{ '--table-offset': '15rem' } as React.CSSProperties}>
        <TableCard>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {canWrite && <SelectAllHead sel={sel} label="agreements" />}
                <TableHead className="px-3">Customer · Site</TableHead>
                <TableHead className="hidden md:table-cell px-3">Equipment</TableHead>
                <TableHead className="px-3">Frequency</TableHead>
                <TableHead className="px-3">Next due</TableHead>
                <TableHead className="px-3">Active</TableHead>
                <TableHead className="px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} data-state={sel.has(r.id) ? 'selected' : undefined} className={r.active ? '' : 'text-muted-foreground'}>
                  {canWrite && <SelectCell sel={sel} row={r} label={name(r)} />}
                  <TableCell className="px-3 py-3 max-w-[320px]">
                    <span className="font-medium block truncate">{name(r)}</span>
                    {(r.annualPrice > 0 || r.endDate || r.slaResponseHours) && (
                      <span className="block text-[11px] text-muted-foreground">
                        {[r.annualPrice > 0 && `£${r.annualPrice}/yr${r.autoInvoice ? ' auto-invoiced' : ''}`, r.endDate && `${r.autoRenew ? 'renews' : 'ends'} ${r.endDate.slice(0, 10)}`, r.slaResponseHours && `SLA ${r.slaResponseHours}h`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {r.notes && <Tip label={r.notes}><span className="block text-[11px] text-muted-foreground truncate">{r.notes}</span></Tip>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3">{assetName(r.equipmentId)}</TableCell>
                  <TableCell className="px-3 py-3 capitalize">{r.frequency}</TableCell>
                  <TableCell className={`px-3 py-3 ${r.active && r.nextDueDate.slice(0, 10) < today ? 'text-destructive font-semibold' : ''}`}>
                    {canWrite ? <DatePicker value={r.nextDueDate.slice(0, 10)} onChange={(v) => v !== r.nextDueDate.slice(0, 10) && void run(services.maintenance.update(r.id, { nextDueDate: v }))} /> : r.nextDueDate.slice(0, 10)}
                  </TableCell>
                  <TableCell className="px-3 py-3"><Checkbox aria-label={`Active, ${name(r)}`} checked={r.active} disabled={!canWrite} onCheckedChange={(v) => void run(services.maintenance.update(r.id, { active: v === true }))} /></TableCell>
                  <TableCell className="px-3 py-3">
                    <RowActions subject={name(r)} actions={[
                      { icon: IconEye, label: 'View', onClick: () => setViewing(r) },
                      { icon: IconPencil, label: 'Edit', hidden: !canWrite, onClick: () => startEdit(r) },
                      { icon: IconTrash, label: 'Delete', destructive: true, hidden: !canWrite, onClick: () => confirmToast('Delete this agreement?', () => void run(services.maintenance.remove(r.id))) },
                    ]} />
                  </TableCell>
                </TableRow>
              ))}
              {!shown.length && <TableRow><TableCell colSpan={canWrite ? 7 : 6} className="py-6"><EmptyState icon={IconCalendarRepeat}>{rows.length ? 'No agreements match your filters.' : 'No agreements yet.'}</EmptyState></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
};

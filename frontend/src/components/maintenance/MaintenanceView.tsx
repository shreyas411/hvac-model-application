import React, { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { services } from '../../services';
import { MaintenanceAgreement } from '../../types';
import { IconCalendarRepeat, IconCalendarTime, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

const FREQ: MaintenanceAgreement['frequency'][] = ['quarterly', 'biannual', 'annual'];
const blank = { customerId: '', locationId: '', equipmentId: '', frequency: 'annual' as MaintenanceAgreement['frequency'], nextDueDate: '', notes: '', annualPrice: '', endDate: '', slaResponseHours: '', autoInvoice: false, autoRenew: false };
const input = 'w-full sm:w-auto border border-slate-300 rounded-md px-2 py-2 bg-white';

/** Recurring preventive-maintenance contracts; the daily sweep raises a job when one falls due. */
export const MaintenanceView: React.FC = () => {
  const { showToast, confirmToast, customers, equipment, currentUser, customerById } = useApp(['showToast', 'confirmToast', 'customers', 'equipment', 'currentUser', 'customerById']);
  const canWrite = currentUser.role === 'admin' || currentUser.role === 'dispatcher';
  const [rows, setRows] = useState<MaintenanceAgreement[]>([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value, ...(k === 'customerId' && { locationId: '', equipmentId: '' }), ...(k === 'locationId' && { equipmentId: '' }) }));

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
    const body = { ...rest, equipmentId: equipmentId || null, notes: notes.trim(), annualPrice: Number(annualPrice) || 0, endDate: endDate || null, slaResponseHours: slaResponseHours ? Number(slaResponseHours) : null };
    void run(editId ? services.maintenance.update(editId, body) : services.maintenance.create(body)).then((ok) => ok && cancel());
  };
  const cancel = () => { setEditId(null); setForm(blank); };
  const startEdit = (r: MaintenanceAgreement) => {
    setEditId(r.id);
    setForm({ customerId: r.customerId, locationId: r.locationId, equipmentId: r.equipmentId ?? '', frequency: r.frequency, nextDueDate: r.nextDueDate.slice(0, 10), notes: r.notes ?? '',
      annualPrice: r.annualPrice ? String(r.annualPrice) : '', endDate: r.endDate?.slice(0, 10) ?? '', slaResponseHours: r.slaResponseHours ? String(r.slaResponseHours) : '', autoInvoice: r.autoInvoice, autoRenew: r.autoRenew });
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5 w-full px-4 sm:px-6 py-4">
      <div className="flex items-center gap-2">
        <IconCalendarTime className="w-5 h-5 text-sky-700" aria-hidden="true" />
        <h1 className="text-lg font-bold text-slate-900">Maintenance Agreements</h1>
      </div>
      <p className="text-xs text-slate-500">A job is raised automatically as each agreement's next due date approaches.</p>

      {canWrite && (
        <form onSubmit={add} className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3 text-xs">
          <select aria-label="Customer" required value={form.customerId} onChange={set('customerId')} className={input}>
            <option value="">Customer…</option>
            {customers.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Site" required value={form.locationId} onChange={set('locationId')} disabled={!customer} className={input}>
            <option value="">Site…</option>
            {customer?.serviceLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <select aria-label="Equipment" value={form.equipmentId} onChange={set('equipmentId')} disabled={!form.locationId} className={input}>
            <option value="">All equipment at site</option>
            {equipment.filter((q) => q.locationId === form.locationId).map((q) => <option key={q.id} value={q.id}>{q.brand} {q.model}</option>)}
          </select>
          <select aria-label="Frequency" value={form.frequency} onChange={set('frequency')} className={`${input} capitalize`}>
            {FREQ.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input required type="date" min={editId ? undefined : today} value={form.nextDueDate} onChange={set('nextDueDate')} aria-label="Next due date" className={input} />
          <input type="number" min="0" step="0.01" value={form.annualPrice} onChange={set('annualPrice')} placeholder="Annual price £" aria-label="Annual price" className={`w-36 ${input}`} />
          <input type="date" value={form.endDate} onChange={set('endDate')} aria-label="Term end date" title="Term end" className={input} />
          <input type="number" min="1" value={form.slaResponseHours} onChange={set('slaResponseHours')} placeholder="SLA hours" aria-label="SLA response hours" className={`w-28 ${input}`} />
          <label className="flex items-center gap-1 self-center"><input type="checkbox" checked={form.autoInvoice} onChange={set('autoInvoice')} /> Auto-invoice visits</label>
          <label className="flex items-center gap-1 self-center"><input type="checkbox" checked={form.autoRenew} onChange={set('autoRenew')} /> Auto-renew term</label>
          <input aria-label="Notes" autoComplete="off" value={form.notes} onChange={set('notes')} placeholder="Notes…" className={`flex-1 sm:min-w-48 ${input}`} />
          <button type="submit" className="flex items-center justify-center gap-1 px-3 py-2 w-full sm:w-auto rounded-md bg-sky-700 text-white font-semibold">
            {editId ? 'Save' : <><IconPlus className="w-3.5 h-3.5" aria-hidden="true" /> Add</>}
          </button>
          {editId && <button type="button" aria-label="Cancel edit" onClick={cancel} className="text-slate-400 self-center p-1"><IconX className="w-4 h-4" aria-hidden="true" /></button>}
        </form>
      )}

      <section className="bg-white border border-slate-200 rounded-xl">
        <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_9rem_3rem_4.5rem] gap-3 p-3 text-xs text-slate-500 border-b border-slate-200">
          <span>Customer · Site</span><span>Equipment</span><span>Frequency</span><span>Next due</span><span>Active</span><span />
        </div>
        <ul className="divide-y divide-slate-100 text-xs">
          {rows.map((r) => (
            <li key={r.id} className={`grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_9rem_3rem_4.5rem] gap-x-3 gap-y-2 p-3 items-center ${r.active ? '' : 'text-slate-400'}`}>
              <div className="col-span-2 md:col-span-1 min-w-0 font-medium">
                {name(r)}
                {(r.annualPrice > 0 || r.endDate || r.slaResponseHours) && (
                  <div className="font-normal text-slate-400">
                    {[r.annualPrice > 0 && `£${r.annualPrice}/yr${r.autoInvoice ? ' auto-invoiced' : ''}`, r.endDate && `${r.autoRenew ? 'renews' : 'ends'} ${r.endDate.slice(0, 10)}`, r.slaResponseHours && `SLA ${r.slaResponseHours}h`].filter(Boolean).join(' · ')}
                  </div>
                )}
                {r.notes && <div title={r.notes} className="font-normal text-slate-400 truncate">{r.notes}</div>}
              </div>
              <div className="min-w-0"><span className="md:hidden block text-[10px] uppercase text-slate-400">Equipment</span>{assetName(r.equipmentId)}</div>
              <div className="capitalize"><span className="md:hidden block text-[10px] uppercase text-slate-400">Frequency</span>{r.frequency}</div>
              <div className={r.active && r.nextDueDate.slice(0, 10) < today ? 'text-red-600 font-semibold' : ''}>
                <span className="md:hidden block text-[10px] uppercase text-slate-400">Next due</span>
                {canWrite ? (
                  <input type="date" defaultValue={r.nextDueDate.slice(0, 10)} aria-label={`Next due date, ${name(r)}`} className="border border-slate-300 rounded-md px-1 py-1 bg-white text-slate-900"
                    onBlur={(e) => e.target.value && e.target.value !== r.nextDueDate.slice(0, 10) && void run(services.maintenance.update(r.id, { nextDueDate: e.target.value }))} />
                ) : r.nextDueDate.slice(0, 10)}
              </div>
              <div><span className="md:hidden block text-[10px] uppercase text-slate-400">Active</span><input type="checkbox" aria-label={`Active, ${name(r)}`} checked={r.active} disabled={!canWrite} onChange={(e) => void run(services.maintenance.update(r.id, { active: e.target.checked }))} /></div>
              {canWrite && (
                <div className="col-span-2 md:col-span-1 flex justify-end gap-3">
                  <button type="button" aria-label={`Edit agreement, ${name(r)}`} onClick={() => startEdit(r)} className="text-slate-400 hover:text-sky-700 p-1"><IconPencil className="w-4 h-4" aria-hidden="true" /></button>
                  <button type="button" aria-label={`Delete agreement, ${name(r)}`} onClick={() => confirmToast('Delete this agreement?', () => void run(services.maintenance.remove(r.id)))} className="text-slate-400 hover:text-red-600 p-1"><IconTrash className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              )}
            </li>
          ))}
          {!rows.length && <li className="px-3"><EmptyState icon={IconCalendarRepeat} compact>No agreements yet.</EmptyState></li>}
        </ul>
      </section>
    </div>
  );
};

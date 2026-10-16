import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { services } from '../../services';
import { MaintenanceAgreement } from '../../types';
import { CalendarClock, Pencil, Plus, Trash2, X } from 'lucide-react';

const FREQ: MaintenanceAgreement['frequency'][] = ['quarterly', 'biannual', 'annual'];
const blank = { customerId: '', locationId: '', equipmentId: '', frequency: 'annual' as MaintenanceAgreement['frequency'], nextDueDate: '', notes: '' };
const input = 'w-full sm:w-auto border border-slate-300 rounded-md px-2 py-2 bg-white';

/** Recurring preventive-maintenance contracts; the daily sweep raises a job when one falls due. */
export const MaintenanceView: React.FC = () => {
  const { showToast, customers, equipment, currentUser } = useApp();
  const canWrite = currentUser.role === 'admin' || currentUser.role === 'dispatcher';
  const [rows, setRows] = useState<MaintenanceAgreement[]>([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'customerId' && { locationId: '', equipmentId: '' }), ...(k === 'locationId' && { equipmentId: '' }) }));

  const reload = useCallback(() => services.maintenance.list().then(setRows).catch(() => {}), []);
  useEffect(() => { void reload(); }, [reload]);
  const run = (p: Promise<unknown>) => p.then(reload, (e) => showToast(e.message ?? 'Request failed', 'error'));

  const customer = customers.find((c) => c.id === form.customerId);
  const name = (r: MaintenanceAgreement) => {
    const c = customers.find((x) => x.id === r.customerId);
    return [c?.name ?? 'Unknown customer', c?.serviceLocations.find((l) => l.id === r.locationId)?.label].filter(Boolean).join(' · ');
  };
  const assetName = (id?: string | null) => { const e = equipment.find((x) => x.id === id); return e ? `${e.brand} ${e.model}` : 'All equipment at site'; };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const { equipmentId, notes, ...rest } = form;
    const body = { ...rest, equipmentId: equipmentId || null, notes: notes.trim() };
    void run(editId ? services.maintenance.update(editId, body) : services.maintenance.create(body)).then(cancel);
  };
  const cancel = () => { setEditId(null); setForm(blank); };
  const startEdit = (r: MaintenanceAgreement) => {
    setEditId(r.id);
    setForm({ customerId: r.customerId, locationId: r.locationId, equipmentId: r.equipmentId ?? '', frequency: r.frequency, nextDueDate: r.nextDueDate.slice(0, 10), notes: r.notes ?? '' });
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5 w-full px-4 sm:px-6 py-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-sky-700" />
        <h1 className="text-lg font-bold text-slate-900">Maintenance Agreements</h1>
      </div>
      <p className="text-xs text-slate-500">A job is raised automatically as each agreement's next due date approaches.</p>

      {canWrite && (
        <form onSubmit={add} className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3 text-xs">
          <select required value={form.customerId} onChange={set('customerId')} className={input}>
            <option value="">Customer…</option>
            {customers.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select required value={form.locationId} onChange={set('locationId')} disabled={!customer} className={input}>
            <option value="">Site…</option>
            {customer?.serviceLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <select value={form.equipmentId} onChange={set('equipmentId')} disabled={!form.locationId} className={input}>
            <option value="">All equipment at site</option>
            {equipment.filter((q) => q.locationId === form.locationId).map((q) => <option key={q.id} value={q.id}>{q.brand} {q.model}</option>)}
          </select>
          <select value={form.frequency} onChange={set('frequency')} className={`${input} capitalize`}>
            {FREQ.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input required type="date" min={editId ? undefined : today} value={form.nextDueDate} onChange={set('nextDueDate')} aria-label="Next due date" className={input} />
          <input value={form.notes} onChange={set('notes')} placeholder="Notes" className={`flex-1 sm:min-w-48 ${input}`} />
          <button type="submit" className="flex items-center justify-center gap-1 px-3 py-2 w-full sm:w-auto rounded-md bg-sky-700 text-white font-semibold">
            {editId ? 'Save' : <><Plus className="w-3.5 h-3.5" /> Add</>}
          </button>
          {editId && <button type="button" aria-label="Cancel edit" onClick={cancel} className="text-slate-400 self-center p-1"><X className="w-4 h-4" /></button>}
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
                {r.notes && <div title={r.notes} className="font-normal text-slate-400 truncate">{r.notes}</div>}
              </div>
              <div className="min-w-0"><span className="md:hidden block text-[10px] uppercase text-slate-400">Equipment</span>{assetName(r.equipmentId)}</div>
              <div className="capitalize"><span className="md:hidden block text-[10px] uppercase text-slate-400">Frequency</span>{r.frequency}</div>
              <div className={r.active && r.nextDueDate.slice(0, 10) < today ? 'text-red-600 font-semibold' : ''}>
                <span className="md:hidden block text-[10px] uppercase text-slate-400">Next due</span>
                {canWrite ? (
                  <input type="date" defaultValue={r.nextDueDate.slice(0, 10)} aria-label="Next due date" className="border border-slate-300 rounded-md px-1 py-1 bg-white text-slate-900"
                    onBlur={(e) => e.target.value && e.target.value !== r.nextDueDate.slice(0, 10) && void run(services.maintenance.update(r.id, { nextDueDate: e.target.value }))} />
                ) : r.nextDueDate.slice(0, 10)}
              </div>
              <div><span className="md:hidden block text-[10px] uppercase text-slate-400">Active</span><input type="checkbox" aria-label="Active" checked={r.active} disabled={!canWrite} onChange={(e) => void run(services.maintenance.update(r.id, { active: e.target.checked }))} /></div>
              {canWrite && (
                <div className="col-span-2 md:col-span-1 flex justify-end gap-3">
                  <button type="button" aria-label="Edit agreement" onClick={() => startEdit(r)} className="text-slate-400 hover:text-sky-700 p-1"><Pencil className="w-4 h-4" /></button>
                  <button type="button" aria-label="Delete agreement" onClick={() => confirm('Delete this agreement?') && void run(services.maintenance.remove(r.id))} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </li>
          ))}
          {!rows.length && <li className="p-3 text-slate-400">No agreements yet.</li>}
        </ul>
      </section>
    </div>
  );
};

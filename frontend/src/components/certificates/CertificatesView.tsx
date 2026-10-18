import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { IconDownload, IconPlus, IconX } from '@tabler/icons-react';
import { services } from '../../services';
import type { Certificate, CertificateType } from '../../services';
import { useServerPaged } from '../common/Pager';

const LABELS: Record<CertificateType, string> = { cp12: 'CP12 Landlord Gas Safety Record', service_record: 'Gas Appliance Service Record', commissioning: 'Commissioning Record' };
const CHECKS = ['flueOperation', 'ventilation', 'safetyDevice', 'gasTightness'] as const;
const blankAppliance = { description: '', location: '', flueOperation: 'pass', ventilation: 'pass', safetyDevice: 'pass', gasTightness: 'pass', safeToUse: true };
const input = 'px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-full';

export const CertificatesView: React.FC = () => {
  const { customers, technicians, currentUser, showToast, customerById } = useApp(['customers', 'technicians', 'currentUser', 'showToast', 'customerById']);
  const [reload, setReload] = useState(0);
  const paged = useServerPaged<Certificate>('/certificates', {}, reload);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CertificateType>('cp12');
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [appliances, setAppliances] = useState<any[]>([{ ...blankAppliance }]);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });


  const sites = customerById.get(customerId)?.serviceLocations ?? [];
  const num = (k: string) => Number(f[k] || 0);
  const data = () =>
    type === 'cp12' ? { appliances, defects: f.defects ?? '', warningNoticeIssued: f.warning === 'yes' }
    : type === 'service_record' ? { workCarried: f.workCarried ?? '', notes: f.notes ?? '' }
    : { applianceMake: f.make ?? '', applianceModel: f.model ?? '', serialNumber: f.serial ?? '', inletPressureMbar: num('inlet'), burnerPressureMbar: num('burner'), coPpm: num('co'), co2Percent: num('co2'), flueTestPassed: f.flue !== 'no', notes: f.notes ?? '' };

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await services.certificates.issue({ type, customerId, locationId, ...(technicianId && { technicianId }), data: data() });
      showToast(`Issued ${c.certNumber}`, 'success');
      setOpen(false); setF({}); setAppliances([{ ...blankAppliance }]);
      setReload((n) => n + 1);
    } catch (err) { showToast((err as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const pdf = async (c: Certificate) => {
    try {
      const url = URL.createObjectURL(await services.certificates.pdf(c.id));
      Object.assign(document.createElement('a'), { href: url, download: `${c.certNumber}.pdf` }).click();
      URL.revokeObjectURL(url);
    } catch (err) { showToast((err as Error).message, 'error'); }
  };

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Gas Certificates</h1>
          <p className="text-xs text-slate-500 mt-0.5">CP12, service and commissioning records. The issuing engineer needs a current Gas Safe registration.</p>
        </div>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 inline-flex items-center gap-1.5">{open ? <IconX className="w-4 h-4" aria-hidden="true" /> : <IconPlus className="w-4 h-4" aria-hidden="true" />}{open ? 'Cancel' : 'Issue Certificate'}</button>
      </div>

      {open && (
        <form onSubmit={issue} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select aria-label="Certificate type" value={type} onChange={(e) => setType(e.target.value as CertificateType)} className={input}>
              {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select aria-label="Customer" required value={customerId} onChange={(e) => { setCustomerId(e.target.value); setLocationId(''); }} className={input}>
              <option value="">Customer…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Site" required value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input}>
              <option value="">Site…</option>{sites.map((l) => <option key={l.id} value={l.id}>{l.label} – {l.postcode}</option>)}
            </select>
            {currentUser.role !== 'technician' && (
              <select aria-label="Engineer" required value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className={input}>
                <option value="">Engineer…</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {type === 'cp12' && (
            <>
              {appliances.map((a, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-end">
                  <input aria-label="Appliance" required placeholder="Appliance" value={a.description} onChange={(e) => setAppliances(appliances.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={`${input} sm:col-span-2`} />
                  {CHECKS.map((k) => (
                    <select key={k} aria-label={k.replace(/([A-Z])/g, ' $1').toLowerCase()} value={a[k]} onChange={(e) => setAppliances(appliances.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} className={input}>
                      {['pass', 'fail', 'na'].map((v) => <option key={v} value={v}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}: {v}</option>)}
                    </select>
                  ))}
                  <label className="flex items-center gap-1"><input type="checkbox" checked={a.safeToUse} onChange={(e) => setAppliances(appliances.map((x, j) => (j === i ? { ...x, safeToUse: e.target.checked } : x)))} />Safe to use</label>
                </div>
              ))}
              <button type="button" onClick={() => setAppliances([...appliances, { ...blankAppliance }])} className="text-blue-600 font-semibold inline-flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" aria-hidden="true" /> Add appliance</button>
              <textarea aria-label="Defects" placeholder="Defects identified" value={f.defects ?? ''} onChange={set('defects')} className={input} />
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.warning === 'yes'} onChange={(e) => setF({ ...f, warning: e.target.checked ? 'yes' : 'no' })} />Warning notice issued</label>
            </>
          )}
          {type === 'service_record' && (
            <>
              <textarea aria-label="Work carried out" required placeholder="Work carried out" value={f.workCarried ?? ''} onChange={set('workCarried')} className={input} />
              <textarea aria-label="Notes" placeholder="Notes" value={f.notes ?? ''} onChange={set('notes')} className={input} />
            </>
          )}
          {type === 'commissioning' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input aria-label="Make" required placeholder="Appliance make" value={f.make ?? ''} onChange={set('make')} className={input} />
              <input aria-label="Model" placeholder="Model" value={f.model ?? ''} onChange={set('model')} className={input} />
              <input aria-label="Serial" placeholder="Serial number" value={f.serial ?? ''} onChange={set('serial')} className={input} />
              <select aria-label="Flue test" value={f.flue ?? 'yes'} onChange={set('flue')} className={input}><option value="yes">Flue test: pass</option><option value="no">Flue test: fail</option></select>
              {[['inlet', 'Inlet mbar'], ['burner', 'Burner mbar'], ['co', 'CO ppm'], ['co2', 'CO2 %']].map(([k, label]) => (
                <input key={k} aria-label={label} type="number" min="0" step="any" required placeholder={label} value={f[k] ?? ''} onChange={set(k)} className={input} />
              ))}
              <textarea aria-label="Notes" placeholder="Notes" value={f.notes ?? ''} onChange={set('notes')} className={`${input} col-span-2 sm:col-span-4`} />
            </div>
          )}
          <button type="submit" disabled={busy} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{busy ? 'Issuing…' : 'Issue Certificate'}</button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto relative">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
            <tr><th className="py-2.5 px-3">Number</th><th className="py-2.5 px-3">Type</th><th className="py-2.5 px-3">Customer</th><th className="py-2.5 px-3">Engineer</th><th className="py-2.5 px-3">Issued</th><th className="py-2.5 px-3">Next due</th><th className="py-2.5 px-3"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.rows.length === 0 && !paged.loading && <tr><td colSpan={7} className="py-4 px-3 text-center text-slate-400">No certificates</td></tr>}
            {paged.rows.map((c) => (
              <tr key={c.id}>
                <td className="py-2.5 px-3 font-mono">{c.certNumber}</td>
                <td className="py-2.5 px-3">{LABELS[c.type]}</td>
                <td className="py-2.5 px-3">{customerById.get(c.customerId)?.name ?? '—'}</td>
                <td className="py-2.5 px-3">{c.engineerName} ({c.gasSafeNumber})</td>
                <td className="py-2.5 px-3">{c.issueDate}</td>
                <td className={`py-2.5 px-3 ${c.expiryDate && c.expiryDate < today ? 'text-rose-600 font-semibold' : ''}`}>{c.expiryDate ?? '—'}</td>
                <td className="py-2.5 px-3"><button onClick={() => void pdf(c)} aria-label={`Download PDF for ${c.certNumber}`} className="text-blue-600 hover:text-blue-800 font-semibold rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 inline-flex items-center gap-1"><IconDownload className="w-3.5 h-3.5" aria-hidden="true" /> PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {paged.pager}
      </div>
    </div>
  );
};

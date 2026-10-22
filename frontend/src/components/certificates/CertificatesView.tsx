import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { IconDownload, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { Combobox } from '../common/Combobox';
import { DetailDrawer } from '../common/DetailDrawer';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { services } from '../../services';
import type { Certificate, CertificateType } from '../../services';
import { SortHead, useServerPaged } from '../common/Pager';
import { formatDateUK } from '../../utils/formatters';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Textarea } from '@/src/components/ui/textarea';

const LABELS: Record<CertificateType, string> = { cp12: 'CP12 Landlord Gas Safety Record', service_record: 'Gas Appliance Service Record', commissioning: 'Commissioning Record' };
const CHECKS = ['flueOperation', 'ventilation', 'safetyDevice', 'gasTightness'] as const;
const blankAppliance = { description: '', location: '', flueOperation: '', ventilation: '', safetyDevice: '', gasTightness: '', safeToUse: false };
const input = 'h-8 text-xs';

/** Compact labelled Select; an empty `value` shows the placeholder. */
const Pick: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][]; required?: boolean }> = ({ label, value, onChange, placeholder, options, required }) => (
  <Select value={value} onValueChange={onChange} required={required}>
    <SelectTrigger aria-label={label} size="sm" className="w-full text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
  </Select>
);

export const CertificatesView: React.FC = () => {
  const { customers, technicians, currentUser, showToast, customerById, confirmToast } = useApp(['customers', 'technicians', 'currentUser', 'showToast', 'customerById', 'confirmToast']);
  const [reload, setReload] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const paged = useServerPaged<Certificate>('/certificates', { q: searchTerm.trim() || undefined, type: typeFilter === 'all' ? undefined : typeFilter }, reload);
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
    if (!customerId || !locationId || (currentUser.role !== 'technician' && !technicianId)) return showToast('Pick the customer, site and engineer first.', 'error');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">Gas Certificates</h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'certificate' : 'certificates'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">CP12, service and commissioning records. The issuing engineer needs a current Gas Safe registration.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0"><IconPlus aria-hidden="true" />Issue Certificate</Button>
      </div>

      {open && (
        <DetailDrawer onClose={() => setOpen(false)} dirty={!busy && !!(customerId || Object.keys(f).length)} title="Issue Certificate" description="The issuing engineer needs a current Gas Safe registration"
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="cert-form" size="sm" disabled={busy}>{busy ? 'Issuing…' : 'Issue Certificate'}</Button>
          </>}>
          <form id="cert-form" onSubmit={issue} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Pick label="Certificate type" value={type} onChange={(v) => setType(v as CertificateType)} placeholder="Type" options={Object.entries(LABELS)} />
            <Combobox value={customerId} onChange={(v) => { setCustomerId(v); setLocationId(''); }} placeholder="Customer…" searchPlaceholder="Search customers…" options={customers.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name, hint: c.type }))} />
            <Pick label="Site" required value={locationId} onChange={setLocationId} placeholder="Site…" options={sites.map((l) => [l.id, `${l.label} – ${l.postcode}`])} />
            {currentUser.role !== 'technician' && (
              <Pick label="Engineer" required value={technicianId} onChange={setTechnicianId} placeholder="Engineer…" options={technicians.map((t) => [t.id, t.name])} />
            )}
          </div>

          {type === 'cp12' && (
            <>
              {appliances.map((a, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 items-end rounded-lg border border-border p-2">
                  <Input aria-label="Appliance" required placeholder="Appliance" value={a.description} onChange={(e) => setAppliances(appliances.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={`${input} col-span-2`} />
                  {CHECKS.map((k) => {
                    const name = k.replace(/([A-Z])/g, ' $1').toLowerCase();
                    return <Pick key={k} required label={name} value={a[k]} onChange={(v) => setAppliances(appliances.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} placeholder={`${name}?`} options={['pass', 'fail', 'na'].map((v) => [v, `${name}: ${v}`])} />;
                  })}
                  <Label className="text-xs font-normal"><Checkbox checked={a.safeToUse} onCheckedChange={(v) => setAppliances(appliances.map((x, j) => (j === i ? { ...x, safeToUse: v === true } : x)))} />Safe to use</Label>
                </div>
              ))}
              <Button type="button" variant="link" size="xs" onClick={() => setAppliances([...appliances, { ...blankAppliance }])}><IconPlus aria-hidden="true" /> Add appliance</Button>
              <Textarea aria-label="Defects" placeholder="Defects identified" value={f.defects ?? ''} onChange={set('defects')} className="text-xs min-h-16" />
              <Label className="text-xs font-normal"><Checkbox checked={f.warning === 'yes'} onCheckedChange={(v) => setF({ ...f, warning: v === true ? 'yes' : 'no' })} />Warning notice issued</Label>
            </>
          )}
          {type === 'service_record' && (
            <>
              <Textarea aria-label="Work carried out" required placeholder="Work carried out" value={f.workCarried ?? ''} onChange={set('workCarried')} className="text-xs min-h-16" />
              <Textarea aria-label="Notes" placeholder="Notes" value={f.notes ?? ''} onChange={set('notes')} className="text-xs min-h-16" />
            </>
          )}
          {type === 'commissioning' && (
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Make" required placeholder="Appliance make" value={f.make ?? ''} onChange={set('make')} className={input} />
              <Input aria-label="Model" placeholder="Model" value={f.model ?? ''} onChange={set('model')} className={input} />
              <Input aria-label="Serial" placeholder="Serial number" value={f.serial ?? ''} onChange={set('serial')} className={input} />
              <Pick label="Flue test" value={f.flue ?? 'yes'} onChange={(v) => setF({ ...f, flue: v })} placeholder="Flue test" options={[['yes', 'Flue test: pass'], ['no', 'Flue test: fail']]} />
              {[['inlet', 'Inlet mbar'], ['burner', 'Burner mbar'], ['co', 'CO ppm'], ['co2', 'CO2 %']].map(([k, label]) => (
                <Input key={k} aria-label={label} type="number" min="0" step="any" required placeholder={label} value={f[k] ?? ''} onChange={set(k)} className={input} />
              ))}
              <Textarea aria-label="Notes" placeholder="Notes" value={f.notes ?? ''} onChange={set('notes')} className="text-xs min-h-16 col-span-2" />
            </div>
          )}
        </form>
        </DetailDrawer>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search certificates" autoComplete="off" placeholder="Search number, engineer, Gas Safe no…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" aria-label="Certificate type" className="w-56 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || typeFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setTypeFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      <div style={{ '--table-offset': '19.5rem' } as React.CSSProperties}><TableCard footer={paged.pager}>
        <Table className="text-xs">
          <TableHeader>
            <TableRow><SortHead paged={paged} by="certNumber">Number</SortHead><SortHead paged={paged} by="type">Type</SortHead><TableHead>Customer</TableHead><SortHead paged={paged} by="engineerName">Engineer</SortHead><SortHead paged={paged} by="issueDate">Issued</SortHead><SortHead paged={paged} by="expiryDate">Next due</SortHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.length === 0 && !paged.loading && <TableRow><TableCell colSpan={7} className="py-4 text-center text-muted-foreground">No certificates</TableCell></TableRow>}
            {paged.rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="tabular-nums">{c.certNumber}</TableCell>
                <TableCell>{LABELS[c.type]}</TableCell>
                <TableCell>{customerById.get(c.customerId)?.name ?? '—'}</TableCell>
                <TableCell>{c.engineerName} ({c.gasSafeNumber})</TableCell>
                <TableCell>{formatDateUK(c.issueDate)}</TableCell>
                <TableCell className={c.expiryDate && c.expiryDate < today ? 'text-rose-600 font-semibold' : ''}>{c.expiryDate ? formatDateUK(c.expiryDate) : '—'}{c.expired && <Badge variant="outline" className="ml-1.5 text-[10px] uppercase text-rose-700 border-rose-200 bg-rose-50">Expired</Badge>}</TableCell>
                <TableCell>
                  <RowActions subject={c.certNumber} actions={[
                    { icon: IconDownload, label: 'Download PDF', onClick: () => void pdf(c) },
                    { icon: IconTrash, label: 'Delete', destructive: true, hidden: currentUser?.role !== 'admin',
                      onClick: () => confirmToast(`Delete ${c.certNumber}?`, () => void services.certificates.remove(c.id).then(() => setReload((n) => n + 1), (e: Error) => showToast(e.message, 'error'))) },
                  ]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard></div>
    </div>
  );
};

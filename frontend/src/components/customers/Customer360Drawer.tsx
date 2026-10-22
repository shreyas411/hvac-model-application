import React, { useEffect, useState } from 'react';
import { IconAirConditioning, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { services, type Certificate } from '../../services';
import { Job, MaintenanceAgreement, ServiceLocation } from '../../types';
import { formatDateUK, formatGBP } from '../../utils/formatters';
import { AddressInput } from '../common/AddressInput';
import { DetailDrawer } from '../common/DetailDrawer';
import { EmptyState } from '../common/EmptyState';
import { JobDetailDrawer } from '../scheduling/JobDetailDrawer';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

const MiniTable: React.FC<{ head: string[]; empty: string; rows: React.ReactNode[][] }> = ({ head, empty, rows }) => rows.length === 0 ? <EmptyState icon={IconAirConditioning} compact>{empty}</EmptyState> : (
  <Table className="text-xs">
    <TableHeader><TableRow>{head.map((h, i) => <TableHead key={h} className={`px-2 ${i === head.length - 1 && head.length > 2 ? 'text-right' : ''}`}>{h}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={`px-2 py-2 ${j === r.length - 1 && r.length > 2 ? 'text-right tabular-nums' : ''}`}>{c}</TableCell>)}</TableRow>)}</TableBody>
  </Table>
);

const Status: React.FC<{ s: string }> = ({ s }) => <Badge variant="secondary" className="capitalize text-[10px]">{s.replace(/_/g, ' ')}</Badge>;

/** Customer 360: everything about one customer in one drawer, tabs in lifecycle order. */
type NewAction = 'request' | 'quote' | 'job' | 'invoice';

const NewButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <div className="flex justify-end"><Button size="xs" variant="outline" onClick={onClick}><IconPlus aria-hidden="true" />{label}</Button></div>
);

export const Customer360Drawer: React.FC<{ customerId: string; onClose: () => void; onEdit: (id: string) => void; onNew: (action: NewAction) => void }> = ({ customerId, onClose, onEdit, onNew }) => {
  const { customerById, equipment, jobs, quotations, invoices, serviceRequests, addCustomerLocation, updateCustomerLocation, removeCustomerLocation, confirmToast } =
    useApp(['customerById', 'equipment', 'jobs', 'quotations', 'invoices', 'serviceRequests', 'addCustomerLocation', 'updateCustomerLocation', 'removeCustomerLocation', 'confirmToast']);
  const c = customerById.get(customerId);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [siteForm, setSiteForm] = useState<{ id: string | null; label: string; addressLine1: string; city: string; postcode: string; accessNotes: string } | null>(null);
  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicate sites)
  const [tab, setTab] = useState('overview');
  // Certificates and maintenance agreements aren't in the shared store: fetch once, when their tab is first opened.
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [agreements, setAgreements] = useState<MaintenanceAgreement[] | null>(null);
  useEffect(() => {
    if (tab === 'certificates' && certs === null) api<{ data: Certificate[] }>('GET', `/certificates?customerId=${customerId}&limit=100`).then((r) => setCerts(r.data), () => setCerts([]));
    if (tab === 'maintenance' && agreements === null) services.maintenance.list().then((all) => setAgreements(all.filter((a) => a.customerId === customerId)), () => setAgreements([]));
  }, [tab, customerId]); // eslint-disable-line react-hooks/exhaustive-deps -- each list loads once per open drawer
  if (!c) return null;

  const reqs = serviceRequests.filter((x) => x.customerId === c.id);
  const quotes = quotations.filter((x) => x.customerId === c.id);
  const js = jobs.filter((x) => x.customerId === c.id);
  const invs = invoices.filter((x) => x.customerId === c.id);
  const eqs = equipment.filter((x) => x.customerId === c.id);
  const balance = invs.reduce((sum, i) => sum + i.balanceDue, 0);
  const count = (n: number) => <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{n}</span>;

  const saveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteForm) return;
    const loc: Omit<ServiceLocation, 'id'> = { label: siteForm.label || 'Secondary Site', addressLine1: siteForm.addressLine1, city: siteForm.city, postcode: siteForm.postcode.toUpperCase(), accessNotes: siteForm.accessNotes };
    setBusy(true);
    const ok = siteForm.id ? await updateCustomerLocation(c.id, siteForm.id, loc) : await addCustomerLocation(c.id, loc);
    setBusy(false);
    if (ok) setSiteForm(null);
  };
  const setF = (patch: Partial<NonNullable<typeof siteForm>>) => setSiteForm((f) => f && { ...f, ...patch });

  return (
    <DetailDrawer size="detail" onClose={onClose}
      title={<span className="flex items-center gap-2">{c.name}<Badge variant="secondary" className="uppercase text-[10px]">{c.type}</Badge></span>}
      description={c.companyName || 'Customer account'}
      footer={<><Button variant="outline" size="sm" onClick={() => onEdit(c.id)}>Edit Customer</Button><Button size="sm" onClick={onClose}>Close</Button></>}>
      <Tabs value={tab} onValueChange={setTab} className="text-xs">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sites">Sites{count(c.serviceLocations.length)}</TabsTrigger>
          <TabsTrigger value="requests">Requests{count(reqs.length)}</TabsTrigger>
          <TabsTrigger value="quotes">Quotes{count(quotes.length)}</TabsTrigger>
          <TabsTrigger value="jobs">Jobs{count(js.length)}</TabsTrigger>
          <TabsTrigger value="invoices">Invoices{count(invs.length)}</TabsTrigger>
          <TabsTrigger value="equipment">Equipment{count(eqs.length)}</TabsTrigger>
          <TabsTrigger value="certificates">Certificates{certs && count(certs.length)}</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance{agreements && count(agreements.length)}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/50 p-3.5">
            <div>
              <span className="mb-1 block font-semibold">Contact</span>
              <p className="font-medium">{c.phone}</p>
              <p className="text-muted-foreground">{c.email}</p>
              <p className="mt-1 text-[11px] capitalize text-muted-foreground">Preference: {c.communicationPreference}</p>
            </div>
            <div>
              <span className="mb-1 block font-semibold">Billing Address</span>
              <p>{c.billingAddress.line1}</p>
              <p>{c.billingAddress.city}, <span className="tabular-nums">{c.billingAddress.postcode}</span></p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([['Open requests', reqs.filter((x) => x.status !== 'converted' && x.status !== 'cancelled').length], ['Quotes', quotes.length], ['Jobs', js.length], ['Assets', eqs.length]] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border p-2.5"><span className="block text-[11px] font-semibold text-muted-foreground">{k}</span><span className="text-base font-semibold tabular-nums">{v}</span></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-muted/50 p-3"><span className="block text-[11px] font-semibold text-muted-foreground">Invoices issued</span><span className="text-base font-semibold tabular-nums">{invs.length}</span></div>
            <div className="rounded-lg border border-border bg-muted/50 p-3"><span className="block text-[11px] font-semibold text-muted-foreground">Outstanding balance</span><span className={`text-base font-semibold tabular-nums ${balance > 0 ? 'text-destructive' : ''}`}>{formatGBP(balance)}</span></div>
          </div>
          {c.notes && <p className="rounded-lg border border-border p-3 text-muted-foreground">{c.notes}</p>}
        </TabsContent>

        <TabsContent value="sites" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <Button size="xs" variant="outline" onClick={() => setSiteForm(siteForm ? null : { id: null, label: '', addressLine1: '', city: '', postcode: '', accessNotes: '' })}>
              {siteForm ? 'Cancel' : <><IconPlus aria-hidden="true" />Add location</>}
            </Button>
          </div>
          {siteForm && (
            <form onSubmit={saveSite} className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input required aria-label="Site label" placeholder="Site Label (e.g. Plant Room)" value={siteForm.label} onChange={(e) => setF({ label: e.target.value })} className="h-8 bg-background text-xs" />
                <AddressInput required aria-label="Address line 1" placeholder="Address Line 1" value={siteForm.addressLine1} onChange={(v) => setF({ addressLine1: v })}
                  onPick={(a) => setF({ addressLine1: a.line1, city: a.city, postcode: a.postcode })} className="h-8 bg-background text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input required aria-label="City" placeholder="City" value={siteForm.city} onChange={(e) => setF({ city: e.target.value })} className="h-8 bg-background text-xs" />
                <Input required aria-label="Postcode" autoComplete="off" placeholder="Postcode (e.g. SW19 4QW)" pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" title="Enter a UK postcode, e.g. LS1 4AB"
                  value={siteForm.postcode} onChange={(e) => setF({ postcode: e.target.value })} className="h-8 bg-background text-xs" />
              </div>
              <Input aria-label="Access notes" placeholder="Access Notes / Keycode" value={siteForm.accessNotes} onChange={(e) => setF({ accessNotes: e.target.value })} className="h-8 bg-background text-xs" />
              <Button type="submit" size="sm" disabled={busy} className="w-full">{siteForm.id ? 'Update Service Location' : 'Save Service Location'}</Button>
            </form>
          )}
          {c.serviceLocations.map((loc) => (
            <div key={loc.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="block font-bold">{loc.label}</span>
                <span className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon-xs" title="Edit" aria-label={`Edit ${loc.label}`} onClick={() => setSiteForm({ id: loc.id, label: loc.label, addressLine1: loc.addressLine1, city: loc.city, postcode: loc.postcode, accessNotes: loc.accessNotes || '' })}><i className="flex text-lg"><IconPencil className="size-[1em]" aria-hidden="true" /></i></Button>
                  <Button variant="ghost" size="icon-xs" title="Remove" aria-label={`Remove ${loc.label}`} className="text-destructive hover:text-destructive"
                    onClick={() => confirmToast(`Remove ${loc.label}? Sites used by jobs or equipment can't be removed.`, () => void removeCustomerLocation(c.id, loc.id))}><i className="flex text-lg"><IconTrash className="size-[1em]" aria-hidden="true" /></i></Button>
                </span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{loc.addressLine1}, {loc.city} <strong className="tabular-nums text-foreground">{loc.postcode}</strong></p>
              {loc.accessNotes && <p className="mt-1 rounded bg-amber-50 p-1 text-[11px] text-amber-800">Access: {loc.accessNotes}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="requests" className="space-y-2 pt-3">
          <NewButton label="New request" onClick={() => onNew('request')} />
          <MiniTable head={['Request', 'Priority', 'Status', 'Raised']} empty="No service requests yet." rows={reqs.map((r) => [<span className="font-semibold tabular-nums">{r.requestNumber}</span>, <span className="capitalize">{r.priority}</span>, <Status s={r.status} />, formatDateUK(r.createdAt)])} />
        </TabsContent>
        <TabsContent value="quotes" className="space-y-2 pt-3">
          <NewButton label="New quote" onClick={() => onNew('quote')} />
          <MiniTable head={['Quote', 'Status', 'Issued', 'Total']} empty="No quotes yet." rows={quotes.map((q) => [<span className="font-semibold tabular-nums">{q.quoteNumber}</span>, <Status s={q.status} />, formatDateUK(q.issueDate), formatGBP(q.total)])} />
        </TabsContent>
        <TabsContent value="jobs" className="space-y-2 pt-3">
          <NewButton label="Book job" onClick={() => onNew('job')} />
          <MiniTable head={['Job', 'Title', 'Status', 'Date']} empty="No jobs yet." rows={js.map((j) => [
            <button type="button" className="font-semibold tabular-nums text-primary hover:underline" aria-label={`View details of ${j.jobNumber}`} onClick={() => setViewingJob(j)}>{j.jobNumber}</button>, j.title, <Status s={j.status} />, formatDateUK(j.appointmentDate)])} />
        </TabsContent>
        <TabsContent value="invoices" className="space-y-2 pt-3">
          <NewButton label="New invoice" onClick={() => onNew('invoice')} />
          <MiniTable head={['Invoice', 'Status', 'Due', 'Balance']} empty="No invoices yet." rows={invs.map((i) => [<span className="font-semibold tabular-nums">{i.invoiceNumber}</span>, <Status s={i.status} />, formatDateUK(i.dueDate), formatGBP(i.balanceDue)])} />
        </TabsContent>
        <TabsContent value="equipment" className="pt-3">
          <MiniTable head={['Asset', 'Serial', 'Status', 'Next service']} empty="No equipment registered yet for this client." rows={eqs.map((q) => [<span className="font-semibold">{q.brand} {q.model}</span>, <span className="tabular-nums">{q.serialNumber}</span>, <Status s={q.status} />, formatDateUK(q.nextServiceDueDate)])} />
        </TabsContent>
        <TabsContent value="certificates" className="pt-3">
          {certs === null ? <p className="text-muted-foreground">Loading…</p> : (
            <MiniTable head={['Certificate', 'Type', 'Issued', 'Next due']} empty="No certificates issued yet." rows={certs.map((c) => [<span className="font-semibold tabular-nums">{c.certNumber}</span>, <span className="capitalize">{c.type.replace(/_/g, ' ')}</span>, formatDateUK(c.issueDate), c.expiryDate ? formatDateUK(c.expiryDate) : '—'])} />
          )}
        </TabsContent>
        <TabsContent value="maintenance" className="pt-3">
          {agreements === null ? <p className="text-muted-foreground">Loading…</p> : (
            <MiniTable head={['Site', 'Frequency', 'Active', 'Next due']} empty="No maintenance agreements yet." rows={agreements.map((a) => [c.serviceLocations.find((l) => l.id === a.locationId)?.label ?? '—', <span className="capitalize">{a.frequency}</span>, a.active ? 'Yes' : 'No', formatDateUK(a.nextDueDate)])} />
          )}
        </TabsContent>
      </Tabs>
      {viewingJob && <JobDetailDrawer job={viewingJob} onClose={() => setViewingJob(null)} />}
    </DetailDrawer>
  );
};

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Job } from '../../types';
import { JobPhotos } from '../technician/JobPhotos';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { formatDateTimeUK, formatDateUK, formatGBP, regLine } from '../../utils/formatters';
import { IconDownload, IconPrinter } from '@tabler/icons-react';
import { Button } from '@/src/components/ui/button';
import { DetailDrawer } from '../common/DetailDrawer';
import { CustomFieldBox } from '../common/CustomFields';
import { useCustomFields } from '../../data/customFields';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="font-bold text-foreground text-xs uppercase tracking-wide border-b border-border pb-1">{title}</h3>
    {children}
  </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="text-muted-foreground italic">{text}</p>;

const mins = (a?: string, b?: string) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);

/**
 * Read-only record of one job: everything captured from booking to sign-off. The sheet doubles as the
 * printable report (`[data-pdf-sheet]`). `onEdit` adds an Edit button (omit for completed/cancelled jobs).
 */
export const JobDetailDrawer: React.FC<{ job: Job; onClose: () => void; onEdit?: () => void }> = ({ job: passed, onClose, onEdit }) => {
  const { jobs, customerById, technicians, equipment, invoices, quotations, settings, deleteRecord, confirmToast, currentUser } =
    useApp(['jobs', 'customerById', 'technicians', 'equipment', 'invoices', 'quotations', 'settings', 'deleteRecord', 'confirmToast', 'currentUser']);

  const { active: customDefs } = useCustomFields('job');
  const job = jobs.find((j) => j.id === passed.id) ?? passed; // live copy: status/notes change while it's open
  const customer = customerById.get(job.customerId);
  const loc = customer?.serviceLocations.find((l) => l.id === job.locationId);
  const tech = technicians.find((t) => t.id === job.technicianId);
  const kit = equipment.filter((e) => job.equipmentIds.includes(e.id));
  const jobInvoices = invoices.filter((i) => i.jobId === job.id);
  const jobQuotes = quotations.filter((q) => q.jobId === job.id);

  const onSite = mins(job.arrivalTime, job.completionTime);
  const labour = job.labourHours * job.hourlyRate;
  const parts = job.partsUsed.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const signed = job.customerSignature;

  return (
    <DetailDrawer size="detail" onClose={onClose} title={<span className="tabular-nums">{job.jobNumber}{job.title && <span className="font-sans font-semibold"> · {job.title}</span>}</span>} description="Job record"
      footer={<>
        {currentUser?.role === 'admin' && ['new', 'awaiting_approval', 'scheduled', 'cancelled'].includes(job.status) && !invoices.some((i) => i.jobId === job.id) && (
          <Button variant="outline" size="sm" onClick={() => confirmToast(`Delete ${job.jobNumber}?`, () => void deleteRecord('jobs', job.id, 'Job').then(onClose))} className="mr-auto text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">Delete</Button>
        )}
        {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>Edit / Reassign</Button>}
        <Button variant="outline" size="sm" onClick={(e) => downloadSheet(e.currentTarget, `${job.jobNumber}-report.pdf`)}><IconDownload aria-hidden="true" /><span>PDF</span></Button>
        <Button size="sm" onClick={(e) => printSheet(e.currentTarget)}><IconPrinter aria-hidden="true" /><span>Print report</span></Button>
      </>}>
        <div data-pdf-sheet className="space-y-5 text-xs">
          <div className="flex justify-between items-start border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">{settings.companyName}</h2>
              <p className="text-muted-foreground tabular-nums">{regLine(settings)}</p>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-sm font-semibold tabular-nums text-foreground block">{job.jobNumber}</span>
              <span className="uppercase font-bold text-sky-700 block">{job.status.replace('_', ' ')}</span>
              <span className="text-muted-foreground capitalize block">{job.type.replace(/_/g, ' ')} · {job.priority} priority</span>
              {job.slaBreached && <span className="text-red-600 font-bold block">SLA breached</span>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Section title="Customer & site">
              <p className="font-semibold text-foreground">{customer?.name ?? 'Unknown customer'}</p>
              {loc && <p className="text-muted-foreground">{loc.addressLine1}, {loc.city} {loc.postcode}</p>}
              {loc?.accessNotes && <p className="text-muted-foreground">Access: {loc.accessNotes}</p>}
              {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
            </Section>
            <Section title="Technician & schedule">
              <p className="font-semibold text-foreground">{tech?.name ?? 'Unassigned'}</p>
              <p className="text-muted-foreground">Booked: {formatDateUK(job.appointmentDate)} · {job.startTime}–{job.endTime} ({job.estimatedDurationMinutes} min)</p>
              <p className="text-muted-foreground">Arrived: {job.arrivalTime ? formatDateTimeUK(job.arrivalTime) : '—'}</p>
              <p className="text-muted-foreground">Completed: {job.completionTime ? formatDateTimeUK(job.completionTime) : '—'}{onSite !== null && ` (${onSite} min on site)`}</p>
            </Section>
          </div>

          <Section title="Job description">
            {job.title && <p className="font-semibold text-foreground">{job.title}</p>}
            <p className="text-foreground whitespace-pre-wrap">{job.description || '—'}</p>
            {job.internalNotes && <p className="text-muted-foreground whitespace-pre-wrap">Internal: {job.internalNotes}</p>}
            {job.requiredSkills.length > 0 && <p className="text-muted-foreground">Skills: {job.requiredSkills.join(', ')}</p>}
          </Section>

          <Section title="Work performed">
            {job.workPerformed ? <p className="text-foreground whitespace-pre-wrap bg-muted/50 p-2.5 rounded border border-border">{job.workPerformed}</p> : <Empty text="No work notes recorded." />}
            {job.followUpRecommended && <p className="text-amber-700 font-semibold">Follow-up recommended{job.followUpNotes ? `: ${job.followUpNotes}` : ''}</p>}
          </Section>

          <Section title="Equipment serviced">
            {kit.length ? kit.map((e) => <p key={e.id} className="text-foreground">{e.brand} {e.model} <span className="text-muted-foreground capitalize">· {e.type.replace(/_/g, ' ')}</span></p>) : <Empty text="No equipment linked." />}
          </Section>

          <Section title={`Checklist (${job.checklist.filter((c) => c.checked).length}/${job.checklist.length})`}>
            {job.checklist.length ? job.checklist.map((c) => (
              <p key={c.id} className={c.checked ? 'text-foreground' : 'text-rose-600'}>
                {c.checked ? '✓' : '✗'} {c.label} <span className="text-muted-foreground">· {c.category.replace('_', ' ')}</span>{c.notes && <span className="text-muted-foreground"> — {c.notes}</span>}
              </p>
            )) : <Empty text="No checklist." />}
          </Section>

          <Section title="Parts used">
            {job.partsUsed.length ? (
              <Table className="w-full text-left">
                <TableHeader className="text-muted-foreground"><TableRow><TableHead className="font-medium">Part</TableHead><TableHead className="font-medium">SKU</TableHead><TableHead className="font-medium text-right">Qty</TableHead><TableHead className="font-medium text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>{job.partsUsed.map((p, i) => <TableRow key={i}><TableCell>{p.partName}</TableCell><TableCell className="tabular-nums text-muted-foreground">{p.sku}</TableCell><TableCell className="text-right">{p.quantity}</TableCell><TableCell className="text-right">{formatGBP(p.quantity * p.unitPrice)}</TableCell></TableRow>)}</TableBody>
              </Table>
            ) : <Empty text="No parts used." />}
          </Section>

          {(job.refrigerantLogs?.length ?? 0) > 0 && (
            <Section title="Refrigerant log">
              {job.refrigerantLogs!.map((l) => (
                <p key={l.id} className="text-foreground"><span className="capitalize font-semibold">{l.action.replace('_', ' ')}</span> · {l.refrigerant} · {l.amountKg} kg · cylinder {l.cylinderId || '—'} · cert {l.certNumber} <span className="text-muted-foreground">({l.createdBy}, {formatDateTimeUK(l.createdAt)})</span></p>
              ))}
            </Section>
          )}

          <Section title="Charges">
            <p className="text-foreground">Labour: {job.labourHours} h × {formatGBP(job.hourlyRate)} = {formatGBP(labour)}</p>
            <p className="text-foreground">Parts: {formatGBP(parts)}</p>
            <p className="text-foreground">Travel: {job.travelTimeMinutes} min · {formatGBP(job.travelCharge)}</p>
            <p className="font-bold text-foreground">Total (ex VAT): {formatGBP(labour + parts + job.travelCharge)}</p>
          </Section>

          <Section title="Photos">
            <JobPhotos jobId={job.id} locked />
          </Section>

          <Section title="Customer sign-off">
            {signed ? (
              <div>
                <img src={signed.dataUrl} alt="Customer signature" className="h-14 my-1" />
                <p className="text-foreground">Signed by {signed.name}</p>
                <p className="text-muted-foreground">{formatDateTimeUK(signed.signedAt)}</p>
              </div>
            ) : <Empty text="Not signed." />}
          </Section>

          {(jobInvoices.length > 0 || jobQuotes.length > 0) && (
            <Section title="Linked documents">
              {jobQuotes.map((q) => <p key={q.id} className="text-foreground"><span className="tabular-nums font-semibold">{q.quoteNumber}</span> · quotation · <span className="capitalize">{q.status}</span></p>)}
              {jobInvoices.map((i) => <p key={i.id} className="text-foreground"><span className="tabular-nums font-semibold">{i.invoiceNumber}</span> · invoice · <span className="capitalize">{i.status.replace('_', ' ')}</span> · {formatGBP(i.total)} (due {formatGBP(i.balanceDue)})</p>)}
            </Section>
          )}

          <CustomFieldBox defs={customDefs} values={job.customFields} />

          <Section title="History">
            {job.auditTrail.length ? job.auditTrail.map((a, i) => (
              <p key={i} className="text-muted-foreground"><span className="tabular-nums text-muted-foreground">{formatDateTimeUK(a.timestamp)}</span> · <span className="font-semibold">{a.action}</span> · {a.userName}{a.details && <span className="text-muted-foreground"> — {a.details}</span>}</p>
            )) : <Empty text="No history." />}
          </Section>
        </div>
    </DetailDrawer>
  );
};

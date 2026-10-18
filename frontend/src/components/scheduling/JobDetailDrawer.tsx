import React from 'react';
import { useApp } from '../../context/AppContext';
import { Job } from '../../types';
import { JobPhotos } from '../technician/JobPhotos';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { formatDateTimeUK, formatDateUK, formatGBP } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconDownload, IconPrinter } from '@tabler/icons-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-100 pb-1">{title}</h3>
    {children}
  </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="text-slate-400 italic">{text}</p>;

const mins = (a?: string, b?: string) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);

/**
 * Read-only record of one job: everything captured from booking to sign-off. The sheet doubles as the
 * printable report (`[data-pdf-sheet]`). `onEdit` adds an Edit button (omit for completed/cancelled jobs).
 */
export const JobDetailDrawer: React.FC<{ job: Job; onClose: () => void; onEdit?: () => void }> = ({ job: passed, onClose, onEdit }) => {
  const { jobs, customerById, technicians, equipment, invoices, quotations, settings } =
    useApp(['jobs', 'customerById', 'technicians', 'equipment', 'invoices', 'quotations', 'settings']);
  useEscape(true, onClose);

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
    <div role="dialog" aria-modal="true" aria-label={`Job ${job.jobNumber}`} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-sm text-slate-900 font-mono">{job.jobNumber}</span>
          <div className="flex items-center gap-2">
            {onEdit && <button onClick={onEdit} className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold">Edit / Reassign</button>}
            <button onClick={(e) => downloadSheet(e.currentTarget, `${job.jobNumber}-report.pdf`)} className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold flex items-center gap-1">
              <IconDownload className="w-3.5 h-3.5" aria-hidden="true" /><span>PDF</span>
            </button>
            <button onClick={(e) => printSheet(e.currentTarget)} className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1">
              <IconPrinter className="w-3.5 h-3.5" aria-hidden="true" /><span>Print report</span>
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"><span aria-hidden="true">✕</span></button>
          </div>
        </div>

        <div data-pdf-sheet className="p-5 overflow-y-auto space-y-5 text-xs">
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{settings.companyName}</h2>
              <p className="text-slate-500 font-mono">Gas Safe: #{settings.gasSafeRegisterNo} · F-Gas: #{settings.fGasCertNo}</p>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-sm font-bold font-mono text-slate-900 block">{job.jobNumber}</span>
              <span className="uppercase font-bold text-sky-700 block">{job.status.replace('_', ' ')}</span>
              <span className="text-slate-500 capitalize block">{job.type.replace(/_/g, ' ')} · {job.priority} priority</span>
              {job.slaBreached && <span className="text-red-600 font-bold block">SLA breached</span>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Section title="Customer & site">
              <p className="font-semibold text-slate-900">{customer?.name ?? 'Unknown customer'}</p>
              {loc && <p className="text-slate-600">{loc.addressLine1}, {loc.city} {loc.postcode}</p>}
              {loc?.accessNotes && <p className="text-slate-500">Access: {loc.accessNotes}</p>}
              {customer?.phone && <p className="text-slate-500">{customer.phone}</p>}
            </Section>
            <Section title="Technician & schedule">
              <p className="font-semibold text-slate-900">{tech?.name ?? 'Unassigned'}</p>
              <p className="text-slate-600">Booked: {formatDateUK(job.appointmentDate)} · {job.startTime}–{job.endTime} ({job.estimatedDurationMinutes} min)</p>
              <p className="text-slate-600">Arrived: {job.arrivalTime ? formatDateTimeUK(job.arrivalTime) : '—'}</p>
              <p className="text-slate-600">Completed: {job.completionTime ? formatDateTimeUK(job.completionTime) : '—'}{onSite !== null && ` (${onSite} min on site)`}</p>
            </Section>
          </div>

          <Section title="Job description">
            <p className="text-slate-800 whitespace-pre-wrap">{job.description || '—'}</p>
            {job.internalNotes && <p className="text-slate-500 whitespace-pre-wrap">Internal: {job.internalNotes}</p>}
            {job.requiredSkills.length > 0 && <p className="text-slate-500">Skills: {job.requiredSkills.join(', ')}</p>}
          </Section>

          <Section title="Work performed">
            {job.workPerformed ? <p className="text-slate-800 whitespace-pre-wrap bg-slate-50 p-2.5 rounded border border-slate-200">{job.workPerformed}</p> : <Empty text="No work notes recorded." />}
            {job.followUpRecommended && <p className="text-amber-700 font-semibold">Follow-up recommended{job.followUpNotes ? `: ${job.followUpNotes}` : ''}</p>}
          </Section>

          <Section title="Equipment serviced">
            {kit.length ? kit.map((e) => <p key={e.id} className="text-slate-700">{e.brand} {e.model} <span className="text-slate-400 capitalize">· {e.type.replace(/_/g, ' ')}</span></p>) : <Empty text="No equipment linked." />}
          </Section>

          <Section title={`Checklist (${job.checklist.filter((c) => c.checked).length}/${job.checklist.length})`}>
            {job.checklist.length ? job.checklist.map((c) => (
              <p key={c.id} className={c.checked ? 'text-slate-700' : 'text-rose-600'}>
                {c.checked ? '✓' : '✗'} {c.label} <span className="text-slate-400">· {c.category.replace('_', ' ')}</span>{c.notes && <span className="text-slate-500"> — {c.notes}</span>}
              </p>
            )) : <Empty text="No checklist." />}
          </Section>

          <Section title="Parts used">
            {job.partsUsed.length ? (
              <table className="w-full text-left">
                <thead className="text-slate-500"><tr><th className="font-medium">Part</th><th className="font-medium">SKU</th><th className="font-medium text-right">Qty</th><th className="font-medium text-right">Price</th></tr></thead>
                <tbody>{job.partsUsed.map((p, i) => <tr key={i}><td>{p.partName}</td><td className="font-mono text-slate-500">{p.sku}</td><td className="text-right">{p.quantity}</td><td className="text-right">{formatGBP(p.quantity * p.unitPrice)}</td></tr>)}</tbody>
              </table>
            ) : <Empty text="No parts used." />}
          </Section>

          {(job.refrigerantLogs?.length ?? 0) > 0 && (
            <Section title="Refrigerant log">
              {job.refrigerantLogs!.map((l) => (
                <p key={l.id} className="text-slate-700"><span className="capitalize font-semibold">{l.action.replace('_', ' ')}</span> · {l.refrigerant} · {l.amountKg} kg · cylinder {l.cylinderId || '—'} · cert {l.certNumber} <span className="text-slate-400">({l.createdBy}, {formatDateTimeUK(l.createdAt)})</span></p>
              ))}
            </Section>
          )}

          <Section title="Charges">
            <p className="text-slate-700">Labour: {job.labourHours} h × {formatGBP(job.hourlyRate)} = {formatGBP(labour)}</p>
            <p className="text-slate-700">Parts: {formatGBP(parts)}</p>
            <p className="text-slate-700">Travel: {job.travelTimeMinutes} min · {formatGBP(job.travelCharge)}</p>
            <p className="font-bold text-slate-900">Total (ex VAT): {formatGBP(labour + parts + job.travelCharge)}</p>
          </Section>

          <Section title="Photos">
            <JobPhotos jobId={job.id} locked />
          </Section>

          <Section title="Customer sign-off">
            {signed ? (
              <div>
                <img src={signed.dataUrl} alt="Customer signature" className="h-14 my-1" />
                <p className="text-slate-700">Signed by {signed.name}</p>
                <p className="text-slate-500">{formatDateTimeUK(signed.signedAt)}</p>
              </div>
            ) : <Empty text="Not signed." />}
          </Section>

          {(jobInvoices.length > 0 || jobQuotes.length > 0) && (
            <Section title="Linked documents">
              {jobQuotes.map((q) => <p key={q.id} className="text-slate-700"><span className="font-mono font-semibold">{q.quoteNumber}</span> · quotation · <span className="capitalize">{q.status}</span></p>)}
              {jobInvoices.map((i) => <p key={i.id} className="text-slate-700"><span className="font-mono font-semibold">{i.invoiceNumber}</span> · invoice · <span className="capitalize">{i.status.replace('_', ' ')}</span> · {formatGBP(i.total)} (due {formatGBP(i.balanceDue)})</p>)}
            </Section>
          )}

          <Section title="History">
            {job.auditTrail.length ? job.auditTrail.map((a, i) => (
              <p key={i} className="text-slate-600"><span className="font-mono text-slate-400">{formatDateTimeUK(a.timestamp)}</span> · <span className="font-semibold">{a.action}</span> · {a.userName}{a.details && <span className="text-slate-500"> — {a.details}</span>}</p>
            )) : <Empty text="No history." />}
          </Section>
        </div>
      </div>
    </div>
  );
};

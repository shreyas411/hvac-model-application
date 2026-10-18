import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useServerPaged } from '../common/Pager';
import { JobDetailDrawer } from '../scheduling/JobDetailDrawer';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus } from '../../types';
import { formatDateUK } from '../../utils/formatters';
import { IconClipboardList } from '@tabler/icons-react';

const STATUSES: JobStatus[] = ['completed', 'in_progress', 'on_hold', 'dispatched', 'scheduled', 'awaiting_approval', 'new', 'cancelled'];

/** Every job of one technician (completed ones included), searchable and filterable by status; a row opens the full job record. */
export const TechJobHistory: React.FC<{ technicianId: string }> = ({ technicianId }) => {
  const { customerById } = useApp(['customerById']);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewing, setViewing] = useState<Job | null>(null);
  const paged = useServerPaged<Job>('/jobs', { technicianId: technicianId || undefined, q: q.trim() || undefined, status: status || undefined, from: from || undefined, to: to || undefined });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-slate-900">Job history ({paged.total})</h2>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" placeholder="Search job no. or notes" className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs capitalize">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs" />
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs" />
          {(q || status || from || to) && <button type="button" onClick={() => { setQ(''); setStatus(''); setFrom(''); setTo(''); }} className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">Clear</button>}
        </div>
      </div>

      {paged.rows.length === 0 ? (
        <EmptyState icon={IconClipboardList}>{paged.loading ? 'Loading…' : 'No jobs match'}</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 text-xs">
          {paged.rows.map((job) => (
            <li key={job.id}>
              <button type="button" onClick={() => setViewing(job)} aria-label={`View details of ${job.jobNumber}`} className="w-full text-left py-2.5 px-1 flex items-center justify-between gap-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                <span className="min-w-0">
                  <span className="font-mono font-bold text-slate-900">{job.jobNumber}</span>
                  <span className="text-slate-500"> · {customerById.get(job.customerId)?.name ?? ''}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{job.description}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block font-medium text-slate-800">{formatDateUK(job.appointmentDate)}</span>
                  <span className="text-[10px] uppercase font-bold text-sky-700">{job.status.replace('_', ' ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {paged.pager}
      {viewing && <JobDetailDrawer job={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

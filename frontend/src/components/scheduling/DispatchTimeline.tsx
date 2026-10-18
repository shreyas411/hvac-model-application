import React, { useState } from 'react';
import { Job, Priority } from '../../types';
import type { TechnicianProfile as Technician } from '../../types';
import { getTodayISO } from '../../utils/formatters';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { IconSearch } from '@tabler/icons-react';

export const DragCard: React.FC<{ id: string } & React.HTMLAttributes<HTMLDivElement>> = ({ id, style, ...rest }) => {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return <div ref={setNodeRef} {...attributes} {...listeners} {...rest} style={{ ...style, opacity: isDragging ? 0.4 : 1, touchAction: 'manipulation' }} />;
};

// eligible: undefined = nothing being dragged, true/false = can this target take the dragged job
export const DropColumn: React.FC<{ id: string; idleClass: string; baseClass: string; eligible?: boolean; children: React.ReactNode }> = ({ id, idleClass, baseClass, eligible, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const state = eligible === undefined ? idleClass
    : !eligible ? `${isOver ? 'border-red-500 ring-2 ring-red-200' : idleClass} opacity-50`
    : isOver ? 'border-emerald-600 ring-2 ring-emerald-300 bg-emerald-50'
    : 'border-emerald-400 ring-1 ring-emerald-200';
  return <div ref={setNodeRef} className={`${baseClass} transition-opacity ${state}`}>{children}</div>;
};

const HOUR_W = 80;
const NAME_W = 176;
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const PRIORITY_RANK: Record<Priority, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_BADGE: Record<Priority, string> = {
  emergency: 'bg-rose-100 text-rose-800 font-bold',
  high: 'bg-amber-100 text-amber-800 font-semibold',
  medium: 'bg-sky-100 text-sky-800',
  low: 'bg-slate-100 text-slate-700',
};

interface Props {
  jobs: Job[];
  technicians: Technician[];
  customerById: Map<string, { name: string }>;
  selectedDate: string;
  workingHoursStart: string; // company settings
  workingHoursEnd: string;
  eligibleFor: (techId: string | null) => boolean | undefined;
  onOpen: (job: Job) => void;
}

export const DispatchTimeline: React.FC<Props> = ({ jobs, technicians, customerById, selectedDate, workingHoursStart, workingHoursEnd, eligibleFor, onOpen }) => {
  const [qJob, setQJob] = useState('');
  const [qTech, setQTech] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const open = (job: Job) => ({
    onClick: () => onOpen(job),
    role: 'button' as const, tabIndex: 0, 'aria-label': `Open ${job.jobNumber}`,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(job); } },
  });

  const needle = qJob.trim().toLowerCase();
  const unassigned = jobs
    .filter((j) => !j.technicianId && j.status !== 'cancelled')
    .filter((j) => !needle || `${j.jobNumber} ${j.description} ${customerById.get(j.customerId)?.name || ''}`.toLowerCase().includes(needle))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.appointmentDate.localeCompare(b.appointmentDate));

  const dayJobs = jobs.filter((j) => j.appointmentDate === selectedDate && j.technicianId && j.status !== 'cancelled');
  // Axis = company work hours, widened to whole hours and to include any job booked outside them
  const CAPACITY_MIN = Math.max(60, mins(workingHoursEnd) - mins(workingHoursStart));
  const DAY_START = Math.floor(Math.min(mins(workingHoursStart), ...dayJobs.map((j) => mins(j.startTime))) / 60);
  const DAY_END = Math.min(24, Math.ceil(Math.max(mins(workingHoursEnd), ...dayJobs.map((j) => mins(j.endTime))) / 60));
  const trackW = (DAY_END - DAY_START) * HOUR_W;
  const offHours = [
    { from: DAY_START * 60, to: mins(workingHoursStart) },
    { from: mins(workingHoursEnd), to: DAY_END * 60 },
  ].filter((r) => r.to > r.from);
  const rows = technicians
    .filter((t) => t.active !== false)
    .map((t) => {
      const tj = dayJobs.filter((j) => j.technicianId === t.id);
      return { tech: t, jobs: tj, booked: tj.reduce((s, j) => s + Math.max(0, mins(j.endTime) - mins(j.startTime)), 0) };
    })
    .filter(({ tech, booked }) => {
      const n = qTech.trim().toLowerCase();
      if (n && !`${tech.name} ${tech.skills.join(' ')}`.toLowerCase().includes(n)) return false;
      return !availableOnly || booked < CAPACITY_MIN;
    });

  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const showNow = selectedDate === getTodayISO() && nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 items-start">
      {/* Unassigned queue */}
      <DropColumn id="none" eligible={eligibleFor(null)} baseClass="bg-slate-100/70 border rounded-lg p-3 flex flex-col lg:max-h-[70vh]" idleClass="border-slate-200">
        <div className="flex items-center justify-between pb-2">
          <span className="font-bold text-xs text-slate-700">Unassigned queue</span>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">{unassigned.length}</span>
        </div>
        <label className="relative mb-2">
          <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input value={qJob} onChange={(e) => setQJob(e.target.value)} placeholder="Search jobs…" aria-label="Search unassigned jobs"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded bg-white" />
        </label>
        <div className="space-y-2 overflow-y-auto flex-1">
          {unassigned.map((job) => (
            <DragCard id={job.id} key={job.id} {...open(job)}
              className={`bg-white p-2.5 rounded-lg border shadow-2xs hover:border-sky-300 cursor-grab active:cursor-grabbing space-y-1 ${job.slaBreached ? 'border-red-400' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono font-bold text-xs text-slate-900">{job.jobNumber}</span>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${PRIORITY_BADGE[job.priority]}`}>{job.priority}</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 truncate">{customerById.get(job.customerId)?.name}</p>
              <p className="text-[11px] text-slate-500 line-clamp-1">{job.description}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{job.appointmentDate} · {job.startTime}</span>
                {job.slaBreached && <span className="font-semibold text-red-600">SLA breached</span>}
              </div>
            </DragCard>
          ))}
          {unassigned.length === 0 && <div className="text-center py-8 text-xs text-slate-400">No unassigned jobs.</div>}
        </div>
        <p className="text-[11px] text-sky-700 pt-2">Drag a job onto a technician's row to assign.</p>
      </DropColumn>

      {/* Technician × time timeline */}
      <div className="bg-white border border-slate-200 rounded-lg min-w-0">
        <div className="p-2 border-b border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          <label className="relative">
            <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input value={qTech} onChange={(e) => setQTech(e.target.value)} placeholder="Find technician or skill…" aria-label="Find technician"
              className="pl-7 pr-2 py-1.5 border border-slate-200 rounded w-56" />
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} /> Available technicians only
          </label>
          <span className="ml-auto text-slate-500">{rows.length} of {technicians.length} technicians</span>
        </div>

        <div className="overflow-auto max-h-[70vh]">
          <div style={{ width: NAME_W + trackW }}>
            {/* hour header */}
            <div className="flex sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
              <div className="sticky left-0 z-30 bg-slate-50 px-3 py-1.5 font-semibold border-r border-slate-200" style={{ width: NAME_W }}>Technician</div>
              {hours.map((h) => (
                <div key={h} className="px-1 py-1.5 border-l border-slate-200 font-mono" style={{ width: HOUR_W }}>{String(h).padStart(2, '0')}:00</div>
              ))}
            </div>

            {rows.map(({ tech, jobs: tj, booked }) => {
              const pct = Math.min(100, Math.round((booked / CAPACITY_MIN) * 100));
              return (
                <DropColumn key={tech.id} id={tech.id} eligible={eligibleFor(tech.id)} baseClass="flex border-b border-slate-100 h-14" idleClass="border-slate-100">
                  <div className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-slate-200 shrink-0 flex flex-col justify-center gap-1" style={{ width: NAME_W }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tech.color }} />
                      <span className="font-bold text-xs text-slate-900 truncate">{tech.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title={`${(booked / 60).toFixed(1)}h of ${(CAPACITY_MIN / 60).toFixed(1)}h booked`}>
                      <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{(booked / 60).toFixed(1)}h</span>
                    </div>
                  </div>

                  <div className="relative shrink-0" style={{ width: trackW, backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px)', backgroundSize: `${HOUR_W}px 100%` }}>
                    {offHours.map((r) => (
                      <div key={r.from} className="absolute top-0 bottom-0 bg-slate-100/80" style={{ left: ((r.from - DAY_START * 60) / 60) * HOUR_W, width: ((r.to - r.from) / 60) * HOUR_W }} />
                    ))}
                    {showNow && <div className="absolute top-0 bottom-0 w-px bg-red-400 z-[5]" style={{ left: ((nowMin - DAY_START * 60) / 60) * HOUR_W }} />}
                    {tj.map((job) => {
                      const left = Math.max(0, ((mins(job.startTime) - DAY_START * 60) / 60) * HOUR_W);
                      const width = Math.max(48, ((mins(job.endTime) - mins(job.startTime)) / 60) * HOUR_W - 2);
                      return (
                        <DragCard id={job.id} key={job.id} {...open(job)}
                          title={`${job.jobNumber} · ${customerById.get(job.customerId)?.name || ''} · ${job.startTime}-${job.endTime}`}
                          className={`absolute top-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-white overflow-hidden cursor-grab active:cursor-grabbing shadow-2xs ${job.priority === 'emergency' || job.slaBreached ? 'ring-2 ring-red-500' : ''}`}
                          style={{ left, width, backgroundColor: tech.color }}>
                          <div className="text-[11px] font-mono font-bold leading-tight truncate">{job.jobNumber}</div>
                          <div className="text-[10px] leading-tight truncate opacity-90">{customerById.get(job.customerId)?.name}</div>
                        </DragCard>
                      );
                    })}
                  </div>
                </DropColumn>
              );
            })}
            {rows.length === 0 && <div className="text-center py-10 text-xs text-slate-400">No technicians match.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

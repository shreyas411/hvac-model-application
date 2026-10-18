import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus, Priority, JobType } from '../../types';
import { formatDateUK, getTodayISO, addDaysISO, canMoveJob } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconLayoutGrid, IconList, IconMapPin, IconPlus } from '@tabler/icons-react';
import { useServerPaged } from '../common/Pager';
import { JobDetailDrawer } from './JobDetailDrawer';
import { DispatchTimeline } from './DispatchTimeline';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { TechnicianProfile as Technician } from '../../types';

// Missing skills/licences for a tech on a job (empty = qualified)
const qualificationGap = (tech: Technician | undefined, job: Job): string[] => {
  const req = (job.requiredSkills || []).map((s) => s.toLowerCase());
  if (!tech || !req.length) return [];
  const have = tech.skills.map((s) => s.toLowerCase());
  return [
    ...req.filter((s) => !have.includes(s)),
    ...(req.includes('gas_safe') && !tech.gasSafeLicense ? ['Gas Safe License'] : []),
    ...(req.includes('f_gas') && !tech.fGasLicense ? ['F-Gas License'] : []),
  ];
};

interface DispatchBoardViewProps {
  onOpenQuickAction: (action: 'job') => void;
  selectedJobId?: string | null;
  onSelectJob?: (id: string | null) => void;
}

export const DispatchBoardView: React.FC<DispatchBoardViewProps> = ({
  onOpenQuickAction,
  selectedJobId,
  onSelectJob,
}) => {
  const {
    jobs,
    technicians,
    customers,
    updateJob,

    updateJobStatus, 
    checkScheduleConflict,
    showToast,
    currentUser,
    customerById,
    settings,
  } = useApp(['jobs', 'technicians', 'customers', 'updateJob', 'updateJobStatus', 'checkScheduleConflict', 'showToast', 'currentUser', 'customerById', 'settings']);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const paged = useServerPaged<Job>('/jobs', { q: q.trim() || undefined, status: status || undefined, from: from || undefined, to: to || undefined }, jobs);

  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO()); // Today
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [forceStatus, setForceStatus] = useState(false); // admin-only: send override=true to skip the workflow

  // Quick state for modal editing/rescheduling
  const [modalDate, setModalDate] = useState<string>('');
  const [modalStartTime, setModalStartTime] = useState<string>('');
  const [modalEndTime, setModalEndTime] = useState<string>('');
  const [modalTechnicianId, setModalTechnicianId] = useState<string>('');
  const [modalDescription, setModalDescription] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [certWarning, setCertWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // guards double-save

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setModalDate(job.appointmentDate);
    setModalStartTime(job.startTime);
    setModalEndTime(job.endTime);
    setModalTechnicianId(job.technicianId || '');
    setModalDescription(job.description);
    setConflictWarning(null);
    setCertWarning(null);
  };

  useEscape(!!editingJob, () => setEditingJob(null));

  // Deep link from the dashboard: open that job's details once, then clear the selection
  useEffect(() => {
    const j = selectedJobId ? jobs.find((x) => x.id === selectedJobId) : undefined;
    if (j) { setViewingJob(j); onSelectJob?.(null); }
  }, [selectedJobId, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    // Check certification first
    if (modalTechnicianId) {
      const tech = technicians.find(t => t.id === modalTechnicianId);
      const gap = qualificationGap(tech, editingJob);
      if (gap.length > 0) {
        setCertWarning(`Certification Gap: Technician lacks required qualifications for this job. Missing: ${gap.join(', ')}`);
        return;
      }
    }


    // Check conflict
    if (modalTechnicianId) {
      const conflict = checkScheduleConflict(
        modalTechnicianId,
        modalDate,
        modalStartTime,
        modalEndTime,
        editingJob.id
      );

      if (conflict) {
        setConflictWarning(
          `Scheduling Conflict Warning: The selected technician is already assigned to ${conflict.jobNumber} from ${conflict.startTime} to ${conflict.endTime} on ${modalDate}.`
        );
        return;
      }
    }

    const durationMins = Math.max(
      30,
      ((parseInt(modalEndTime.split(':')[0]) * 60 + parseInt(modalEndTime.split(':')[1])) -
        (parseInt(modalStartTime.split(':')[0]) * 60 + parseInt(modalStartTime.split(':')[1])))
    );

    setBusy(true);
    const ok = await updateJob(
      editingJob.id,
      {
        appointmentDate: modalDate,
        startTime: modalStartTime,
        endTime: modalEndTime,
        technicianId: modalTechnicianId || null,
        description: modalDescription,
        estimatedDurationMinutes: durationMins,
        status: editingJob.status === 'new' && modalTechnicianId ? 'scheduled' : editingJob.status,
      },
      `Rescheduled appointment to ${modalDate} ${modalStartTime}-${modalEndTime} (${modalTechnicianId ? 'Assigned' : 'Unassigned'})`
    );
    setBusy(false);
    if (ok) setEditingJob(null); // stay open on failure so the edits aren't lost
  };


  // Drag & drop: drop on a technician column assigns (to the viewed date); drop on Unassigned clears
  const [dragging, setDragging] = useState<Job | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), // so plain clicks still open the job
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }), // long-press to drag, scroll otherwise
  );
  // Why `job` can't go to `techId` (null = allowed)
  const dropBlocker = (job: Job, techId: string | null): string | null => {
    if (!techId) return null;
    const tech = technicians.find((t) => t.id === techId);
    const gap = qualificationGap(tech, job);
    if (gap.length) return `${tech?.name} can't take ${job.jobNumber}: missing ${gap.join(', ')}`;
    const c = checkScheduleConflict(techId, selectedDate, job.startTime, job.endTime, job.id);
    if (c) return `${tech?.name} already has ${c.jobNumber} ${c.startTime}-${c.endTime} on ${selectedDate}`;
    return null;
  };
  const eligibleFor = (techId: string | null) => (dragging ? !dropBlocker(dragging, techId) : undefined);
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const job = jobs.find((j) => j.id === active.id);
    if (!job || !over || busy) return;
    const techId = over.id === 'none' ? null : String(over.id);
    if ((job.technicianId || null) === techId && (!techId || job.appointmentDate === selectedDate)) return;
    const blocked = dropBlocker(job, techId);
    if (blocked) { showToast(`Not allowed: ${blocked}`, 'error'); return; }
    setBusy(true);
    await updateJob(
      job.id,
      techId
        ? { technicianId: techId, appointmentDate: selectedDate, status: job.status === 'new' ? 'scheduled' : job.status }
        : { technicianId: null },
      techId ? `Assigned by drag & drop on ${selectedDate}` : 'Unassigned by drag & drop'
    );
    setBusy(false);
  };

  const statusColors: Record<JobStatus, { bg: string; text: string; label: string }> = {
    new: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-800', label: 'New / Unassigned' },
    awaiting_approval: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'Awaiting Approval' },
    scheduled: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-800', label: 'Scheduled' },
    dispatched: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', label: 'Dispatched / En Route' },
    in_progress: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-900', label: 'In Progress (On Site)' },
    on_hold: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-900', label: 'On Hold' },
    completed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Completed' },
    cancelled: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-400', label: 'Cancelled' },
  };

  const STATUSES = Object.keys(statusColors) as JobStatus[];

  const priorityBadges: Record<Priority, string> = {
    emergency: 'bg-rose-100 text-rose-800 font-bold',
    high: 'bg-amber-100 text-amber-800 font-semibold',
    medium: 'bg-sky-100 text-sky-800',
    low: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Scheduling & Dispatch Board
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time appointment assignment, route dispatch, and conflict prevention
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('board')}
              aria-pressed={viewMode === 'board'}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'board' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconLayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Dispatch Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconList className="w-3.5 h-3.5" aria-hidden="true" />
              <span>List View</span>
            </button>
          </div>

          <button
            onClick={() => onOpenQuickAction('job')}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Book New Job</span>
          </button>
        </div>
      </div>

      {/* Date Navigation Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedDate(addDaysISO(selectedDate, -1));
            }}
            className="p-1.5 hover:bg-slate-100 rounded border border-slate-200"
            title="Previous Day" aria-label="Previous day"
          >
            <IconChevronLeft className="w-4 h-4 text-slate-600" aria-hidden="true" />
          </button>

          <span className="font-bold text-slate-900 text-sm px-2">
            {formatDateUK(selectedDate)} {selectedDate === getTodayISO() && '(Today)'}
          </span>

          <button
            onClick={() => {
              setSelectedDate(addDaysISO(selectedDate, 1));
            }}
            className="p-1.5 hover:bg-slate-100 rounded border border-slate-200"
            title="Next Day" aria-label="Next day"
          >
            <IconChevronRight className="w-4 h-4 text-slate-600" aria-hidden="true" />
          </button>

          <button
            onClick={() => setSelectedDate(getTodayISO())}
            className="ml-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs"
          >
            Jump to Today
          </button>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <span>Active Technicians: <strong className="text-slate-800">{technicians.length}</strong></span>
          <span>·</span>
          <span>Jobs this date: <strong className="text-slate-800">{jobs.filter((j) => j.appointmentDate === selectedDate).length}</strong></span>
        </div>
      </div>

      {/* Board Mode: unassigned queue + technician timeline */}
      {viewMode === 'board' && (
        <DndContext sensors={sensors} onDragStart={(e) => setDragging(jobs.find((j) => j.id === e.active.id) || null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <DispatchTimeline jobs={jobs} technicians={technicians} customerById={customerById} selectedDate={selectedDate} workingHoursStart={settings.workingHoursStart} workingHoursEnd={settings.workingHoursEnd} eligibleFor={eligibleFor} onOpen={setViewingJob} />
          <DragOverlay>
            {dragging && <div className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-mono font-bold shadow-lg">{dragging.jobNumber}</div>}
          </DragOverlay>
        </DndContext>
      )}

      {/* IconList View Mode */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              All Scheduled Jobs ({paged.total})
            </span>
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-2.5 px-3">Job Number</th>
                  <th scope="col" className="py-2.5 px-3">Date & Time</th>
                  <th scope="col" className="py-2.5 px-3">Type</th>
                  <th scope="col" className="py-2.5 px-3">Customer & Location</th>
                  <th scope="col" className="py-2.5 px-3">Technician</th>
                  <th scope="col" className="py-2.5 px-3">Priority</th>
                  <th scope="col" className="py-2.5 px-3">Status</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.rows.map((job) => {
                  const cust = customerById.get(job.customerId);
                  const tech = technicians.find((t) => t.id === job.technicianId);
                  const loc = cust?.serviceLocations.find((l) => l.id === job.locationId);

                  return (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {job.jobNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium text-slate-900 block">{job.appointmentDate}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{job.startTime} - {job.endTime}</span>
                      </td>
                      <td className="py-2.5 px-3 capitalize text-slate-700">
                        {job.type.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <span className="font-semibold text-slate-900 block truncate">{cust?.name}</span>
                        <span className="text-[11px] text-slate-500 block truncate">{loc?.city}, {loc?.postcode}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {tech ? (
                          <span className="font-medium text-slate-900">{tech.name}</span>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${priorityBadges[job.priority]}`}>
                          {job.priority}
                        </span>
                        {job.slaBreached && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-600 text-white">SLA breached</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="capitalize text-slate-700 font-medium">
                          {job.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setViewingJob(job)}
                          aria-label={`View details of ${job.jobNumber}`} className="px-2 py-1 text-xs text-slate-700 hover:text-slate-900 font-semibold hover:bg-slate-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEditModal(job)}
                          aria-label={`Edit or reassign ${job.jobNumber}`} className="px-2 py-1 text-xs text-sky-700 hover:text-sky-900 font-semibold hover:bg-sky-50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          Edit / Reassign
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paged.pager}
        </div>
      )}

      {viewingJob && (
        <JobDetailDrawer
          job={viewingJob}
          onClose={() => setViewingJob(null)}
          onEdit={() => { openEditModal(viewingJob); setViewingJob(null); }}
        />
      )}

      {/* Reschedule / Reassign Modal with Scheduling Conflict Warning */}
      {editingJob && (
        <div role="dialog" aria-modal="true" aria-label={`Reschedule ${editingJob.jobNumber}`} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Reschedule & Assign {editingJob.jobNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Detects technician overlaps and maintains audit history
                </p>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                aria-label="Close" className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <form onSubmit={handleModalSave} className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* Conflict warning banner */}
              {conflictWarning && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                  <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs">
                    <p className="font-bold">Scheduling Conflict!</p>
                    <p className="mt-0.5">{conflictWarning}</p>
                    <p className="mt-1 text-[11px] text-rose-700 font-medium">
                      {conflictWarning.includes('buffer') 
                        ? 'Pro Tip: Try moving the start time back by 30 mins to accommodate travel.' 
                        : 'Please choose a different technician or a completely different time slot.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Certification warning banner */}
              {certWarning && (
                <div role="alert" className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-start gap-2">
                  <IconAlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs">
                    <p className="font-bold">Certification Requirement Gap!</p>
                    <p className="mt-0.5">{certWarning}</p>
                    <p className="mt-1 text-[11px] text-amber-700">This technician is not qualified for the required skills/licenses of this job. Assignment blocked for safety.</p>
                  </div>
                </div>
              )}

              {/* Technician selection */}
              <div>
                <label htmlFor="ds-tech" className="block font-semibold text-slate-700 mb-1">
                  Assign Technician
                </label>
                <select
                  id="ds-tech" value={modalTechnicianId}
                  onChange={(e) => {
                    setModalTechnicianId(e.target.value);
                    setConflictWarning(null);
                    setCertWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">-- Leave Unassigned --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.skills.slice(0, 2).join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & times */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="ds-date" className="block font-semibold text-slate-700 mb-1">Appointment Date</label>
                  <input
                    type="date"
                    required
                    id="ds-date" value={modalDate}
                    onChange={(e) => {
                      setModalDate(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="ds-start" className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    id="ds-start" value={modalStartTime}
                    onChange={(e) => {
                      setModalStartTime(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="ds-end" className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    id="ds-end" value={modalEndTime}
                    onChange={(e) => {
                      setModalEndTime(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Work description */}
              <div>
                <label htmlFor="ds-desc" className="block font-semibold text-slate-700 mb-1">Work Instructions</label>
                <textarea
                  rows={2}
                  id="ds-desc" name="description" value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Status Update Quick Buttons */}
              <div className="pt-2 border-t border-slate-100">
                <span className="block font-semibold text-slate-700 mb-1.5">Update Status:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['new', 'awaiting_approval', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled'] as JobStatus[]).map((st) => {
                    const current = jobs.find((j) => j.id === editingJob.id)?.status ?? editingJob.status;
                    const forced = forceStatus && currentUser.role === 'admin';
                    return (
                    <button
                      key={st}
                      type="button"
                      disabled={current !== st && !forced && !canMoveJob(current, st)}
                      aria-pressed={current === st}
                      onClick={() => updateJobStatus(editingJob.id, st, undefined, forced || undefined)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border disabled:opacity-40 disabled:cursor-not-allowed ${
                        current === st
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                    );
                  })}
                </div>
                {currentUser.role === 'admin' && (
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input type="checkbox" checked={forceStatus} onChange={(e) => setForceStatus(e.target.checked)} />
                    Force status (skip workflow rules)
                  </label>
                )}
              </div>

              {/* Audit trail preview */}
              <div className="pt-2 border-t border-slate-100">
                <span className="block font-semibold text-slate-700 mb-1">Audit Trail History</span>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded border border-slate-200 text-[10px]">
                  {editingJob.auditTrail.map((log, idx) => (
                    <div key={idx} className="text-slate-600">
                      <span className="font-semibold text-slate-900">{log.action}</span> by {log.userName} at {new Date(log.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}: {log.details}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy} className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus, Priority, JobType } from '../../types';
import { formatDateUK, getTodayISO, addDaysISO, canMoveJob } from '../../utils/formatters';
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconEye, IconLayoutGrid, IconList, IconMapPin, IconPencil, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { DatePicker, DateRangePicker } from '../common/DatePicker';
import { DetailDrawer } from '../common/DetailDrawer';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { SortHead, useServerPaged } from '../common/Pager';
import { JobDetailDrawer } from './JobDetailDrawer';
import { DispatchTimeline } from './DispatchTimeline';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { TechnicianProfile as Technician } from '../../types';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Textarea } from '@/src/components/ui/textarea';

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
  const [modalTitle, setModalTitle] = useState<string>('');
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
    setModalTitle(job.title ?? '');
    setModalDescription(job.description);
    setConflictWarning(null);
    setCertWarning(null);
  };

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
        title: modalTitle.trim(),
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
    useSensor(KeyboardSensor), // focus a card, Space to lift, arrows to move, Space to drop
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
    if (techId && job.appointmentDate !== selectedDate) showToast(`${job.jobNumber} moved from ${formatDateUK(job.appointmentDate)} to ${formatDateUK(selectedDate)}`);
    setBusy(false);
  };

  const statusColors: Record<JobStatus, { bg: string; text: string; label: string }> = {
    new: { bg: 'bg-muted border-border', text: 'text-foreground', label: 'New / Unassigned' },
    awaiting_approval: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'Awaiting Approval' },
    scheduled: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-800', label: 'Scheduled' },
    dispatched: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', label: 'Dispatched / En Route' },
    in_progress: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-900', label: 'In Progress (On Site)' },
    on_hold: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-900', label: 'On Hold' },
    completed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Completed' },
    cancelled: { bg: 'bg-muted/50 border-border', text: 'text-muted-foreground', label: 'Cancelled' },
  };

  const STATUSES = Object.keys(statusColors) as JobStatus[];

  const priorityBadges: Record<Priority, string> = {
    emergency: 'bg-rose-100 text-rose-800 font-bold',
    high: 'bg-amber-100 text-amber-800 font-semibold',
    medium: 'bg-sky-100 text-sky-800',
    low: 'bg-muted text-foreground',
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">

      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">
            Scheduling & Dispatch Board
          </h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'job' : 'jobs'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time appointment assignment, route dispatch, and conflict prevention
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted p-1 rounded-lg border border-border gap-1">
            <Button variant={viewMode === 'board' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('board')} aria-pressed={viewMode === 'board'}>
              <IconLayoutGrid aria-hidden="true" />
              <span>Dispatch Board</span>
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}>
              <IconList aria-hidden="true" />
              <span>List View</span>
            </Button>
          </div>

          <Button size="sm" onClick={() => onOpenQuickAction('job')}>
            <IconPlus aria-hidden="true" />
            <span>Book New Job</span>
          </Button>
        </div>
      </div>

      {/* Date Navigation Strip (board only) */}
      {viewMode === 'board' && (
      <Card className="gap-3 py-3 px-3 flex-col sm:flex-row items-center justify-between text-xs">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setSelectedDate(addDaysISO(selectedDate, -1))} title="Previous Day" aria-label="Previous day">
            <IconChevronLeft aria-hidden="true" />
          </Button>

          <span className="font-bold text-sm px-2">
            {formatDateUK(selectedDate)} {selectedDate === getTodayISO() && '(Today)'}
          </span>

          <Button variant="outline" size="icon-sm" onClick={() => setSelectedDate(addDaysISO(selectedDate, 1))} title="Next Day" aria-label="Next day">
            <IconChevronRight aria-hidden="true" />
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setSelectedDate(getTodayISO())} className="ml-2">
            Jump to Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground">
          <span>Active Technicians: <strong className="text-foreground">{technicians.length}</strong></span>
          <span>·</span>
          <span>Jobs this date: <strong className="text-foreground">{jobs.filter((j) => j.appointmentDate === selectedDate).length}</strong></span>
        </div>
      </Card>
      )}

      {/* Board Mode: unassigned queue + technician timeline */}
      {viewMode === 'board' && (
        <DndContext sensors={sensors} onDragStart={(e) => setDragging(jobs.find((j) => j.id === e.active.id) || null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <DispatchTimeline jobs={jobs} technicians={technicians} customerById={customerById} selectedDate={selectedDate} workingHoursStart={settings.workingHoursStart} workingHoursEnd={settings.workingHoursEnd} eligibleFor={eligibleFor} onOpen={setViewingJob} />
          <DragOverlay>
            {dragging && <div className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs tabular-nums font-semibold shadow-lg">{dragging.jobNumber}</div>}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View Mode */}
      {viewMode === 'list' && (<>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" autoComplete="off" placeholder="Search job no., title or notes…" className="pl-9 h-8 text-xs" />
          </div>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger aria-label="Filter by status" size="sm" className="w-40 text-xs capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangePicker value={{ from, to }} onChange={(r) => { setFrom(r.from); setTo(r.to); }} />
          {(q || status || from || to) && <Button type="button" variant="ghost" size="xs" onClick={() => { setQ(''); setStatus(''); setFrom(''); setTo(''); }}><IconX aria-hidden="true" />Clear filters</Button>}
        </div>

        <div style={{ '--table-offset': '19.5rem' } as React.CSSProperties}><TableCard footer={paged.pager}>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <SortHead paged={paged} by="jobNumber">Job Number</SortHead>
                <SortHead paged={paged} by="appointmentDate">Date & Time</SortHead>
                <SortHead paged={paged} by="type">Type</SortHead>
                <SortHead paged={paged} by="customer.name">Customer & Location</SortHead>
                <SortHead paged={paged} by="technician.name">Technician</SortHead>
                <SortHead paged={paged} by="priority">Priority</SortHead>
                <SortHead paged={paged} by="status">Status</SortHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.rows.map((job) => {
                const cust = customerById.get(job.customerId);
                const tech = technicians.find((t) => t.id === job.technicianId);
                const loc = cust?.serviceLocations.find((l) => l.id === job.locationId);

                return (
                  <TableRow key={job.id}>
                    <TableCell className="tabular-nums font-semibold">
                      <button type="button" onClick={() => setViewingJob(job)} className="rounded hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{job.jobNumber}</button>
                      <span className="block text-[11px] font-sans font-medium truncate max-w-[220px]">{job.title}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium block">{formatDateUK(job.appointmentDate)}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{job.startTime} - {job.endTime}</span>
                    </TableCell>
                    <TableCell className="capitalize">{job.type.replace('_', ' ')}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="font-semibold block truncate">{cust?.name}</span>
                      <span className="text-[11px] text-muted-foreground block truncate">{loc?.city}, {loc?.postcode}</span>
                    </TableCell>
                    <TableCell>
                      {tech ? (
                        <span className="font-medium">{tech.name}</span>
                      ) : (
                        <span className="text-amber-600 font-medium italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] uppercase ${priorityBadges[job.priority]}`}>{job.priority}</Badge>
                      {job.slaBreached && <Badge variant="destructive" className="ml-1 text-[10px] uppercase">SLA breached</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${statusColors[job.status].bg} ${statusColors[job.status].text}`}>{job.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <RowActions subject={job.jobNumber} actions={[
                        { icon: IconEye, label: 'View', onClick: () => setViewingJob(job) },
                        { icon: IconPencil, label: 'Edit / reassign', onClick: () => openEditModal(job) },
                      ]} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.rows.length === 0 && !paged.loading && (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No jobs match these filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableCard></div>
      </>)}

      {viewingJob && (
        <JobDetailDrawer
          job={viewingJob}
          onClose={() => setViewingJob(null)}
          onEdit={() => { openEditModal(viewingJob); setViewingJob(null); }}
        />
      )}

      {/* Reschedule / Reassign Drawer with Scheduling Conflict Warning */}
      {editingJob && (
        <DetailDrawer onClose={() => setEditingJob(null)} title={`Reschedule & Assign ${editingJob.jobNumber}`} description="Detects technician overlaps and maintains audit history"
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button type="submit" form="dispatch-edit-form" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save Schedule'}</Button>
          </>}>
            <form id="dispatch-edit-form" onSubmit={handleModalSave} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="ds-title" className="text-xs">Job Title</Label>
                <Input required maxLength={200} autoComplete="off" id="ds-title" name="title" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} />
              </div>

              {/* Conflict warning banner */}
              {conflictWarning && (
                <Alert variant="destructive" className="bg-rose-50 border-rose-300 text-rose-900 animate-in fade-in slide-in-from-top-2">
                  <IconAlertTriangle aria-hidden="true" />
                  <AlertTitle>Scheduling Conflict!</AlertTitle>
                  <AlertDescription className="text-rose-900">
                    <p>{conflictWarning}</p>
                    <p className="mt-1 text-[11px] text-rose-700 font-medium">
                      {conflictWarning.includes('buffer')
                        ? 'Pro Tip: Try moving the start time back by 30 mins to accommodate travel.'
                        : 'Please choose a different technician or a completely different time slot.'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Certification warning banner */}
              {certWarning && (
                <Alert className="bg-amber-50 border-amber-300 text-amber-900">
                  <IconAlertTriangle className="text-amber-600" aria-hidden="true" />
                  <AlertTitle>Certification Requirement Gap!</AlertTitle>
                  <AlertDescription className="text-amber-900">
                    <p>{certWarning}</p>
                    <p className="mt-1 text-[11px] text-amber-700">This technician is not qualified for the required skills/licenses of this job. Assignment blocked for safety.</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Technician selection */}
              <div className="space-y-1.5">
                <Label htmlFor="ds-tech" className="text-xs">Assign Technician</Label>
                <Select value={modalTechnicianId || 'none'} onValueChange={(v) => { setModalTechnicianId(v === 'none' ? '' : v); setConflictWarning(null); setCertWarning(null); }}>
                  <SelectTrigger id="ds-tech" className="w-full" style={{ borderLeft: `4px solid ${technicians.find((t) => t.id === modalTechnicianId)?.color ?? '#cbd5e1'}` }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Leave Unassigned --</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}><span style={{ color: t.color }}>●</span> {t.name} ({t.skills.slice(0, 2).join(', ')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date & times */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ds-date" className="text-xs">Appointment Date</Label>
                  <div><DatePicker id="ds-date" value={modalDate} onChange={(v) => { setModalDate(v); setConflictWarning(null); }} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-start" className="text-xs">Start Time</Label>
                  <Input type="time" required id="ds-start" value={modalStartTime} onChange={(e) => { setModalStartTime(e.target.value); setConflictWarning(null); }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-end" className="text-xs">End Time</Label>
                  <Input type="time" required id="ds-end" value={modalEndTime} onChange={(e) => { setModalEndTime(e.target.value); setConflictWarning(null); }} />
                </div>
              </div>

              {/* Work description */}
              <div className="space-y-1.5">
                <Label htmlFor="ds-desc" className="text-xs">Work Instructions</Label>
                <Textarea rows={2} id="ds-desc" name="description" value={modalDescription} onChange={(e) => setModalDescription(e.target.value)} />
              </div>

              {/* Status Update Quick Buttons */}
              <div className="pt-2 border-t border-border">
                <span className="block font-semibold mb-1.5">Update Status:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['new', 'awaiting_approval', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled'] as JobStatus[]).map((st) => {
                    const current = jobs.find((j) => j.id === editingJob.id)?.status ?? editingJob.status;
                    const forced = forceStatus && currentUser.role === 'admin';
                    return (
                      <Button
                        key={st}
                        type="button"
                        variant={current === st ? 'default' : 'outline'}
                        size="xs"
                        disabled={current !== st && !forced && !canMoveJob(current, st)}
                        aria-pressed={current === st}
                        onClick={() => updateJobStatus(editingJob.id, st, undefined, forced || undefined)}
                        className="capitalize"
                      >
                        {st.replace('_', ' ')}
                      </Button>
                    );
                  })}
                </div>
                {currentUser.role === 'admin' && (
                  <Label className="mt-1.5 text-[11px] font-normal text-muted-foreground">
                    <Checkbox checked={forceStatus} onCheckedChange={(v) => setForceStatus(v === true)} />
                    Force status (skip workflow rules)
                  </Label>
                )}
              </div>

              {/* Audit trail preview */}
              <div className="pt-2 border-t border-border">
                <span className="block font-semibold mb-1">Audit Trail History</span>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-muted/50 p-2 rounded border border-border text-[10px]">
                  {editingJob.auditTrail.map((log, idx) => (
                    <div key={idx} className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{log.action}</span> by {log.userName} at {new Date(log.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}: {log.details}
                    </div>
                  ))}
                </div>
              </div>
            </form>
        </DetailDrawer>
      )}

    </div>
  );
};

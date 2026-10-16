import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus, Priority, JobType } from '../../types';
import { formatGBP, formatDateUK, getTodayISO, canMoveJob } from '../../utils/formatters';
import {
  Calendar as CalendarIcon,
  Clock, 
  AlertTriangle, 
  Plus, 
  User, 
  MapPin, 
  CheckCircle2, 
  Wrench, 
  History, 
  Edit2, 
  Trash2, 
  FileText,
  ChevronLeft,
  ChevronRight,
  List,
  Grid
} from 'lucide-react';

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
  console.log('%c[SCHE-DEBUG] 🛠️ DispatchBoardView Component Mounted', 'color: #ff00ff; font-weight: bold;');
  const {
    jobs,
    technicians,
    customers,
    equipment,
    updateJob,

    updateJobStatus, 
    checkScheduleConflict,
    currentUser,
    parts
  } = useApp();

  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO()); // Today
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [forceStatus, setForceStatus] = useState(false); // admin-only: send override=true to skip the workflow

  // Quick state for modal editing/rescheduling
  const [modalDate, setModalDate] = useState<string>('');
  const [modalStartTime, setModalStartTime] = useState<string>('');
  const [modalEndTime, setModalEndTime] = useState<string>('');
  const [modalTechnicianId, setModalTechnicianId] = useState<string>('');
  const [modalDescription, setModalDescription] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [certWarning, setCertWarning] = useState<string | null>(null);

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

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    // Check certification first
    if (modalTechnicianId) {
      const tech = technicians.find(t => t.id === modalTechnicianId);
      const required = editingJob.requiredSkills || [];

      if (required.length > 0 && tech) {
        const techSkillsLower = tech.skills.map(s => s.toLowerCase());
        const missingSkills = required.filter(s => !techSkillsLower.includes(s.toLowerCase()));
        const missingLicenses: string[] = [];
        if (required.some(s => s.toLowerCase() === 'gas_safe') && !tech.gasSafeLicense) missingLicenses.push('Gas Safe License');
        if (required.some(s => s.toLowerCase() === 'f_gas') && !tech.fGasLicense) missingLicenses.push('F-Gas License');

        if (missingSkills.length > 0 || missingLicenses.length > 0) {
          const details = [
            ...(missingSkills.length ? [`Missing skills: ${missingSkills.join(', ')}`] : []),
            ...(missingLicenses.length ? [`Missing licenses: ${missingLicenses.join(', ')}`] : [])
          ].join('; ');

          console.warn('[Scheduling Guard] Blocked by Certification Gap:', details);
          setCertWarning(`Certification Gap: Technician lacks required qualifications for this job. ${details}`);
          return;
        }
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

    console.log('%c[DEBUG] 🚀 Step 1: handleModalSave triggered', 'color: blue; font-weight: bold; font-size: 14px;');
    console.log('[DEBUG] Current state:', { modalDate, modalStartTime, modalEndTime, modalTechnicianId });

    try {
      await updateJob(
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
      console.log('%c[DEBUG] ✅ Step 2: updateJob call completed successfully', 'color: green; font-weight: bold; font-size: 14px;');
    } catch (e) {
      console.error('%c[DEBUG] ❌ Step 2: updateJob call failed', 'color: red; font-weight: bold; font-size: 14px;', e);
    }

    setEditingJob(null);
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
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'board' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Dispatch Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          <button
            onClick={() => onOpenQuickAction('job')}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book New Job</span>
          </button>
        </div>
      </div>

      {/* Date Navigation Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className="p-1.5 hover:bg-slate-100 rounded border border-slate-200"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>

          <span className="font-bold text-slate-900 text-sm px-2">
            {formatDateUK(selectedDate)} {selectedDate === getTodayISO() && '(Today)'}
          </span>

          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className="p-1.5 hover:bg-slate-100 rounded border border-slate-200"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
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

      {/* Board Mode: Columns by Technician + Unassigned Drawer */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Unassigned / Floating column */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <span className="font-bold text-xs text-slate-700">Unassigned / Pending</span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {jobs.filter((j) => !j.technicianId && j.status !== 'cancelled').length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {jobs
                .filter((j) => !j.technicianId && j.status !== 'cancelled')
                .map((job) => {
                  const cust = customers.find((c) => c.id === job.customerId);
                  return (
                    <div
                      key={job.id}
                      onClick={() => openEditModal(job)}
                      className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:border-sky-300 cursor-pointer space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900">{job.jobNumber}</span>
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${priorityBadges[job.priority]}`}>
                          {job.priority}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 line-clamp-1">{cust?.name}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{job.description}</p>
                      <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Target: {job.appointmentDate}</span>
                        <span className="font-medium text-sky-700">Assign →</span>
                      </div>
                    </div>
                  );
                })}
              {jobs.filter((j) => !j.technicianId && j.status !== 'cancelled').length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  No unassigned jobs pending.
                </div>
              )}
            </div>
          </div>

          {/* Columns for each Technician */}
          {technicians.map((tech) => {
            const techJobs = jobs.filter(
              (j) => j.technicianId === tech.id && j.appointmentDate === selectedDate && j.status !== 'cancelled'
            );

            return (
              <div
                key={tech.id}
                className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col shadow-2xs"
              >
                {/* Tech Column Header */}
                <div className="pb-2 border-b border-slate-100 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: tech.color }} 
                      />
                      <span className="font-bold text-xs text-slate-900">{tech.name}</span>
                    </div>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                      {techJobs.length} {techJobs.length === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span className="font-mono">{tech.vanRegistration || 'Van Rota'}</span>
                    <span className="line-clamp-1">{tech.skills[0]}</span>
                  </div>
                </div>

                {/* Assigned Job Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {techJobs.map((job) => {
                    const cust = customers.find((c) => c.id === job.customerId);
                    const loc = cust?.serviceLocations.find((l) => l.id === job.locationId);
                    const statusInfo = statusColors[job.status] || statusColors.scheduled;

                    return (
                      <div
                        key={job.id}
                        onClick={() => openEditModal(job)}
                        className={`p-3 rounded-lg border shadow-2xs hover:shadow-sm cursor-pointer space-y-2 transition-all ${statusInfo.bg}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {job.startTime} - {job.endTime}
                          </span>
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${priorityBadges[job.priority]}`}>
                            {job.priority}
                          </span>
                        </div>

                        <div>
                          <span className="font-bold text-xs text-slate-900 block line-clamp-1">
                            {cust?.name}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{loc?.addressLine1}, {loc?.postcode}</span>
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {job.description}
                        </p>

                        <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[11px]">
                          <span className={`font-semibold ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                          <span className="font-mono text-slate-500">{job.jobNumber}</span>
                        </div>
                      </div>
                    );
                  })}

                  {techJobs.length === 0 && (
                    <div className="text-center py-10 text-xs text-slate-400">
                      No jobs scheduled on {formatDateUK(selectedDate)}.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View Mode */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              All Scheduled Jobs ({jobs.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Job Number</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Customer & Location</th>
                  <th className="py-2.5 px-3">Technician</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => {
                  const cust = customers.find((c) => c.id === job.customerId);
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
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="capitalize text-slate-700 font-medium">
                          {job.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => openEditModal(job)}
                          className="px-2 py-1 text-xs text-sky-700 hover:text-sky-900 font-semibold hover:bg-sky-50 rounded"
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
        </div>
      )}

      {/* Reschedule / Reassign Modal with Scheduling Conflict Warning */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSave} className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* Conflict warning banner */}
              {conflictWarning && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
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
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Certification Requirement Gap!</p>
                    <p className="mt-0.5">{certWarning}</p>
                    <p className="mt-1 text-[11px] text-amber-700">This technician is not qualified for the required skills/licenses of this job. Assignment blocked for safety.</p>
                  </div>
                </div>
              )}

              {/* Technician selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assign Technician
                </label>
                <select
                  value={modalTechnicianId}
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
                  <label className="block font-semibold text-slate-700 mb-1">Appointment Date</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => {
                      setModalDate(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={modalStartTime}
                    onChange={(e) => {
                      setModalStartTime(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={modalEndTime}
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
                <label className="block font-semibold text-slate-700 mb-1">Work Instructions</label>
                <textarea
                  rows={2}
                  value={modalDescription}
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
                      <span className="font-semibold text-slate-900">{log.action}</span> by {log.userName} at {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: {log.details}
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
                  className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

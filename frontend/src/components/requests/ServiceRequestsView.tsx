import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Priority, ServiceRequest } from '../../types';
import { formatDateUK, getTodayISO } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconAlertTriangle, IconArrowRight, IconCircleCheck, IconInbox, IconPlus } from '@tabler/icons-react';

interface ServiceRequestsViewProps {
  onOpenQuickAction: (action: 'request' | 'job') => void;
  onNavigateTab: (tab: string) => void;
}

export const ServiceRequestsView: React.FC<ServiceRequestsViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { 
    serviceRequests, 
    customers, 
    equipment, 
    technicians, 
    convertRequestToJob,
    checkScheduleConflict,
    customerById,
  } = useApp(['serviceRequests', 'customers', 'equipment', 'technicians', 'convertRequestToJob', 'checkScheduleConflict', 'customerById']);

  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'awaiting_approval' | 'converted'>('all');
  
  // Convert modal
  const [convertingRequest, setConvertingRequest] = useState<ServiceRequest | null>(null);
  const [assignDate, setAssignDate] = useState<string>(getTodayISO());
  const [assignStartTime, setAssignStartTime] = useState<string>('09:00');
  const [assignEndTime, setAssignEndTime] = useState<string>('11:30');
  const [assignTechId, setAssignTechId] = useState<string>(technicians[0]?.id || '');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // guards double-submit (would book the job twice)

  const filteredRequests = serviceRequests.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  useEscape(!!convertingRequest, () => setConvertingRequest(null));

  const handleOpenConvert = (sr: ServiceRequest) => {
    setConvertingRequest(sr);
    setAssignDate(getTodayISO());
    setAssignStartTime(sr.preferredSlot === 'afternoon' ? '13:00' : '09:00');
    setAssignEndTime(sr.preferredSlot === 'afternoon' ? '15:30' : '11:30');
    setAssignTechId(technicians[0]?.id || '');
    setConflictWarning(null);
  };

  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingRequest) return;

    // Check conflict
    if (assignTechId) {
      const conflict = checkScheduleConflict(
        assignTechId,
        assignDate,
        assignStartTime,
        assignEndTime
      );
      if (conflict) {
        setConflictWarning(
          `Technician conflict: Already booked for ${conflict.jobNumber} from ${conflict.startTime} to ${conflict.endTime}.`
        );
        return;
      }
    }

    setBusy(true);
    const job = await convertRequestToJob(
      convertingRequest.id,
      assignDate,
      assignStartTime,
      assignEndTime,
      assignTechId
    );
    setBusy(false);
    if (!job) return;

    setConvertingRequest(null);
    onNavigateTab('dispatch');
  };

  const priorityBadges: Record<Priority, string> = {
    emergency: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    high: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
    medium: 'bg-sky-100 text-sky-800 border-sky-300',
    low: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Customer Service Requests & Enquiries
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Triage breakdown alerts, evaluate priority, and schedule onto the technician dispatch board
          </p>
        </div>

        <button
          onClick={() => onOpenQuickAction('request')}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New Enquiry</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        {[
          { id: 'all', label: 'All Requests' },
          { id: 'new', label: 'New / Unassigned' },
          { id: 'awaiting_approval', label: 'Awaiting Approval' },
          { id: 'converted', label: 'Converted to Job' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id as any)}
            aria-pressed={statusFilter === tab.id}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === tab.id
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests Cards List */}
      <div className="space-y-3">
        {filteredRequests.map((req) => {
          const cust = customerById.get(req.customerId);
          const loc = cust?.serviceLocations.find((l) => l.id === req.locationId);
          const eq = equipment.find((e) => e.id === req.equipmentId);

          return (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {req.requestNumber}
                  </span>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${priorityBadges[req.priority]}`}>
                    {req.priority} Priority
                  </span>
                  <span className="text-xs text-slate-400 capitalize">
                    Slot: {req.preferredSlot}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900">{cust?.name}</h3>
                  <p className="text-xs text-slate-500">
                    {loc ? `${loc.addressLine1}, ${loc.city} (${loc.postcode})` : 'No site on file'}
                  </p>
                </div>

                <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {req.reportedProblem}
                </p>

                {eq && (
                  <p className="text-[11px] text-sky-800 font-medium">
                    Attached Asset: {eq.brand} {eq.model} (S/N: {eq.serialNumber})
                  </p>
                )}
              </div>

              <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 text-xs">
                <span className="text-slate-500 text-[11px]">
                  Logged {formatDateUK(req.createdAt)}
                </span>

                {req.status === 'converted' ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-semibold text-xs flex items-center gap-1">
                    <IconCircleCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Job Booked</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleOpenConvert(req)}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-2xs flex items-center gap-1"
                  >
                    <span>Schedule Job</span>
                    <IconArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredRequests.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl py-6"><EmptyState icon={IconInbox}>No service requests found in this category.</EmptyState></div>
        )}
      </div>

      {/* Convert to Job Wizard Modal */}
      {convertingRequest && (
        <div role="dialog" aria-modal="true" aria-label="Convert request to job" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Convert {convertingRequest.requestNumber} to Job
                </h3>
                <p className="text-xs text-slate-500">
                  Assign appointment slot and technician
                </p>
              </div>
              <button
                onClick={() => setConvertingRequest(null)}
                aria-label="Close" className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <form onSubmit={handleConfirmConvert} className="p-5 space-y-4 text-xs">
              {conflictWarning && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start gap-2">
                  <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Technician Conflict!</p>
                    <p className="mt-0.5">{conflictWarning}</p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="sr-tech" className="block font-semibold text-slate-700 mb-1">
                  Assign Qualified Technician *
                </label>
                <select
                  id="sr-tech" value={assignTechId}
                  onChange={(e) => {
                    setAssignTechId(e.target.value);
                    setConflictWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.skills.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sr-date" className="block font-semibold text-slate-700 mb-1">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  required
                  id="sr-date" name="date" min={getTodayISO()} value={assignDate}
                  onChange={(e) => {
                    setAssignDate(e.target.value);
                    setConflictWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sr-start" className="block font-semibold text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    id="sr-start" name="start" value={assignStartTime}
                    onChange={(e) => {
                      setAssignStartTime(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="sr-end" className="block font-semibold text-slate-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    id="sr-end" name="end" value={assignEndTime}
                    onChange={(e) => {
                      setAssignEndTime(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConvertingRequest(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Scheduling…' : 'Confirm & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

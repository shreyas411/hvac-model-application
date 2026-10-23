import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Priority, ServiceRequest } from '../../types';
import { formatDateUK, getTodayISO } from '../../utils/formatters';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { IconAlertTriangle, IconCalendarPlus, IconCircleCheck, IconInbox, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { Input } from '@/src/components/ui/input';
import { BulkBar, SelectAllHead, SelectCell, useRowSelection } from '../common/BulkSelect';
import { DatePicker } from '../common/DatePicker';
import { DetailDrawer } from '../common/DetailDrawer';
import { SortHead, useServerPaged } from '../common/Pager';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { Tip } from '@/src/components/common/Tip';

interface ServiceRequestsViewProps {
  onOpenQuickAction: (action: 'request' | 'job') => void;
  onNavigateTab: (tab: string) => void;
}

export const ServiceRequestsView: React.FC<ServiceRequestsViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { 
    jobs,
    serviceRequests, 
    customers, 
    equipment, 
    technicians, 
    convertRequestToJob,
    bulkCancelRequests,
    showToast,
    checkScheduleConflict,
    customerById,
    deleteRecord,
    confirmToast,
    currentUser,
  } = useApp(['jobs', 'serviceRequests', 'customers', 'equipment', 'technicians', 'convertRequestToJob', 'bulkCancelRequests', 'showToast', 'checkScheduleConflict', 'customerById', 'deleteRecord', 'confirmToast', 'currentUser']);

  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'awaiting_approval' | 'converted' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Search and status run on the server so paging covers the whole list (search matches request number and problem text)
  const paged = useServerPaged<ServiceRequest>('/requests', { q: searchTerm.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter }, serviceRequests);
  
  const sel = useRowSelection(paged.rows, (r) => r.status === 'new' || r.status === 'awaiting_approval');
  const bulkCancel = async () => {
    const rows = sel.selected;
    setBusy(true);
    const failed = await bulkCancelRequests(rows.map((r) => r.id));
    setBusy(false);
    sel.clear();
    const bad = rows.filter((r) => failed[r.id]);
    if (bad.length) showToast(`${rows.length - bad.length} of ${rows.length} cancelled. Skipped: ${bad.map((r) => `${r.requestNumber}: ${failed[r.id]}`).join('; ')}`, 'error');
  };

  // Convert modal
  const [convertingRequest, setConvertingRequest] = useState<ServiceRequest | null>(null);
  const [assignDate, setAssignDate] = useState<string>(getTodayISO());
  const [assignStartTime, setAssignStartTime] = useState<string>('09:00');
  const [assignEndTime, setAssignEndTime] = useState<string>('11:30');
  const [assignTechId, setAssignTechId] = useState<string>(technicians[0]?.id || '');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // guards double-submit (would book the job twice)

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
    low: 'bg-muted text-foreground border-border',
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">Service Requests</h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'request' : 'requests'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Triage enquiries, set priority, and schedule them onto the dispatch board</p>
        </div>
        <Button size="sm" onClick={() => onOpenQuickAction('request')} className="shrink-0">
          <IconPlus aria-hidden="true" />
          <span>New Enquiry</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search requests" name="search" autoComplete="off" placeholder="Search number or problem…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger size="sm" aria-label="Request status" className="w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New / Unassigned</SelectItem>
            <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
            <SelectItem value="converted">Converted to Job</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || statusFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      <BulkBar count={sel.selected.length} onClear={sel.clear}>
        <Button type="button" size="xs" variant="destructive" disabled={busy} onClick={() => confirmToast(`Cancel ${sel.selected.length} request${sel.selected.length === 1 ? '' : 's'}? They stay on record as cancelled.`, () => void bulkCancel(), { confirmLabel: 'Cancel requests' })}><IconX aria-hidden="true" />Cancel {sel.selected.length}</Button>
      </BulkBar>

      <TableCard footer={paged.pager}>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <SelectAllHead sel={sel} label="requests" />
              <SortHead paged={paged} by="requestNumber" className="px-3">Request</SortHead>
              <SortHead paged={paged} by="customer.name" className="px-3">Customer / Site</SortHead>
              <TableHead className="hidden md:table-cell px-3">Problem</TableHead>
              <SortHead paged={paged} by="priority" className="px-3">Priority</SortHead>
              <SortHead paged={paged} by="status" className="hidden md:table-cell px-3">Status</SortHead>
              <SortHead paged={paged} by="createdAt" className="hidden lg:table-cell px-3">Logged</SortHead>
              <TableHead className="px-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((req) => {
              const cust = customerById.get(req.customerId);
              const loc = cust?.serviceLocations.find((l) => l.id === req.locationId);
              const eq = equipment.find((e) => e.id === req.equipmentId);
              const booked = req.convertedJobId ? jobs.find((j) => j.id === req.convertedJobId) : undefined;
              return (
                <TableRow key={req.id} data-state={sel.has(req.id) ? 'selected' : undefined}>
                  <SelectCell sel={sel} row={req} label={req.requestNumber} />
                  <TableCell className="px-3 py-3 align-top">
                    <span className="block font-semibold tabular-nums">{req.requestNumber}</span>
                    <span className="block text-[11px] text-muted-foreground capitalize">Slot: {req.preferredSlot.replace('_', ' ')}</span>
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top max-w-[220px]">
                    <span className="block font-bold truncate">{cust?.name}</span>
                    <Tip label={loc ? `${loc.addressLine1}, ${loc.city} ${loc.postcode}` : undefined}><span className="block text-[11px] text-muted-foreground truncate">{loc ? `${loc.addressLine1}, ${loc.city} (${loc.postcode})` : 'No site on file'}</span></Tip>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3 align-top max-w-[320px]">
                    <Tip label={req.reportedProblem}><span className="block line-clamp-2">{req.reportedProblem}</span></Tip>
                    {eq && <span className="block text-[11px] text-sky-800">Asset: {eq.brand} {eq.model}</span>}
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <Badge variant="outline" className={`text-[10px] uppercase ${priorityBadges[req.priority]}`}>{req.priority}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-3 py-3 align-top">
                    {req.status === 'converted' ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200"><IconCircleCheck aria-hidden="true" />Job{booked ? ` ${booked.jobNumber}` : ' booked'}</Badge>
                    ) : <Badge variant="secondary" className="capitalize">{req.status.replace('_', ' ')}</Badge>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-3 py-3 align-top tabular-nums text-muted-foreground">{formatDateUK(req.createdAt)}</TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <RowActions subject={req.requestNumber} actions={[
                      { icon: IconCalendarPlus, label: 'Schedule job', tone: 'info', hidden: req.status === 'converted' || req.status === 'cancelled', onClick: () => handleOpenConvert(req) },
                      { icon: IconTrash, label: 'Delete', destructive: true, hidden: req.status === 'converted' || currentUser?.role !== 'admin',
                        onClick: () => confirmToast(`Delete request ${req.requestNumber}?`, () => void deleteRecord('requests', req.id, 'Request')) },
                    ]} />
                  </TableCell>
                </TableRow>
              );
            })}
            {paged.rows.length === 0 && !paged.loading && (
              <TableRow><TableCell colSpan={8} className="py-6"><EmptyState icon={IconInbox}>No service requests match your filters.</EmptyState></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableCard>

      {convertingRequest && (
        <DetailDrawer onClose={() => setConvertingRequest(null)} title={`Convert ${convertingRequest.requestNumber} to Job`} description="Assign appointment slot and technician"
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConvertingRequest(null)}>Cancel</Button>
            <Button type="submit" form="convert-form" size="sm" disabled={busy}>{busy ? 'Scheduling…' : 'Confirm & Schedule'}</Button>
          </>}>
          <form id="convert-form" onSubmit={handleConfirmConvert} className="space-y-4 text-xs">
            {conflictWarning && (
              <Alert variant="destructive" className="bg-rose-50 border-rose-300 text-rose-900">
                <IconAlertTriangle aria-hidden="true" />
                <AlertTitle>Technician Conflict!</AlertTitle>
                <AlertDescription className="text-rose-900">{conflictWarning}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="sr-tech" className="text-xs">Assign Qualified Technician *</Label>
              <Select value={assignTechId} onValueChange={(v) => { setAssignTechId(v); setConflictWarning(null); }}>
                <SelectTrigger id="sr-tech" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.skills.join(', ')})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-date" className="text-xs">Appointment Date *</Label>
              <div><DatePicker id="sr-date" min={getTodayISO()} value={assignDate} onChange={(v) => { setAssignDate(v); setConflictWarning(null); }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sr-start" className="text-xs">Start Time *</Label>
                <Input type="time" required id="sr-start" name="start" value={assignStartTime} onChange={(e) => { setAssignStartTime(e.target.value); setConflictWarning(null); }} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-end" className="text-xs">End Time *</Label>
                <Input type="time" required id="sr-end" name="end" value={assignEndTime} onChange={(e) => { setAssignEndTime(e.target.value); setConflictWarning(null); }} className="tabular-nums" />
              </div>
            </div>
          </form>
        </DetailDrawer>
      )}
    </div>
  );
};

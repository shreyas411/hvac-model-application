import React, { useState, useEffect } from 'react';
import { EmptyState } from '../common/EmptyState';
import { SignaturePad } from './SignaturePad';
import { JobPhotos } from './JobPhotos';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { useApp } from '../../context/AppContext';
import { wasQueued } from '../../services/api';
import { Job, JobStatus, JobChecklistItem, EquipmentReading, TechnicianProfile } from '../../types';
import { useChecklistTemplates, toChecklistItems } from '../../data/checklistTemplates';
import { formatGBP, formatDateUK, formatDateTimeUK, getTodayISO, canMoveJob, joinParts, regLine } from '../../utils/formatters';
import { DetailDrawer } from '../common/DetailDrawer';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { IconMapPin, IconCircleCheck, IconDownload, IconFlame, IconMail, IconPackage, IconPencil, IconPhone, IconPlus, IconPrinter, IconSquareCheck, IconTool } from '@tabler/icons-react';

interface TechnicianPortalViewProps {
  onNavigateTab?: (tab: string) => void;
}

// Fallback while no technicians exist on the server yet
const NO_TECH: TechnicianProfile = { id: '', name: 'No technician', phone: '', email: '', skills: [], color: '#94a3b8', active: false };

export const TechnicianPortalView: React.FC<TechnicianPortalViewProps> = ({ onNavigateTab }) => {
  const { 
    currentUser, 
    jobs, 
    customers, 
    equipment, 
    technicians, 
    updateJob, 
    updateJobStatus, 
    addJobPart,
    addRefrigerantLog,
    parts, 
    addEquipmentServiceRecord,
    settings,
    showToast,
    confirmToast,
    customerById,
  } = useApp(['currentUser', 'jobs', 'customers', 'equipment', 'technicians', 'updateJob', 'updateJobStatus', 'addJobPart', 'addRefrigerantLog', 'parts', 'addEquipmentServiceRecord', 'settings', 'showToast', 'confirmToast', 'customerById']);

  // Active technician: the signed-in technician; office roles start on the first one in the roster
  const [activeTechId, setActiveTechId] = useState<string>(
    currentUser.technicianId || ''
  );

  const activeTech: TechnicianProfile = technicians.find((t) => t.id === activeTechId) || technicians[0] || NO_TECH;

  // Selected job for on-site execution
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const today = getTodayISO();
  // This technician's open stops: today onwards, plus anything earlier that isn't finished
  const techJobs = jobs
    .filter((j) => j.technicianId === activeTech.id && j.status !== 'cancelled' && (j.appointmentDate >= today || j.status !== 'completed'))
    .sort((x, y) => `${x.appointmentDate} ${x.startTime}`.localeCompare(`${y.appointmentDate} ${y.startTime}`));
  const openJobs = techJobs.filter((j) => j.status !== 'completed');
  const doneJobs = techJobs.filter((j) => j.status === 'completed');
  const activeJob = techJobs.find((j) => j.id === selectedJobId) ?? openJobs[0] ?? techJobs[0]; // next open stop by default; never another technician's job
  const [showAllStops, setShowAllStops] = useState(false);
  const [showDoneStops, setShowDoneStops] = useState(false);
  const STOPS_VISIBLE = 3;
  const shownOpen = showAllStops ? openJobs : openJobs.filter((j, i) => i < STOPS_VISIBLE || j.id === activeJob?.id);

  const customer = customers.find((c) => c.id === activeJob?.customerId);
  const location = customer?.serviceLocations.find((l) => l.id === activeJob?.locationId) ?? activeJob?.site;
  const customerName = customer?.name ?? activeJob?.site?.customerName;
  const customerPhone = customer?.phone ?? activeJob?.site?.customerPhone;
  const jobEquipments = equipment.filter((e) => activeJob?.equipmentIds.includes(e.id));

  // On-site form inputs
  const [workNotes, setWorkNotes] = useState<string>(activeJob?.workPerformed || '');
  const [labourHours, setLabourHours] = useState<number>(activeJob?.labourHours || 0); // no default: hours feed the invoice, so the engineer has to state them
  const [followUpRecommended, setFollowUpRecommended] = useState<boolean>(activeJob?.followUpRecommended || false);
  const [followUpNotes, setFollowUpNotes] = useState<string>(activeJob?.followUpNotes || '');

  // Diagnostic readings state
  const [pressureBar, setPressureBar] = useState<string>('');
  const [flowTempC, setFlowTempC] = useState<string>('');
  const [returnTempC, setReturnTempC] = useState<string>('');
  const [coPpm, setCoPpm] = useState<string>('');
  const [co2Percent, setCo2Percent] = useState<string>('');
  const [refrigerantPsi, setRefrigerantPsi] = useState<string>('');

  // Parts consumption selector
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const partId = selectedPartId || parts[0]?.id || ''; // parts load async: default at render time
  const [busy, setBusy] = useState(false); // guards double-taps (double stock deduction, duplicate records)
  const [partQuantity, setPartQuantity] = useState<number>(1);

  // Digital Signature Canvas
  const [signatureName, setSignatureName] = useState<string>('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState<boolean>(!!activeJob?.customerSignature);
  const [showServiceReportModal, setShowServiceReportModal] = useState<boolean>(false);

  // Reset the form whenever the job shown changes: carrying one job's notes or readings onto another would corrupt records
  const activeJobId = activeJob?.id;
  useEffect(() => {
    setWorkNotes(activeJob?.workPerformed || '');
    setLabourHours(activeJob?.labourHours || 0);
    setFollowUpRecommended(!!activeJob?.followUpRecommended);
    setFollowUpNotes(activeJob?.followUpNotes || '');
    setIsSigned(!!activeJob?.customerSignature);
    setPressureBar(''); setFlowTempC(''); setReturnTempC(''); setCoPpm(''); setCo2Percent(''); setRefrigerantPsi('');
    setSignatureName(''); setSignatureData(null);
  }, [activeJobId]);

  // Add a template item (or a custom one) to the job's checklist
  const { templates } = useChecklistTemplates();
  const [customItem, setCustomItem] = useState('');
  const addChecklistItems = (items: JobChecklistItem[]) => {
    if (!activeJob || !items.length) return;
    updateJob(activeJob.id, { checklist: [...activeJob.checklist, ...items] }, 'Added checklist items');
  };

  // Toggle checklist item
  const handleChecklistToggle = (itemId: string) => {
    if (!activeJob) return;
    const updatedChecklist = activeJob.checklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateJob(activeJob.id, { checklist: updatedChecklist }, 'Updated checklist item');
  };

  // Add part to job & reduce stock
  const handleAddPartToJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !activeJob || !partId) return;

    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    setBusy(true);
    await addJobPart(activeJob.id, part.id, Number(partQuantity));
    setBusy(false);
  };

  const [fridge, setFridge] = useState({ refrigerant: 'R410A', action: 'charge', amountKg: '', cylinderId: '', certNumber: '' });
  const handleAddRefrigerant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJob || busy) return;
    setBusy(true);
    const ok = await addRefrigerantLog(activeJob.id, { ...fridge, amountKg: Number(fridge.amountKg) });
    setBusy(false);
    if (ok) setFridge({ ...fridge, amountKg: '', cylinderId: '' }); // keep the entry on failure so it isn't retyped
  };

  // Save diagnostic readings & create equipment service record
  const handleSaveFindings = async () => {
    if (!activeJob || busy) return;
    if (!workNotes.trim()) return showToast('Describe the work performed before saving', 'error');
    if (!(Number(labourHours) > 0)) return showToast('Enter the labour hours', 'error');

    const readings: EquipmentReading = {
      pressureBar: pressureBar ? parseFloat(pressureBar) : undefined,
      flowTempC: flowTempC ? parseFloat(flowTempC) : undefined,
      returnTempC: returnTempC ? parseFloat(returnTempC) : undefined,
      coPpm: coPpm ? parseFloat(coPpm) : undefined,
      co2Percent: co2Percent ? parseFloat(co2Percent) : undefined,
      refrigerantPsi: refrigerantPsi ? parseFloat(refrigerantPsi) : undefined,
    };

    setBusy(true);
    const saved = await updateJob(
      activeJob.id,
      {
        workPerformed: workNotes,
        labourHours: Number(labourHours),
        followUpRecommended,
        followUpNotes,
      },
      'Updated work notes and diagnostic readings'
    );
    setBusy(false);
    if (!saved) return; // don't write service history or claim success if the job update failed
    const offline = wasQueued(); // read before the service-record writes below start and replace the flag

    // If equipment attached, add service history record
    if (activeJob.equipmentIds.length > 0) {
      activeJob.equipmentIds.forEach((eqId) => {
        addEquipmentServiceRecord(eqId, {
          date: activeJob.appointmentDate,
          jobId: activeJob.id,
          technicianName: activeTech.name,
          serviceType: activeJob.type.replace('_', ' '),
          findings: workNotes,
          readings,
          partsReplaced: activeJob.partsUsed.map((p) => p.partName),
          recommendations: followUpRecommended ? followUpNotes : undefined,
        });
      });
    }

    if (offline) showToast('No signal: work report saved on this phone and will send when you are back online', 'info');
    else showToast('Work report and readings logged successfully', 'success');
  };

  // Capture Digital Customer Signature
  const handleCaptureSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJob || busy || !signatureName.trim()) return;
    if (!signatureData) return showToast('Ask the customer to sign in the box first', 'error');
    // The notes and hours on screen are saved with the sign-off, so one tap does what the button says.
    if (!workNotes.trim()) return showToast('Describe the work performed before completing the job', 'error');
    if (!(Number(labourHours) > 0)) return showToast('Enter the labour hours before completing the job', 'error');

    setBusy(true);
    const ok = await updateJob(
      activeJob.id,
      {
        workPerformed: workNotes,
        labourHours: Number(labourHours),
        followUpRecommended,
        followUpNotes,
        customerSignature: {
          name: signatureName,
          dataUrl: signatureData,
          signedAt: new Date().toISOString(),
        },
        status: 'completed',
        completionTime: new Date().toISOString(),
      },
      `Customer sign-off collected from ${signatureName}. Job marked as completed.`
    );
    setBusy(false);
    if (!ok) return; // e.g. the completion gate refused: don't show the job as signed off

    setIsSigned(true);
    if (wasQueued()) showToast(`No signal: ${signatureName}'s sign-off is saved on this phone and the job will be marked completed when you are back online`, 'info');
    else showToast(`Signature saved for ${signatureName}. Job marked completed!`, 'success');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      
      {/* Mobile Van Top Card */}
      <div className="bg-slate-800 text-white rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold border border-sky-400/30 shrink-0">
              <IconTool className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white">Technician Van Portal</h1>
                <span className="hidden sm:inline text-[10px] tabular-nums uppercase px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  Van View
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {activeTech.name} · {activeTech.vanRegistration} · {activeTech.skills.slice(0, 2).join(', ')}
              </p>
            </div>
          </div>

          {/* Switch technician dropdown */}
          {currentUser.role !== 'technician' && (
            <div className="flex items-center gap-2">
              <Select value={activeTechId} onValueChange={(v) => { setActiveTechId(v); setSelectedJobId(''); }}>
                <SelectTrigger size="sm" aria-label="Active van" className="bg-slate-800 border-slate-700 text-white text-xs hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.vanRegistration || 'Van'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Today's Job Quick Carousel / Selector */}
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Route & Assigned Stops
            </span>
            <span className="text-[11px] text-slate-300">{doneJobs.length} of {techJobs.length} done</span>
          </div>
          <div className="h-1 rounded bg-slate-800 mb-3" role="progressbar" aria-valuemin={0} aria-valuemax={techJobs.length} aria-valuenow={doneJobs.length}>
            <div className="h-1 rounded bg-emerald-500" style={{ width: `${techJobs.length ? (doneJobs.length / techJobs.length) * 100 : 0}%` }} />
          </div>

          {(() => {
            const row = (job: Job) => {
              const isSelected = job.id === activeJob?.id;
              const cust = customerById.get(job.customerId);
              return (
                <Button
                  key={job.id}
                  variant="outline"
                  onClick={() => setSelectedJobId(job.id)}
                  aria-pressed={isSelected}
                  className={`w-full h-auto px-3 py-2 justify-start text-left font-normal ${
                    isSelected
                      ? 'bg-primary text-white border-sky-400 shadow-xs hover:bg-primary hover:text-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-slate-300'
                  }`}
                >
                  <span className="text-xs tabular-nums font-semibold shrink-0">
                    {job.appointmentDate !== today && <span className="opacity-80 mr-1">{formatDateUK(job.appointmentDate)}</span>}
                    {job.startTime}-{job.endTime}
                  </span>
                  <span className="text-xs font-medium truncate flex-1">
                    {job.title || cust?.name || job.site?.customerName || job.jobNumber}
                  </span>
                  <span className="text-[10px] capitalize opacity-80 shrink-0">{job.status.replace('_', ' ')}</span>
                </Button>
              );
            };
            const toggle = 'text-[11px] font-semibold text-sky-300 hover:text-sky-200 h-auto py-1.5 px-0 justify-start';
            return (
              <div className="space-y-1.5">
                {shownOpen.map(row)}
                {openJobs.length > shownOpen.length || showAllStops && openJobs.length > STOPS_VISIBLE ? (
                  <Button variant="link" size="xs" onClick={() => setShowAllStops(!showAllStops)} className={toggle}>
                    {showAllStops ? 'Show fewer' : `Later (${openJobs.length - shownOpen.length} more)`}
                  </Button>
                ) : null}
                {openJobs.length === 0 && <p className="text-xs text-slate-400">No open stops.</p>}
                {doneJobs.length > 0 && (
                  <>
                    <Button variant="link" size="xs" onClick={() => setShowDoneStops(!showDoneStops)} aria-expanded={showDoneStops} className={toggle}>
                      {showDoneStops ? 'Hide' : 'Show'} completed ({doneJobs.length})
                    </Button>
                    {showDoneStops && doneJobs.map(row)}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {activeJob && (
        <div className="space-y-6">
          
          {/* Active Job Header & Status Workflow Action Buttons */}
          <Card className="gap-0 py-4 px-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold tabular-nums text-slate-900 whitespace-nowrap">{activeJob.jobNumber}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                    {activeJob.type.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-slate-800 mt-1">
                  {customerName}
                </h2>
              </div>

              {/* Print Service Report Button */}
              <Button variant="secondary" size="sm" onClick={() => setShowServiceReportModal(true)}>
                <IconPrinter aria-hidden="true" />
                <span>Service Report</span>
              </Button>
            </div>

            {/* Step Workflow Status Buttons */}
            <div>
              <span id="tp-status" className="block text-xs font-semibold text-slate-600 mb-2">
                Job status
              </span>
              {(() => {
                const steps = [
                  { status: 'new' as JobStatus, label: 'New', tint: 'bg-slate-100 text-slate-700' },
                  { status: 'awaiting_approval' as JobStatus, label: 'Awaiting Approval', tint: 'bg-amber-100 text-amber-800' },
                  { status: 'scheduled' as JobStatus, label: 'Scheduled', tint: 'bg-indigo-100 text-indigo-800' },
                  { status: 'dispatched' as JobStatus, label: 'On the Way', tint: 'bg-purple-100 text-purple-800' },
                  { status: 'in_progress' as JobStatus, label: 'Arrived / Start', tint: 'bg-sky-100 text-sky-800' },
                  { status: 'on_hold' as JobStatus, label: 'On Hold', tint: 'bg-orange-100 text-orange-800' },
                  { status: 'completed' as JobStatus, label: 'Completed', tint: 'bg-emerald-100 text-emerald-800' },
                  { status: 'cancelled' as JobStatus, label: 'Cancel', tint: '' },
                ];
                const current = steps.find((s) => s.status === activeJob.status);
                // backend limits technicians to TECH_TARGETS (jobs/service.ts); admins viewing the portal are only bound by the workflow
                const next = steps.filter((s) => s.status !== activeJob.status
                  && (currentUser.role !== 'technician' || ['dispatched', 'in_progress', 'on_hold', 'completed'].includes(s.status))
                  && canMoveJob(activeJob.status, s.status));
                return (
                  <>
                    <p className="mb-3 text-sm text-slate-600">
                      Now: <span className={`ml-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${current?.tint ?? 'bg-slate-100 text-slate-700'}`}>{current?.label ?? activeJob.status.replace(/_/g, ' ')}</span>
                    </p>
                    {next.length > 0 ? (
                      <div role="group" aria-labelledby="tp-status" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {next.map((item) => (
                          <Button
                            key={item.status}
                            variant="outline"
                            onClick={() => { const go = () => void updateJobStatus(activeJob.id, item.status); if (item.status === 'cancelled') confirmToast(`Cancel ${activeJob.jobNumber}?`, go); else go(); }}
                            className={`h-auto min-h-12 py-3 px-4 text-sm font-semibold ${item.status === 'cancelled' ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10' : 'bg-card'}`}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No further status changes available.</p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Customer Location & Contact Info */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Service Address:</span>
                <p className="text-slate-900 font-medium">
                  {location?.addressLine1}
                  {location?.addressLine2 && `, ${location.addressLine2}`}
                </p>
                <p className="text-slate-700">
                  {location?.city}, <span className="tabular-nums font-semibold">{location?.postcode}</span>
                </p>
                {location && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([location.addressLine1, location.city, location.postcode].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 py-2 text-sky-700 hover:text-sky-900 font-medium"
                  >
                    <IconMapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Navigate</span>
                  </a>
                )}
                {location?.accessNotes && (
                  <p className="mt-1.5 text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 text-[11px]">
                    <strong>Access Notes:</strong> {location.accessNotes}
                  </p>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Site Contact:</span>
                <p className="text-slate-900 font-medium">
                  {location?.contactName || customerName}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <a
                    href={`tel:${location?.contactPhone || customerPhone}`}
                    className="inline-flex items-center gap-1 py-2 text-sky-700 hover:text-sky-900 font-medium"
                  >
                    <IconPhone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{location?.contactPhone || customerPhone}</span>
                  </a>
                  {customer?.email && (
                    <a
                      href={`mailto:${customer?.email}`}
                      className="inline-flex items-center gap-1 py-2 text-slate-600 hover:text-slate-900"
                    >
                      <IconMail className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Email</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Equipment on Site */}
            {jobEquipments.length > 0 && (
              <div className="p-3 bg-sky-50/60 rounded-lg border border-sky-200 text-xs space-y-1">
                <span className="font-bold text-sky-900 block">Equipment Assets to Service:</span>
                {jobEquipments.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between text-slate-800">
                    <span className="font-medium">
                      {eq.brand} {eq.model} ({eq.type.replace('_', ' ')})
                    </span>
                    <span className="tabular-nums text-[11px] text-slate-500">
                      S/N: {eq.serialNumber}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Inspection Checklists (Gas Safe & F-Gas Requirements) */}
          <Card className="gap-0 py-4 px-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IconSquareCheck className="w-4 h-4 text-sky-700" aria-hidden="true" />
                <h3 className="font-bold text-sm text-slate-900">
                  Service Checklist & Regulatory Compliance
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {activeJob.checklist.filter((i) => i.checked).length} of {activeJob.checklist.length} checked
              </span>
            </div>

            <div className="space-y-2">
              {activeJob.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                >
                  <Checkbox checked={item.checked} onCheckedChange={() => handleChecklistToggle(item.id)} className="mt-0.5 size-5" />
                  <div className="flex-1">
                    <span className={`font-medium ${item.checked ? 'text-slate-900 line-through' : 'text-slate-800'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize block mt-0.5">
                      Category: {item.category.replace('_', ' ')}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            {(() => {
              const have = new Set(activeJob.checklist.map((c) => c.label));
              const available = templates.filter((t) => t.jobType === activeJob.type && !t.inactive && !have.has(t.label));
              return (
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  {available.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 capitalize">
                          {activeJob.type.replace(/_/g, ' ')} checklist
                        </span>
                        <Button type="button" variant="link" size="xs" onClick={() => addChecklistItems(toChecklistItems(available))}>
                          Add all
                        </Button>
                      </div>
                      {available.map((t) => (
                        <Button
                          key={t.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addChecklistItems(toChecklistItems([t]))}
                          className="w-full justify-start border-dashed font-normal"
                        >
                          + {t.label}
                        </Button>
                      ))}
                    </>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const label = customItem.trim();
                      if (!label) return;
                      addChecklistItems([{ id: crypto.randomUUID(), label, category: 'general', checked: false }]);
                      setCustomItem('');
                    }}
                  >
                    <Input
                      value={customItem}
                      onChange={(e) => setCustomItem(e.target.value)}
                      aria-label="Custom checklist item" autoComplete="off" placeholder="Custom checklist item"
                      className="flex-1"
                    />
                    <Button type="submit"><IconPlus aria-hidden="true" /> Add</Button>
                  </form>
                </div>
              );
            })()}
          </Card>

          {/* HVAC Diagnostic Readings & Findings Input */}
          <Card className="gap-0 py-4 px-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IconFlame className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <h3 className="font-bold text-sm text-slate-900">
                  HVAC Diagnostic Readings & Findings
                </h3>
              </div>
              <span className="text-xs text-slate-500">Gas & Refrigerant Gauges</span>
            </div>

            {/* Gauge inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <Label htmlFor="tp-1" className="text-xs mb-1">Pressure (Bar)</Label>
                <Input id="tp-1"
                  type="number"
                  step="0.1"
                  value={pressureBar}
                  onChange={(e) => setPressureBar(e.target.value)}
                  className="tabular-nums"
                  placeholder="e.g. 1.4"
                />
              </div>

              <div>
                <Label htmlFor="tp-2" className="text-xs mb-1">Flow Temp (°C)</Label>
                <Input id="tp-2"
                  type="number"
                  value={flowTempC}
                  onChange={(e) => setFlowTempC(e.target.value)}
                  className="tabular-nums"
                  placeholder="e.g. 70"
                />
              </div>

              <div>
                <Label htmlFor="tp-3" className="text-xs mb-1">Return Temp (°C)</Label>
                <Input id="tp-3"
                  type="number"
                  value={returnTempC}
                  onChange={(e) => setReturnTempC(e.target.value)}
                  className="tabular-nums"
                  placeholder="e.g. 54"
                />
              </div>

              <div>
                <Label htmlFor="tp-4" className="text-xs mb-1">CO (ppm)</Label>
                <Input id="tp-4"
                  type="number"
                  value={coPpm}
                  onChange={(e) => setCoPpm(e.target.value)}
                  className="tabular-nums"
                  placeholder="e.g. 14"
                />
              </div>

              <div>
                <Label htmlFor="tp-5" className="text-xs mb-1">CO2 Ratio (%)</Label>
                <Input id="tp-5"
                  type="number"
                  step="0.1"
                  value={co2Percent}
                  onChange={(e) => setCo2Percent(e.target.value)}
                  className="tabular-nums"
                  placeholder="e.g. 9.2"
                />
              </div>

              <div>
                <Label htmlFor="tp-6" className="text-xs mb-1">Refrigerant Suction (psi)</Label>
                <Input id="tp-6"
                  type="number"
                  value={refrigerantPsi}
                  onChange={(e) => setRefrigerantPsi(e.target.value)}
                  className="tabular-nums"
                  placeholder="e.g. 125"
                />
              </div>
            </div>

            {/* Work notes & labour hours */}
            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="tp-7" className="text-xs mb-1">
                  Work Notes & Action Performed:
                </Label>
                <Textarea id="tp-7"
                  rows={3}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="Describe test results, cleaning steps, parts fitted, and gas/oil observations..."
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-40">
                  <Label htmlFor="tp-8" className="text-xs mb-1">
                    Labour Hours:
                  </Label>
                  <Input id="tp-8"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={labourHours}
                    onChange={(e) => setLabourHours(parseFloat(e.target.value) || 0)}
                    className="text-xs tabular-nums"
                  />
                </div>

                <div className="flex-1 pt-4">
                  <Button type="button" onClick={handleSaveFindings} disabled={busy} className="bg-slate-900 hover:bg-slate-800 text-white">
                    Save Findings & Log Readings
                  </Button>
                </div>
              </div>
            </div>

            {/* Follow-up Work Recommendation (Workflow D Trigger) */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                <Checkbox checked={followUpRecommended} onCheckedChange={(v) => setFollowUpRecommended(v === true)} />
                <span>Recommend Follow-up Visit / Additional Work Required (Workflow D)</span>
              </label>

              {followUpRecommended && (
                <div className="pt-1 space-y-1">
                  <p className="text-[11px] text-purple-800">
                    Flagged items automatically notify the office dispatcher to prepare a quotation for the customer.
                  </p>
                  <Textarea
                    rows={2}
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="e.g. Intermittent refrigerant pressure drop noted. Recommend nitrogen pressure test & pipe braze repair."
                    className="bg-white border-purple-300 text-xs"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Refrigerant handling log (required to complete jobs with a refrigerant checklist item) */}
          {activeJob.checklist.some((c) => c.category === 'refrigerant') && (
            <Card className="gap-0 py-4 px-4 sm:p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">Refrigerant Log</h3>
              <form onSubmit={handleAddRefrigerant} className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <Input required aria-label="Refrigerant" placeholder="Refrigerant" value={fridge.refrigerant} onChange={(e) => setFridge({ ...fridge, refrigerant: e.target.value })}  />
                <Select value={fridge.action} onValueChange={(v) => setFridge({ ...fridge, action: v })}>
                  <SelectTrigger aria-label="Action" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charge">Charge</SelectItem><SelectItem value="recover">Recover</SelectItem><SelectItem value="reclaim">Reclaim</SelectItem><SelectItem value="leak_check">Leak check</SelectItem>
                  </SelectContent>
                </Select>
                <Input required type="number" min="0" step="0.01" aria-label="Amount (kg)" placeholder="Amount (kg)" value={fridge.amountKg} onChange={(e) => setFridge({ ...fridge, amountKg: e.target.value })} className="tabular-nums" />
                <Input aria-label="Cylinder ID" autoComplete="off" placeholder="Cylinder ID" value={fridge.cylinderId} onChange={(e) => setFridge({ ...fridge, cylinderId: e.target.value })}  />
                <Input required aria-label="Certificate number" autoComplete="off" placeholder="Cert number" value={fridge.certNumber} onChange={(e) => setFridge({ ...fridge, certNumber: e.target.value })}  />
                <Button type="submit" disabled={busy}><IconPlus aria-hidden="true" /> Add Entry</Button>
              </form>
              {activeJob.refrigerantLogs?.map((l) => (
                <div key={l.id} className="text-xs p-2.5 bg-slate-50 rounded-lg flex justify-between">
                  <span className="font-semibold">{l.action.replace('_', ' ')} · {l.refrigerant}</span>
                  <span className="tabular-nums">{l.amountKg} kg</span>
                </div>
              ))}
            </Card>
          )}

          {/* Parts Used on Site (Van Stock Inventory Deduction) */}
          <Card className="gap-0 py-4 px-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Van Parts Consumed</h3>
              <span className="text-xs text-slate-500">Live Inventory Deduction</span>
            </div>

            {/* Add Part Form */}
            <form onSubmit={handleAddPartToJob} className="flex flex-col sm:flex-row gap-2 text-xs">
              <Select value={partId} onValueChange={setSelectedPartId}>
                <SelectTrigger aria-label="Part" className="flex-1 min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {parts.filter((p) => !p.inactive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku}) - Available: {p.stockQuantity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min="1"
                aria-label="Quantity" value={partQuantity}
                onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
                className="w-20 tabular-nums"
              />

              <Button type="submit" disabled={busy}>
                <IconPlus aria-hidden="true" />
                <span>Add Part</span>
              </Button>
            </form>

            {/* Listed Parts */}
            {activeJob.partsUsed.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs">
                {activeJob.partsUsed.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-slate-50">
                    <div>
                      <span className="font-semibold text-slate-900">{p.partName}</span>
                      <span className="text-[11px] text-slate-500 block tabular-nums">{p.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="tabular-nums font-semibold text-slate-800">{p.quantity} unit(s)</span>
                      <span className="text-[11px] text-slate-500 block">
                        {formatGBP(p.quantity * p.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={IconPackage} compact>No parts consumed yet on this visit.</EmptyState>
            )}
          </Card>

          <JobPhotos jobId={activeJob.id} locked={activeJob.status === 'completed'} />

          {/* Customer Approval & Digital Signature */}
          <Card className="gap-0 py-4 px-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IconPencil className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <h3 className="font-bold text-sm text-slate-900">
                  Customer Sign-Off & Handover
                </h3>
              </div>
              {isSigned ? (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <IconCircleCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Signed by {activeJob.customerSignature?.name}
                </span>
              ) : (
                <span className="text-xs text-amber-700 font-medium">Awaiting Signature</span>
              )}
            </div>

            {!isSigned ? (
              <form onSubmit={handleCaptureSignature} className="space-y-3 text-xs">
                <div>
                  <Label htmlFor="tp-9" className="text-xs mb-1">
                    Customer Full Name:
                  </Label>
                  <Input id="tp-9"
                    type="text"
                    required
                    name="signatory" autoComplete="off" value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="e.g. Dr. Alistair Finch / Nigel Edwards"
                    className="text-xs"
                  />
                </div>

                <div>
                  <span className="block text-slate-700 font-semibold mb-1">
                    Sign on Glass / Touch Approval:
                  </span>
                  <SignaturePad key={activeJobId} onChange={setSignatureData} />
                </div>

                <Button type="submit" disabled={busy} className="w-full h-auto py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                  Capture Signature & Complete Job
                </Button>
              </form>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-emerald-900">
                    Service completed and certified on {formatDateUK(activeJob.customerSignature?.signedAt || '')}
                  </p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Signatory: {activeJob.customerSignature?.name}
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowServiceReportModal(true)} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  View Service Sheet
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeJob && (
        <Card className="gap-0 py-4 px-4 sm:p-5 space-y-2">
          <h2 className="font-bold text-sm text-slate-900">History · {activeJob.jobNumber}</h2>
          {activeJob.auditTrail.length ? (
            <ul className="divide-y divide-slate-100 text-xs">
              {[...activeJob.auditTrail].reverse().map((a, i) => (
                <li key={i} className="py-2 text-slate-600">
                  <span className="tabular-nums text-slate-500">{formatDateTimeUK(a.timestamp)}</span> · <span className="font-semibold">{a.action}</span> · {a.userName}
                  {a.details && <span className="text-slate-500"> — {a.details}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate-500">No history.</p>}
        </Card>
      )}

      {/* Official Service Report Modal (Printable/Downloadable) */}
      {showServiceReportModal && activeJob && (
        <DetailDrawer size="detail" onClose={() => setShowServiceReportModal(false)} title="Official HVAC Service Certificate & Report" description={`Printable service report for ${activeJob.jobNumber}`}
          footer={<>
            <Button variant="ghost" size="sm" onClick={() => setShowServiceReportModal(false)}>Close</Button>
            <Button variant="outline" size="sm" onClick={(e) => downloadSheet(e.currentTarget, `${activeJob.jobNumber}-report.pdf`)}><IconDownload aria-hidden="true" /> Download PDF</Button>
            <Button size="sm" onClick={(e) => printSheet(e.currentTarget)}><IconPrinter aria-hidden="true" /> Print Report</Button>
          </>}>
            {/* Printable Report Sheet */}
            <div data-pdf-sheet className="-m-5 p-6 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{settings.companyName}</h2>
                  <p className="text-slate-500">{joinParts([settings.addressLine1, settings.city, settings.postcode], ', ')}</p>
                  <p className="text-slate-500 tabular-nums">{regLine(settings)}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold tabular-nums text-slate-900 block">{activeJob.jobNumber}</span>
                  <span className="text-slate-500 block">Date: {formatDateUK(activeJob.appointmentDate)}</span>
                  <span className="text-slate-500 block">Engineer: {activeTech.name}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 mb-1">Customer & Site Address</h3>
                <p className="text-slate-800 font-semibold">{customerName}</p>
                <p className="text-slate-600">{location?.addressLine1}, {location?.city} {location?.postcode}</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 mb-1">Work Done & Observations</h3>
                <p className="text-slate-800 whitespace-pre-wrap bg-slate-50 p-2.5 rounded border border-slate-200">
                  {activeJob.workPerformed || 'No work notes recorded.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-2.5 rounded">
                  <span className="font-bold text-slate-900 block mb-1">Checklist Verified:</span>
                  <ul className="space-y-1 text-slate-600 text-[11px]">
                    {activeJob.checklist.map((c) => (
                      <li key={c.id}>
                        {c.checked ? '✓' : '✗'} {c.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border border-slate-200 p-2.5 rounded">
                  <span className="font-bold text-slate-900 block mb-1">Customer Sign-off:</span>
                  {activeJob.customerSignature?.dataUrl && <img src={activeJob.customerSignature.dataUrl} alt="Customer signature" className="h-14 my-1" />}
                  <p className="text-slate-700">Signed: {activeJob.customerSignature?.name || 'Pending'}</p>
                  <p className="text-slate-500 text-[11px]">Timestamp: {activeJob.customerSignature?.signedAt ? formatDateUK(activeJob.customerSignature.signedAt) : 'Pending'}</p>
                </div>
              </div>
            </div>
        </DetailDrawer>
      )}

    </div>
  );
};

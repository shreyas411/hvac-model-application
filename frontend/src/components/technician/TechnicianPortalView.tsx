import React, { useState, useEffect } from 'react';
import { EmptyState } from '../common/EmptyState';
import { SignaturePad } from './SignaturePad';
import { JobPhotos } from './JobPhotos';
import { TechJobHistory } from './TechJobHistory';
import { downloadSheet, printSheet } from '../../utils/pdf';
import { useApp } from '../../context/AppContext';
import { Job, JobStatus, JobChecklistItem, EquipmentReading, TechnicianProfile } from '../../types';
import { useChecklistTemplates, toChecklistItems } from '../../data/checklistTemplates';
import { formatGBP, formatDateUK, getTodayISO, canMoveJob } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconCircleCheck, IconDownload, IconFlame, IconMail, IconPackage, IconPencil, IconPhone, IconPlus, IconPrinter, IconSquareCheck, IconTool } from '@tabler/icons-react';

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
  const activeJob = techJobs.find((j) => j.id === selectedJobId) ?? techJobs[0]; // never another technician's job

  const customer = customers.find((c) => c.id === activeJob?.customerId);
  const location = customer?.serviceLocations.find((l) => l.id === activeJob?.locationId);
  const jobEquipments = equipment.filter((e) => activeJob?.equipmentIds.includes(e.id));

  // On-site form inputs
  const [workNotes, setWorkNotes] = useState<string>(activeJob?.workPerformed || '');
  const [labourHours, setLabourHours] = useState<number>(activeJob?.labourHours || 2.5);
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
  useEscape(showServiceReportModal, () => setShowServiceReportModal(false));

  // Reset the form whenever the job shown changes: carrying one job's notes or readings onto another would corrupt records
  const activeJobId = activeJob?.id;
  useEffect(() => {
    setWorkNotes(activeJob?.workPerformed || '');
    setLabourHours(activeJob?.labourHours || 2.5);
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

    showToast('Work report and readings logged successfully', 'success');
  };

  // Capture Digital Customer Signature
  const handleCaptureSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJob || busy || !signatureName.trim()) return;
    if (!signatureData) return showToast('Ask the customer to sign in the box first', 'error');

    setBusy(true);
    const ok = await updateJob(
      activeJob.id,
      {
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
    showToast(`Signature saved for ${signatureName}. Job marked completed!`, 'success');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Mobile Van Top Card */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg border border-sky-400/30">
              <IconTool className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white">Technician Van Portal</h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
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
              <span className="text-xs text-slate-400 hidden sm:inline">Active Van:</span>
              <select
                value={activeTechId}
                aria-label="Active van"
              onChange={(e) => { setActiveTechId(e.target.value); setSelectedJobId(''); }}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-sky-500"
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.vanRegistration || 'Van'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Today's Job Quick Carousel / Selector */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Route & Assigned Stops ({techJobs.length})
          </span>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {techJobs.map((job) => {
              const isSelected = job.id === activeJob?.id;
              const cust = customerById.get(job.customerId);
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-2 rounded-lg text-left transition-colors whitespace-nowrap shrink-0 border ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-400 shadow-xs'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs font-mono font-bold">
                    <span>{job.startTime} - {job.endTime}</span>
                    <span className="text-[10px] capitalize opacity-80">{job.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs font-medium mt-0.5 truncate max-w-[160px]">
                    {job.title || cust?.name || job.jobNumber}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeJob && (
        <div className="space-y-6">
          
          {/* Active Job Header & Status Workflow Action Buttons */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold font-mono text-slate-900">{activeJob.jobNumber}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                    {activeJob.type.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-slate-800 mt-1">
                  {customer?.name}
                </h2>
              </div>

              {/* Print Service Report Button */}
              <button
                onClick={() => setShowServiceReportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <IconPrinter className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Service Report</span>
              </button>
            </div>

            {/* Step Workflow Status Buttons */}
            <div>
              <span id="tp-status" className="block text-xs font-semibold text-slate-600 mb-2">
                Update Job Status Progress:
              </span>
              <div role="group" aria-labelledby="tp-status" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { status: 'new' as JobStatus, label: 'New', color: 'bg-slate-600 text-white' },
                  { status: 'awaiting_approval' as JobStatus, label: 'Awaiting Approval', color: 'bg-amber-600 text-white' },
                  { status: 'scheduled' as JobStatus, label: 'Scheduled', color: 'bg-indigo-600 text-white' },
                  { status: 'dispatched' as JobStatus, label: 'On the Way', color: 'bg-purple-600 text-white' },
                  { status: 'in_progress' as JobStatus, label: 'Arrived / Start', color: 'bg-sky-600 text-white' },
                  { status: 'on_hold' as JobStatus, label: 'On Hold', color: 'bg-orange-600 text-white' },
                  { status: 'completed' as JobStatus, label: 'Completed', color: 'bg-emerald-600 text-white' },
                  { status: 'cancelled' as JobStatus, label: 'Cancel', color: 'bg-rose-600 text-white' },
                ].map((item) => {
                  const isActive = activeJob.status === item.status;
                  // backend limits technicians to TECH_TARGETS (jobs/service.ts); admins viewing the portal are only bound by the workflow
                  const techOk = currentUser.role !== 'technician' || ['dispatched', 'in_progress', 'on_hold', 'completed'].includes(item.status);
                  const allowed = isActive || (techOk && canMoveJob(activeJob.status, item.status));
                  return (
                    <button
                      key={item.status}
                      disabled={!allowed}
                      aria-pressed={isActive}
                      onClick={() => { const go = () => void updateJobStatus(activeJob.id, item.status); if (item.status === 'cancelled') confirmToast(`Cancel ${activeJob.jobNumber}?`, go); else go(); }}
                      className={`py-3 px-3 text-xs font-semibold rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                        isActive
                          ? `${item.color} shadow-xs border-transparent ring-2 ring-slate-900`
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
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
                  {location?.city}, <span className="font-mono font-semibold">{location?.postcode}</span>
                </p>
                {location?.accessNotes && (
                  <p className="mt-1.5 text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 text-[11px]">
                    <strong>Access Notes:</strong> {location.accessNotes}
                  </p>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Site Contact:</span>
                <p className="text-slate-900 font-medium">
                  {location?.contactName || customer?.name}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <a
                    href={`tel:${location?.contactPhone || customer?.phone}`}
                    className="inline-flex items-center gap-1 py-2 text-sky-700 hover:text-sky-900 font-medium"
                  >
                    <IconPhone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{location?.contactPhone || customer?.phone}</span>
                  </a>
                  <a
                    href={`mailto:${customer?.email}`}
                    className="inline-flex items-center gap-1 py-2 text-slate-600 hover:text-slate-900"
                  >
                    <IconMail className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Email</span>
                  </a>
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
                    <span className="font-mono text-[11px] text-slate-500">
                      S/N: {eq.serialNumber}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inspection Checklists (Gas Safe & F-Gas Requirements) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
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
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleChecklistToggle(item.id)}
                    className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="flex-1">
                    <span className={`font-medium ${item.checked ? 'text-slate-900 line-through' : 'text-slate-800'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize block mt-0.5">
                      Category: {item.category.replace('_', ' ')}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            {(() => {
              const have = new Set(activeJob.checklist.map((c) => c.label));
              const available = templates.filter((t) => t.jobType === activeJob.type && !have.has(t.label));
              return (
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  {available.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 capitalize">
                          {activeJob.type.replace(/_/g, ' ')} checklist
                        </span>
                        <button
                          type="button"
                          onClick={() => addChecklistItems(toChecklistItems(available))}
                          className="text-sky-700 font-semibold hover:underline"
                        >
                          Add all
                        </button>
                      </div>
                      {available.map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => addChecklistItems(toChecklistItems([t]))}
                          className="w-full text-left px-2 py-1.5 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50"
                        >
                          + {t.label}
                        </button>
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
                    <input
                      value={customItem}
                      onChange={(e) => setCustomItem(e.target.value)}
                      aria-label="Custom checklist item" autoComplete="off" placeholder="Custom checklist item"
                      className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                    <button type="submit" className="px-4 py-2 rounded-lg bg-sky-700 text-white font-semibold inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" aria-hidden="true" /> Add</button>
                  </form>
                </div>
              );
            })()}
          </div>

          {/* HVAC Diagnostic Readings & Findings Input */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
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
                <label htmlFor="tp-1" className="block text-slate-600 font-semibold mb-1">Pressure (Bar)</label>
                <input id="tp-1"
                  type="number"
                  step="0.1"
                  value={pressureBar}
                  onChange={(e) => setPressureBar(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  placeholder="e.g. 1.4"
                />
              </div>

              <div>
                <label htmlFor="tp-2" className="block text-slate-600 font-semibold mb-1">Flow Temp (°C)</label>
                <input id="tp-2"
                  type="number"
                  value={flowTempC}
                  onChange={(e) => setFlowTempC(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  placeholder="e.g. 70"
                />
              </div>

              <div>
                <label htmlFor="tp-3" className="block text-slate-600 font-semibold mb-1">Return Temp (°C)</label>
                <input id="tp-3"
                  type="number"
                  value={returnTempC}
                  onChange={(e) => setReturnTempC(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  placeholder="e.g. 54"
                />
              </div>

              <div>
                <label htmlFor="tp-4" className="block text-slate-600 font-semibold mb-1">CO (ppm)</label>
                <input id="tp-4"
                  type="number"
                  value={coPpm}
                  onChange={(e) => setCoPpm(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  placeholder="e.g. 14"
                />
              </div>

              <div>
                <label htmlFor="tp-5" className="block text-slate-600 font-semibold mb-1">CO2 Ratio (%)</label>
                <input id="tp-5"
                  type="number"
                  step="0.1"
                  value={co2Percent}
                  onChange={(e) => setCo2Percent(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  placeholder="e.g. 9.2"
                />
              </div>

              <div>
                <label htmlFor="tp-6" className="block text-slate-600 font-semibold mb-1">Refrigerant Suction (psi)</label>
                <input id="tp-6"
                  type="number"
                  value={refrigerantPsi}
                  onChange={(e) => setRefrigerantPsi(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
                  placeholder="e.g. 125"
                />
              </div>
            </div>

            {/* Work notes & labour hours */}
            <div className="space-y-3 pt-2">
              <div>
                <label htmlFor="tp-7" className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Notes & Action Performed:
                </label>
                <textarea id="tp-7"
                  rows={3}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="Describe test results, cleaning steps, parts fitted, and gas/oil observations..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-40">
                  <label htmlFor="tp-8" className="block text-xs font-semibold text-slate-700 mb-1">
                    Labour Hours:
                  </label>
                  <input id="tp-8"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={labourHours}
                    onChange={(e) => setLabourHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>

                <div className="flex-1 pt-4">
                  <button
                    type="button"
                    onClick={handleSaveFindings}
                    disabled={busy} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs disabled:opacity-60"
                  >
                    Save Findings & Log Readings
                  </button>
                </div>
              </div>
            </div>

            {/* Follow-up Work Recommendation (Workflow D Trigger) */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                <input
                  type="checkbox"
                  checked={followUpRecommended}
                  onChange={(e) => setFollowUpRecommended(e.target.checked)}
                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Recommend Follow-up Visit / Additional Work Required (Workflow D)</span>
              </label>

              {followUpRecommended && (
                <div className="pt-1 space-y-1">
                  <p className="text-[11px] text-purple-800">
                    Flagged items automatically notify the office dispatcher to prepare a quotation for the customer.
                  </p>
                  <textarea
                    rows={2}
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="e.g. Intermittent refrigerant pressure drop noted. Recommend nitrogen pressure test & pipe braze repair."
                    className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Refrigerant handling log (required to complete jobs with a refrigerant checklist item) */}
          {activeJob.checklist.some((c) => c.category === 'refrigerant') && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">Refrigerant Log</h3>
              <form onSubmit={handleAddRefrigerant} className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <input required aria-label="Refrigerant" placeholder="Refrigerant" value={fridge.refrigerant} onChange={(e) => setFridge({ ...fridge, refrigerant: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-md" />
                <select aria-label="Action" value={fridge.action} onChange={(e) => setFridge({ ...fridge, action: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white">
                  <option value="charge">Charge</option><option value="recover">Recover</option><option value="reclaim">Reclaim</option><option value="leak_check">Leak check</option>
                </select>
                <input required type="number" min="0" step="0.01" aria-label="Amount (kg)" placeholder="Amount (kg)" value={fridge.amountKg} onChange={(e) => setFridge({ ...fridge, amountKg: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-md font-mono" />
                <input aria-label="Cylinder ID" autoComplete="off" placeholder="Cylinder ID" value={fridge.cylinderId} onChange={(e) => setFridge({ ...fridge, cylinderId: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-md" />
                <input required aria-label="Certificate number" autoComplete="off" placeholder="Cert number" value={fridge.certNumber} onChange={(e) => setFridge({ ...fridge, certNumber: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-md" />
                <button type="submit" disabled={busy} className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md disabled:opacity-60 inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" aria-hidden="true" /> Add Entry</button>
              </form>
              {activeJob.refrigerantLogs?.map((l) => (
                <div key={l.id} className="text-xs p-2.5 bg-slate-50 rounded-lg flex justify-between">
                  <span className="font-semibold">{l.action.replace('_', ' ')} · {l.refrigerant}</span>
                  <span className="font-mono">{l.amountKg} kg</span>
                </div>
              ))}
            </div>
          )}

          {/* Parts Used on Site (Van Stock Inventory Deduction) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Van Parts Consumed</h3>
              <span className="text-xs text-slate-500">Live Inventory Deduction</span>
            </div>

            {/* Add Part Form */}
            <form onSubmit={handleAddPartToJob} className="flex flex-col sm:flex-row gap-2 text-xs">
              <select
                aria-label="Part" value={partId}
                onChange={(e) => setSelectedPartId(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900"
              >
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) - Available: {p.stockQuantity}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                aria-label="Quantity" value={partQuantity}
                onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
                className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
              />

              <button
                type="submit"
                disabled={busy} className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md flex items-center justify-center gap-1 disabled:opacity-60"
              >
                <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Part</span>
              </button>
            </form>

            {/* Listed Parts */}
            {activeJob.partsUsed.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs">
                {activeJob.partsUsed.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-slate-50">
                    <div>
                      <span className="font-semibold text-slate-900">{p.partName}</span>
                      <span className="text-[11px] text-slate-500 block font-mono">{p.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-800">{p.quantity} unit(s)</span>
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
          </div>

          <JobPhotos jobId={activeJob.id} locked={activeJob.status === 'completed'} />

          {/* Customer Approval & Digital Signature */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
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
                  <label htmlFor="tp-9" className="block text-slate-700 font-semibold mb-1">
                    Customer Full Name:
                  </label>
                  <input id="tp-9"
                    type="text"
                    required
                    name="signatory" autoComplete="off" value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="e.g. Dr. Alistair Finch / Nigel Edwards"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <span className="block text-slate-700 font-semibold mb-1">
                    Sign on Glass / Touch Approval:
                  </span>
                  <SignaturePad key={activeJobId} onChange={setSignatureData} />
                </div>

                <button
                  type="submit"
                  disabled={busy} className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm text-xs transition-colors disabled:opacity-60"
                >
                  Capture Signature & Complete Job
                </button>
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
                <button
                  onClick={() => setShowServiceReportModal(true)}
                  className="px-3 py-1.5 bg-emerald-700 text-white font-semibold rounded-md text-xs"
                >
                  View Service Sheet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Official Service Report Modal (Printable/Downloadable) */}
      <TechJobHistory technicianId={activeTech.id} />

      {showServiceReportModal && activeJob && (
        <div role="dialog" aria-modal="true" aria-label="Service report" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                Official HVAC Service Certificate & Report
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => downloadSheet(e.currentTarget, `${activeJob.jobNumber}-report.pdf`)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
                >
                  <IconDownload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={(e) => printSheet(e.currentTarget)}
                  className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  <IconPrinter className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print Report</span>
                </button>
                <button
                  onClick={() => setShowServiceReportModal(false)}
                  aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>

            {/* Printable Report Sheet */}
            <div data-pdf-sheet className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{settings.companyName}</h2>
                  <p className="text-slate-500">{settings.addressLine1}, {settings.city} {settings.postcode}</p>
                  <p className="text-slate-500 font-mono">Gas Safe: #{settings.gasSafeRegisterNo} · F-Gas: #{settings.fGasCertNo}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-slate-900 block">{activeJob.jobNumber}</span>
                  <span className="text-slate-500 block">Date: {formatDateUK(activeJob.appointmentDate)}</span>
                  <span className="text-slate-500 block">Engineer: {activeTech.name}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 mb-1">Customer & Site Address</h3>
                <p className="text-slate-800 font-semibold">{customer?.name}</p>
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

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowServiceReportModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import { CustomerFormModal } from '../customers/CustomerFormModal';
import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Priority, JobType, LineItem } from '../../types';
import { formatGBP, tierPrices, getTodayISO } from '../../utils/formatters';
import { useChecklistTemplates, toChecklistItems } from '../../data/checklistTemplates';
import { useEscape } from '../../utils/useEscape';
import { IconAlertTriangle, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

// Starting lines for a new quote / invoice.
const defaultLines = (hourlyRate: number, travelCharge: number): LineItem[] => [
  {
    id: 'li-1',
    type: 'labour',
    description: 'Standard HVAC Diagnostic & Service Labour (2 hrs)',
    quantity: 2,
    unitPrice: hourlyRate,
    amount: hourlyRate * 2,
  },
  {
    id: 'li-2',
    type: 'travel',
    description: 'Depot Van Travel & Callout Fee',
    quantity: 1,
    unitPrice: travelCharge,
    amount: travelCharge,
  },
];

interface QuickCreateModalsProps {
  activeModal: 'customer' | 'job' | 'request' | 'quote' | 'invoice' | null;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const QuickCreateModals: React.FC<QuickCreateModalsProps> = ({
  activeModal,
  onClose,
  onNavigateTab,
}) => {
  const { 
    customers, 
    equipment, 
    technicians, 
    addServiceRequest, 
    addJob, 
    addQuotation, 
    addInvoice, 
    checkScheduleConflict,
    settings,
    parts,
    customerById,
  } = useApp(['customers', 'equipment', 'technicians', 'addServiceRequest', 'addJob', 'addQuotation', 'addInvoice', 'checkScheduleConflict', 'settings', 'parts', 'customerById']);

  // Common customer selector
  // Customers load async after login; this component mounts earlier, so default at render time, not in useState.
  const [pickedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [pickedLocationId, setPickedLocationId] = useState('');
  const selectedCustomer = customerById.get(pickedCustomerId) ?? customers[0];
  const selectedCustomerId = selectedCustomer?.id ?? '';
  const selectedLocation = selectedCustomer?.serviceLocations.find((l) => l.id === pickedLocationId) ?? selectedCustomer?.serviceLocations[0];

  // Request state
  const [reqProblem, setReqProblem] = useState('');
  const [reqPriority, setReqPriority] = useState<Priority>('medium');
  const [reqSlot, setReqSlot] = useState<'morning' | 'afternoon' | 'all_day' | 'urgent'>('morning');
  const [reqEquipmentId, setReqEquipmentId] = useState('');

  // Job state
  const { templates } = useChecklistTemplates();
  const [jobType, setJobType] = useState<JobType>('repair');
  const [jobPriority, setJobPriority] = useState<Priority>('medium');
  const [jobDate, setJobDate] = useState(getTodayISO());
  const [jobStartTime, setJobStartTime] = useState('09:00');
  const [jobEndTime, setJobEndTime] = useState('11:30');
  const [jobTechId, setJobTechId] = useState(technicians[0]?.id || '');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  // Quote / Invoice line items state
  const [lineItems, setLineItems] = useState<LineItem[]>(() => defaultLines(settings.defaultHourlyRate, settings.defaultTravelCharge));
  const [vatRate, setVatRate] = useState<number>(settings.defaultVatRate);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [cisRate, setCisRate] = useState(0);
  const [retentionPct, setRetentionPct] = useState(0);
  const [terms, setTerms] = useState(settings.termsAndConditions);

  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicates)
  useEscape(!!activeModal, onClose);
  // This component stays mounted, so every open starts clean: today's date, current settings, nothing left from the last form.
  useEffect(() => {
    if (!activeModal) return;
    setJobDate(getTodayISO()); setReqProblem(''); setReqEquipmentId(''); setJobTitle(''); setJobDesc(''); setConflictWarning(null); setPickedLocationId('');
    setLineItems(defaultLines(settings.defaultHourlyRate, settings.defaultTravelCharge)); setReverseCharge(false); setCisRate(0); setRetentionPct(0);
    setVatRate(settings.defaultVatRate); setTerms(settings.termsAndConditions);
  }, [activeModal]);

  if (!activeModal) return null;

  if (activeModal === 'customer') return <CustomerFormModal customer={null} onClose={onClose} />;

  // Add line item
  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: `li-${Date.now()}`,
        type: 'part',
        description: 'HVAC Part / Material Item',
        quantity: 1,
        unitPrice: 50.00,
        amount: 50.00,
      },
    ]);
  };

  const handleUpdateLine = (id: string, updates: Partial<LineItem>) => {
    setLineItems(
      lineItems.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, ...updates };
        updated.amount = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  };

  const handleRemoveLine = (id: string) => {
    setLineItems(lineItems.filter((li) => li.id !== id));
  };

  const sumOf = (ls: LineItem[]) => ls.reduce((sum, li) => sum + li.amount, 0);
  // Quote tiers are alternatives: price shared lines plus the cheapest tier, as the server does.
  const tierTotals = Object.values(Object.groupBy(lineItems.filter((li) => li.option), (li) => li.option!)).map((ls) => sumOf(ls!));
  const subtotal = sumOf(lineItems.filter((li) => !li.option)) + (tierTotals.length ? Math.min(...tierTotals) : 0);
  const vatAmount = reverseCharge && activeModal === 'invoice' ? 0 : subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const guard = (h: (e: React.FormEvent) => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await h(e); } finally { setBusy(false); }
  };

  // Submit Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedLocation) return;

    const created = await addServiceRequest({
      customerId: selectedCustomer.id,
      locationId: selectedLocation.id,
      equipmentId: reqEquipmentId || undefined,
      reportedProblem: reqProblem,
      priority: reqPriority,
      preferredSlot: reqSlot,
      status: 'new',
      contactPerson: selectedCustomer.name,
      contactPhone: selectedCustomer.phone,
    });
    if (!created) return;

    onClose();
    onNavigateTab('requests');
  };

  // Submit Job
  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedLocation) return;

    // Check conflict
    if (jobTechId) {
      const conflict = checkScheduleConflict(jobTechId, jobDate, jobStartTime, jobEndTime);
      if (conflict) {
        setConflictWarning(
          `Technician conflict: Already booked for ${conflict.jobNumber} from ${conflict.startTime} to ${conflict.endTime}.`
        );
        return;
      }
    }

    const durationMins = Math.max(
      30,
      ((parseInt(jobEndTime.split(':')[0]) * 60 + parseInt(jobEndTime.split(':')[1])) -
        (parseInt(jobStartTime.split(':')[0]) * 60 + parseInt(jobStartTime.split(':')[1])))
    );

    const created = await addJob({
      customerId: selectedCustomer.id,
      locationId: selectedLocation.id,
      equipmentIds: [],
      type: jobType,
      priority: jobPriority,
      status: jobTechId ? 'scheduled' : 'new',
      technicianId: jobTechId || null,
      appointmentDate: jobDate,
      startTime: jobStartTime,
      endTime: jobEndTime,
      estimatedDurationMinutes: durationMins,
      requiredSkills: [],
      title: jobTitle.trim(),
      description: jobDesc,
      partsUsed: [],
      labourHours: durationMins / 60,
      hourlyRate: settings.defaultHourlyRate,
      travelTimeMinutes: 30,
      travelCharge: settings.defaultTravelCharge,
      checklist: toChecklistItems(templates.filter((t) => t.jobType === jobType)),
    });
    if (!created) return;

    onClose();
    onNavigateTab('dispatch');
  };

  // Submit Quote
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedLocation) return;

    const issueDate = getTodayISO();
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

    const created = await addQuotation({
      customerId: selectedCustomer.id,
      locationId: selectedLocation.id,
      issueDate,
      expiryDate,
      status: 'sent',
      items: lineItems,
      subtotal,
      vatRatePercent: vatRate,
      vatAmount,
      total,
      terms,
    });
    if (!created) return;

    onClose();
    onNavigateTab('quotations');
  };

  // Submit Invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedLocation) return;

    const issueDate = getTodayISO();
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

    const created = await addInvoice({
      customerId: selectedCustomer.id,
      locationId: selectedLocation.id,
      issueDate,
      dueDate,
      status: 'issued',
      items: lineItems,
      subtotal,
      vatRatePercent: vatRate,
      vatAmount,
      total,
      payments: [],
      amountPaid: 0,
      balanceDue: total,
      paymentTermsDays: 14,
      notes: terms,
      reverseCharge,
      cisRatePercent: cisRate,
      retentionPercent: retentionPct,
    });
    if (!created) return;

    onClose();
    onNavigateTab('invoices');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label={`Create new ${activeModal}`}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 capitalize">
            Create New {activeModal.replace('_', ' ')}
          </h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <IconX className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Customer selector (common) */}
          <div>
            <label htmlFor="qc-cust" className="block font-semibold text-slate-700 mb-1">Customer Client *</label>
            <select
              id="qc-cust" value={selectedCustomerId}
              onChange={(e) => { setSelectedCustomerId(e.target.value); setPickedLocationId(''); setReqEquipmentId(''); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
            {selectedCustomer && selectedCustomer.serviceLocations.length > 1 && (
              <div className="mt-2">
                <label htmlFor="qc-site" className="block font-semibold text-slate-700 mb-1">Service Location *</label>
                <select id="qc-site" value={selectedLocation?.id ?? ''} onChange={(e) => { setPickedLocationId(e.target.value); setReqEquipmentId(''); }} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs">
                  {selectedCustomer.serviceLocations.map((l) => <option key={l.id} value={l.id}>{l.label} - {l.addressLine1}</option>)}
                </select>
              </div>
            )}
            {selectedCustomer && !selectedLocation && (
              <p className="mt-1 text-red-600">This customer has no service location. Add a site in Customers first.</p>
            )}
          </div>

          {/* SERVICE REQUEST FORM */}
          {activeModal === 'request' && (
            <form onSubmit={guard(handleSubmitRequest)} className="space-y-3">
              <div>
                <label htmlFor="qc-problem" className="block font-semibold text-slate-700 mb-1">Reported Problem / Fault *</label>
                <textarea
                  rows={3}
                  required
                  id="qc-problem" name="problem" value={reqProblem}
                  onChange={(e) => setReqProblem(e.target.value)}
                  placeholder="e.g. No heating or hot water, boiler displaying F75 pressure fault…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qc-pri" className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    id="qc-pri" value={reqPriority}
                    onChange={(e) => setReqPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs capitalize"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency Callout</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="qc-slot" className="block font-semibold text-slate-700 mb-1">Preferred Time Slot</label>
                  <select
                    id="qc-slot" value={reqSlot}
                    onChange={(e) => setReqSlot(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs capitalize"
                  >
                    <option value="morning">Morning (08:00 - 12:00)</option>
                    <option value="afternoon">Afternoon (12:00 - 17:00)</option>
                    <option value="all_day">All Day</option>
                    <option value="urgent">Urgent / Immediate</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="qc-eq" className="block font-semibold text-slate-700 mb-1">Customer Equipment</label>
                <select
                  id="qc-eq" value={reqEquipmentId}
                  onChange={(e) => setReqEquipmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="">-- General / Not Specified --</option>
                  {equipment
                    .filter((e) => e.customerId === selectedCustomerId && (!selectedLocation || e.locationId === selectedLocation.id))
                    .map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.brand} {eq.model} (S/N: {eq.serialNumber})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  Log Service Request
                </button>
              </div>
            </form>
          )}

          {/* BOOK JOB FORM */}
          {activeModal === 'job' && (
            <form onSubmit={guard(handleSubmitJob)} className="space-y-3">
              <div>
                <label htmlFor="qc-jtitle" className="block font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  required maxLength={200} autoComplete="off"
                  id="qc-jtitle" name="title" value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Annual boiler service"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              {conflictWarning && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start gap-2">
                  <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs font-semibold">{conflictWarning}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qc-jtype" className="block font-semibold text-slate-700 mb-1">Job Type</label>
                  <select
                    id="qc-jtype" value={jobType}
                    onChange={(e) => setJobType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs capitalize"
                  >
                    <option value="repair">Repair</option>
                    <option value="installation">Installation</option>
                    <option value="preventive_maintenance">Preventive Maintenance</option>
                    <option value="inspection">Inspection / CP12 Gas Check</option>
                    <option value="emergency_callout">Emergency Callout</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="qc-jtech" className="block font-semibold text-slate-700 mb-1">Assign Engineer</label>
                  <select
                    id="qc-jtech" value={jobTechId}
                    onChange={(e) => {
                      setJobTechId(e.target.value);
                      setConflictWarning(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                  >
                    <option value="">-- Unassigned --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.skills[0]})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="qc-jdate" className="block font-semibold text-slate-700 mb-1">Appointment Date</label>
                <input
                  type="date"
                  required
                  id="qc-jdate" value={jobDate}
                  onChange={(e) => {
                    setJobDate(e.target.value);
                    setConflictWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qc-jstart" className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    id="qc-jstart" value={jobStartTime}
                    onChange={(e) => setJobStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="qc-jend" className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    id="qc-jend" value={jobEndTime}
                    onChange={(e) => setJobEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="qc-jdesc" className="block font-semibold text-slate-700 mb-1">Instructions / Description</label>
                <textarea
                  rows={2}
                  required
                  id="qc-jdesc" name="description" value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="e.g. Annual Gas Safety check on Worcester Bosch combi boiler."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  Schedule Job
                </button>
              </div>
            </form>
          )}

          {/* QUOTE OR INVOICE FORM */}
          {(activeModal === 'quote' || activeModal === 'invoice') && (
            <form onSubmit={guard(activeModal === 'quote' ? handleSubmitQuote : handleSubmitInvoice)} className="space-y-4">
              
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Line Items & Materials</span>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs text-sky-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Line</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lineItems.map((li) => (
                  <div key={li.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        aria-label="Line description" name="description" autoComplete="off" value={li.description}
                        onChange={(e) => handleUpdateLine(li.id, { description: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        placeholder="Description"
                      />
                      {activeModal === 'quote' && (
                        <select
                          aria-label="Quote option" value={li.option ?? ''}
                          onChange={(e) => handleUpdateLine(li.id, { option: e.target.value || undefined })}
                          className="w-24 px-1 py-1 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="">All tiers</option>
                          <option>Good</option>
                          <option>Better</option>
                          <option>Best</option>
                        </select>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove line: ${li.description}`}
                        onClick={() => handleRemoveLine(li.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <IconTrash className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor={`qty-${li.id}`} className="text-[10px] text-slate-500 block">Qty</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          id={`qty-${li.id}`} inputMode="decimal" value={li.quantity}
                          onChange={(e) => handleUpdateLine(li.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label htmlFor={`price-${li.id}`} className="text-[10px] text-slate-500 block">Unit Price (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          id={`price-${li.id}`} inputMode="decimal" value={li.unitPrice}
                          onChange={(e) => handleUpdateLine(li.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>
                      <div className="text-right">
                        <label className="text-[10px] text-slate-500 block">Line Total</label>
                        <span className="font-mono font-bold text-slate-900 block mt-1">
                          {formatGBP(li.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeModal === 'quote' && tierPrices(lineItems, vatRate).length > 0 && (
                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-sky-900">Price per option (inc. VAT)</span>
                  {tierPrices(lineItems, vatRate).map((t) => (
                    <div key={t.name} className="flex justify-between"><span>{t.name}</span><span className="font-mono font-bold">{formatGBP(t.total)}</span></div>
                  ))}
                </div>
              )}
              {/* VAT & Totals */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Applicable UK VAT:</span>
                  <select
                    aria-label="VAT rate" value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    className="px-2 py-1 border border-slate-300 rounded text-xs font-mono bg-white"
                  >
                    <option value={20}>20% (Standard)</option>
                    <option value={5}>5% (Reduced)</option>
                    <option value={0}>0% (Zero)</option>
                  </select>
                </div>

                {activeModal === 'invoice' && (
                  <>
                    <label className="flex justify-between items-center text-slate-600">
                      <span>Domestic reverse charge (no VAT charged):</span>
                      <input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} />
                    </label>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">CIS deduction (labour only):</span>
                      <select aria-label="CIS deduction" value={cisRate} onChange={(e) => setCisRate(Number(e.target.value))} className="px-2 py-1 border border-slate-300 rounded text-xs font-mono bg-white">
                        <option value={0}>None</option>
                        <option value={20}>20%</option>
                        <option value={30}>30%</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Retention held (%):</span>
                      <input aria-label="Retention percent" type="number" min={0} max={100} step={0.5} value={retentionPct} onChange={(e) => setRetentionPct(Number(e.target.value))} className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono text-right" />
                    </div>
                  </>
                )}

                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-100">
                  <span>Grand Total:</span>
                  <span className="font-mono text-sky-900">{formatGBP(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  Cancel
                </button>
                <button type="submit" disabled={busy || lineItems.length === 0} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  {activeModal === 'quote' ? 'Generate Quotation' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

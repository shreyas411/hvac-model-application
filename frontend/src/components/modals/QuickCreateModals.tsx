import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Priority, JobType, LineItem } from '../../types';
import { formatGBP } from '../../utils/formatters';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';

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
    parts
  } = useApp();

  // Common customer selector
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedLocation = selectedCustomer?.serviceLocations[0];

  // Request state
  const [reqProblem, setReqProblem] = useState('');
  const [reqPriority, setReqPriority] = useState<Priority>('medium');
  const [reqSlot, setReqSlot] = useState<'morning' | 'afternoon' | 'all_day' | 'urgent'>('morning');
  const [reqEquipmentId, setReqEquipmentId] = useState('');

  // Job state
  const [jobType, setJobType] = useState<JobType>('repair');
  const [jobPriority, setJobPriority] = useState<Priority>('medium');
  const [jobDate, setJobDate] = useState('2026-10-14');
  const [jobStartTime, setJobStartTime] = useState('09:00');
  const [jobEndTime, setJobEndTime] = useState('11:30');
  const [jobTechId, setJobTechId] = useState(technicians[0]?.id || '');
  const [jobDesc, setJobDesc] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Quote / Invoice line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: 'li-1',
      type: 'labour',
      description: 'Standard HVAC Diagnostic & Service Labour (2 hrs)',
      quantity: 2,
      unitPrice: 85.00,
      amount: 170.00,
    },
    {
      id: 'li-2',
      type: 'travel',
      description: 'Depot Van Travel & Callout Fee',
      quantity: 1,
      unitPrice: 35.00,
      amount: 35.00,
    },
  ]);
  const [vatRate, setVatRate] = useState<number>(settings.defaultVatRate);
  const [terms, setTerms] = useState(settings.termsAndConditions);

  if (!activeModal || activeModal === 'customer') return null;

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

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  // Submit Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const created = await addServiceRequest({
      customerId: selectedCustomer.id,
      locationId: selectedLocation?.id || selectedCustomer.serviceLocations[0]?.id,
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
    if (!selectedCustomer) return;

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
      locationId: selectedLocation?.id || selectedCustomer.serviceLocations[0]?.id,
      equipmentIds: [],
      type: jobType,
      priority: jobPriority,
      status: jobTechId ? 'scheduled' : 'new',
      technicianId: jobTechId || null,
      appointmentDate: jobDate,
      startTime: jobStartTime,
      endTime: jobEndTime,
      estimatedDurationMinutes: durationMins,
      requiredSkills: ['System Diagnostics'],
      description: jobDesc,
      partsUsed: [],
      labourHours: durationMins / 60,
      hourlyRate: 85.00,
      travelTimeMinutes: 30,
      travelCharge: 35.00,
      checklist: [
        { id: `c-1`, category: 'general', label: 'Initial visual survey and isolate supply', checked: false },
        { id: `c-2`, category: 'general', label: 'Perform diagnostic testing and maintenance', checked: false },
        { id: `c-3`, category: 'general', label: 'Verify operational safety and test burn/cycle', checked: false },
      ],
    });
    if (!created) return;

    onClose();
    onNavigateTab('dispatch');
  };

  // Submit Quote
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const issueDate = new Date().toISOString().split('T')[0];
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const created = await addQuotation({
      customerId: selectedCustomer.id,
      locationId: selectedLocation?.id || selectedCustomer.serviceLocations[0]?.id,
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
    if (!selectedCustomer) return;

    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const created = await addInvoice({
      customerId: selectedCustomer.id,
      locationId: selectedLocation?.id || selectedCustomer.serviceLocations[0]?.id,
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
    });
    if (!created) return;

    onClose();
    onNavigateTab('invoices');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 capitalize">
            Create New {activeModal.replace('_', ' ')}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Customer selector (common) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer Client *</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* SERVICE REQUEST FORM */}
          {activeModal === 'request' && (
            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reported Problem / Fault *</label>
                <textarea
                  rows={3}
                  required
                  value={reqProblem}
                  onChange={(e) => setReqProblem(e.target.value)}
                  placeholder="e.g. No heating or hot water, boiler displaying F75 pressure fault..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={reqPriority}
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
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Time Slot</label>
                  <select
                    value={reqSlot}
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
                <label className="block font-semibold text-slate-700 mb-1">Customer Equipment</label>
                <select
                  value={reqEquipmentId}
                  onChange={(e) => setReqEquipmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="">-- General / Not Specified --</option>
                  {equipment
                    .filter((e) => e.customerId === selectedCustomerId)
                    .map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.brand} {eq.model} (S/N: {eq.serialNumber})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg">
                  Log Service Request
                </button>
              </div>
            </form>
          )}

          {/* BOOK JOB FORM */}
          {activeModal === 'job' && (
            <form onSubmit={handleSubmitJob} className="space-y-3">
              {conflictWarning && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold">{conflictWarning}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Type</label>
                  <select
                    value={jobType}
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
                  <label className="block font-semibold text-slate-700 mb-1">Assign Engineer</label>
                  <select
                    value={jobTechId}
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
                <label className="block font-semibold text-slate-700 mb-1">Appointment Date</label>
                <input
                  type="date"
                  required
                  value={jobDate}
                  onChange={(e) => {
                    setJobDate(e.target.value);
                    setConflictWarning(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={jobStartTime}
                    onChange={(e) => setJobStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={jobEndTime}
                    onChange={(e) => setJobEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Instructions / Description</label>
                <textarea
                  rows={2}
                  required
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="e.g. Annual Gas Safety check on Worcester Bosch combi boiler."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg">
                  Schedule Job
                </button>
              </div>
            </form>
          )}

          {/* QUOTE OR INVOICE FORM */}
          {(activeModal === 'quote' || activeModal === 'invoice') && (
            <form onSubmit={activeModal === 'quote' ? handleSubmitQuote : handleSubmitInvoice} className="space-y-4">
              
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Line Items & Materials</span>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs text-sky-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lineItems.map((li) => (
                  <div key={li.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => handleUpdateLine(li.id, { description: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        placeholder="Description"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(li.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block">Qty</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={li.quantity}
                          onChange={(e) => handleUpdateLine(li.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Unit Price (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={li.unitPrice}
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

              {/* VAT & Totals */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Applicable UK VAT:</span>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    className="px-2 py-1 border border-slate-300 rounded text-xs font-mono bg-white"
                  >
                    <option value={20}>20% (Standard)</option>
                    <option value={5}>5% (Reduced)</option>
                    <option value={0}>0% (Zero)</option>
                  </select>
                </div>

                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-100">
                  <span>Grand Total:</span>
                  <span className="font-mono text-sky-900">{formatGBP(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg">
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

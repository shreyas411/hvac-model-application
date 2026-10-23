import { CustomerFormDrawer } from '../customers/CustomerFormDrawer';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Priority, JobType, LineItem, Quotation } from '../../types';
import { formatGBP, tierPrices, getTodayISO } from '../../utils/formatters';
import { useChecklistTemplates, toChecklistItems } from '../../data/checklistTemplates';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { DetailDrawer } from '../common/DetailDrawer';
import { DatePicker } from '../common/DatePicker';
import { Combobox } from '../common/Combobox';
import { LineItemPicker } from '../common/LineItemPicker';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';

// Lines the user adds on purpose (rates come from Settings); a new quote / invoice starts with none.
const newLine = (kind: 'labour' | 'travel' | 'part', rates: { hourly: number; travel: number }): LineItem => {
  const base = { id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, quantity: 1 };
  if (kind === 'labour') return { ...base, type: 'labour', description: 'Labour', quantity: 1, unitPrice: rates.hourly, amount: rates.hourly };
  if (kind === 'travel') return { ...base, type: 'travel', description: 'Travel / call-out', unitPrice: rates.travel, amount: rates.travel };
  return { ...base, type: 'part', description: '', unitPrice: 0, amount: 0 };
};

interface QuickCreateModalsProps {
  activeModal: 'customer' | 'job' | 'request' | 'quote' | 'invoice' | null;
  initialCustomerId?: string; // pre-selects the customer when started from their 360 view
  editQuote?: Quotation | null; // with activeModal 'quote': edit this draft / sent quote instead of creating one
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const QuickCreateModals: React.FC<QuickCreateModalsProps> = ({
  activeModal,
  initialCustomerId,
  editQuote,
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
    updateQuotation,
    addInvoice, 
    checkScheduleConflict,
    settings,
    parts,
    customerById,
  } = useApp(['customers', 'equipment', 'technicians', 'addServiceRequest', 'addJob', 'addQuotation', 'updateQuotation', 'addInvoice', 'checkScheduleConflict', 'settings', 'parts', 'customerById']);

  // Common customer selector
  // No default customer: a document must never go to someone nobody chose. Site is pre-selected only when there is just one.
  const [pickedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [pickedLocationId, setPickedLocationId] = useState('');
  const selectedCustomer = customerById.get(pickedCustomerId);
  const selectedCustomerId = selectedCustomer?.id ?? '';
  const selectedLocation = selectedCustomer?.serviceLocations.find((l) => l.id === pickedLocationId) ?? (selectedCustomer?.serviceLocations.length === 1 ? selectedCustomer.serviceLocations[0] : undefined);

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
  const [jobTechId, setJobTechId] = useState(''); // unassigned until the dispatcher picks someone
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  // Quote / Invoice line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [vatRate, setVatRate] = useState<number>(settings.defaultVatRate);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [cisRate, setCisRate] = useState(0);
  const [retentionPct, setRetentionPct] = useState(0);
  const [terms, setTerms] = useState(settings.termsAndConditions);

  const quoteStatus = useRef<'draft' | 'sent'>('sent'); // which submit button was pressed
  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicates)
  // This component stays mounted, so every open starts clean: today's date, current settings, nothing left from the last form.
  useEffect(() => {
    if (!activeModal) return;
    setJobDate(getTodayISO()); setReqProblem(''); setReqEquipmentId(''); setJobTitle(''); setJobDesc(''); setConflictWarning(null); setPickedLocationId('');
    setSelectedCustomerId(initialCustomerId ?? ''); setJobTechId(''); setLineItems([]); setReverseCharge(false); setCisRate(0); setRetentionPct(0);
    setVatRate(settings.defaultVatRate); setTerms(settings.termsAndConditions);
    if (editQuote) { setSelectedCustomerId(editQuote.customerId); setPickedLocationId(editQuote.locationId); setLineItems(editQuote.items); setVatRate(editQuote.vatRatePercent); setTerms(editQuote.terms); }
  }, [activeModal, initialCustomerId, editQuote]);

  if (!activeModal) return null;

  if (activeModal === 'customer') return <CustomerFormDrawer customer={null} onClose={onClose} />;

  const addLine = (kind: 'labour' | 'travel' | 'part') => setLineItems([...lineItems, newLine(kind, { hourly: settings.defaultHourlyRate, travel: settings.defaultTravelCharge })]);

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
  const vatAmount = reverseCharge && selectedCustomer?.type === 'commercial' && activeModal === 'invoice' ? 0 : subtotal * (vatRate / 100);
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
      checklist: toChecklistItems(templates.filter((t) => t.jobType === jobType && !t.inactive)),
    });
    if (!created) return;

    onClose();
    onNavigateTab('dispatch');
  };

  // Submit Quote
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedLocation) return;

    if (editQuote) {
      if (await updateQuotation(editQuote.id, { customerId: selectedCustomer.id, locationId: selectedLocation.id, items: lineItems, vatRatePercent: vatRate, terms })) onClose();
      return;
    }

    const issueDate = getTodayISO();
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

    const created = await addQuotation({
      customerId: selectedCustomer.id,
      locationId: selectedLocation.id,
      issueDate,
      expiryDate,
      status: quoteStatus.current,
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
      reverseCharge: reverseCharge && selectedCustomer.type === 'commercial',
      cisRatePercent: selectedCustomer.type === 'commercial' ? cisRate : 0,
      retentionPercent: retentionPct,
    });
    if (!created) return;

    onClose();
    onNavigateTab('invoices');
  };

  return (
    <DetailDrawer footer={<>
<Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
{activeModal === 'request' && (<Button type="submit" form="qc-form" size="sm" disabled={busy}>
                  Log Service Request
                </Button>)}
{activeModal === 'job' && (<Button type="submit" form="qc-form" size="sm" disabled={busy}>
                  Schedule Job
                </Button>)}
{activeModal === 'quote' && !editQuote && (<Button type="submit" form="qc-form" variant="outline" size="sm" onClick={() => { quoteStatus.current = 'draft'; }} disabled={busy || lineItems.length === 0 || lineItems.some((li) => !li.description.trim() || !li.unitPrice)}>
                  Save as Draft
                </Button>)}
{(activeModal === 'quote' || activeModal === 'invoice') && (<Button type="submit" form="qc-form" size="sm" onClick={() => { quoteStatus.current = 'sent'; }} disabled={busy || lineItems.length === 0 || lineItems.some((li) => !li.description.trim() || !li.unitPrice)}>
                  {activeModal === 'quote' ? (editQuote ? 'Save Changes' : 'Generate & Send Quotation') : 'Issue Invoice'}
                </Button>)}
</>} onClose={onClose} dirty={!busy && !!(pickedCustomerId || reqProblem || jobTitle || lineItems.length)} title={editQuote ? `Edit ${editQuote.quoteNumber}` : `Create New ${activeModal.replace('_', ' ')}`} description="Fill in the details and submit to create it">
        {/* Modal Content */}
        <div className="space-y-4 text-xs">
          
          {/* Customer selector (common) */}
          <div>
            <Label htmlFor="qc-cust" className="text-xs mb-1">Customer *</Label>
            <Combobox id="qc-cust" value={selectedCustomerId} onChange={(v) => { setSelectedCustomerId(v); setPickedLocationId(''); setReqEquipmentId(''); }}
              options={customers.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name, hint: c.type }))} placeholder="Select a customer…" searchPlaceholder="Search customers…" />
            {selectedCustomer && selectedCustomer.serviceLocations.length > 1 && (
              <div className="mt-2">
                <Label htmlFor="qc-site" className="text-xs mb-1">Service Location *</Label>
                <Select required value={selectedLocation?.id ?? ''} onValueChange={(v) => { setPickedLocationId(v); setReqEquipmentId(''); }}>
<SelectTrigger id="qc-site" size="sm" className="w-full text-xs"><SelectValue placeholder="Select a site…" /></SelectTrigger>
<SelectContent>
                  
                  {selectedCustomer.serviceLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.label} - {l.addressLine1}</SelectItem>)}
                </SelectContent>
</Select>
              </div>
            )}
            {selectedCustomer && !selectedLocation && (
              <p className="mt-1 text-destructive">This customer has no service location. Add a site in Customers first.</p>
            )}
          </div>

          {/* SERVICE REQUEST FORM */}
          {activeModal === 'request' && (
            <form id="qc-form" onSubmit={guard(handleSubmitRequest)} className="space-y-3">
              <div>
                <Label htmlFor="qc-problem" className="text-xs mb-1">Reported Problem / Fault *</Label>
                <Textarea
                  rows={3}
                  required
                  id="qc-problem" name="problem" value={reqProblem}
                  onChange={(e) => setReqProblem(e.target.value)}
                  placeholder="e.g. No heating or hot water, boiler displaying F75 pressure fault…"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qc-pri" className="text-xs mb-1">Priority</Label>
                  <Select value={reqPriority} onValueChange={(v) => setReqPriority(v as any)}>
<SelectTrigger id="qc-pri" size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency Callout</SelectItem>
                  </SelectContent>
</Select>
                </div>

                <div>
                  <Label htmlFor="qc-slot" className="text-xs mb-1">Preferred Time Slot</Label>
                  <Select value={reqSlot} onValueChange={(v) => setReqSlot(v as any)}>
<SelectTrigger id="qc-slot" size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                    <SelectItem value="morning">Morning (08:00 - 12:00)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12:00 - 17:00)</SelectItem>
                    <SelectItem value="all_day">All Day</SelectItem>
                    <SelectItem value="urgent">Urgent / Immediate</SelectItem>
                  </SelectContent>
</Select>
                </div>
              </div>

              <div>
                <Label htmlFor="qc-eq" className="text-xs mb-1">Customer Equipment</Label>
                <Select value={reqEquipmentId || 'none'} onValueChange={(raw) => { const v = raw === 'none' ? '' : raw; setReqEquipmentId(v); }}>
<SelectTrigger id="qc-eq" size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                  <SelectItem value="none">-- General / Not Specified --</SelectItem>
                  {equipment
                    .filter((e) => e.customerId === selectedCustomerId && (!selectedLocation || e.locationId === selectedLocation.id))
                    .map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.brand} {eq.model} (S/N: {eq.serialNumber})
                      </SelectItem>
                    ))}
                </SelectContent>
</Select>
              </div>

            </form>
          )}

          {/* BOOK JOB FORM */}
          {activeModal === 'job' && (
            <form id="qc-form" onSubmit={guard(handleSubmitJob)} className="space-y-3">
              <div>
                <Label htmlFor="qc-jtitle" className="text-xs mb-1">Job Title</Label>
                <Input
                  required maxLength={200} autoComplete="off"
                  id="qc-jtitle" name="title" value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Annual boiler service"
                  className="text-xs"
                />
              </div>

              {conflictWarning && (
                <Alert className="border-rose-300 bg-rose-50 text-rose-900"><IconAlertTriangle className="text-rose-600" aria-hidden="true" /><AlertDescription className="text-xs font-semibold text-rose-900">{conflictWarning}</AlertDescription></Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qc-jtype" className="text-xs mb-1">Job Type</Label>
                  <Select value={jobType} onValueChange={(v) => setJobType(v as any)}>
<SelectTrigger id="qc-jtype" size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="preventive_maintenance">Preventive Maintenance</SelectItem>
                    <SelectItem value="inspection">Inspection / CP12 Gas Check</SelectItem>
                    <SelectItem value="emergency_callout">Emergency Callout</SelectItem>
                  </SelectContent>
</Select>
                </div>

                <div>
                  <Label htmlFor="qc-jtech" className="text-xs mb-1">Assign Engineer</Label>
                  <Select value={jobTechId || 'none'} onValueChange={(raw) => { const v = raw === 'none' ? '' : raw; 
                      setJobTechId(v);
                      setConflictWarning(null);
                     }}>
<SelectTrigger id="qc-jtech" size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                    <SelectItem value="none">-- Unassigned --</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id} style={{ color: t.color }}>● {t.name}{t.skills[0] ? ` (${t.skills[0]})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
</Select>
                </div>
              </div>

              <div>
                <Label htmlFor="qc-jdate" className="text-xs mb-1">Appointment Date</Label>
                <DatePicker id="qc-jdate" min={getTodayISO()} value={jobDate} onChange={(v) => { setJobDate(v); setConflictWarning(null); }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qc-jstart" className="text-xs mb-1">Start Time</Label>
                  <Input
                    type="time"
                    required
                    id="qc-jstart" value={jobStartTime}
                    onChange={(e) => setJobStartTime(e.target.value)}
                    className="tabular-nums text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="qc-jend" className="text-xs mb-1">End Time</Label>
                  <Input
                    type="time"
                    required
                    id="qc-jend" value={jobEndTime}
                    onChange={(e) => setJobEndTime(e.target.value)}
                    className="tabular-nums text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="qc-jdesc" className="text-xs mb-1">Instructions / Description</Label>
                <Textarea
                  rows={2}
                  required
                  id="qc-jdesc" name="description" value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="e.g. Annual Gas Safety check on Worcester Bosch combi boiler."
                  className="text-xs"
                />
              </div>

            </form>
          )}

          {/* QUOTE OR INVOICE FORM */}
          {(activeModal === 'quote' || activeModal === 'invoice') && (
            <form id="qc-form" onSubmit={guard(activeModal === 'quote' ? handleSubmitQuote : handleSubmitInvoice)} className="space-y-4">
              
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Line Items & Materials</span>
                <div className="flex items-center gap-3">
                  {([['labour', 'Labour'], ['travel', 'Travel'], ['part', 'Part / other']] as const).map(([kind, label]) => (
                    <Button key={kind} type="button" variant="ghost" size="xs" onClick={() => addLine(kind)} className="text-primary"><IconPlus aria-hidden="true" /><span>{label}</span></Button>
                  ))}
                </div>
              </div>
              {lineItems.length === 0 && <p className="p-3 text-center text-muted-foreground bg-muted/50 border border-dashed border-input rounded-lg">No lines yet. Add labour, travel or a part above.</p>}

              <div className="space-y-2">
                {lineItems.map((li) => (
                  <div key={li.id} className="p-2.5 bg-muted/50 border border-border rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <LineItemPicker onPick={(p) => handleUpdateLine(li.id, p)} />
                      <Input
                        type="text"
                        aria-label="Line description" name="description" autoComplete="off" required value={li.description}
                        onChange={(e) => handleUpdateLine(li.id, { description: e.target.value })}
                        className="flex-1 h-8 text-xs"
                        placeholder="Description"
                      />
                      {activeModal === 'quote' && (
                        <Select value={li.option || 'all'} onValueChange={(raw) => { const v = raw === 'all' ? '' : raw; handleUpdateLine(li.id, { option: v || undefined }); }}>
<SelectTrigger aria-label="Quote option" size="sm" className="w-24 text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                          <SelectItem value="all">All tiers</SelectItem>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Better">Better</SelectItem>
                          <SelectItem value="Best">Best</SelectItem>
                        </SelectContent>
</Select>
                      )}
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove line: ${li.description}`} onClick={() => handleRemoveLine(li.id)} className="text-destructive hover:text-destructive"><IconTrash aria-hidden="true" /></Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor={`qty-${li.id}`} className="text-[10px] text-muted-foreground mb-0">Qty</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          id={`qty-${li.id}`} inputMode="decimal" value={li.quantity}
                          onChange={(e) => handleUpdateLine(li.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="h-8 tabular-nums text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`price-${li.id}`} className="text-[10px] text-muted-foreground mb-0">Unit Price (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          id={`price-${li.id}`} inputMode="decimal" value={li.unitPrice}
                          onChange={(e) => handleUpdateLine(li.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="h-8 tabular-nums text-xs"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Line Total</span>
                        <span className="tabular-nums font-semibold text-foreground block mt-1">
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
                    <div key={t.name} className="flex justify-between"><span>{t.name}</span><span className="tabular-nums font-semibold">{formatGBP(t.total)}</span></div>
                  ))}
                </div>
              )}
              {/* VAT & Totals */}
              <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Applicable UK VAT:</span>
                  <Select value={String(vatRate)} onValueChange={(v) => setVatRate(Number(v))}>
<SelectTrigger aria-label="VAT rate" size="sm" className="tabular-nums text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                    <SelectItem value="20">20% (Standard)</SelectItem>
                    <SelectItem value="5">5% (Reduced)</SelectItem>
                    <SelectItem value="0">0% (Zero)</SelectItem>
                  </SelectContent>
</Select>
                </div>

                {activeModal === 'invoice' && (
                  <>
                    {selectedCustomer && selectedCustomer.type !== 'commercial' && (
                      <p className="text-muted-foreground">Reverse charge and CIS are only for commercial customers (VAT-registered contractors), so they are switched off for {selectedCustomer.name}.</p>
                    )}
                    <Label className="flex justify-between items-center text-xs font-normal text-muted-foreground">
                      <span>Domestic reverse charge (no VAT charged):</span>
                      <Checkbox disabled={selectedCustomer?.type !== 'commercial'} checked={reverseCharge && selectedCustomer?.type === 'commercial'} onCheckedChange={(v) => setReverseCharge(v === true)} />
                    </Label>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">CIS deduction (labour only):</span>
                      <Select disabled={selectedCustomer?.type !== 'commercial'} value={String(selectedCustomer?.type === 'commercial' ? cisRate : 0)} onValueChange={(v) => setCisRate(Number(v))}>
<SelectTrigger aria-label="CIS deduction" size="sm" className="tabular-nums text-xs"><SelectValue /></SelectTrigger>
<SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="30">30%</SelectItem>
                      </SelectContent>
</Select>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Retention held (%):</span>
                      <Input aria-label="Retention percent" type="number" min={0} max={100} step={0.5} value={retentionPct} onChange={(e) => setRetentionPct(Number(e.target.value))} className="w-20 h-8 tabular-nums text-xs text-right" />
                    </div>
                  </>
                )}

                <div className="flex justify-between font-bold text-sm text-foreground pt-2 border-t border-border">
                  <span>Grand Total:</span>
                  <span className="tabular-nums text-sky-900">{formatGBP(total)}</span>
                </div>
              </div>

              {lineItems.length > 0 && lineItems.some((li) => !li.description.trim() || !li.unitPrice) && (
                <p role="status" className="text-amber-700">Every line needs a description and a price before you can {activeModal === 'quote' ? 'generate the quotation' : 'issue the invoice'}.</p>
              )}

            </form>
          )}

        </div>
    </DetailDrawer>
  );
};

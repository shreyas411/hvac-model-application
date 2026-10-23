import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Equipment, EquipmentType, CustomFieldValues } from '../../types';
import { CustomFieldBox, CustomFieldInputs } from '../common/CustomFields';
import { useCustomFields } from '../../data/customFields';
import { formatDateUK, getTodayISO } from '../../utils/formatters';
import { downloadCsv } from '../../utils/csv';
import { BulkBar, SelectAllHead, SelectCell, useRowSelection } from '../common/BulkSelect';
import { IconAirConditioning, IconCalendarPlus, IconCancel, IconCheck, IconDownload, IconHistory, IconPencil, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { Combobox } from '../common/Combobox';
import { DatePicker } from '../common/DatePicker';
import { DetailDrawer } from '../common/DetailDrawer';
import { SortHead, useServerPaged } from '../common/Pager';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/src/components/ui/sheet';
import { leakCheckMonths, refrigerantTonnes } from '../../utils/fgas';

interface EquipmentViewProps {
  onOpenQuickAction: (action: 'job') => void;
  onNavigateTab: (tab: string) => void;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { equipment, customers, addEquipment, updateEquipment, bulkSetEquipmentInactive, addJob, settings, customerById, confirmToast, showToast } = useApp(['equipment', 'customers', 'addEquipment', 'updateEquipment', 'bulkSetEquipmentInactive', 'addJob', 'settings', 'customerById', 'confirmToast', 'showToast']);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedEqId, setSelectedEqId] = useState<string | null>(null);
  const selectedEquipment = equipment.find((e) => e.id === selectedEqId);

  // New Equipment Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // set = the drawer edits this asset instead of registering one
  const [formCustomerId, setFormCustomerId] = useState(customers[0]?.id || '');
  const [formLocationId, setFormLocationId] = useState(customers[0]?.serviceLocations[0]?.id || '');
  const [formType, setFormType] = useState<EquipmentType>('combi_boiler');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formRefType, setFormRefType] = useState('');
  const [formRefKg, setFormRefKg] = useState('');
  const [formInstallDate, setFormInstallDate] = useState('');
  const [formWarrantyDate, setFormWarrantyDate] = useState('');
  const [formFrequency, setFormFrequency] = useState<'annual' | 'biannual' | 'quarterly'>('annual');
  const [formNextDue, setFormNextDue] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCustom, setFormCustom] = useState<CustomFieldValues>({});
  const { active: customDefs } = useCustomFields('equipment');
  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicate jobs/assets)

  // Search (brand, model, serial, customer) and type run on the server so paging covers the whole register
  const paged = useServerPaged<Equipment>('/equipment', { q: searchTerm.trim() || undefined, type: typeFilter === 'all' ? undefined : typeFilter }, equipment);

  const sel = useRowSelection(paged.rows);
  const bulkInactive = async (inactive: boolean) => {
    const rows = sel.selected;
    const failed = await bulkSetEquipmentInactive(rows.map((e) => e.id), inactive);
    sel.clear();
    const bad = rows.filter((e) => failed[e.id]);
    if (bad.length) showToast(`${rows.length - bad.length} of ${rows.length} done. Skipped: ${bad.map((e) => `${e.brand} ${e.model}: ${failed[e.id]}`).join('; ')}`, 'error');
  };
  const exportSelected = () => downloadCsv(`equipment-${getTodayISO()}.csv`, [
    ['Brand', 'Model', 'Type', 'Serial', 'Customer', 'Postcode', 'Refrigerant', 'Charge (kg)', 'Installed', 'Warranty expiry', 'Frequency', 'Next service', 'Inactive'],
    ...sel.selected.map((e) => {
      const c = customerById.get(e.customerId);
      return [e.brand, e.model, e.type, e.serialNumber, c?.name, c?.serviceLocations.find((l) => l.id === e.locationId)?.postcode, e.refrigerantType, e.refrigerantChargeKg, e.installationDate, e.warrantyExpiryDate, e.maintenanceFrequency, e.nextServiceDueDate, e.inactive ? 'Yes' : 'No'];
    }),
  ]);

  const handleBookServiceForEquipment = async (eq: Equipment) => {
    if (busy) return;
    setBusy(true);
    const cust = customerById.get(eq.customerId);
    const created = await addJob({
      customerId: eq.customerId,
      locationId: eq.locationId,
      equipmentIds: [eq.id],
      title: `Service: ${eq.brand} ${eq.model}`.slice(0, 200),
      type: 'preventive_maintenance',
      priority: 'medium',
      status: 'new',
      technicianId: null,
      appointmentDate: eq.nextServiceDueDate,
      startTime: '09:00',
      endTime: '11:30',
      estimatedDurationMinutes: 150,
      requiredSkills: [eq.type.includes('boiler') ? 'Domestic Gas' : 'F-Gas Heat Pumps'],
      description: `Scheduled ${eq.maintenanceFrequency} maintenance for ${eq.brand} ${eq.model} (S/N: ${eq.serialNumber})`,
      partsUsed: [],
      labourHours: 2.5,
      hourlyRate: settings.defaultHourlyRate,
      travelTimeMinutes: 30,
      travelCharge: settings.defaultTravelCharge,
      checklist: [
        { id: `c-1`, category: 'general', label: 'Clean filters and heat exchanger surfaces', checked: false },
        { id: `c-2`, category: 'general', label: 'Inspect safety relief valve and pressure', checked: false },
        { id: `c-3`, category: 'general', label: 'Check electrical controls and thermistors', checked: false },
      ],
    });
    setBusy(false);
    if (created) onNavigateTab('dispatch');
  };

  const closeForm = () => { setShowAddModal(false); setEditId(null); };
  const openEdit = (eq: Equipment) => {
    setEditId(eq.id); setFormCustomerId(eq.customerId); setFormLocationId(eq.locationId); setFormType(eq.type); setFormBrand(eq.brand); setFormModel(eq.model); setFormSerial(eq.serialNumber);
    setFormRefType(eq.refrigerantType ?? ''); setFormRefKg(eq.refrigerantChargeKg ? String(eq.refrigerantChargeKg) : ''); setFormInstallDate(eq.installationDate); setFormWarrantyDate(eq.warrantyExpiryDate);
    setFormFrequency(eq.maintenanceFrequency); setFormNextDue(eq.nextServiceDueDate); setFormNotes(eq.locationNotes ?? ''); setFormCustom(eq.customFields ?? {});
    setShowAddModal(true);
  };

  const handleSaveNewEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInstallDate || !formWarrantyDate || !formNextDue) return showToast('Pick the installed, warranty and next service dates.', 'error');
    setBusy(true);
    if (editId) {
      const fridge = ['heat_pump', 'air_conditioning', 'chiller'].includes(formType);
      const ok = await updateEquipment(editId, {
        customerId: formCustomerId, locationId: formLocationId, type: formType, brand: formBrand, model: formModel, serialNumber: formSerial,
        refrigerantType: fridge && formRefType.trim() ? formRefType.trim() : null, refrigerantChargeKg: fridge && formRefKg ? Number(formRefKg) : null,
        installationDate: formInstallDate, warrantyExpiryDate: formWarrantyDate, maintenanceFrequency: formFrequency, nextServiceDueDate: formNextDue,
        locationNotes: formNotes, customFields: formCustom,
      });
      setBusy(false);
      if (ok) closeForm();
      return;
    }
    const newEq = await addEquipment({
      customerId: formCustomerId,
      locationId: formLocationId,
      type: formType,
      brand: formBrand,
      model: formModel,
      serialNumber: formSerial,
      ...(['heat_pump', 'air_conditioning', 'chiller'].includes(formType) && formRefType.trim() && { refrigerantType: formRefType.trim() }),
      ...(['heat_pump', 'air_conditioning', 'chiller'].includes(formType) && formRefKg && { refrigerantChargeKg: Number(formRefKg) }),
      installationDate: formInstallDate,
      warrantyExpiryDate: formWarrantyDate,
      maintenanceFrequency: formFrequency,
      nextServiceDueDate: formNextDue,
      status: 'operational',
      locationNotes: formNotes,
      customFields: formCustom,
    });
    setBusy(false);
    if (!newEq) return;
    setFormModel(''); setFormSerial(''); setFormNotes(''); setFormRefType(''); setFormRefKg(''); setFormCustom({});
    closeForm();
    setSelectedEqId(newEq.id);
  };

  const customerForAdd = customerById.get(formCustomerId);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">HVAC Equipment & Asset Register</h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${paged.total} ${paged.total === 1 ? 'asset' : 'assets'}`}>{paged.total}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track boilers, heat pumps, air con units, F-Gas logbooks, and maintenance warranty dates
          </p>
        </div>

        <Button size="sm" onClick={() => { setFormBrand(''); setFormModel(''); setFormSerial(''); setFormNotes(''); setFormRefType(''); setFormRefKg(''); setFormCustom({}); setShowAddModal(true); }} className="shrink-0">
          <IconPlus aria-hidden="true" />
          <span>Register Asset</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="search" aria-label="Search equipment" name="search" autoComplete="off" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search brand, model, serial, customer…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" aria-label="Equipment type" className="w-48 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {['combi_boiler', 'system_boiler', 'heat_pump', 'air_conditioning', 'ventilation', 'chiller'].map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || typeFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setTypeFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      <BulkBar count={sel.selected.length} onClear={sel.clear}>
        <Button type="button" size="xs" onClick={() => void bulkInactive(false)}><IconCheck aria-hidden="true" />Activate</Button>
        <Button type="button" size="xs" onClick={() => confirmToast(`Deactivate ${sel.selected.length} asset${sel.selected.length === 1 ? '' : 's'}? They stay on record but drop out of scheduling.`, () => void bulkInactive(true), { confirmLabel: 'Deactivate' })}><IconCancel aria-hidden="true" />Deactivate</Button>
        <Button type="button" size="xs" variant="secondary" onClick={exportSelected}><IconDownload aria-hidden="true" />Export CSV</Button>
      </BulkBar>

      <div style={{ '--table-offset': '19.5rem' } as React.CSSProperties}>
        <TableCard footer={paged.pager}>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <SelectAllHead sel={sel} label="assets" />
                <SortHead paged={paged} by="brand" className="px-3">Asset</SortHead>
                <SortHead paged={paged} by="type" className="hidden md:table-cell px-3">Type</SortHead>
                <SortHead paged={paged} by="customer.name" className="px-3">Customer / Site</SortHead>
                <SortHead paged={paged} by="serialNumber" className="hidden lg:table-cell px-3">Serial</SortHead>
                <SortHead paged={paged} by="warrantyExpiryDate" className="hidden lg:table-cell px-3">Warranty</SortHead>
                <SortHead paged={paged} by="nextServiceDueDate" className="px-3">Next service</SortHead>
                <TableHead className="px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.rows.map((eq) => {
                const cust = customerById.get(eq.customerId);
                const loc = cust?.serviceLocations.find((l) => l.id === eq.locationId);
                const isOverdue = eq.nextServiceDueDate <= getTodayISO();
                return (
                  <TableRow key={eq.id} data-state={sel.has(eq.id) ? 'selected' : undefined} className={eq.inactive ? 'opacity-60' : undefined}>
                    <SelectCell sel={sel} row={eq} label={`${eq.brand} ${eq.model}`} />
                    <TableCell className="px-3 py-3">
                      <button onClick={() => setSelectedEqId(eq.id)} className="text-left group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="font-bold group-hover:text-primary block">{eq.brand} {eq.model}</span>
                      </button>
                      {eq.inactive && <Badge variant="secondary" className="mt-0.5 text-[10px] uppercase">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-3 py-3 capitalize">{eq.type.replace('_', ' ')}</TableCell>
                    <TableCell className="px-3 py-3 max-w-[220px]">
                      <span className="block font-semibold truncate">{cust?.name}</span>
                      {loc && <span className="block text-[11px] text-muted-foreground truncate">{loc.city}, {loc.postcode}</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-3 py-3 tabular-nums text-muted-foreground">{eq.serialNumber}</TableCell>
                    <TableCell className="hidden lg:table-cell px-3 py-3 tabular-nums text-muted-foreground">{formatDateUK(eq.warrantyExpiryDate)}{eq.expired && <span className="ml-1 text-amber-700 font-semibold">(expired)</span>}</TableCell>
                    <TableCell className="px-3 py-3">
                      <span className="tabular-nums font-semibold block">{formatDateUK(eq.nextServiceDueDate)}</span>
                      <Badge className={`text-[10px] font-bold border-transparent ${isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{isOverdue ? 'Service due' : 'Operational'}</Badge>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <RowActions subject={`${eq.brand} ${eq.model}`} actions={[
                        { icon: IconHistory, label: 'History', onClick: () => setSelectedEqId(eq.id) },
                        { icon: IconPencil, label: 'Edit', onClick: () => openEdit(eq) },
                        { icon: IconCalendarPlus, label: 'Book service', tone: 'info', hidden: busy, onClick: () => void handleBookServiceForEquipment(eq) },
                        { icon: eq.inactive ? IconCheck : IconCancel, label: eq.inactive ? 'Activate' : 'Deactivate', destructive: !eq.inactive,
                          onClick: () => eq.inactive ? void updateEquipment(eq.id, { inactive: false }) : confirmToast(`Deactivate ${eq.brand} ${eq.model}? It stays on record but drops out of scheduling.`, () => void updateEquipment(eq.id, { inactive: true }), { confirmLabel: 'Deactivate' }) },
                      ]} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.rows.length === 0 && !paged.loading && (
                <TableRow><TableCell colSpan={8} className="py-6"><EmptyState icon={IconAirConditioning}>No equipment found.</EmptyState></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      {/* Equipment Detailed History Drawer */}
      <Sheet open={!!selectedEquipment} onOpenChange={(o) => { if (!o) setSelectedEqId(null); }}>
        {selectedEquipment && (
          <SheetContent side="right" className="w-full sm:max-w-xl gap-0">
            <SheetHeader className="bg-muted/50 border-b border-border pr-12">
              <SheetTitle className="text-base">{selectedEquipment.brand} {selectedEquipment.model}</SheetTitle>
              <SheetDescription className="text-xs tabular-nums">S/N: {selectedEquipment.serialNumber}</SheetDescription>
              {selectedEquipment.refrigerantType && selectedEquipment.refrigerantChargeKg ? (
                <p className="text-xs text-muted-foreground">
                  {selectedEquipment.refrigerantType} · {selectedEquipment.refrigerantChargeKg} kg
                  {refrigerantTonnes(selectedEquipment.refrigerantType, selectedEquipment.refrigerantChargeKg) !== null && ` (${refrigerantTonnes(selectedEquipment.refrigerantType, selectedEquipment.refrigerantChargeKg)!.toFixed(1)} tCO₂e)`}
                  {leakCheckMonths(selectedEquipment.refrigerantType, selectedEquipment.refrigerantChargeKg) && <strong className="text-amber-700"> · F-Gas leak check every {leakCheckMonths(selectedEquipment.refrigerantType, selectedEquipment.refrigerantChargeKg)} months</strong>}
                </p>
              ) : null}
            </SheetHeader>

            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="bg-muted/50 p-3.5 rounded-lg border border-border space-y-1.5">
                <span className="font-bold block">Equipment Specifications</span>
                <p><strong>Frequency:</strong> Every {selectedEquipment.maintenanceFrequency}</p>
                <p><strong>Installed:</strong> {formatDateUK(selectedEquipment.installationDate)}</p>
                <p><strong>Warranty Expiry:</strong> {formatDateUK(selectedEquipment.warrantyExpiryDate)}</p>
                <p><strong>Plant Location:</strong> {selectedEquipment.locationNotes || 'Not recorded'}</p>
              </div>

              <CustomFieldBox defs={customDefs} values={selectedEquipment.customFields} />

              <div>
                <h4 className="font-bold text-sm mb-2">Service Visit Findings & Readings</h4>
                <div className="space-y-3">
                  {selectedEquipment.serviceHistory.map((rec) => (
                    <div key={rec.id} className="p-3 bg-card border border-border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{rec.serviceType}</span>
                        <span className="tabular-nums text-muted-foreground text-[11px]">{formatDateUK(rec.date)}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">Engineer: <strong>{rec.technicianName}</strong></p>
                      <p className="bg-muted/50 p-2 rounded">{rec.findings}</p>

                      {rec.readings && (
                        <div className="grid grid-cols-3 gap-2 bg-muted p-2 rounded text-[11px] tabular-nums">
                          {rec.readings.pressureBar !== undefined && <div>Pressure: <strong>{rec.readings.pressureBar} bar</strong></div>}
                          {rec.readings.flowTempC !== undefined && <div>Flow: <strong>{rec.readings.flowTempC}°C</strong></div>}
                          {rec.readings.refrigerantPsi !== undefined && <div>Refrigerant: <strong>{rec.readings.refrigerantPsi} psi</strong></div>}
                          {rec.readings.coPpm !== undefined && <div>CO: <strong>{rec.readings.coPpm} ppm</strong></div>}
                        </div>
                      )}

                      {rec.recommendations && (
                        <p className="text-[11px] text-amber-800">
                          <strong>Engineer Note:</strong> {rec.recommendations}
                        </p>
                      )}
                    </div>
                  ))}

                  {selectedEquipment.serviceHistory.length === 0 && (
                    <EmptyState icon={IconHistory} compact>No historical visits logged yet.</EmptyState>
                  )}
                </div>
              </div>
            </div>

            <SheetFooter className="bg-muted/50 border-t border-border flex-row items-center justify-between">
              <Button size="sm" disabled={busy} onClick={() => { handleBookServiceForEquipment(selectedEquipment); setSelectedEqId(null); }}>
                Schedule Next Maintenance
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEqId(null)}>Close</Button>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      {/* Register asset drawer */}
      {showAddModal && (
        <DetailDrawer onClose={closeForm} dirty={!busy && !!(formBrand || formModel || formSerial)} title={editId ? `Edit ${formBrand} ${formModel}` : 'Register HVAC Asset'} description={editId ? 'Update the equipment details' : 'Enter the details of the new equipment asset'}
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="equipment-form" size="sm" disabled={busy}>{busy ? 'Saving…' : editId ? 'Update Asset' : 'Save Asset'}</Button>
          </>}>
          <form id="equipment-form" onSubmit={handleSaveNewEquipment} className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="e-cust" className="text-xs">Customer Client *</Label>
              <Combobox id="e-cust" value={formCustomerId} searchPlaceholder="Search customers…" options={customers.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name, hint: c.type }))}
                onChange={(v) => { setFormCustomerId(v); const c = customers.find((cust) => cust.id === v); if (c?.serviceLocations[0]) setFormLocationId(c.serviceLocations[0].id); }} />
            </div>

            {customerForAdd && (
              <div className="space-y-1.5">
                <Label htmlFor="e-loc" className="text-xs">Service Location *</Label>
                <Select value={formLocationId} onValueChange={setFormLocationId}>
                  <SelectTrigger id="e-loc" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{customerForAdd.serviceLocations.map((loc) => <SelectItem key={loc.id} value={loc.id}>{loc.label} - {loc.addressLine1}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-type" className="text-xs">Equipment Type *</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as EquipmentType)}>
                  <SelectTrigger id="e-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combi_boiler">Combi Boiler</SelectItem>
                    <SelectItem value="system_boiler">System Boiler</SelectItem>
                    <SelectItem value="heat_pump">Heat Pump</SelectItem>
                    <SelectItem value="air_conditioning">Air Conditioning</SelectItem>
                    <SelectItem value="ventilation">Ventilation</SelectItem>
                    <SelectItem value="chiller">Chiller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-brand" className="text-xs">Manufacturer Brand *</Label>
                <Input id="e-brand" required name="brand" autoComplete="off" value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="e.g. Worcester Bosch / Daikin / Vaillant" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-model" className="text-xs">Model Name / Number *</Label>
                <Input id="e-model" required name="model" autoComplete="off" value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="e.g. Greenstar 8000 Life 35kW" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-serial" className="text-xs">Serial Number *</Label>
                <Input id="e-serial" required name="serial" autoComplete="off" spellCheck={false} value={formSerial} onChange={(e) => setFormSerial(e.target.value)} placeholder="e.g. WB88910248" className="tabular-nums" />
              </div>
            </div>

            {['heat_pump', 'air_conditioning', 'chiller'].includes(formType) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-reftype" className="text-xs">Refrigerant</Label>
                  <Input id="e-reftype" name="refrigerantType" autoComplete="off" value={formRefType} onChange={(e) => setFormRefType(e.target.value)} placeholder="e.g. R32 / R410A" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-refkg" className="text-xs">Charge (kg)</Label>
                  <Input id="e-refkg" name="refrigerantChargeKg" type="number" min="0.01" step="0.01" value={formRefKg} onChange={(e) => setFormRefKg(e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-inst" className="text-xs">Installed</Label>
                <div><DatePicker id="e-inst" value={formInstallDate} onChange={setFormInstallDate} /></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-warr" className="text-xs">Warranty Till</Label>
                <div><DatePicker id="e-warr" value={formWarrantyDate} onChange={setFormWarrantyDate} /></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-next" className="text-xs">Next Service</Label>
                <div><DatePicker id="e-next" value={formNextDue} onChange={setFormNextDue} /></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-notes" className="text-xs">Plant Location Notes</Label>
              <Input id="e-notes" name="notes" autoComplete="off" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="e.g. Roof plant rack 2 / Basement cellar…" />
            </div>

            <CustomFieldInputs defs={customDefs} values={formCustom} onChange={setFormCustom} />
          </form>
        </DetailDrawer>
      )}

    </div>
  );
};

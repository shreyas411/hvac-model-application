import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Equipment, EquipmentType } from '../../types';
import { formatDateUK, getTodayISO } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconAirConditioning, IconHistory, IconPlus, IconSearch, IconX } from '@tabler/icons-react';

interface EquipmentViewProps {
  onOpenQuickAction: (action: 'job') => void;
  onNavigateTab: (tab: string) => void;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { equipment, customers, addEquipment, updateEquipment, addJob, settings, customerById } = useApp(['equipment', 'customers', 'addEquipment', 'updateEquipment', 'addJob', 'settings', 'customerById']);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedEqId, setSelectedEqId] = useState<string | null>(null);
  const selectedEquipment = equipment.find((e) => e.id === selectedEqId);

  // New Equipment Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState(customers[0]?.id || '');
  const [formLocationId, setFormLocationId] = useState(customers[0]?.serviceLocations[0]?.id || '');
  const [formType, setFormType] = useState<EquipmentType>('combi_boiler');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formInstallDate, setFormInstallDate] = useState('');
  const [formWarrantyDate, setFormWarrantyDate] = useState('');
  const [formFrequency, setFormFrequency] = useState<'annual' | 'biannual' | 'quarterly'>('annual');
  const [formNextDue, setFormNextDue] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicate jobs/assets)
  const closeAll = () => { setShowAddModal(false); setSelectedEqId(null); };
  useEscape(showAddModal || !!selectedEqId, closeAll);

  const filteredEquipment = equipment.filter((eq) => {
    if (typeFilter !== 'all' && eq.type !== typeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const cust = customerById.get(eq.customerId);
      return (
        eq.brand.toLowerCase().includes(q) ||
        eq.model.toLowerCase().includes(q) ||
        eq.serialNumber.toLowerCase().includes(q) ||
        cust?.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

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

  const handleSaveNewEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const newEq = await addEquipment({
      customerId: formCustomerId,
      locationId: formLocationId,
      type: formType,
      brand: formBrand,
      model: formModel,
      serialNumber: formSerial,
      installationDate: formInstallDate,
      warrantyExpiryDate: formWarrantyDate,
      maintenanceFrequency: formFrequency,
      nextServiceDueDate: formNextDue,
      status: 'operational',
      locationNotes: formNotes,
    });
    setBusy(false);
    if (!newEq) return;
    setFormModel(''); setFormSerial(''); setFormNotes('');
    setShowAddModal(false);
    setSelectedEqId(newEq.id);
  };

  const customerForAdd = customerById.get(formCustomerId);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            HVAC Equipment & Asset Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track boilers, heat pumps, air con units, F-Gas logbooks, and maintenance warranty dates
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>Register Asset</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search equipment"
            name="search"
            autoComplete="off"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by brand, model, serial, or customer…"
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['all', 'combi_boiler', 'system_boiler', 'heat_pump', 'air_conditioning', 'ventilation', 'chiller'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              aria-pressed={typeFilter === t}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap capitalize ${
                typeFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'all' ? 'All Types' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment Asset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEquipment.length === 0 && <div className="md:col-span-2 lg:col-span-3 bg-white border border-slate-200 rounded-xl py-6"><EmptyState icon={IconAirConditioning}>No equipment found.</EmptyState></div>}
        {filteredEquipment.map((eq) => {
          const cust = customerById.get(eq.customerId);
          const loc = cust?.serviceLocations.find((l) => l.id === eq.locationId);
          const isOverdue = eq.nextServiceDueDate <= getTodayISO();

          return (
            <div
              key={eq.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 flex flex-col justify-between space-y-3 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {eq.type.replace('_', ' ')}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 mt-1.5">
                      {eq.brand} {eq.model}
                    </h2>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isOverdue ? 'Service Due' : 'Operational'}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  <p>
                    <strong>Site:</strong> {cust?.name}{loc && ` (${loc.city})`}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    S/N: {eq.serialNumber}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Installed: {formatDateUK(eq.installationDate)} · Warranty: {formatDateUK(eq.warrantyExpiryDate)}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Next Service:</span>
                  <span className="font-mono font-bold text-slate-900">{formatDateUK(eq.nextServiceDueDate)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedEqId(eq.id)}
                    aria-label={`History for ${eq.brand} ${eq.model}`} className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    History
                  </button>
                  <button
                    onClick={() => handleBookServiceForEquipment(eq)}
                    disabled={busy} aria-label={`Book service for ${eq.brand} ${eq.model}`} className="px-2.5 py-1 text-white bg-sky-600 hover:bg-sky-700 rounded text-xs font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    title="Execute Workflow C: Book Preventive Maintenance"
                  >
                    Book Service
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Equipment Detailed History Drawer */}
      {selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-2xs" role="dialog" aria-modal="true" aria-label="Equipment history">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {selectedEquipment.brand} {selectedEquipment.model}
                </h3>
                <p className="text-xs font-mono text-slate-500">S/N: {selectedEquipment.serialNumber}</p>
              </div>
              <button
                onClick={() => setSelectedEqId(null)}
                aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700"
              >
                <IconX className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-900 block">Equipment Specifications</span>
                <p><strong>Frequency:</strong> Every {selectedEquipment.maintenanceFrequency}</p>
                <p><strong>Installed:</strong> {formatDateUK(selectedEquipment.installationDate)}</p>
                <p><strong>Warranty Expiry:</strong> {formatDateUK(selectedEquipment.warrantyExpiryDate)}</p>
                <p><strong>Plant Location:</strong> {selectedEquipment.locationNotes || 'Not recorded'}</p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 mb-2">Service Visit Findings & Readings</h4>
                <div className="space-y-3">
                  {selectedEquipment.serviceHistory.map((rec) => (
                    <div key={rec.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{rec.serviceType}</span>
                        <span className="font-mono text-slate-500 text-[11px]">{formatDateUK(rec.date)}</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">Engineer: <strong>{rec.technicianName}</strong></p>
                      <p className="text-slate-800 bg-slate-50 p-2 rounded">{rec.findings}</p>

                      {rec.readings && (
                        <div className="grid grid-cols-3 gap-2 bg-slate-100/70 p-2 rounded text-[11px] font-mono">
                          {rec.readings.pressureBar !== undefined && (
                            <div>Pressure: <strong>{rec.readings.pressureBar} bar</strong></div>
                          )}
                          {rec.readings.flowTempC !== undefined && (
                            <div>Flow: <strong>{rec.readings.flowTempC}°C</strong></div>
                          )}
                          {rec.readings.refrigerantPsi !== undefined && (
                            <div>Refrigerant: <strong>{rec.readings.refrigerantPsi} psi</strong></div>
                          )}
                          {rec.readings.coPpm !== undefined && (
                            <div>CO: <strong>{rec.readings.coPpm} ppm</strong></div>
                          )}
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  handleBookServiceForEquipment(selectedEquipment);
                  setSelectedEqId(null);
                }}
                disabled={busy}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs disabled:opacity-60"
              >
                Schedule Next Maintenance
              </button>
              <button
                onClick={() => setSelectedEqId(null)}
                className="px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Equipment Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Register HVAC asset">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Register HVAC Asset</h3>
              <button
                onClick={() => setShowAddModal(false)}
                aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewEquipment} className="p-5 space-y-3 overflow-y-auto text-xs">
              <div>
                <label htmlFor="e-cust" className="block font-semibold text-slate-700 mb-1">Customer Client *</label>
                <select
                  id="e-cust" value={formCustomerId}
                  onChange={(e) => {
                    setFormCustomerId(e.target.value);
                    const c = customers.find((cust) => cust.id === e.target.value);
                    if (c?.serviceLocations[0]) setFormLocationId(c.serviceLocations[0].id);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {customerForAdd && (
                <div>
                  <label htmlFor="e-loc" className="block font-semibold text-slate-700 mb-1">Service Location *</label>
                  <select
                    id="e-loc" value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                  >
                    {customerForAdd.serviceLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.label} - {loc.addressLine1}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="e-type" className="block font-semibold text-slate-700 mb-1">Equipment Type *</label>
                  <select
                    id="e-type" value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs capitalize"
                  >
                    <option value="combi_boiler">Combi Boiler</option>
                    <option value="system_boiler">System Boiler</option>
                    <option value="heat_pump">Heat Pump</option>
                    <option value="air_conditioning">Air Conditioning</option>
                    <option value="ventilation">Ventilation</option>
                    <option value="chiller">Chiller</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="e-brand" className="block font-semibold text-slate-700 mb-1">Manufacturer Brand *</label>
                  <input
                    type="text"
                    required
                    id="e-brand" name="brand" autoComplete="off" value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="e.g. Worcester Bosch / Daikin / Vaillant"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="e-model" className="block font-semibold text-slate-700 mb-1">Model Name / Number *</label>
                  <input
                    type="text"
                    required
                    id="e-model" name="model" autoComplete="off" value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="e.g. Greenstar 8000 Life 35kW"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="e-serial" className="block font-semibold text-slate-700 mb-1">Serial Number *</label>
                  <input
                    type="text"
                    required
                    id="e-serial" name="serial" autoComplete="off" spellCheck={false} value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    placeholder="e.g. WB88910248"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="e-inst" className="block font-semibold text-slate-700 mb-1">Installed</label>
                  <input
                    type="date"
                    id="e-inst" required max={getTodayISO()}
                    value={formInstallDate}
                    onChange={(e) => setFormInstallDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="e-warr" className="block font-semibold text-slate-700 mb-1">Warranty Till</label>
                  <input
                    type="date"
                    id="e-warr" required
                    value={formWarrantyDate}
                    onChange={(e) => setFormWarrantyDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="e-next" className="block font-semibold text-slate-700 mb-1">Next Service</label>
                  <input
                    type="date"
                    id="e-next" required
                    value={formNextDue}
                    onChange={(e) => setFormNextDue(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="e-notes" className="block font-semibold text-slate-700 mb-1">Plant Location Notes</label>
                <input
                  type="text"
                  id="e-notes" name="notes" autoComplete="off" value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Roof plant rack 2 / Basement cellar…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
                >
                  {busy ? 'Saving…' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

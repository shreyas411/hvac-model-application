import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getTodayISO } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { CompanySettings, TechnicianProfile } from '../../types';
import { IconBuilding, IconCreditCard, IconDownload, IconPencil, IconPlus, IconShieldCheck } from '@tabler/icons-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    technicians,
    addTechnician,
    updateTechnician,
    exportDataJson,
    showToast,
    realAuth
  } = useApp(['settings', 'updateSettings', 'technicians', 'addTechnician', 'updateTechnician', 'exportDataJson', 'showToast', 'realAuth']);

  const [form, setForm] = useState<CompanySettings>(settings);
  React.useEffect(() => setForm(settings), [settings]); // settings load async: never edit (or save) a stale copy
  const [busy, setBusy] = useState(false); // guards double-submit

  // New Tech modal
  const [showTechModal, setShowTechModal] = useState(false);
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techSkills, setTechSkills] = useState('');
  const [techGasLicense, setTechGasLicense] = useState('');
  const [techFGasLicense, setTechFGasLicense] = useState('');
  const [techVan, setTechVan] = useState('');

  // Edit Tech modal
  const [showEditTechModal, setShowEditTechModal] = useState(false);
  const [editingTech, setEditingTech] = useState<TechnicianProfile | null>(null);
  const [editTechName, setEditTechName] = useState('');
  const [editTechEmail, setEditTechEmail] = useState('');
  const [editTechPhone, setEditTechPhone] = useState('');
  const [editTechSkills, setEditTechSkills] = useState('');
  const [editTechGasLicense, setEditTechGasLicense] = useState('');
  const [editTechFGasLicense, setEditTechFGasLicense] = useState('');
  const [editTechGasExpiry, setEditTechGasExpiry] = useState('');
  const [editTechFGasExpiry, setEditTechFGasExpiry] = useState('');
  const [editTechVan, setEditTechVan] = useState('');

  // Import JSON input ref


  useEscape(showTechModal || showEditTechModal, () => { setShowTechModal(false); setShowEditTechModal(false); });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await updateSettings(form);
    setBusy(false);
  };

  const handleAddTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const created = await addTechnician({
      name: techName,
      email: techEmail,
      phone: techPhone,
      skills: techSkills.split(',').map((s) => s.trim()).filter(Boolean),
      gasSafeLicense: techGasLicense,
      fGasLicense: techFGasLicense,
      vanRegistration: techVan,
      color: '#0284c7',
      active: true,
    });
    setBusy(false);
    if (!created) return;
    setTechName(''); setTechEmail(''); setTechPhone(''); setTechSkills(''); setTechGasLicense(''); setTechFGasLicense(''); setTechVan('');
    setShowTechModal(false);
  };

  const handleEditTechOpen = (tech: TechnicianProfile) => {
    setEditingTech(tech);
    setEditTechName(tech.name);
    setEditTechEmail(tech.email);
    setEditTechPhone(tech.phone);
    setEditTechSkills(tech.skills.join(', '));
    setEditTechGasLicense(tech.gasSafeLicense || '');
    setEditTechFGasLicense(tech.fGasLicense || '');
    setEditTechGasExpiry(tech.gasSafeExpiry?.slice(0, 10) || '');
    setEditTechFGasExpiry(tech.fGasExpiry?.slice(0, 10) || '');
    setEditTechVan(tech.vanRegistration || '');
    setShowEditTechModal(true);
  };

  const handleEditTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;
    setBusy(true);
    const ok = await updateTechnician(editingTech.id, {
      name: editTechName,
      email: editTechEmail,
      phone: editTechPhone,
      skills: editTechSkills.split(',').map((s) => s.trim()).filter(Boolean),
      gasSafeLicense: editTechGasLicense,
      fGasLicense: editTechFGasLicense,
      gasSafeExpiry: editTechGasExpiry || undefined,
      fGasExpiry: editTechFGasExpiry || undefined,
      vanRegistration: editTechVan,
    });
    setBusy(false);
    if (ok) setShowEditTechModal(false);
  };

  const handleDownloadBackup = async () => {

    const jsonStr = await exportDataJson().catch((e) => { showToast(e.message, 'error'); return null; });
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ApexHVAC_Backup_${getTodayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Database backup downloaded');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Business Settings & Company Profile
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure UK tax rules, Gas Safe certifications, company bank details, technician roster, and system backups
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadBackup}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5"
          >
            <IconDownload className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Export Backup</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        
        {/* Company Details & UK Certifications */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <IconBuilding className="w-4 h-4 text-sky-700" aria-hidden="true" />
            <span>UK Company Details & Regulatory Registrations</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="st-1" className="block font-semibold text-slate-700 mb-1">Registered Company Name</label>
              <input id="st-1"
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div>
              <label htmlFor="st-2" className="block font-semibold text-slate-700 mb-1">Trading / Brand Name</label>
              <input id="st-2"
                type="text"
                value={form.tradingName}
                onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div>
              <label htmlFor="st-3" className="block font-semibold text-slate-700 mb-1">Gas Safe Register Number</label>
              <input id="st-3"
                type="text"
                spellCheck={false} value={form.gasSafeRegisterNo}
                onChange={(e) => setForm({ ...form, gasSafeRegisterNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-4" className="block font-semibold text-slate-700 mb-1">Refcom F-Gas Certificate Number</label>
              <input id="st-4"
                type="text"
                spellCheck={false} value={form.fGasCertNo}
                onChange={(e) => setForm({ ...form, fGasCertNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-5" className="block font-semibold text-slate-700 mb-1">UK VAT Registration Number</label>
              <input id="st-5"
                type="text"
                spellCheck={false} value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-6" className="block font-semibold text-slate-700 mb-1">Companies House Number</label>
              <input id="st-6"
                type="text"
                spellCheck={false} value={form.companyNumber}
                onChange={(e) => setForm({ ...form, companyNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-7" className="block font-semibold text-slate-700 mb-1">Headquarters Address</label>
              <input id="st-7"
                type="text"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="st-8" className="block font-semibold text-slate-700 mb-1">City / County</label>
                <input id="st-8"
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>
              <div>
                <label htmlFor="st-9" className="block font-semibold text-slate-700 mb-1">Postcode</label>
                <input id="st-9"
                  type="text"
                  autoComplete="postal-code" value={form.postcode}
                  onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* VAT Rates & Numbering Prefixes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <IconCreditCard className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            <span>Configurable UK VAT & Document Numbering</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="st-10" className="block font-semibold text-slate-700 mb-1">Default VAT Rate (%)</label>
              <select id="st-10"
                value={form.defaultVatRate}
                onChange={(e) => setForm({ ...form, defaultVatRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs font-mono"
              >
                <option value={20}>20% (Standard UK Rate)</option>
                <option value={5}>5% (Reduced - Energy Saving Materials)</option>
                <option value={0}>0% (Zero Rated)</option>
              </select>
            </div>

            <div>
              <label htmlFor="st-11" className="block font-semibold text-slate-700 mb-1">Default Hourly Rate</label>
              <input id="st-11"
                type="number" min={0} step="0.01"
                value={form.defaultHourlyRate}
                onChange={(e) => setForm({ ...form, defaultHourlyRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-12" className="block font-semibold text-slate-700 mb-1">Default Travel Charge</label>
              <input id="st-12"
                type="number" min={0} step="0.01"
                value={form.defaultTravelCharge}
                onChange={(e) => setForm({ ...form, defaultTravelCharge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-13" className="block font-semibold text-slate-700 mb-1">Job Number Prefix</label>
              <input id="st-13"
                type="text"
                value={form.prefixJob}
                onChange={(e) => setForm({ ...form, prefixJob: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-14" className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
              <input id="st-14"
                type="text"
                value={form.prefixInvoice}
                onChange={(e) => setForm({ ...form, prefixInvoice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={form.enableInventory}
                onChange={(e) => setForm({ ...form, enableInventory: e.target.checked })}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Enable Warehouse & Van Stock Inventory Tracking</span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={form.autoSendEmails}
                onChange={(e) => setForm({ ...form, autoSendEmails: e.target.checked })}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Send customer emails automatically</span>
            </label>
            <p className="text-xs text-slate-500 mt-1 ml-6">
              On: quote, invoice, booking and engineer-dispatched emails send as soon as they are triggered. Off: they wait as drafts for staff approval in Notifications.
            </p>
          </div>
        </div>

        {/* Bank Account Details for Invoices */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900">Company Bank Details (For BACS Invoices)</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="st-15" className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input id="st-15"
                type="text"
                value={form.bankDetails.bankName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, bankName: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div>
              <label htmlFor="st-16" className="block font-semibold text-slate-700 mb-1">Account Name</label>
              <input id="st-16"
                type="text"
                value={form.bankDetails.accountName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, accountName: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div>
              <label htmlFor="st-17" className="block font-semibold text-slate-700 mb-1">Sort Code</label>
              <input id="st-17"
                type="text"
                inputMode="numeric" autoComplete="off" spellCheck={false} value={form.bankDetails.sortCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, sortCode: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="st-18" className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input id="st-18"
                type="text"
                inputMode="numeric" autoComplete="off" spellCheck={false} value={form.bankDetails.accountNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, accountNumber: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={busy} className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save All Settings'}
          </button>
        </div>

      </form>

      {/* Field Technicians Roster Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Field Engineering Roster</h3>
            <p className="text-xs text-slate-500">Manage qualified technicians, Gas Safe cards, and vans</p>
          </div>
          <button
            onClick={() => setShowTechModal(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
          >
            <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Technician</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {technicians.map((t) => (
            <div key={t.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-bold text-slate-900">{t.name}</span>
                  </div>
                  <span className="font-mono text-slate-600 text-[11px]">{t.vanRegistration}</span>
                </div>
                <button
                  onClick={() => handleEditTechOpen(t)}
                  className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                  title="Edit Technician" aria-label={`Edit ${t.name}`}
                >
                  <IconPencil className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-1">
                <p className="text-slate-500 mt-1">{t.email} · {t.phone}</p>
                <p className="text-slate-700 font-medium mt-1">Skills: {t.skills.join(', ')}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
                Gas Safe: {t.gasSafeLicense || 'N/A'} · F-Gas: {t.fGasLicense || 'N/A'}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Add Technician Modal */}
      {showTechModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Add field technician">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Add Field Technician</h3>
            <form onSubmit={handleAddTechSubmit} className="space-y-3">
              <div>
                <label htmlFor="st-19" className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input id="st-19"
                  type="text"
                  required
                  name="name" autoComplete="off" value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="e.g. Samuel Green"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="st-20" className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input id="st-20"
                    type="email"
                    required
                    value={techEmail}
                    onChange={(e) => setTechEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="st-21" className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input id="st-21"
                    type="tel"
                    required
                    value={techPhone}
                    onChange={(e) => setTechPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="st-22" className="block font-semibold text-slate-700 mb-1">Skills (comma separated)</label>
                <input id="st-22"
                  type="text"
                  value={techSkills}
                  onChange={(e) => setTechSkills(e.target.value)}
                  placeholder="e.g. GAS_SAFE, F_GAS, AC_INSTALL"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="st-23" className="block font-semibold text-slate-700 mb-1">Gas Safe #</label>
                  <input id="st-23"
                    type="text"
                    value={techGasLicense}
                    onChange={(e) => setTechGasLicense(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="st-24" className="block font-semibold text-slate-700 mb-1">F-Gas #</label>
                  <input id="st-24"
                    type="text"
                    value={techFGasLicense}
                    onChange={(e) => setTechFGasLicense(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="st-25" className="block font-semibold text-slate-700 mb-1">Van Reg</label>
                  <input id="st-25"
                    type="text"
                    value={techVan}
                    onChange={(e) => setTechVan(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTechModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Adding…' : 'Add Technician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Technician Modal */}
      {showEditTechModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Edit field technician">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Edit Field Technician</h3>
            <form onSubmit={handleEditTechSubmit} className="space-y-3">
              <div>
                <label htmlFor="st-26" className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input id="st-26"
                  type="text"
                  required
                  name="name" autoComplete="off" value={editTechName}
                  onChange={(e) => setEditTechName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="st-27" className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input id="st-27"
                    type="email"
                    required
                    value={editTechEmail}
                    onChange={(e) => setEditTechEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="st-28" className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input id="st-28"
                    type="tel"
                    required
                    value={editTechPhone}
                    onChange={(e) => setEditTechPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 space-y-3">
                <div className="flex items-center gap-2 text-sky-800 font-bold mb-1">
                  <IconShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Regulatory Certifications & Skills</span>
                </div>
                <div>
                  <label htmlFor="st-29" className="block text-[10px] font-semibold text-sky-700 mb-1">Qualified Skills (comma separated)</label>
                  <input id="st-29"
                    type="text"
                    value={editTechSkills}
                    onChange={(e) => setEditTechSkills(e.target.value)}
                    placeholder="e.g. GAS_SAFE, F_GAS, AC_INSTALL"
                    className="w-full px-3 py-2 border border-sky-200 rounded-md text-xs bg-white"
                  />
                  <p className="text-[10px] text-sky-600 mt-1">Important: Use uppercase keys like GAS_SAFE and F_GAS to pass scheduling guards.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="st-30" className="block text-[10px] font-semibold text-sky-700 mb-1">Gas Safe License #</label>
                    <input id="st-30"
                      type="text"
                      value={editTechGasLicense}
                      onChange={(e) => setEditTechGasLicense(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-200 rounded text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="st-31" className="block text-[10px] font-semibold text-sky-700 mb-1">F-Gas License #</label>
                    <input id="st-31"
                      type="text"
                      value={editTechFGasLicense}
                      onChange={(e) => setEditTechFGasLicense(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-200 rounded text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="st-32" className="block text-[10px] font-semibold text-sky-700 mb-1">Gas Safe Expiry</label>
                    <input id="st-32"
                      type="date"
                      value={editTechGasExpiry}
                      onChange={(e) => setEditTechGasExpiry(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-200 rounded text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="st-33" className="block text-[10px] font-semibold text-sky-700 mb-1">F-Gas Expiry</label>
                    <input id="st-33"
                      type="date"
                      value={editTechFGasExpiry}
                      onChange={(e) => setEditTechFGasExpiry(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-200 rounded text-xs font-mono bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="st-34" className="block font-semibold text-slate-700 mb-1">Van Registration</label>
                <input id="st-34"
                  type="text"
                  value={editTechVan}
                  onChange={(e) => setEditTechVan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditTechModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

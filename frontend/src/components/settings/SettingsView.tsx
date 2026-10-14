import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CompanySettings, TechnicianProfile } from '../../types';
import { 
  Building, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  CreditCard, 
  Clock, 
  RotateCcw, 
  Download, 
  Upload, 
  Users, 
  Plus,
  Flame,
  Check
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    technicians, 
    addTechnician, 
    resetAllData, 
    exportDataJson, 
    importDataJson,
    showToast 
  } = useApp();

  const [form, setForm] = useState<CompanySettings>(settings);

  // New Tech modal
  const [showTechModal, setShowTechModal] = useState(false);
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techSkills, setTechSkills] = useState('Domestic Gas, Heat Pumps');
  const [techGasLicense, setTechGasLicense] = useState('GSR-992140');
  const [techFGasLicense, setTechFGasLicense] = useState('FGAS-2079');
  const [techVan, setTechVan] = useState('LO24 KMP');

  // Import JSON input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  const handleAddTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!created) return;
    setShowTechModal(false);
  };

  const handleDownloadBackup = async () => {
    const jsonStr = await exportDataJson().catch((e) => { showToast(e.message, 'error'); return null; });
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ApexHVAC_Backup_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Database backup downloaded');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importDataJson(content);
      }
    };
    reader.readAsText(file);
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
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Backup</span>
          </button>

          <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Restore JSON</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </label>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        
        {/* Company Details & UK Certifications */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-700" />
            <span>UK Company Details & Regulatory Registrations</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registered Company Name</label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trading / Brand Name</label>
              <input
                type="text"
                value={form.tradingName}
                onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gas Safe Register Number</label>
              <input
                type="text"
                value={form.gasSafeRegisterNo}
                onChange={(e) => setForm({ ...form, gasSafeRegisterNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Refcom F-Gas Certificate Number</label>
              <input
                type="text"
                value={form.fGasCertNo}
                onChange={(e) => setForm({ ...form, fGasCertNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">UK VAT Registration Number</label>
              <input
                type="text"
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Companies House Number</label>
              <input
                type="text"
                value={form.companyNumber}
                onChange={(e) => setForm({ ...form, companyNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Headquarters Address</label>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City / County</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Postcode</label>
                <input
                  type="text"
                  value={form.postcode}
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
            <CreditCard className="w-4 h-4 text-emerald-700" />
            <span>Configurable UK VAT & Document Numbering</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default VAT Rate (%)</label>
              <select
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
              <label className="block font-semibold text-slate-700 mb-1">Job Number Prefix</label>
              <input
                type="text"
                value={form.prefixJob}
                onChange={(e) => setForm({ ...form, prefixJob: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
              <input
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
        </div>

        {/* Bank Account Details for Invoices */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900">Company Bank Details (For BACS Invoices)</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
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
              <label className="block font-semibold text-slate-700 mb-1">Account Name</label>
              <input
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
              <label className="block font-semibold text-slate-700 mb-1">Sort Code</label>
              <input
                type="text"
                value={form.bankDetails.sortCode}
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
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={form.bankDetails.accountNumber}
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
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset the server to the original UK HVAC sample data? This replaces all current data.')) {
                resetAllData();
              }
            }}
            className="px-3 py-2 text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-sm"
          >
            Save All Settings
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
            <Plus className="w-3.5 h-3.5" />
            <span>Add Technician</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {technicians.map((t) => (
            <div key={t.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-bold text-slate-900">{t.name}</span>
                  </div>
                  <span className="font-mono text-slate-600">{t.vanRegistration}</span>
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Add Field Technician</h3>
            <form onSubmit={handleAddTechSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="e.g. Samuel Green"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={techEmail}
                    onChange={(e) => setTechEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={techPhone}
                    onChange={(e) => setTechPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Skills (comma separated)</label>
                <input
                  type="text"
                  value={techSkills}
                  onChange={(e) => setTechSkills(e.target.value)}
                  placeholder="e.g. Domestic Gas, Commercial Gas, VRF AC"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gas Safe #</label>
                  <input
                    type="text"
                    value={techGasLicense}
                    onChange={(e) => setTechGasLicense(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">F-Gas #</label>
                  <input
                    type="text"
                    value={techFGasLicense}
                    onChange={(e) => setTechFGasLicense(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Van Reg</label>
                  <input
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
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg"
                >
                  Add Technician
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

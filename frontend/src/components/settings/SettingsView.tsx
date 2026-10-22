import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AddressInput } from '../common/AddressInput';
import { getTodayISO } from '../../utils/formatters';
import { CompanySettings, TechnicianProfile } from '../../types';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { DatePicker } from '../common/DatePicker';
import { DetailDrawer } from '../common/DetailDrawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { IconBuilding, IconCreditCard, IconDownload, IconPencil, IconPlus, IconTrash, IconShieldCheck } from '@tabler/icons-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    technicians,
    addTechnician,
    updateTechnician,
    removeTechnician,
    exportDataJson,
    showToast,
    confirmToast,
    realAuth
  } = useApp(['settings', 'updateSettings', 'technicians', 'addTechnician', 'updateTechnician', 'removeTechnician', 'exportDataJson', 'showToast', 'confirmToast', 'realAuth']);

  const [form, setForm] = useState<CompanySettings>(settings);
  React.useEffect(() => setForm(settings), [settings]); // settings load async: never edit (or save) a stale copy
  const [busy, setBusy] = useState(false); // guards double-submit
  const TABS = ['company', 'vat', 'bank', 'engineers'];
  const [tab, setTab] = useState(() => { const t = new URLSearchParams(location.search).get('tab') ?? ''; return TABS.includes(t) ? t : 'company'; });
  const changeTab = (t: string) => { setTab(t); history.replaceState(null, '', `${location.pathname}?tab=${t}`); }; // refresh and shared links keep the section

  // New Tech modal
  const [showTechModal, setShowTechModal] = useState(false);
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techSkills, setTechSkills] = useState('');
  const [techGasLicense, setTechGasLicense] = useState('');
  const [techFGasLicense, setTechFGasLicense] = useState('');
  const [techVan, setTechVan] = useState('');
  const [techColor, setTechColor] = useState('#0284c7');

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
  const [editTechColor, setEditTechColor] = useState('#0284c7');

  // Import JSON input ref



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
      color: techColor,
      active: true,
    });
    setBusy(false);
    if (!created) return;
    setTechName(''); setTechEmail(''); setTechPhone(''); setTechSkills(''); setTechGasLicense(''); setTechFGasLicense(''); setTechVan(''); setTechColor('#0284c7');
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
    setEditTechColor(tech.color || '#0284c7');
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
      color: editTechColor,
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Business Settings & Company Profile
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure UK tax rules, Gas Safe certifications, company bank details, technician roster, and system backups
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadBackup}>
            <IconDownload className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Export Backup</span>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="vat">VAT & Numbering</TabsTrigger>
          <TabsTrigger value="bank">Bank Details</TabsTrigger>
          <TabsTrigger value="engineers">Engineers <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">{technicians.length}</span></TabsTrigger>
        </TabsList>

      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        
        {/* Company Details & UK Certifications */}
        <TabsContent value="company">
        <div id="settings-company" className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-2xs scroll-mt-14">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <IconBuilding className="w-4 h-4 text-sky-700" aria-hidden="true" />
            <span>UK Company Details & Regulatory Registrations</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="st-1" className="font-semibold text-foreground mb-1 block">Registered Company Name</Label>
              <Input id="st-1"
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs"
              />
            </div>

            <div>
              <Label htmlFor="st-2" className="font-semibold text-foreground mb-1 block">Trading / Brand Name</Label>
              <Input id="st-2"
                type="text"
                value={form.tradingName}
                onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs"
              />
            </div>

            <div>
              <Label htmlFor="st-3" className="font-semibold text-foreground mb-1 block">Gas Safe Register Number</Label>
              <Input id="st-3"
                type="text"
                spellCheck={false} value={form.gasSafeRegisterNo}
                onChange={(e) => setForm({ ...form, gasSafeRegisterNo: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-4" className="font-semibold text-foreground mb-1 block">Refcom F-Gas Certificate Number</Label>
              <Input id="st-4"
                type="text"
                spellCheck={false} value={form.fGasCertNo}
                onChange={(e) => setForm({ ...form, fGasCertNo: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-5" className="font-semibold text-foreground mb-1 block">UK VAT Registration Number</Label>
              <Input id="st-5"
                type="text"
                spellCheck={false} value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-6" className="font-semibold text-foreground mb-1 block">Companies House Number</Label>
              <Input id="st-6"
                type="text"
                spellCheck={false} value={form.companyNumber}
                onChange={(e) => setForm({ ...form, companyNumber: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-7" className="font-semibold text-foreground mb-1 block">Headquarters Address</Label>
              <AddressInput id="st-7"
                value={form.addressLine1}
                onChange={(v) => setForm({ ...form, addressLine1: v })}
                onPick={(a) => setForm({ ...form, addressLine1: a.line1, city: a.city, postcode: a.postcode })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="st-8" className="font-semibold text-foreground mb-1 block">City / County</Label>
                <Input id="st-8"
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md text-xs"
                />
              </div>
              <div>
                <Label htmlFor="st-9" className="font-semibold text-foreground mb-1 block">Postcode</Label>
                <Input id="st-9"
                  type="text"
                  autoComplete="postal-code" pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" title="Enter a UK postcode, e.g. LS1 4AB" value={form.postcode}
                  onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>
        </TabsContent>

        {/* VAT Rates & Numbering Prefixes */}
        <TabsContent value="vat">
        <div id="settings-vat" className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-2xs scroll-mt-14">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <IconCreditCard className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            <span>Configurable UK VAT & Document Numbering</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="st-10" className="font-semibold text-foreground mb-1 block">Default VAT Rate (%)</Label>
              <Select value={String(form.defaultVatRate)} onValueChange={(v) => setForm({ ...form, defaultVatRate: Number(v) })}>
                <SelectTrigger id="st-10" className="w-full text-xs tabular-nums"><SelectValue /></SelectTrigger>
                <SelectContent>
                <SelectItem value="20">20% (Standard UK Rate)</SelectItem>
                <SelectItem value="5">5% (Reduced - Energy Saving Materials)</SelectItem>
                <SelectItem value="0">0% (Zero Rated)</SelectItem>
                              </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="st-11" className="font-semibold text-foreground mb-1 block">Default Hourly Rate (£)</Label>
              <Input id="st-11"
                type="number" min={0} step="0.01"
                value={form.defaultHourlyRate}
                onChange={(e) => setForm({ ...form, defaultHourlyRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-12" className="font-semibold text-foreground mb-1 block">Default Travel Charge (£)</Label>
              <Input id="st-12"
                type="number" min={0} step="0.01"
                value={form.defaultTravelCharge}
                onChange={(e) => setForm({ ...form, defaultTravelCharge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-13" className="font-semibold text-foreground mb-1 block">Job Number Prefix</Label>
              <Input id="st-13"
                type="text"
                value={form.prefixJob}
                onChange={(e) => setForm({ ...form, prefixJob: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-14" className="font-semibold text-foreground mb-1 block">Invoice Prefix</Label>
              <Input id="st-14"
                type="text"
                value={form.prefixInvoice}
                onChange={(e) => setForm({ ...form, prefixInvoice: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="st-wh-start" className="font-semibold text-foreground mb-1 block">Work Day Starts</Label>
              <Input id="st-wh-start" type="time" required value={form.workingHoursStart}
                onChange={(e) => setForm({ ...form, workingHoursStart: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums" />
            </div>
            <div>
              <Label htmlFor="st-wh-end" className="font-semibold text-foreground mb-1 block">Work Day Ends</Label>
              <Input id="st-wh-end" type="time" required value={form.workingHoursEnd} min={form.workingHoursStart}
                onChange={(e) => setForm({ ...form, workingHoursEnd: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums" />
            </div>
            <p className="text-xs text-muted-foreground col-span-2 sm:col-span-1 self-end">Sets the time range shown on the dispatch board and each technician's daily capacity.</p>
          </div>

          <div className="pt-2 border-t border-border">
            <Label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
              <Checkbox checked={form.enableInventory} onCheckedChange={(c) => setForm({ ...form, enableInventory: c === true })} />
              <span>Enable Warehouse & Van Stock Inventory Tracking</span>
            </Label>
          </div>

          <div className="pt-2 border-t border-border">
            <Label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
              <Checkbox checked={form.autoSendEmails} onCheckedChange={(c) => setForm({ ...form, autoSendEmails: c === true })} />
              <span>Send customer emails automatically</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              On: quote, invoice, booking and engineer-dispatched emails send as soon as they are triggered. Off: they wait as drafts for staff approval in Notifications.
            </p>
          </div>
        </div>
        </TabsContent>

        {/* Bank Account Details for Invoices */}
        <TabsContent value="bank">
        <div id="settings-bank" className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-2xs scroll-mt-14">
          <h3 className="font-bold text-sm text-foreground">Company Bank Details (For BACS Invoices)</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="st-15" className="font-semibold text-foreground mb-1 block">Bank Name</Label>
              <Input id="st-15"
                type="text"
                value={form.bankDetails.bankName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, bankName: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-input rounded-md text-xs"
              />
            </div>

            <div>
              <Label htmlFor="st-16" className="font-semibold text-foreground mb-1 block">Account Name</Label>
              <Input id="st-16"
                type="text"
                value={form.bankDetails.accountName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, accountName: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-input rounded-md text-xs"
              />
            </div>

            <div>
              <Label htmlFor="st-17" className="font-semibold text-foreground mb-1 block">Sort Code</Label>
              <Input id="st-17"
                type="text"
                inputMode="numeric" autoComplete="off" spellCheck={false} value={form.bankDetails.sortCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, sortCode: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>

            <div>
              <Label htmlFor="st-18" className="font-semibold text-foreground mb-1 block">Account Number</Label>
              <Input id="st-18"
                type="text"
                inputMode="numeric" autoComplete="off" spellCheck={false} value={form.bankDetails.accountNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bankDetails: { ...form.bankDetails, accountNumber: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums"
              />
            </div>
          </div>
        </div>
        </TabsContent>

        {/* Action Button */}
        {tab !== 'engineers' && <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 py-3 bg-background border-t border-border shadow-[0_-8px_12px_-8px_rgba(0,0,0,0.08)]">
          {JSON.stringify(form) !== JSON.stringify(settings) && <span role="status" className="text-amber-700 font-semibold">Unsaved changes</span>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save All Settings'}
          </Button>
        </div>}

      </form>

      <TabsContent value="engineers">
      <div id="settings-roster" className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-2xs scroll-mt-14">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="font-bold text-sm text-foreground">Field Engineering Roster</h3>
            <p className="text-xs text-muted-foreground">Manage qualified technicians, Gas Safe cards, and vans</p>
          </div>
          <Button size="sm" onClick={() => setShowTechModal(true)}>
            <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Technician</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {technicians.map((t) => (
            <div key={t.id} className="p-3 border border-border rounded-lg bg-muted/50/50 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-bold text-foreground">{t.name}</span>
                    {t.expired && <span className="ml-2 text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">Licence expired</span>}
                  </div>
                  <span className="tabular-nums text-muted-foreground text-[11px]">{t.vanRegistration}</span>
                </div>
                <div className="flex gap-1">
                <Button variant="ghost" size="icon-xs"
                  onClick={() => handleEditTechOpen(t)}
                  title="Edit Technician" aria-label={`Edit ${t.name}`}
                >
                  <i className="flex text-lg"><IconPencil className="size-[1em]" aria-hidden="true" /></i>
                </Button>
                <Button variant="ghost" size="icon-xs"
                  onClick={() => confirmToast(`Delete ${t.name}? Their past jobs keep the name; to stop new bookings, deactivate them instead.`, () => void removeTechnician(t.id))}
                  title="Delete Technician" aria-label={`Delete ${t.name}`} className="text-destructive hover:text-destructive"
                >
                  <i className="flex text-lg"><IconTrash className="size-[1em]" aria-hidden="true" /></i>
                </Button>
                </div>
              </div>
              <div className="mt-1">
                <p className="text-muted-foreground mt-1">{t.email} · {t.phone}</p>
                <p className="text-foreground font-medium mt-1">Skills: {t.skills.length ? t.skills.join(', ') : 'none listed'}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground tabular-nums">
                {[t.gasSafeLicense && `Gas Safe: ${t.gasSafeLicense}`, t.fGasLicense && `F-Gas: ${t.fGasLicense}`].filter(Boolean).join(' · ') || 'No licences recorded'}
              </div>
            </div>
          ))}
        </div>

      </div>
      </TabsContent>
      </Tabs>

      {/* Add technician drawer */}
      {showTechModal && (
        <DetailDrawer onClose={() => setShowTechModal(false)} title="Add Field Technician" description="Add a qualified engineer to the roster"
          footer={<>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowTechModal(false)}>Cancel</Button>
                <Button type="submit" form="tech-add-form" size="sm" disabled={busy}>
                  {busy ? 'Adding…' : 'Add Technician'}
                </Button>
          </>}>
          <form id="tech-add-form" onSubmit={handleAddTechSubmit} className="space-y-3 text-xs">
              <div>
                <Label htmlFor="st-19" className="font-semibold text-foreground mb-1 block">Full Name *</Label>
                <Input id="st-19"
                  type="text"
                  required
                  name="name" autoComplete="off" value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="e.g. Samuel Green"
                  className="w-full px-3 py-2 border border-input rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="st-20" className="font-semibold text-foreground mb-1 block">Email</Label>
                  <Input id="st-20"
                    type="email"
                    required
                    value={techEmail}
                    onChange={(e) => setTechEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="st-21" className="font-semibold text-foreground mb-1 block">Phone</Label>
                  <Input id="st-21"
                    type="tel"
                    required
                    value={techPhone}
                    onChange={(e) => setTechPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="st-22" className="font-semibold text-foreground mb-1 block">Skills (comma separated)</Label>
                <Input id="st-22"
                  type="text"
                  value={techSkills}
                  onChange={(e) => setTechSkills(e.target.value)}
                  placeholder="e.g. GAS_SAFE, F_GAS, AC_INSTALL"
                  className="w-full px-3 py-2 border border-input rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="st-23" className="font-semibold text-foreground mb-1 block">Gas Safe #</Label>
                  <Input id="st-23"
                    type="text"
                    value={techGasLicense}
                    onChange={(e) => setTechGasLicense(e.target.value)}
                    className="w-full px-2 py-1.5 border border-input rounded text-xs tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="st-24" className="font-semibold text-foreground mb-1 block">F-Gas #</Label>
                  <Input id="st-24"
                    type="text"
                    value={techFGasLicense}
                    onChange={(e) => setTechFGasLicense(e.target.value)}
                    className="w-full px-2 py-1.5 border border-input rounded text-xs tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="st-25" className="font-semibold text-foreground mb-1 block">Van Reg</Label>
                  <Input id="st-25"
                    type="text"
                    value={techVan}
                    onChange={(e) => setTechVan(e.target.value)}
                    className="w-full px-2 py-1.5 border border-input rounded text-xs tabular-nums uppercase"
                  />
                </div>
                <div>
                  <Label htmlFor="st-add-color" className="font-semibold text-foreground mb-1 block">Dispatch Colour</Label>
                  <Input id="st-add-color" type="color" value={techColor} onChange={(e) => setTechColor(e.target.value)}
                    className="h-9 w-full p-0.5 border border-input rounded-md cursor-pointer" />
                </div>
              </div>

</form>
        </DetailDrawer>
      )}
      {/* Edit technician drawer */}
      {showEditTechModal && (
        <DetailDrawer onClose={() => setShowEditTechModal(false)} title="Edit Field Technician" description="Update licences, van and dispatch colour"
          footer={<>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditTechModal(false)}>Cancel</Button>
                <Button type="submit" form="tech-edit-form" size="sm" disabled={busy}>
                  {busy ? 'Saving…' : 'Update Profile'}
                </Button>
          </>}>
          <form id="tech-edit-form" onSubmit={handleEditTechSubmit} className="space-y-3 text-xs">
              <div>
                <Label htmlFor="st-26" className="font-semibold text-foreground mb-1 block">Full Name *</Label>
                <Input id="st-26"
                  type="text"
                  required
                  name="name" autoComplete="off" value={editTechName}
                  onChange={(e) => setEditTechName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="st-27" className="font-semibold text-foreground mb-1 block">Email</Label>
                  <Input id="st-27"
                    type="email"
                    required
                    value={editTechEmail}
                    onChange={(e) => setEditTechEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="st-28" className="font-semibold text-foreground mb-1 block">Phone</Label>
                  <Input id="st-28"
                    type="tel"
                    required
                    value={editTechPhone}
                    onChange={(e) => setEditTechPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 space-y-3">
                <div className="flex items-center gap-2 text-sky-800 font-bold mb-1">
                  <IconShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Regulatory Certifications & Skills</span>
                </div>
                <div>
                  <Label htmlFor="st-29" className="text-[10px] font-semibold text-sky-700 mb-1 block">Qualified Skills (comma separated)</Label>
                  <Input id="st-29"
                    type="text"
                    value={editTechSkills}
                    onChange={(e) => setEditTechSkills(e.target.value)}
                    placeholder="e.g. GAS_SAFE, F_GAS, AC_INSTALL"
                    className="w-full px-3 py-2 border border-sky-200 rounded-md text-xs bg-card"
                  />
                  <p className="text-[10px] text-sky-600 mt-1">Important: Use uppercase keys like GAS_SAFE and F_GAS to pass scheduling guards.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="st-30" className="text-[10px] font-semibold text-sky-700 mb-1 block">Gas Safe License #</Label>
                    <Input id="st-30"
                      type="text"
                      value={editTechGasLicense}
                      onChange={(e) => setEditTechGasLicense(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-200 rounded text-xs tabular-nums bg-card"
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-31" className="text-[10px] font-semibold text-sky-700 mb-1 block">F-Gas License #</Label>
                    <Input id="st-31"
                      type="text"
                      value={editTechFGasLicense}
                      onChange={(e) => setEditTechFGasLicense(e.target.value)}
                      className="w-full px-2 py-1.5 border border-sky-200 rounded text-xs tabular-nums bg-card"
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-32" className="text-[10px] font-semibold text-sky-700 mb-1 block">Gas Safe Expiry</Label>
                    <DatePicker id="st-32" clearable value={editTechGasExpiry} onChange={setEditTechGasExpiry} />
                  </div>
                  <div>
                    <Label htmlFor="st-33" className="text-[10px] font-semibold text-sky-700 mb-1 block">F-Gas Expiry</Label>
                    <DatePicker id="st-33" clearable value={editTechFGasExpiry} onChange={setEditTechFGasExpiry} />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="st-34" className="font-semibold text-foreground mb-1 block">Van Registration</Label>
                <Input id="st-34"
                  type="text"
                  value={editTechVan}
                  onChange={(e) => setEditTechVan(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-xs tabular-nums uppercase"
                />
              </div>

              <div>
                <Label htmlFor="st-edit-color" className="font-semibold text-foreground mb-1 block">Dispatch Colour</Label>
                <Input id="st-edit-color" type="color" value={editTechColor} onChange={(e) => setEditTechColor(e.target.value)}
                  className="h-9 w-full p-0.5 border border-input rounded-md cursor-pointer" />
              </div>

</form>
        </DetailDrawer>
      )}
    </div>
  );
};

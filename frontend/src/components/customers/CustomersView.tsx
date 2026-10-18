import React, { useState, useMemo } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerType, Job, ServiceLocation } from '../../types';
import { formatDateUK, formatGBP } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconAirConditioning, IconArchive, IconCircleCheck, IconPencil, IconPlus, IconSearch, IconTrash, IconUsers, IconX } from '@tabler/icons-react';
import { useServerPaged } from '../common/Pager';
import { CustomerFormModal } from './CustomerFormModal';
import { JobDetailDrawer } from '../scheduling/JobDetailDrawer';

interface CustomersViewProps {
  onOpenQuickAction: (action: 'customer' | 'job' | 'quote' | 'invoice') => void;
  onNavigateTab: (tab: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onOpenQuickAction,
  onNavigateTab,
}) => {
  const { 
    customers, 
    addCustomer, 
    updateCustomer, 
    addCustomerLocation,
    updateCustomerLocation,
    removeCustomerLocation,
    archiveCustomer,
    equipment,
    jobs,
    quotations,
    invoices,
    serviceRequests,
    customerById,
    confirmToast,
  } = useApp(['customers', 'addCustomer', 'updateCustomer', 'addCustomerLocation', 'updateCustomerLocation', 'removeCustomerLocation', 'archiveCustomer', 'equipment', 'jobs', 'quotations', 'invoices', 'serviceRequests', 'customerById', 'confirmToast']);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'residential' | 'commercial'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false); // guards double-submit (would create duplicate customers/sites)

  // Selected customer for 360 view drawer/modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const selectedCustomer = (selectedCustomerId ? customerById.get(selectedCustomerId) : undefined);

  // Customer Add/Edit Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form states for Add/Edit
  const [formType, setFormType] = useState<CustomerType>('residential');
  const [formName, setFormName] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBillingLine1, setFormBillingLine1] = useState('');
  const [formBillingLine2, setFormBillingLine2] = useState('');
  const [formBillingCity, setFormBillingCity] = useState('');
  const [formBillingPostcode, setFormBillingPostcode] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPref, setFormPref] = useState<'email' | 'sms' | 'both'>('email');
  const [formGdpr, setFormGdpr] = useState(false);

  // Multi-site add state in drawer
  const [newSiteLabel, setNewSiteLabel] = useState('');
  const [newSiteAddress1, setNewSiteAddress1] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSitePostcode, setNewSitePostcode] = useState('');
  const [newSiteAccessNotes, setNewSiteAccessNotes] = useState('');
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  // IconSearch, type and archived filters run on the server so paging covers the whole list
  const paged = useServerPaged<Customer>('/customers', { q: searchTerm.trim() || undefined, type: typeFilter === 'all' ? undefined : typeFilter, archived: String(showArchived) }, customers);

  useEscape(!!selectedCustomer && !showCustomerModal, () => setSelectedCustomerId(null)); // the dialog handles its own Escape

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormType('residential');
    setFormName('');
    setFormCompanyName('');
    setFormPhone('');
    setFormEmail('');
    setFormBillingLine1('');
    setFormBillingLine2('');
    setFormBillingCity('');
    setFormBillingPostcode('');
    setFormNotes('');
    setFormPref('both');
    setFormGdpr(false); // consent must be an affirmative tick, never pre-ticked
    setShowCustomerModal(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormType(c.type);
    setFormName(c.name);
    setFormCompanyName(c.companyName || '');
    setFormPhone(c.phone);
    setFormEmail(c.email);
    setFormBillingLine1(c.billingAddress.line1);
    setFormBillingLine2(c.billingAddress.line2 || '');
    setFormBillingCity(c.billingAddress.city);
    setFormBillingPostcode(c.billingAddress.postcode);
    setFormNotes(c.notes || '');
    setFormPref(c.communicationPreference);
    setFormGdpr(c.gdprConsent);
    setShowCustomerModal(true);
  };


  // Add extra service location to active customer
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const newLoc: Omit<ServiceLocation, 'id'> = {
      label: newSiteLabel || 'Secondary Site',
      addressLine1: newSiteAddress1,
      city: newSiteCity,
      postcode: newSitePostcode.toUpperCase(),
      accessNotes: newSiteAccessNotes,
    };

    setBusy(true);
    const ok = editingSiteId ? await updateCustomerLocation(selectedCustomer.id, editingSiteId, newLoc) : await addCustomerLocation(selectedCustomer.id, newLoc);
    setBusy(false);
    if (!ok) return;
    setEditingSiteId(null);

    setNewSiteLabel('');
    setNewSiteAddress1('');
    setNewSiteCity('');
    setNewSitePostcode('');
    setNewSiteAccessNotes('');
    setShowAddSiteForm(false);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Customer Directory & Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage residential homeowners, commercial facilities, multi-site plant rooms, and 360 history
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* IconSearch & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search customers" name="search" autoComplete="off" placeholder="Search by name, company, email, or postcode…"
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md">
            <button
              onClick={() => setTypeFilter('all')}
              aria-pressed={typeFilter === 'all'}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All ({customers.filter((c) => !c.archived).length})
            </button>
            <button
              onClick={() => setTypeFilter('commercial')}
              aria-pressed={typeFilter === 'commercial'}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === 'commercial' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Commercial
            </button>
            <button
              onClick={() => setTypeFilter('residential')}
              aria-pressed={typeFilter === 'residential'}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === 'residential' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Residential
            </button>
          </div>

          <button
            onClick={() => setShowArchived(!showArchived)}
            aria-pressed={showArchived}
            className={`px-2.5 py-1 rounded text-xs font-medium border ${
              showArchived ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showArchived ? 'Viewing Archived' : 'Show Archived'}
          </button>
        </div>
      </div>

      {/* Customer Grid / Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="py-2.5 px-3">Customer / Company</th>
                <th scope="col" className="py-2.5 px-3">Type</th>
                <th scope="col" className="py-2.5 px-3">Contact</th>
                <th scope="col" className="py-2.5 px-3">Primary Service Location</th>
                <th scope="col" className="py-2.5 px-3">Sites</th>
                <th scope="col" className="py-2.5 px-3">GDPR</th>
                <th scope="col" className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.rows.map((c) => {
                const primaryLoc = c.serviceLocations[0];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="text-left group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <span className="font-bold text-slate-900 group-hover:text-sky-700 block">
                          {c.name}
                        </span>
                        {c.companyName && (
                          <span className="text-[11px] text-slate-500 block">
                            {c.companyName}
                          </span>
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        c.type === 'commercial' ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {c.type}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-slate-900 block font-medium">{c.phone}</span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">{c.email}</span>
                    </td>

                    <td className="py-3 px-3 max-w-[200px]">
                      <span className="text-slate-800 block truncate">
                        {primaryLoc?.addressLine1}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono block">
                        {primaryLoc?.city}, {primaryLoc?.postcode}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700 text-[11px]">
                        {c.serviceLocations.length} {c.serviceLocations.length === 1 ? 'site' : 'sites'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {c.gdprConsent ? (
                        <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                          <IconCircleCheck className="w-3 h-3" aria-hidden="true" />
                          <span>Consent OK</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Pending</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCustomerId(c.id)}
                          aria-label={`360 view of ${c.name}`} className="px-2 py-1 text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          360 View
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1 text-slate-500 hover:text-slate-800 rounded"
                          title="Edit Details" aria-label={`Edit ${c.name}`}
                        >
                          <IconPencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => archiveCustomer(c.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title={c.archived ? 'Restore' : 'Archive'} aria-label={`${c.archived ? 'Restore' : 'Archive'} ${c.name}`}
                        >
                          <IconArchive className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paged.rows.length === 0 && !paged.loading && (
                <tr>
                  <td colSpan={7} className="py-6"><EmptyState icon={IconUsers}>No customers found matching your criteria.</EmptyState></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {paged.pager}
      </div>

      {/* Customer 360 Drawer / Modal */}
      {selectedCustomer && (
        <div role="dialog" aria-modal="true" aria-label={`${selectedCustomer.name} account`} className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    {selectedCustomer.type}
                  </span>
                </div>
                {selectedCustomer.companyName && (
                  <p className="text-xs text-slate-500">{selectedCustomer.companyName}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700"
              >
                <IconX className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Body (360 History) */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* Quick Contact & Billing Card */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Contact:</span>
                  <p className="text-slate-900 font-medium">{selectedCustomer.phone}</p>
                  <p className="text-slate-600">{selectedCustomer.email}</p>
                  <p className="text-slate-500 text-[11px] mt-1 capitalize">
                    Preference: {selectedCustomer.communicationPreference}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Billing Address:</span>
                  <p className="text-slate-800">{selectedCustomer.billingAddress.line1}</p>
                  <p className="text-slate-800">{selectedCustomer.billingAddress.city}, <span className="font-mono">{selectedCustomer.billingAddress.postcode}</span></p>
                </div>
              </div>

              {/* Service Locations (Multi-site) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">
                    Service Locations ({selectedCustomer.serviceLocations.length})
                  </h3>
                  <button
                    onClick={() => { setEditingSiteId(null); setNewSiteLabel(''); setNewSiteAddress1(''); setNewSiteCity(''); setNewSitePostcode(''); setNewSiteAccessNotes(''); setShowAddSiteForm(!showAddSiteForm); }}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    {showAddSiteForm ? 'Cancel' : '+ Add Location'}
                  </button>
                </div>

                {/* Add new site form */}
                {showAddSiteForm && (
                  <form onSubmit={handleAddLocation} className="p-3 bg-sky-50/60 border border-sky-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        aria-label="Site label" placeholder="Site Label (e.g. Plant Room)"
                        value={newSiteLabel}
                        onChange={(e) => setNewSiteLabel(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        required
                        aria-label="Address line 1" placeholder="Address Line 1"
                        value={newSiteAddress1}
                        onChange={(e) => setNewSiteAddress1(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        aria-label="City" placeholder="City"
                        value={newSiteCity}
                        onChange={(e) => setNewSiteCity(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        required
                        aria-label="Postcode" autoComplete="off" placeholder="Postcode (e.g. SW19 4QW)"
                        value={newSitePostcode}
                        onChange={(e) => setNewSitePostcode(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      aria-label="Access notes" placeholder="Access Notes / Keycode"
                      value={newSiteAccessNotes}
                      onChange={(e) => setNewSiteAccessNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                    <button
                      type="submit"
                      disabled={busy} className="w-full py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded text-xs disabled:opacity-60"
                    >
                      {editingSiteId ? 'Update Service Location' : 'Save Service Location'}
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {selectedCustomer.serviceLocations.map((loc) => (
                    <div key={loc.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 block">{loc.label}</span>
                        <span className="flex gap-2 shrink-0 text-[11px] font-semibold">
                          <button
                            onClick={() => {
                              setEditingSiteId(loc.id); setNewSiteLabel(loc.label); setNewSiteAddress1(loc.addressLine1); setNewSiteCity(loc.city);
                              setNewSitePostcode(loc.postcode); setNewSiteAccessNotes(loc.accessNotes || ''); setShowAddSiteForm(true);
                            }}
                            title="Edit" aria-label={`Edit ${loc.label}`} className="p-1 text-sky-700 hover:bg-sky-50 rounded"
                          >
                            <IconPencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => confirmToast(`Remove ${loc.label}? Sites used by jobs or equipment can't be removed.`, () => void removeCustomerLocation(selectedCustomer.id, loc.id))}
                            title="Remove" aria-label={`Remove ${loc.label}`} className="p-1 text-rose-700 hover:bg-rose-50 rounded"
                          >
                            <IconTrash className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        {loc.addressLine1}, {loc.city} <strong className="font-mono text-slate-800">{loc.postcode}</strong>
                      </p>
                      {loc.accessNotes && (
                        <p className="text-[11px] text-amber-800 mt-1 bg-amber-50 p-1 rounded">
                          Access: {loc.accessNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment Assets Registered */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">Registered HVAC Assets</h3>
                <div className="space-y-1.5">
                  {equipment.filter((e) => e.customerId === selectedCustomer.id).map((eq) => (
                    <div key={eq.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{eq.brand} {eq.model}</span>
                        <span className="text-[11px] text-slate-500 block font-mono">S/N: {eq.serialNumber}</span>
                      </div>
                      <span className="text-[11px] font-mono text-sky-700">Next: {formatDateUK(eq.nextServiceDueDate)}</span>
                    </div>
                  ))}
                  {equipment.filter((e) => e.customerId === selectedCustomer.id).length === 0 && (
                    <EmptyState icon={IconAirConditioning} compact>No equipment registered yet for this client.</EmptyState>
                  )}
                </div>
              </div>

              {/* Past & Scheduled Jobs */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">Job History & Visits</h3>
                <div className="space-y-1.5">
                  {jobs.filter((j) => j.customerId === selectedCustomer.id).map((job) => (
                    <button key={job.id} type="button" onClick={() => setViewingJob(job)} aria-label={`View details of ${job.jobNumber}`} className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{job.jobNumber}</span>
                        <span className="text-xs font-medium text-slate-700 block">{job.title}</span>
                        <span className="text-[11px] text-slate-500 block">{job.description}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-slate-800 block">{formatDateUK(job.appointmentDate)}</span>
                        <span className="text-[10px] uppercase font-bold text-sky-700">{job.status}</span>
                      </div>
                    </button>
                  ))}
                  {viewingJob && <JobDetailDrawer job={viewingJob} onClose={() => setViewingJob(null)} />}
                </div>
              </div>

              {/* Invoices & Quotations */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">Financial History</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[11px] text-slate-500 font-semibold block">Invoices Issued</span>
                    <span className="text-base font-bold font-mono text-slate-900">
                      {invoices.filter((i) => i.customerId === selectedCustomer.id).length}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[11px] text-slate-500 font-semibold block">Outstanding Balance</span>
                    <span className="text-base font-bold font-mono text-rose-600">
                      {formatGBP(
                        invoices
                          .filter((i) => i.customerId === selectedCustomer.id)
                          .reduce((sum, inv) => sum + inv.balanceDue, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => handleOpenEditModal(selectedCustomer)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg"
              >
                Edit Customer
              </button>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <CustomerFormModal customer={editingCustomer} onClose={() => setShowCustomerModal(false)} onSaved={setSelectedCustomerId} />
      )}

    </div>
  );
};

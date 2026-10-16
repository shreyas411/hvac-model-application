import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerType, ServiceLocation } from '../../types';
import { formatDateUK, formatGBP } from '../../utils/formatters';
import {
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Search,
  Plus,
  Archive,
  Eye,
  Edit3,
  Wrench,
  FileText,
  Receipt,
  CheckCircle,
  ExternalLink,
  X,
  Loader2
} from 'lucide-react';
import { lookupPostcode } from '../../services/postcode';

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
    archiveCustomer,
    equipment,
    jobs,
    quotations,
    invoices,
    serviceRequests,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'residential' | 'commercial'>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Selected customer for 360 view drawer/modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

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
  const [formBillingCity, setFormBillingCity] = useState('');
  const [formBillingPostcode, setFormBillingPostcode] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPref, setFormPref] = useState<'email' | 'sms' | 'both'>('email');
  const [formGdpr, setFormGdpr] = useState(true);

  // Postcode lookup state
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResults, setLookupResults] = useState<any[]>([]);

  // Multi-site add state in drawer
  const [newSiteLabel, setNewSiteLabel] = useState('');
  const [newSiteAddress1, setNewSiteAddress1] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSitePostcode, setNewSitePostcode] = useState('');
  const [newSiteAccessNotes, setNewSiteAccessNotes] = useState('');
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);

  // Postcode lookup for new site
  const [isSiteLookingUp, setIsSiteLookingUp] = useState(false);
  const [siteLookupResults, setSiteLookupResults] = useState<any[]>([]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!showArchived && c.archived) return false;
      if (showArchived && !c.archived) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesCompany = c.companyName?.toLowerCase().includes(query);
        const matchesEmail = c.email.toLowerCase().includes(query);
        const matchesPhone = c.phone.includes(query);
        const matchesPostcode = c.serviceLocations.some((l) =>
          l.postcode.toLowerCase().includes(query)
        );
        return matchesName || matchesCompany || matchesEmail || matchesPhone || matchesPostcode;
      }
      return true;
    });
  }, [customers, searchTerm, typeFilter, showArchived]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormType('residential');
    setFormName('');
    setFormCompanyName('');
    setFormPhone('');
    setFormEmail('');
    setFormBillingLine1('');
    setFormBillingCity('London');
    setFormBillingPostcode('');
    setFormNotes('');
    setFormPref('both');
    setFormGdpr(true);
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
    setFormBillingCity(c.billingAddress.city);
    setFormBillingPostcode(c.billingAddress.postcode);
    setFormNotes(c.notes || '');
    setFormPref(c.communicationPreference);
    setFormGdpr(c.gdprConsent);
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, {
        type: formType,
        name: formName,
        companyName: formType === 'commercial' ? formCompanyName : undefined,
        phone: formPhone,
        email: formEmail,
        billingAddress: {
          line1: formBillingLine1,
          city: formBillingCity,
          postcode: formBillingPostcode.toUpperCase(),
        },
        notes: formNotes,
        communicationPreference: formPref,
        gdprConsent: formGdpr,
      });
    } else {
      // Create new customer with primary service location
      const newCustomer = await addCustomer({
        type: formType,
        name: formName,
        companyName: formType === 'commercial' ? formCompanyName : undefined,
        phone: formPhone,
        email: formEmail,
        billingAddress: {
          line1: formBillingLine1,
          city: formBillingCity,
          postcode: formBillingPostcode.toUpperCase(),
        },
        serviceLocations: [
          {
            label: formType === 'commercial' ? 'Primary Site / HQ' : 'Main Residence',
            addressLine1: formBillingLine1,
            city: formBillingCity,
            postcode: formBillingPostcode.toUpperCase(),
            contactName: formName,
            contactPhone: formPhone,
          },
        ],
        notes: formNotes,
        communicationPreference: formPref,
        gdprConsent: formGdpr,
      });
      if (newCustomer) setSelectedCustomerId(newCustomer.id);
    }

    setShowCustomerModal(false);
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

    await addCustomerLocation(selectedCustomer.id, newLoc);

    setNewSiteLabel('');
    setNewSiteAddress1('');
    setNewSiteCity('');
    setNewSitePostcode('');
    setNewSiteAccessNotes('');
    setShowAddSiteForm(false);
  };

  const handleSiteLookup = async () => {
    if (!newSitePostcode) return;
    setIsSiteLookingUp(true);
    try {
      const results = await lookupPostcode(newSitePostcode);
      setSiteLookupResults(results);
    } catch (e) {
      console.error('Site postcode lookup failed', e);
    } finally {
      setIsSiteLookingUp(false);
    }
  };

  const selectSiteAddress = (addr: any) => {
    setNewSiteAddress1(addr.addressLine1);
    setNewSiteCity(addr.city);
    setNewSitePostcode(addr.postcode);
    setSiteLookupResults([]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
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
          <Plus className="w-3.5 h-3.5" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, company, email, or postcode..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All ({customers.filter((c) => !c.archived).length})
            </button>
            <button
              onClick={() => setTypeFilter('commercial')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === 'commercial' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Commercial
            </button>
            <button
              onClick={() => setTypeFilter('residential')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === 'residential' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Residential
            </button>
          </div>

          <button
            onClick={() => setShowArchived(!showArchived)}
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
                <th className="py-2.5 px-3">Customer / Company</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Primary Service Location</th>
                <th className="py-2.5 px-3">Sites</th>
                <th className="py-2.5 px-3">GDPR</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((c) => {
                const primaryLoc = c.serviceLocations[0];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="text-left group focus:outline-none"
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
                          <CheckCircle className="w-3 h-3" />
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
                          className="px-2 py-1 text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded font-semibold text-xs"
                        >
                          360 View
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1 text-slate-500 hover:text-slate-800 rounded"
                          title="Edit Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => archiveCustomer(c.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title={c.archived ? 'Restore' : 'Archive'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                    No customers found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer 360 Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-2xs">
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
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
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
                    onClick={() => setShowAddSiteForm(!showAddSiteForm)}
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
                        placeholder="Site Label (e.g. Plant Room)"
                        value={newSiteLabel}
                        onChange={(e) => setNewSiteLabel(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Address Line 1"
                        value={newSiteAddress1}
                        onChange={(e) => setNewSiteAddress1(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="City"
                        value={newSiteCity}
                        onChange={(e) => setNewSiteCity(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Postcode (e.g. SW19 4QW)"
                        value={newSitePostcode}
                        onChange={(e) => setNewSitePostcode(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Access Notes / Keycode"
                      value={newSiteAccessNotes}
                      onChange={(e) => setNewSiteAccessNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded text-xs"
                    >
                      Save Service Location
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {selectedCustomer.serviceLocations.map((loc) => (
                    <div key={loc.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="font-bold text-slate-900 block">{loc.label}</span>
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
                      <span className="text-[11px] font-mono text-sky-700">Next: {eq.nextServiceDueDate}</span>
                    </div>
                  ))}
                  {equipment.filter((e) => e.customerId === selectedCustomer.id).length === 0 && (
                    <p className="text-slate-400 py-1">No equipment registered yet for this client.</p>
                  )}
                </div>
              </div>

              {/* Past & Scheduled Jobs */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900">Job History & Visits</h3>
                <div className="space-y-1.5">
                  {jobs.filter((j) => j.customerId === selectedCustomer.id).map((job) => (
                    <div key={job.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{job.jobNumber}</span>
                        <span className="text-[11px] text-slate-500 block">{job.description}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-slate-800 block">{job.appointmentDate}</span>
                        <span className="text-[10px] uppercase font-bold text-sky-700">{job.status}</span>
                      </div>
                    </div>
                  ))}
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

      {/* Customer Add/Edit Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                {editingCustomer ? `Edit Customer (${editingCustomer.name})` : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="custType"
                      checked={formType === 'residential'}
                      onChange={() => setFormType('residential')}
                    />
                    <span>Residential</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="custType"
                      checked={formType === 'commercial'}
                      onChange={() => setFormType('commercial')}
                    />
                    <span>Commercial</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Contact Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dr. Alistair Finch or Nigel Edwards"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {formType === 'commercial' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Trading Name *</label>
                  <input
                    type="text"
                    required
                    value={formCompanyName}
                    onChange={(e) => setFormCompanyName(e.target.value)}
                    placeholder="e.g. Crown Hospitality Group Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 020 8940 3392"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. client@example.co.uk"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Billing Street Address</label>
                <input
                  type="text"
                  required
                  value={formBillingLine1}
                  onChange={(e) => setFormBillingLine1(e.target.value)}
                  placeholder="e.g. 9 Heron Court, Richmond Green"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Borough</label>
                  <input
                    type="text"
                    required
                    value={formBillingCity}
                    onChange={(e) => setFormBillingCity(e.target.value)}
                    placeholder="e.g. London / Surrey"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">UK Postcode *</label>
                  <input
                    type="text"
                    required
                    value={formBillingPostcode}
                    onChange={(e) => setFormBillingPostcode(e.target.value)}
                    placeholder="e.g. TW9 1NW"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Communication Preference</label>
                <select
                  value={formPref}
                  onChange={(e) => setFormPref(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                >
                  <option value="both">Both Email & SMS</option>
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only</option>
                </select>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formGdpr}
                  onChange={(e) => setFormGdpr(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-slate-700">Customer consented to service communication (UK GDPR)</span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
                >
                  {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

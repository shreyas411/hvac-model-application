import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CompanySettings,
  Customer,
  Equipment,
  EquipmentServiceRecord,
  InventoryMovement,
  Invoice,
  Job,
  JobStatus,
  LineItem,
  PartItem,
  PaymentRecord,
  Quotation,
  ServiceRequest,
  TechnicianProfile,
  User,
  UserRole,
  CustomerNotification,
} from '../types';
import {
  INITIAL_CUSTOMERS,
  INITIAL_EQUIPMENT,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_INVOICES,
  INITIAL_JOBS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PARTS,
  INITIAL_QUOTATIONS,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_SETTINGS,
  INITIAL_TECHNICIANS,
  INITIAL_USERS,
} from '../data/initialData';

interface AppContextType {
  // Authentication & Role
  currentUser: User;
  setCurrentUser: (user: User) => void;
  switchUserRole: (role: UserRole) => void;
  users: User[];
  
  // Settings
  settings: CompanySettings;
  updateSettings: (newSettings: Partial<CompanySettings>) => void;
  resetAllData: () => void;
  exportDataJson: () => string;
  importDataJson: (jsonStr: string) => boolean;

  // Technicians
  technicians: TechnicianProfile[];
  addTechnician: (tech: Omit<TechnicianProfile, 'id'>) => void;
  updateTechnician: (id: string, updates: Partial<TechnicianProfile>) => void;

  // Customers
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  archiveCustomer: (id: string) => void;

  // Equipment
  equipment: Equipment[];
  addEquipment: (eq: Omit<Equipment, 'id' | 'serviceHistory'>) => Equipment;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  addEquipmentServiceRecord: (equipmentId: string, record: Omit<EquipmentServiceRecord, 'id'>) => void;

  // Service Requests
  serviceRequests: ServiceRequest[];
  addServiceRequest: (sr: Omit<ServiceRequest, 'id' | 'requestNumber' | 'createdAt' | 'updatedAt'>) => ServiceRequest;
  updateServiceRequest: (id: string, updates: Partial<ServiceRequest>) => void;
  convertRequestToJob: (requestId: string, appointmentDate: string, startTime: string, endTime: string, technicianId: string) => Job;

  // Jobs
  jobs: Job[];
  addJob: (jobData: Omit<Job, 'id' | 'jobNumber' | 'createdAt' | 'updatedAt' | 'auditTrail'>) => Job;
  updateJob: (id: string, updates: Partial<Job>, auditAction?: string) => void;
  updateJobStatus: (id: string, newStatus: JobStatus, note?: string) => void;
  checkScheduleConflict: (technicianId: string, date: string, startTime: string, endTime: string, excludeJobId?: string) => Job | null;

  // Quotations
  quotations: Quotation[];
  addQuotation: (q: Omit<Quotation, 'id' | 'quoteNumber' | 'createdAt' | 'updatedAt'>) => Quotation;
  updateQuotation: (id: string, updates: Partial<Quotation>) => void;
  acceptQuotation: (id: string, acceptedBy: string) => void;
  convertQuotationToJob: (quoteId: string, appointmentDate: string, startTime: string, endTime: string, technicianId: string) => Job;
  convertQuotationToInvoice: (quoteId: string) => Invoice;

  // Invoices & Payments
  invoices: Invoice[];
  addInvoice: (inv: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  recordPayment: (invoiceId: string, payment: Omit<PaymentRecord, 'id' | 'recordedBy'>) => void;
  generateInvoiceFromJob: (jobId: string) => Invoice;

  // Parts & Inventory
  parts: PartItem[];
  addPart: (part: Omit<PartItem, 'id' | 'createdAt'>) => PartItem;
  updatePart: (id: string, updates: Partial<PartItem>) => void;
  adjustStock: (partId: string, delta: number, type: 'used_on_job' | 'stock_adjustment' | 'restock_purchase', notes: string, jobId?: string) => void;
  inventoryMovements: InventoryMovement[];

  // Notifications
  notifications: CustomerNotification[];
  createNotification: (notif: Omit<CustomerNotification, 'id' | 'createdAt'>) => CustomerNotification;
  sendNotification: (id: string) => void;

  // Active Toast/Banner Feedback
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const STORAGE_KEY = 'apexhvac_app_data_v1';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from LocalStorage or defaults
  const loadStored = <T,>(key: string, defaultVal: T): T => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${key}`);
      return stored ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [users] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User>(() => loadStored('currentUser', INITIAL_USERS[0]));
  const [settings, setSettings] = useState<CompanySettings>(() => loadStored('settings', INITIAL_SETTINGS));
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>(() => loadStored('technicians', INITIAL_TECHNICIANS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadStored('customers', INITIAL_CUSTOMERS));
  const [equipment, setEquipment] = useState<Equipment[]>(() => loadStored('equipment', INITIAL_EQUIPMENT));
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(() => loadStored('serviceRequests', INITIAL_SERVICE_REQUESTS));
  const [jobs, setJobs] = useState<Job[]>(() => loadStored('jobs', INITIAL_JOBS));
  const [quotations, setQuotations] = useState<Quotation[]>(() => loadStored('quotations', INITIAL_QUOTATIONS));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadStored('invoices', INITIAL_INVOICES));
  const [parts, setParts] = useState<PartItem[]>(() => loadStored('parts', INITIAL_PARTS));
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => loadStored('inventoryMovements', INITIAL_INVENTORY_MOVEMENTS));
  const [notifications, setNotifications] = useState<CustomerNotification[]>(() => loadStored('notifications', INITIAL_NOTIFICATIONS));

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(currentUser));
      localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(settings));
      localStorage.setItem(`${STORAGE_KEY}_technicians`, JSON.stringify(technicians));
      localStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(customers));
      localStorage.setItem(`${STORAGE_KEY}_equipment`, JSON.stringify(equipment));
      localStorage.setItem(`${STORAGE_KEY}_serviceRequests`, JSON.stringify(serviceRequests));
      localStorage.setItem(`${STORAGE_KEY}_jobs`, JSON.stringify(jobs));
      localStorage.setItem(`${STORAGE_KEY}_quotations`, JSON.stringify(quotations));
      localStorage.setItem(`${STORAGE_KEY}_invoices`, JSON.stringify(invoices));
      localStorage.setItem(`${STORAGE_KEY}_parts`, JSON.stringify(parts));
      localStorage.setItem(`${STORAGE_KEY}_inventoryMovements`, JSON.stringify(inventoryMovements));
      localStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
    } catch {
      // ignore quota errors
    }
  }, [currentUser, settings, technicians, customers, equipment, serviceRequests, jobs, quotations, invoices, parts, inventoryMovements, notifications]);

  // Role switching
  const switchUserRole = (role: UserRole) => {
    const userForRole = users.find((u) => u.role === role);
    if (userForRole) {
      setCurrentUser(userForRole);
      showToast(`Switched active profile to ${userForRole.name} (${role.toUpperCase()})`, 'info');
    }
  };

  // Settings
  const updateSettings = (newSettings: Partial<CompanySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    showToast('Company settings updated successfully');
  };

  const resetAllData = () => {
    setCurrentUser(INITIAL_USERS[0]);
    setSettings(INITIAL_SETTINGS);
    setTechnicians(INITIAL_TECHNICIANS);
    setCustomers(INITIAL_CUSTOMERS);
    setEquipment(INITIAL_EQUIPMENT);
    setServiceRequests(INITIAL_SERVICE_REQUESTS);
    setJobs(INITIAL_JOBS);
    setQuotations(INITIAL_QUOTATIONS);
    setInvoices(INITIAL_INVOICES);
    setParts(INITIAL_PARTS);
    setInventoryMovements(INITIAL_INVENTORY_MOVEMENTS);
    setNotifications(INITIAL_NOTIFICATIONS);
    showToast('Application reset to initial UK HVAC demonstration data', 'info');
  };

  const exportDataJson = () => {
    const payload = {
      settings,
      technicians,
      customers,
      equipment,
      serviceRequests,
      jobs,
      quotations,
      invoices,
      parts,
      inventoryMovements,
      notifications,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  };

  const importDataJson = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.customers && data.jobs) {
        if (data.settings) setSettings(data.settings);
        if (data.technicians) setTechnicians(data.technicians);
        if (data.customers) setCustomers(data.customers);
        if (data.equipment) setEquipment(data.equipment);
        if (data.serviceRequests) setServiceRequests(data.serviceRequests);
        if (data.jobs) setJobs(data.jobs);
        if (data.quotations) setQuotations(data.quotations);
        if (data.invoices) setInvoices(data.invoices);
        if (data.parts) setParts(data.parts);
        if (data.inventoryMovements) setInventoryMovements(data.inventoryMovements);
        if (data.notifications) setNotifications(data.notifications);
        showToast('Successfully imported database backup');
        return true;
      }
      showToast('Invalid backup file structure', 'error');
      return false;
    } catch {
      showToast('Failed to parse JSON file', 'error');
      return false;
    }
  };

  // Technicians
  const addTechnician = (tech: Omit<TechnicianProfile, 'id'>) => {
    const newTech: TechnicianProfile = {
      ...tech,
      id: `tech-${Date.now()}`,
    };
    setTechnicians((prev) => [...prev, newTech]);
    showToast(`Added technician ${newTech.name}`);
  };

  const updateTechnician = (id: string, updates: Partial<TechnicianProfile>) => {
    setTechnicians((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    showToast('Technician profile updated');
  };

  // Customers
  const addCustomer = (cust: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer => {
    const now = new Date().toISOString();
    const newCust: Customer = {
      ...cust,
      id: `cust-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setCustomers((prev) => [newCust, ...prev]);
    showToast(`Customer "${newCust.name}" added successfully`);
    return newCust;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      )
    );
    showToast('Customer record updated');
  };

  const archiveCustomer = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, archived: !c.archived, updatedAt: new Date().toISOString() } : c
      )
    );
    showToast('Customer archive status changed');
  };

  // Equipment
  const addEquipment = (eq: Omit<Equipment, 'id' | 'serviceHistory'>): Equipment => {
    const newEq: Equipment = {
      ...eq,
      id: `eq-${Date.now()}`,
      serviceHistory: [],
    };
    setEquipment((prev) => [newEq, ...prev]);
    showToast(`Equipment ${newEq.brand} ${newEq.model} registered`);
    return newEq;
  };

  const updateEquipment = (id: string, updates: Partial<Equipment>) => {
    setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    showToast('Equipment details updated');
  };

  const addEquipmentServiceRecord = (equipmentId: string, record: Omit<EquipmentServiceRecord, 'id'>) => {
    const newRecord: EquipmentServiceRecord = {
      ...record,
      id: `rec-${Date.now()}`,
    };
    setEquipment((prev) =>
      prev.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              lastServiceDate: record.date,
              serviceHistory: [newRecord, ...e.serviceHistory],
            }
          : e
      )
    );
  };

  // Service Requests
  const addServiceRequest = (
    sr: Omit<ServiceRequest, 'id' | 'requestNumber' | 'createdAt' | 'updatedAt'>
  ): ServiceRequest => {
    const now = new Date().toISOString();
    const count = serviceRequests.length + 1025;
    const newSr: ServiceRequest = {
      ...sr,
      id: `sr-${Date.now()}`,
      requestNumber: `SR-${count}`,
      createdAt: now,
      updatedAt: now,
    };
    setServiceRequests((prev) => [newSr, ...prev]);
    showToast(`Service request ${newSr.requestNumber} created`);
    return newSr;
  };

  const updateServiceRequest = (id: string, updates: Partial<ServiceRequest>) => {
    setServiceRequests((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      )
    );
  };

  // Check schedule conflict
  const checkScheduleConflict = (
    technicianId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeJobId?: string
  ): Job | null => {
    if (!technicianId) return null;
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const reqStart = toMinutes(startTime);
    const reqEnd = toMinutes(endTime);

    for (const job of jobs) {
      if (job.id === excludeJobId) continue;
      if (job.technicianId !== technicianId) continue;
      if (job.appointmentDate !== date) continue;
      if (job.status === 'cancelled') continue;

      const jobStart = toMinutes(job.startTime);
      const jobEnd = toMinutes(job.endTime);

      // Overlap condition
      if (reqStart < jobEnd && reqEnd > jobStart) {
        return job;
      }
    }
    return null;
  };

  // Convert service request to job
  const convertRequestToJob = (
    requestId: string,
    appointmentDate: string,
    startTime: string,
    endTime: string,
    technicianId: string
  ): Job => {
    const request = serviceRequests.find((r) => r.id === requestId);
    if (!request) throw new Error('Request not found');

    const jobCount = jobs.length + 813;
    const now = new Date().toISOString();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMins = Math.max(30, (endH * 60 + endM) - (startH * 60 + startM));

    const newJob: Job = {
      id: `job-${Date.now()}`,
      jobNumber: `JOB-2026-${jobCount}`,
      requestId: request.id,
      customerId: request.customerId,
      locationId: request.locationId,
      equipmentIds: request.equipmentId ? [request.equipmentId] : [],
      type: request.priority === 'emergency' ? 'emergency_callout' : 'repair',
      priority: request.priority,
      status: technicianId ? 'scheduled' : 'new',
      technicianId: technicianId || null,
      appointmentDate,
      startTime,
      endTime,
      estimatedDurationMinutes: durationMins,
      requiredSkills: ['System Diagnostics'],
      description: request.reportedProblem,
      internalNotes: request.internalNotes,
      partsUsed: [],
      labourHours: durationMins / 60,
      hourlyRate: 85.00,
      travelTimeMinutes: 30,
      travelCharge: 35.00,
      checklist: [
        { id: `chk-${Date.now()}-1`, category: 'general', label: 'Initial visual inspection & safety check', checked: false },
        { id: `chk-${Date.now()}-2`, category: 'general', label: 'Perform diagnostics & identify root cause', checked: false },
        { id: `chk-${Date.now()}-3`, category: 'general', label: 'Test operation and log readings', checked: false },
      ],
      auditTrail: [
        {
          timestamp: now,
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'Converted from Service Request',
          details: `Created from ${request.requestNumber}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setJobs((prev) => [newJob, ...prev]);
    updateServiceRequest(requestId, { status: 'converted', convertedJobId: newJob.id });
    showToast(`Converted ${request.requestNumber} to Job ${newJob.jobNumber}`);
    return newJob;
  };

  // Jobs
  const addJob = (
    jobData: Omit<Job, 'id' | 'jobNumber' | 'createdAt' | 'updatedAt' | 'auditTrail'>
  ): Job => {
    const jobCount = jobs.length + 814;
    const now = new Date().toISOString();
    const newJob: Job = {
      ...jobData,
      id: `job-${Date.now()}`,
      jobNumber: `JOB-2026-${jobCount}`,
      auditTrail: [
        {
          timestamp: now,
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'Job Created',
          details: `Created by ${currentUser.name}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setJobs((prev) => [newJob, ...prev]);
    showToast(`Job ${newJob.jobNumber} created`);
    return newJob;
  };

  const updateJob = (id: string, updates: Partial<Job>, auditAction?: string) => {
    const now = new Date().toISOString();
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const newAudit = auditAction
          ? [
              ...j.auditTrail,
              {
                timestamp: now,
                userId: currentUser.id,
                userName: currentUser.name,
                action: auditAction,
                details: `Updated by ${currentUser.name}`,
              },
            ]
          : j.auditTrail;

        return {
          ...j,
          ...updates,
          auditTrail: newAudit,
          updatedAt: now,
        };
      })
    );
    showToast('Job updated');
  };

  const updateJobStatus = (id: string, newStatus: JobStatus, note?: string) => {
    const now = new Date().toISOString();
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    const updates: Partial<Job> = { status: newStatus };
    if (newStatus === 'in_progress' && !job.arrivalTime) {
      updates.arrivalTime = now;
    }
    if (newStatus === 'completed' && !job.completionTime) {
      updates.completionTime = now;
    }

    const auditText = note ? `Status set to ${newStatus}: ${note}` : `Status updated to ${newStatus}`;

    updateJob(id, updates, auditText);
    showToast(`Job ${job.jobNumber} marked as ${newStatus.replace('_', ' ')}`);
  };

  // Quotations
  const addQuotation = (
    q: Omit<Quotation, 'id' | 'quoteNumber' | 'createdAt' | 'updatedAt'>
  ): Quotation => {
    const count = quotations.length + 42;
    const now = new Date().toISOString();
    const newQ: Quotation = {
      ...q,
      id: `quote-${Date.now()}`,
      quoteNumber: `QTE-2026-${String(count).padStart(4, '0')}`,
      createdAt: now,
      updatedAt: now,
    };
    setQuotations((prev) => [newQ, ...prev]);
    showToast(`Quotation ${newQ.quoteNumber} created`);
    return newQ;
  };

  const updateQuotation = (id: string, updates: Partial<Quotation>) => {
    setQuotations((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
      )
    );
    showToast('Quotation updated');
  };

  const acceptQuotation = (id: string, acceptedBy: string) => {
    const now = new Date().toISOString();
    setQuotations((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: 'accepted',
              acceptedAt: now,
              acceptedBy,
              updatedAt: now,
            }
          : q
      )
    );
    showToast(`Customer acceptance recorded for quotation`);
  };

  const convertQuotationToJob = (
    quoteId: string,
    appointmentDate: string,
    startTime: string,
    endTime: string,
    technicianId: string
  ): Job => {
    const quote = quotations.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quotation not found');

    const jobCount = jobs.length + 815;
    const now = new Date().toISOString();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMins = Math.max(60, (endH * 60 + endM) - (startH * 60 + startM));

    // Convert items into parts or labour
    const labourLines = quote.items.filter((i) => i.type === 'labour');
    const totalLabourHours = labourLines.reduce((acc, l) => acc + l.quantity, 0) || 4;

    const newJob: Job = {
      id: `job-${Date.now()}`,
      jobNumber: `JOB-2026-${jobCount}`,
      customerId: quote.customerId,
      locationId: quote.locationId,
      equipmentIds: [],
      type: 'installation',
      priority: 'medium',
      status: technicianId ? 'scheduled' : 'new',
      technicianId: technicianId || null,
      appointmentDate,
      startTime,
      endTime,
      estimatedDurationMinutes: durationMins,
      requiredSkills: ['F-Gas Heat Pumps', 'Domestic Gas'],
      description: `Installation work as agreed per Quotation ${quote.quoteNumber}`,
      internalNotes: quote.notes,
      partsUsed: [],
      labourHours: totalLabourHours,
      hourlyRate: 85.00,
      travelTimeMinutes: 30,
      travelCharge: 35.00,
      checklist: [
        { id: `chk-${Date.now()}-1`, category: 'general', label: 'Pre-installation survey & isolate services', checked: false },
        { id: `chk-${Date.now()}-2`, category: 'general', label: 'Position equipment on secure mounts', checked: false },
        { id: `chk-${Date.now()}-3`, category: 'general', label: 'Connect pipework & leak test', checked: false },
        { id: `chk-${Date.now()}-4`, category: 'general', label: 'Commissioning & customer handover', checked: false },
      ],
      auditTrail: [
        {
          timestamp: now,
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'Created from Quotation',
          details: `Generated from accepted quote ${quote.quoteNumber}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setJobs((prev) => [newJob, ...prev]);
    updateQuotation(quoteId, { convertedToJobId: newJob.id });
    showToast(`Converted quotation ${quote.quoteNumber} into scheduled Job ${newJob.jobNumber}`);
    return newJob;
  };

  const convertQuotationToInvoice = (quoteId: string): Invoice => {
    const quote = quotations.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quotation not found');

    const invCount = invoices.length + 119;
    const now = new Date();
    const issueDateStr = now.toISOString().split('T')[0];
    const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-0${invCount}`,
      quoteId: quote.id,
      jobId: quote.jobId,
      customerId: quote.customerId,
      locationId: quote.locationId,
      issueDate: issueDateStr,
      dueDate,
      status: 'issued',
      items: [...quote.items],
      subtotal: quote.subtotal,
      vatRatePercent: quote.vatRatePercent,
      vatAmount: quote.vatAmount,
      total: quote.total,
      payments: [],
      amountPaid: 0,
      balanceDue: quote.total,
      paymentTermsDays: 14,
      notes: `Invoice generated for accepted Quotation ${quote.quoteNumber}. Payment terms 14 days.`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    updateQuotation(quoteId, { convertedToInvoiceId: newInvoice.id });
    showToast(`Invoice ${newInvoice.invoiceNumber} generated from Quotation ${quote.quoteNumber}`);
    return newInvoice;
  };

  // Invoices & Payments
  const addInvoice = (
    inv: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>
  ): Invoice => {
    const count = invoices.length + 120;
    const now = new Date().toISOString();
    const newInv: Invoice = {
      ...inv,
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-0${count}`,
      createdAt: now,
      updatedAt: now,
    };
    setInvoices((prev) => [newInv, ...prev]);
    showToast(`Invoice ${newInv.invoiceNumber} created`);
    return newInv;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
      )
    );
    showToast('Invoice updated');
  };

  const recordPayment = (
    invoiceId: string,
    payment: Omit<PaymentRecord, 'id' | 'recordedBy'>
  ) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;

    const newPaymentRecord: PaymentRecord = {
      ...payment,
      id: `pay-${Date.now()}`,
      recordedBy: currentUser.name,
    };

    const newAmountPaid = invoice.amountPaid + payment.amount;
    const newBalance = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partially_paid';

    setInvoices((prev) =>
      prev.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              payments: [...i.payments, newPaymentRecord],
              amountPaid: newAmountPaid,
              balanceDue: newBalance,
              status: newStatus,
              updatedAt: new Date().toISOString(),
            }
          : i
      )
    );
    showToast(
      `Recorded payment of £${payment.amount.toFixed(2)} for ${invoice.invoiceNumber}. Balance: £${newBalance.toFixed(2)}`
    );
  };

  const generateInvoiceFromJob = (jobId: string): Invoice => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Job not found');

    const invCount = invoices.length + 121;
    const now = new Date();
    const issueDateStr = now.toISOString().split('T')[0];
    const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const lineItems: LineItem[] = [];

    // Labour line
    if (job.labourHours > 0) {
      lineItems.push({
        id: `li-${Date.now()}-1`,
        type: 'labour',
        description: `Engineering & Field Labour - ${job.type.replace('_', ' ')} (${job.labourHours} hrs @ £${job.hourlyRate.toFixed(2)}/hr)`,
        quantity: job.labourHours,
        unitPrice: job.hourlyRate,
        amount: job.labourHours * job.hourlyRate,
      });
    }

    // Travel line
    if (job.travelCharge > 0) {
      lineItems.push({
        id: `li-${Date.now()}-2`,
        type: 'travel',
        description: `Service Travel & Van Callout Charge`,
        quantity: 1,
        unitPrice: job.travelCharge,
        amount: job.travelCharge,
      });
    }

    // Parts used
    job.partsUsed.forEach((p, idx) => {
      lineItems.push({
        id: `li-${Date.now()}-${idx + 3}`,
        type: 'part',
        description: `${p.partName} (${p.sku})`,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        amount: p.quantity * p.unitPrice,
      });
    });

    const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
    const vatRate = settings.defaultVatRate;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-0${invCount}`,
      jobId: job.id,
      customerId: job.customerId,
      locationId: job.locationId,
      issueDate: issueDateStr,
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
      notes: `Invoice generated from completed Job ${job.jobNumber}. Certification signed and work logged.`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    showToast(`Generated invoice ${newInvoice.invoiceNumber} for Job ${job.jobNumber}`);
    return newInvoice;
  };

  // Parts & Inventory
  const addPart = (part: Omit<PartItem, 'id' | 'createdAt'>): PartItem => {
    const newPart: PartItem = {
      ...part,
      id: `part-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setParts((prev) => [...prev, newPart]);
    showToast(`Added part item "${newPart.name}"`);
    return newPart;
  };

  const updatePart = (id: string, updates: Partial<PartItem>) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    showToast('Part updated');
  };

  const adjustStock = (
    partId: string,
    delta: number,
    type: 'used_on_job' | 'stock_adjustment' | 'restock_purchase',
    notes: string,
    jobId?: string
  ) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    const newQty = Math.max(0, part.stockQuantity + delta);

    setParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, stockQuantity: newQty } : p))
    );

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      partId,
      type,
      quantityDelta: delta,
      jobId,
      notes,
      timestamp: new Date().toISOString(),
      userName: currentUser.name,
    };

    setInventoryMovements((prev) => [movement, ...prev]);
    showToast(`Stock updated for ${part.name}: new qty ${newQty}`);
  };

  // Notifications
  const createNotification = (
    notif: Omit<CustomerNotification, 'id' | 'createdAt'>
  ): CustomerNotification => {
    const newN: CustomerNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newN, ...prev]);
    return newN;
  };

  const sendNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              status: 'sent',
              sentAt: new Date().toISOString(),
              approvedBy: currentUser.name,
            }
          : n
      )
    );
    showToast('Customer notification sent successfully');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchUserRole,
        users,
        settings,
        updateSettings,
        resetAllData,
        exportDataJson,
        importDataJson,
        technicians,
        addTechnician,
        updateTechnician,
        customers,
        addCustomer,
        updateCustomer,
        archiveCustomer,
        equipment,
        addEquipment,
        updateEquipment,
        addEquipmentServiceRecord,
        serviceRequests,
        addServiceRequest,
        updateServiceRequest,
        convertRequestToJob,
        jobs,
        addJob,
        updateJob,
        updateJobStatus,
        checkScheduleConflict,
        quotations,
        addQuotation,
        updateQuotation,
        acceptQuotation,
        convertQuotationToJob,
        convertQuotationToInvoice,
        invoices,
        addInvoice,
        updateInvoice,
        recordPayment,
        generateInvoiceFromJob,
        parts,
        addPart,
        updatePart,
        adjustStock,
        inventoryMovements,
        notifications,
        createNotification,
        sendNotification,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

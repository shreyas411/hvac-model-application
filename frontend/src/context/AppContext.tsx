import React, { createContext, useContext, useState, useEffect } from 'react';
import { services } from '../services';
import { REAL_AUTH, setDevUser } from '../services/api';
import { useAuth } from '../components/auth/AuthGate';
import { useDataStore } from '../store/useDataStore';
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
  ServiceLocation,
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
  /** True when signed in with a real account: no role switching, and `logout` is available. */
  realAuth: boolean;
  logout: () => Promise<void>;
  
  // Settings
  settings: CompanySettings;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<void>;
  resetAllData: () => Promise<void>;
  exportDataJson: () => Promise<string>;
  importDataJson: (jsonStr: string) => Promise<boolean>;

  // Technicians
  technicians: TechnicianProfile[];
  addTechnician: (tech: Omit<TechnicianProfile, 'id'>) => Promise<TechnicianProfile | undefined>;
  updateTechnician: (id: string, updates: Partial<TechnicianProfile>) => Promise<void>;

  // Customers
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'serviceLocations'> & { serviceLocations: Omit<ServiceLocation, 'id'>[] }) => Promise<Customer | undefined>;
  updateCustomer: (id: string, updates: Partial<Omit<Customer, 'serviceLocations'>>) => Promise<void>;
  addCustomerLocation: (id: string, loc: Omit<ServiceLocation, 'id'>) => Promise<void>;
  archiveCustomer: (id: string) => Promise<void>;

  // Equipment
  equipment: Equipment[];
  addEquipment: (eq: Omit<Equipment, 'id' | 'serviceHistory'>) => Promise<Equipment | undefined>;
  updateEquipment: (id: string, updates: Partial<Equipment>) => Promise<void>;
  addEquipmentServiceRecord: (equipmentId: string, record: Omit<EquipmentServiceRecord, 'id'>) => Promise<void>;

  // Service Requests
  serviceRequests: ServiceRequest[];
  addServiceRequest: (sr: Omit<ServiceRequest, 'id' | 'requestNumber' | 'createdAt' | 'updatedAt' | 'convertedJobId'>) => Promise<ServiceRequest | undefined>;
  updateServiceRequest: (id: string, updates: Partial<ServiceRequest>) => Promise<void>;
  convertRequestToJob: (requestId: string, appointmentDate: string, startTime: string, endTime: string, technicianId: string) => Promise<Job | undefined>;

  // Jobs
  jobs: Job[];
  addJob: (jobData: Omit<Job, 'id' | 'jobNumber' | 'createdAt' | 'updatedAt' | 'auditTrail'>) => Promise<Job | undefined>;
  updateJob: (id: string, updates: Partial<Job>, auditAction?: string) => Promise<void>;
  updateJobStatus: (id: string, newStatus: JobStatus, note?: string, override?: boolean) => Promise<void>;
  addJobPart: (jobId: string, partId: string, quantity: number) => Promise<void>;
  checkScheduleConflict: (technicianId: string, date: string, startTime: string, endTime: string, excludeJobId?: string) => Job | null;

  // Quotations
  quotations: Quotation[];
  addQuotation: (q: Omit<Quotation, 'id' | 'quoteNumber' | 'createdAt' | 'updatedAt'>) => Promise<Quotation | undefined>;
  updateQuotation: (id: string, updates: Partial<Quotation>) => Promise<void>;
  acceptQuotation: (id: string, acceptedBy: string) => Promise<void>;
  convertQuotationToJob: (quoteId: string, appointmentDate: string, startTime: string, endTime: string, technicianId: string) => Promise<Job | undefined>;
  convertQuotationToInvoice: (quoteId: string) => Promise<Invoice | undefined>;

  // Invoices & Payments
  invoices: Invoice[];
  addInvoice: (inv: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>) => Promise<Invoice | undefined>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  recordPayment: (invoiceId: string, payment: Omit<PaymentRecord, 'id' | 'recordedBy'>) => Promise<boolean>;
  generateInvoiceFromJob: (jobId: string) => Promise<Invoice | undefined>;

  // Parts & Inventory
  parts: PartItem[];
  addPart: (part: Omit<PartItem, 'id' | 'createdAt'>) => Promise<PartItem | undefined>;
  updatePart: (id: string, updates: Partial<PartItem>) => Promise<void>;
  adjustStock: (partId: string, delta: number, type: 'used_on_job' | 'stock_adjustment' | 'restock_purchase', notes: string, jobId?: string) => Promise<void>;
  inventoryMovements: InventoryMovement[];

  // Notifications
  notifications: CustomerNotification[];
  createNotification: (notif: Omit<CustomerNotification, 'id' | 'createdAt'>) => Promise<CustomerNotification | undefined>;
  sendNotification: (id: string) => Promise<CustomerNotification | undefined>;

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

  const { user: signedIn, logout } = useAuth();
  const [users] = useState<User[]>(() => (signedIn ? [signedIn] : INITIAL_USERS));
  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (signedIn) return signedIn; // real account: the server decides who this is
    const u = loadStored('currentUser', INITIAL_USERS[0]);
    setDevUser(`dev-${u.role}`); // before any data loads, so the first requests carry the right identity
    return u;
  });
  const [settings, setSettings] = useState<CompanySettings>(INITIAL_SETTINGS);
  useEffect(() => { services.settings.get().then(setSettings).catch(() => {}); }, []);
  const technicians = useDataStore((st) => st.data.technicians);
  useEffect(() => { useDataStore.getState().load('technicians'); }, []);
  const customers = useDataStore((st) => st.data.customers);
  useEffect(() => { useDataStore.getState().load('customers'); }, []);
  const equipment = useDataStore((st) => st.data.equipment);
  useEffect(() => { useDataStore.getState().load('equipment'); }, []);
  const serviceRequests = useDataStore((st) => st.data.requests);
  useEffect(() => { useDataStore.getState().load('requests'); }, []);
  const jobs = useDataStore((st) => st.data.jobs);
  useEffect(() => { useDataStore.getState().load('jobs'); }, []);
  const quotations = useDataStore((st) => st.data.quotations);
  useEffect(() => { useDataStore.getState().load('quotations'); }, []);
  const invoices = useDataStore((st) => st.data.invoices);
  useEffect(() => { useDataStore.getState().load('invoices'); }, []);
  const parts = useDataStore((st) => st.data.parts);
  const inventoryMovements = useDataStore((st) => st.data.movements);
  useEffect(() => { useDataStore.getState().load('parts'); useDataStore.getState().load('movements'); }, []);
  const notifications = useDataStore((st) => st.data.notifications);
  useEffect(() => { useDataStore.getState().load('notifications'); }, []);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Persist the active profile; everything else lives on the server.
  useEffect(() => {
    if (!signedIn) localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(currentUser));
  }, [currentUser]);

  // Role switching: the backend identifies the dev user by header, so reload everything it scopes by role.
  const switchUserRole = (role: UserRole) => {
    if (REAL_AUTH) return; // signed-in users can't impersonate other roles
    const userForRole = users.find((u) => u.role === role);
    if (userForRole) {
      setDevUser(`dev-${role}`);
      setCurrentUser(userForRole);
      useDataStore.getState().loadAll();
      services.settings.get().then(setSettings).catch(() => {});
      showToast(`Switched active profile to ${userForRole.name} (${role.toUpperCase()})`, 'info');
    }
  };

  // Settings
  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    try {
      setSettings(await services.settings.update(newSettings));
      showToast('Company settings updated successfully');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  // Reset = re-seed the server with the bundled demo data through the import endpoint.
  const resetAllData = async () => {
    try {
      await services.data.import({
        settings: INITIAL_SETTINGS, technicians: INITIAL_TECHNICIANS, customers: INITIAL_CUSTOMERS, equipment: INITIAL_EQUIPMENT,
        serviceRequests: INITIAL_SERVICE_REQUESTS, jobs: INITIAL_JOBS, quotations: INITIAL_QUOTATIONS, invoices: INITIAL_INVOICES,
        parts: INITIAL_PARTS, inventoryMovements: INITIAL_INVENTORY_MOVEMENTS, notifications: INITIAL_NOTIFICATIONS,
      });
      await refreshAfterImport();
      showToast('Application reset to initial UK HVAC demonstration data', 'info');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const refreshAfterImport = async () => {
    await useDataStore.getState().loadAll();
    setSettings(await services.settings.get());
  };

  const exportDataJson = async () => JSON.stringify(await services.data.export(), null, 2);

  const importDataJson = async (jsonStr: string): Promise<boolean> => {
    try {
      await services.data.import(JSON.parse(jsonStr));
      await refreshAfterImport();
      showToast('Successfully imported database backup');
      return true;
    } catch (e) {
      showToast(e instanceof SyntaxError ? 'Failed to parse JSON file' : (e as Error).message, 'error');
      return false;
    }
  };

  // Server is the source of truth; the store keeps the returned rows.
  const apiCall = async <R,>(key: Parameters<ReturnType<typeof useDataStore.getState>['run']>[0], call: () => Promise<R>, ok: string): Promise<R | undefined> => {
    try {
      const r = await useDataStore.getState().run(key, call as any);
      showToast(ok);
      return r as R;
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  // Technicians
  const addTechnician: AppContextType['addTechnician'] = (tech) =>
    apiCall('technicians', () => services.technicians.create(tech), `Added technician ${tech.name}`);

  const updateTechnician: AppContextType['updateTechnician'] = async (id, updates) => {
    await apiCall('technicians', () => services.technicians.update(id, updates), 'Technician profile updated');
  };

  // Customers
  const addCustomer: AppContextType['addCustomer'] = (cust) =>
    apiCall('customers', () => services.customers.create(cust as Partial<Customer>), `Customer "${cust.name}" added successfully`);

  const updateCustomer: AppContextType['updateCustomer'] = async (id, updates) => {
    await apiCall('customers', () => services.customers.update(id, updates), 'Customer record updated');
  };

  const addCustomerLocation: AppContextType['addCustomerLocation'] = async (id, loc) => {
    await apiCall('customers', () => services.customers.addLocation(id, loc), `Added service site "${loc.label}"`);
  };

  const archiveCustomer = async (id: string) => {
    const c = customers.find((x) => x.id === id);
    await apiCall('customers', () => (c?.archived ? services.customers.unarchive(id) : services.customers.archive(id)), 'Customer archive status changed');
  };

  // Equipment
  const addEquipment: AppContextType['addEquipment'] = (eq) =>
    apiCall('equipment', () => services.equipment.create(eq), `Equipment ${eq.brand} ${eq.model} registered`);

  const updateEquipment: AppContextType['updateEquipment'] = async (id, updates) => {
    await apiCall('equipment', () => services.equipment.update(id, updates), 'Equipment details updated');
  };

  const addEquipmentServiceRecord: AppContextType['addEquipmentServiceRecord'] = async (equipmentId, record) => {
    await apiCall('equipment', () => services.equipment.addServiceRecord(equipmentId, record), 'Service record logged');
  };

  // Service Requests
  const addServiceRequest: AppContextType['addServiceRequest'] = async (sr) => {
    return apiCall('requests', () => services.requests.create(sr), 'Service request created');
  };

  const updateServiceRequest: AppContextType['updateServiceRequest'] = async (id, updates) => {
    await apiCall('requests', () => services.requests.update(id, updates), 'Service request updated');
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

  // Convert service request to job (server creates the job and marks the request converted)
  const convertRequestToJob: AppContextType['convertRequestToJob'] = async (requestId, appointmentDate, startTime, endTime, technicianId) => {
    try {
      const job = await services.requests.convert(requestId, { appointmentDate, startTime, endTime, technicianId: technicianId || null });
      await useDataStore.getState().run('jobs', async () => job);
      await useDataStore.getState().load('requests');
      showToast(`Converted request to Job ${job.jobNumber}`);
      return job;
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  // Jobs
  // Fields the server owns; never sent back.
  const serverOwned = ['id', 'jobNumber', 'createdAt', 'updatedAt', 'auditTrail', 'partsUsed', 'arrivalTime', 'completionTime', 'requestId'];
  const jobBody = (j: Partial<Job>) => Object.fromEntries(Object.entries(j).filter(([k]) => !serverOwned.includes(k))) as Partial<Job>;

  const addJob: AppContextType['addJob'] = (jobData) =>
    apiCall('jobs', () => services.jobs.create(jobBody(jobData)), 'Job created');

  // Status goes through its own endpoint (the server enforces the workflow); the rest is a plain PATCH.
  const updateJob: AppContextType['updateJob'] = async (id, updates, auditAction) => {
    const { status, ...rest } = updates;
    const patch = jobBody(rest);
    await apiCall('jobs', async () => {
      let job = Object.keys(patch).length ? await services.jobs.update(id, patch) : jobs.find((j) => j.id === id)!;
      if (status && status !== job.status) job = await services.jobs.setStatus(id, status, auditAction);
      return job;
    }, 'Job updated');
  };

  const updateJobStatus: AppContextType['updateJobStatus'] = async (id, newStatus, note, override) => {
    await apiCall('jobs', () => services.jobs.setStatus(id, newStatus, note, override), `Job marked as ${newStatus.replace('_', ' ')}`);
  };

  // Server records the part and writes the stock movement when inventory is enabled.
  const addJobPart: AppContextType['addJobPart'] = async (jobId, partId, quantity) => {
    const job = await apiCall('jobs', () => services.jobs.addPart(jobId, partId, quantity), 'Part added to job');
    if (job) await reloadStock(); // server decremented stock and wrote a movement
  };

  // Quotations
  // Server computes totals and numbering; a quote created as 'sent' is created then sent.
  const addQuotation: AppContextType['addQuotation'] = async (q) => {
    const { status, subtotal, vatAmount, total, ...body } = q;
    return apiCall('quotations', async () => {
      const draft = await services.quotations.create(body);
      return status === 'sent' ? services.quotations.send(draft.id) : draft;
    }, 'Quotation created');
  };

  const updateQuotation: AppContextType['updateQuotation'] = async (id, updates) => {
    await apiCall('quotations', () => services.quotations.update(id, updates), 'Quotation updated');
  };

  const acceptQuotation: AppContextType['acceptQuotation'] = async (id, acceptedBy) => {
    await apiCall('quotations', () => services.quotations.accept(id, acceptedBy), 'Customer acceptance recorded for quotation');
  };

  // The server creates the job / invoice and links it back on the quotation.
  const convertQuotationToJob: AppContextType['convertQuotationToJob'] = async (quoteId, appointmentDate, startTime, endTime, technicianId) => {
    const r = await apiCall('jobs', async () => {
      const { job, quotation } = await services.quotations.convertToJob(quoteId, { appointmentDate, startTime, endTime, technicianId: technicianId || null });
      await useDataStore.getState().run('quotations', async () => quotation);
      return job;
    }, 'Quotation converted into a job');
    return r;
  };

  const convertQuotationToInvoice: AppContextType['convertQuotationToInvoice'] = async (quoteId) => {
    try {
      const { invoice, quotation } = await services.quotations.convertToInvoice(quoteId);
      await useDataStore.getState().run('quotations', async () => quotation);
      await useDataStore.getState().run('invoices', async () => invoice);
      showToast(`Invoice ${invoice.invoiceNumber} generated from quotation`);
      return invoice;
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  // Invoices & Payments
  // Server computes totals, due date and numbering; only business fields are sent.
  const addInvoice: AppContextType['addInvoice'] = (inv) => {
    const { subtotal, vatAmount, total, payments, amountPaid, balanceDue, ...body } = inv;
    return apiCall('invoices', () => services.invoices.create(body), 'Invoice created');
  };

  const updateInvoice: AppContextType['updateInvoice'] = async (id, updates) => {
    const { subtotal, vatAmount, total, payments, amountPaid, balanceDue, status, ...body } = updates;
    await apiCall('invoices', () => services.invoices.update(id, body), 'Invoice updated');
  };

  const recordPayment: AppContextType['recordPayment'] = async (invoiceId, payment) => {
    const inv = await apiCall('invoices', () => services.invoices.pay(invoiceId, payment),
      `Recorded payment of £${payment.amount.toFixed(2)}`);
    return !!inv;
  };

  const generateInvoiceFromJob: AppContextType['generateInvoiceFromJob'] = (jobId) =>
    apiCall('invoices', () => services.jobs.invoice(jobId), 'Invoice generated from job');

  // Parts & Inventory
  const reloadStock = () => Promise.all([useDataStore.getState().load('parts'), useDataStore.getState().load('movements')]);

  const addPart: AppContextType['addPart'] = async (part) => {
    const created = await apiCall('parts', () => services.parts.create(part), `Added part item "${part.name}"`);
    if (created) await useDataStore.getState().load('movements'); // opening stock is a ledger entry
    return created;
  };

  const updatePart: AppContextType['updatePart'] = async (id, updates) => {
    await apiCall('parts', () => services.parts.update(id, updates), 'Part updated');
  };

  // Server applies the delta, rejects negative stock, and appends the ledger entry.
  const adjustStock = async (
    partId: string,
    delta: number,
    type: 'used_on_job' | 'stock_adjustment' | 'restock_purchase',
    notes: string,
    jobId?: string
  ) => {
    try {
      const { part, movement } = await services.parts.adjust(partId, { delta, type, notes, jobId });
      await useDataStore.getState().run('parts', async () => part);
      await useDataStore.getState().run('movements', async () => movement);
      showToast(`Stock updated for ${part.name}: new qty ${part.stockQuantity}`);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  // Notifications
  // Server checks GDPR consent and channel preference, and records who approved the send.
  const createNotification: AppContextType['createNotification'] = (notif) => {
    const { sentAt, approvedBy, ...body } = notif;
    return apiCall('notifications', () => services.notifications.create(body), 'Notification created');
  };

  const sendNotification: AppContextType['sendNotification'] = async (id) => {
    const n = await apiCall('notifications', () => services.notifications.approveSend(id), 'Customer notification sent successfully');
    if (n?.status === 'failed') showToast('Notification delivery failed', 'error');
    return n;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchUserRole,
        users,
        realAuth: REAL_AUTH,
        logout,
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
        addCustomerLocation,
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
        addJobPart,
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

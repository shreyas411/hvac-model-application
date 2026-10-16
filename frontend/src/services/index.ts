import type {
  CompanySettings,
  ChecklistTemplate,
  Customer, CustomerNotification, MaintenanceAgreement, Equipment, EquipmentServiceRecord, InventoryMovement, Invoice, Job, JobStatus,
  PartItem, PaymentRecord, Quotation, ServiceLocation, ServiceRequest, TechnicianProfile,
} from '../types';
import { api } from './api';

/** Follows nextCursor so a list is never silently cut at one page. */
async function listAll<T>(path: string) {
  const out: T[] = [];
  for (let cursor = ''; ; ) {
    const r = await api<{ data: T[]; nextCursor: string | null }>('GET', `${path}?limit=200${cursor && `&cursor=${cursor}`}`);
    out.push(...r.data);
    if (!r.nextCursor) return out;
    cursor = r.nextCursor;
  }
}

const resource = <T extends { id: string }>(path: string) => ({
  list: () => listAll<T>(path),
  get: (id: string) => api<T>('GET', `${path}/${id}`),
  create: (body: Partial<T>) => api<T>('POST', path, body),
  update: (id: string, body: Partial<T>) => api<T>('PATCH', `${path}/${id}`, body),
});
const post = <T,>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});

/** Every backend call the UI makes lives here. Components never call fetch. */
export const services = {
  technicians: resource<TechnicianProfile>('/technicians'),
  customers: {
    ...resource<Customer>('/customers'),
    archive: (id: string) => post<Customer>(`/customers/${id}/archive`),
    unarchive: (id: string) => post<Customer>(`/customers/${id}/unarchive`),
    addLocation: (id: string, loc: Omit<ServiceLocation, 'id'>) => post<Customer>(`/customers/${id}/locations`, loc),
  },
  equipment: {
    ...resource<Equipment>('/equipment'),
    addServiceRecord: (id: string, rec: Omit<EquipmentServiceRecord, 'id'>) => post<Equipment>(`/equipment/${id}/service-records`, rec),
  },
  requests: {
    ...resource<ServiceRequest>('/requests'),
    convert: (id: string, slot: object) => post<Job>(`/requests/${id}/convert`, slot),
  },
  jobs: {
    ...resource<Job>('/jobs'),
    setStatus: (id: string, status: JobStatus, note?: string, override?: boolean) => post<Job>(`/jobs/${id}/status`, { status, note, override }),
    invoice: (id: string) => post<Invoice>(`/jobs/${id}/invoice`),
    addPart: (id: string, partId: string, quantity: number) => post<Job>(`/jobs/${id}/parts`, { partId, quantity }),
  },
  quotations: {
    ...resource<Quotation>('/quotations'),
    send: (id: string) => post<Quotation>(`/quotations/${id}/send`),
    reject: (id: string) => post<Quotation>(`/quotations/${id}/reject`),
    accept: (id: string, acceptedBy: string) => post<Quotation>(`/quotations/${id}/accept`, { acceptedBy }),
    convertToJob: (id: string, slot: object) => post<{ job: Job; quotation: Quotation }>(`/quotations/${id}/convert-to-job`, slot),
    convertToInvoice: (id: string) => post<{ invoice: Invoice; quotation: Quotation }>(`/quotations/${id}/convert-to-invoice`),
  },
  invoices: {
    ...resource<Invoice>('/invoices'),
    pay: (id: string, p: Omit<PaymentRecord, 'id' | 'recordedBy'>) => post<Invoice>(`/invoices/${id}/payments`, p),
    issue: (id: string) => post<Invoice>(`/invoices/${id}/issue`),
    void: (id: string, reason: string) => post<Invoice>(`/invoices/${id}/void`, { reason }),
    credit: (id: string, amount: number, reason: string) => post<{ invoice: Invoice }>(`/invoices/${id}/credit-notes`, { amount, reason }),
  },
  parts: {
    ...resource<PartItem>('/parts'),
    adjust: (id: string, body: object) => post<{ part: PartItem; movement: InventoryMovement }>(`/parts/${id}/adjust`, body),
  },
  movements: { list: () => listAll<InventoryMovement>('/movements') },
  notifications: {
    ...resource<CustomerNotification>('/notifications'),
    approveSend: (id: string) => post<CustomerNotification>(`/notifications/${id}/approve-send`),
  },
  maintenance: {
    ...resource<MaintenanceAgreement>('/maintenance-agreements'),
    remove: (id: string) => api<void>('DELETE', `/maintenance-agreements/${id}`),
  },
  checklistTemplates: {
    ...resource<ChecklistTemplate>('/checklist-templates'),
    remove: (id: string) => api<void>('DELETE', `/checklist-templates/${id}`),
    reorder: (ids: string[]) => post<void>('/checklist-templates/reorder', { ids }),
  },
  settings: {
    get: () => api<CompanySettings>('GET', '/settings'),
    update: (body: Partial<CompanySettings>) => api<CompanySettings>('PATCH', '/settings', body),
  },
  data: {
    export: () => api<Record<string, unknown>>('GET', '/export'),
    import: (body: unknown) => api<{ imported: Record<string, number> }>('POST', '/import?confirm=wipe', body),
  },
  dashboard: () => api('GET', '/dashboard'),
};

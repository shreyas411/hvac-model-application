import type {
  CompanySettings,
  ChecklistTemplate,
  Customer, CustomerNotification, MaintenanceAgreement, Equipment, EquipmentServiceRecord, InventoryMovement, Invoice, Job, JobStatus,
  PartItem, PaymentRecord, Quotation, ServiceLocation, ServiceRequest, TechnicianProfile,
} from '../types';
import { api, apiBlob } from './api';

export interface AuditEntry { id: string; entity: string; entityId: string; action: string; details: string; userName: string; timestamp: string }

export interface JobPhoto { id: string; jobId: string; caption: string; takenBy: string; createdAt: string; mime: string }
export type CertificateType = 'cp12' | 'service_record' | 'commissioning';
export interface Certificate {
  id: string; certNumber: string; type: CertificateType; jobId?: string; customerId: string; locationId: string; technicianId: string;
  engineerName: string; gasSafeNumber: string; issueDate: string; expiryDate?: string; expired?: boolean; data: Record<string, any>;
}

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
  /** Soft delete: the server hides the record and refuses (409 IN_USE) while it is still referenced. */
  remove: (id: string) => api<void>('DELETE', `${path}/${id}`),
});
const post = <T,>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
/** One request for many records: the server loops and reports each id, so a failure never stops the rest. */
export type BulkResults = { results: { id: string; ok: boolean; error?: { code?: string; message: string } }[] };
const bulkPost = (path: string, body: object) => post<BulkResults>(path, body);

/** Every backend call the UI makes lives here. Components never call fetch. */
export const services = {
  certificates: {
    expiring: (days = 60) => api<Certificate[]>('GET', `/certificates/expiring?days=${days}`),
    issue: (body: object) => api<Certificate>('POST', '/certificates', body),
    pdf: (id: string) => apiBlob(`/certificates/${id}/pdf`),
    remove: (id: string) => api<void>('DELETE', `/certificates/${id}`),
    bulkDelete: (ids: string[]) => bulkPost('/certificates/bulk-delete', { ids }),
  },
  technicians: resource<TechnicianProfile>('/technicians'),
  customers: {
    ...resource<Customer>('/customers'),
    archive: (id: string) => post<Customer>(`/customers/${id}/archive`),
    unarchive: (id: string) => post<Customer>(`/customers/${id}/unarchive`),
    bulkArchive: (ids: string[], archived: boolean) => bulkPost('/customers/bulk-archive', { ids, archived }),
    updateLocation: (id: string, locId: string, loc: Partial<Omit<ServiceLocation, 'id'>>) => api<Customer>('PATCH', `/customers/${id}/locations/${locId}`, loc),
    removeLocation: (id: string, locId: string) => api<Customer>('DELETE', `/customers/${id}/locations/${locId}`),
    addLocation: (id: string, loc: Omit<ServiceLocation, 'id'>) => post<Customer>(`/customers/${id}/locations`, loc),
  },
  equipment: {
    ...resource<Equipment>('/equipment'),
    bulkSetInactive: (ids: string[], inactive: boolean) => bulkPost('/equipment/bulk-update', { ids, inactive }),
    addServiceRecord: (id: string, rec: Omit<EquipmentServiceRecord, 'id'>) => post<Equipment>(`/equipment/${id}/service-records`, rec),
  },
  requests: {
    ...resource<ServiceRequest>('/requests'),
    convert: (id: string, slot: object) => post<Job>(`/requests/${id}/convert`, slot),
    bulkCancel: (ids: string[]) => bulkPost('/requests/bulk-cancel', { ids }),
  },
  jobs: {
    ...resource<Job>('/jobs'),
    setStatus: (id: string, status: JobStatus, note?: string, override?: boolean) => post<Job>(`/jobs/${id}/status`, { status, note, override }),
    bulkAssign: (jobIds: string[], technicianId: string | null) => post<BulkResults>('/jobs/bulk-assign', { jobIds, technicianId }),
    bulkSetStatus: (jobIds: string[], status: JobStatus) => bulkPost('/jobs/bulk-status', { jobIds, status }),
    invoice: (id: string, vatRatePercent: number) => post<Invoice>(`/jobs/${id}/invoice`, { vatRatePercent }),
    addPart: (id: string, partId: string, quantity: number) => post<Job>(`/jobs/${id}/parts`, { partId, quantity }),
    addRefrigerant: (id: string, body: object) => post<Job>(`/jobs/${id}/refrigerant`, body),
    photos: (id: string) => api<JobPhoto[]>('GET', `/jobs/${id}/photos`),
    addPhoto: (id: string, dataUrl: string, caption: string) => post<JobPhoto>(`/jobs/${id}/photos`, { dataUrl, caption }),
    removePhoto: (id: string, photoId: string) => api('DELETE', `/jobs/${id}/photos/${photoId}`),
    photoBlob: (id: string, photoId: string) => apiBlob(`/jobs/${id}/photos/${photoId}`),
  },
  quotations: {
    ...resource<Quotation>('/quotations'),
    send: (id: string) => post<Quotation>(`/quotations/${id}/send`),
    reject: (id: string) => post<Quotation>(`/quotations/${id}/reject`),
    bulk: (action: 'send' | 'reject', ids: string[]) => bulkPost(`/quotations/bulk-${action}`, { ids }),
    accept: (id: string, acceptedBy: string, option?: string) => post<Quotation>(`/quotations/${id}/accept`, { acceptedBy, option }),
    convertToJob: (id: string, slot: object) => post<{ job: Job; quotation: Quotation }>(`/quotations/${id}/convert-to-job`, slot),
    convertToInvoice: (id: string) => post<{ invoice: Invoice; quotation: Quotation }>(`/quotations/${id}/convert-to-invoice`),
  },
  invoices: {
    ...resource<Invoice>('/invoices'),
    pay: (id: string, p: Omit<PaymentRecord, 'id' | 'recordedBy'>) => post<Invoice>(`/invoices/${id}/payments`, p),
    issue: (id: string) => post<Invoice>(`/invoices/${id}/issue`),
    bulkIssue: (ids: string[]) => bulkPost('/invoices/bulk-issue', { ids }),
    stage: (b: { quoteId: string; percent?: number; final?: boolean; label?: string }) => post<Invoice>('/invoices/stage', b),
    releaseRetention: (id: string) => post<Invoice>(`/invoices/${id}/release-retention`),
    refund: (id: string, paymentId: string, reason: string) => post<Invoice>(`/invoices/${id}/payments/${paymentId}/refund`, { reason }),
    void: (id: string, reason: string) => post<Invoice>(`/invoices/${id}/void`, { reason }),
    credit: (id: string, amount: number, reason: string) => post<{ invoice: Invoice }>(`/invoices/${id}/credit-notes`, { amount, reason }),
  },
  parts: {
    ...resource<PartItem>('/parts'),
    bulkSetInactive: (ids: string[], inactive: boolean) => bulkPost('/parts/bulk-update', { ids, inactive }),
    bulkDelete: (ids: string[]) => bulkPost('/parts/bulk-delete', { ids }),
  adjust: (id: string, body: object) => post<{ part: PartItem; movement: InventoryMovement }>(`/parts/${id}/adjust`, body),
  },
  movements: { list: () => listAll<InventoryMovement>('/movements') },
  notifications: {
    ...resource<CustomerNotification>('/notifications'),
    approveSend: (id: string) => post<CustomerNotification>(`/notifications/${id}/approve-send`),
    bulkApproveSend: (ids: string[]) => bulkPost('/notifications/bulk-approve-send', { ids }),
  },
  maintenance: {
    ...resource<MaintenanceAgreement>('/maintenance-agreements'),
    bulkSetActive: (ids: string[], active: boolean) => bulkPost('/maintenance-agreements/bulk-update', { ids, active }),
    bulkDelete: (ids: string[]) => bulkPost('/maintenance-agreements/bulk-delete', { ids }),
  },
  checklistTemplates: {
    ...resource<ChecklistTemplate>('/checklist-templates'),
    reorder: (ids: string[]) => post<void>('/checklist-templates/reorder', { ids }),
  },
  settings: {
    get: () => api<CompanySettings>('GET', '/settings'),
    update: (body: Partial<CompanySettings>) => api<CompanySettings>('PATCH', '/settings', body),
  },
  data: {
    export: () => api<Record<string, unknown>>('GET', '/export'),
  },
  dashboard: () => api('GET', '/dashboard'),
};

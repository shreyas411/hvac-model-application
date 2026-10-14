// ponytail: in-memory repository, state is lost on restart and not shared across processes.
// Replace this file's Repo with Prisma-backed repos (same method names, made async) when the DB exists.
import { randomUUID } from 'node:crypto';
import type {
  CompanySettings, Customer, CustomerNotification, Equipment, InventoryMovement, Invoice, Job,
  PartItem, Quotation, ServiceRequest, TechnicianProfile, User,
} from '../types.js';
import { ApiError, notFound } from './errors.js';

type New<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string };

export class Repo<T extends { id: string }> {
  private m = new Map<string, T>();
  /** Newest first. */
  all = (): T[] => [...this.m.values()].reverse();
  find = (id: string) => this.m.get(id);
  insert(row: New<T>): T {
    const now = new Date().toISOString();
    const full = { createdAt: now, updatedAt: now, ...row, id: row.id ?? randomUUID() } as unknown as T;
    this.m.set(full.id, full);
    return full;
  }
  update(id: string, patch: Partial<T>): T {
    const cur = this.m.get(id);
    if (!cur) throw notFound('Record');
    const next = { ...cur, ...patch, id, updatedAt: new Date().toISOString() };
    this.m.set(id, next);
    return next;
  }
  remove = (id: string) => this.m.delete(id);
  clear = () => this.m.clear();
}

export const db = {
  users: new Repo<User>(),
  technicians: new Repo<TechnicianProfile>(),
  customers: new Repo<Customer>(),
  equipment: new Repo<Equipment>(),
  requests: new Repo<ServiceRequest>(),
  jobs: new Repo<Job>(),
  quotations: new Repo<Quotation>(),
  invoices: new Repo<Invoice>(),
  parts: new Repo<PartItem>(),
  movements: new Repo<InventoryMovement>(),
  notifications: new Repo<CustomerNotification>(),
  settings: {
    companyName: 'My HVAC Company', tradingName: '', gasSafeRegisterNo: '', fGasCertNo: '', vatNumber: '',
    companyNumber: '', email: '', phone: '', addressLine1: '', city: '', postcode: '', website: '',
    currencySymbol: '£', defaultVatRate: 20, availableVatRates: [20, 5, 0],
    workingHoursStart: '08:00', workingHoursEnd: '17:30', enableInventory: true,
    prefixJob: 'JOB-', prefixQuote: 'QTE-', prefixInvoice: 'INV-',
    bankDetails: { bankName: '', accountName: '', sortCode: '', accountNumber: '' },
    termsAndConditions: 'Payment due within 14 days of invoice issue.',
  } as CompanySettings,
};

export const must = <T extends { id: string }>(repo: Repo<T>, id: string | undefined | null, what: string): T => {
  const row = id ? repo.find(id) : undefined;
  if (!row) throw new ApiError(404, 'NOT_FOUND', `${what} not found`);
  return row;
};

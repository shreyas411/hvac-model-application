export type UserRole = 'admin' | 'dispatcher' | 'technician' | 'accountant';

export interface User {
  inactive?: boolean;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  avatar?: string;
  technicianId?: string; // Links to technician profile if role === 'technician'
}

export interface TechnicianProfile {
  expired?: boolean; // Gas Safe / F-Gas licence has lapsed
  id: string;
  name: string;
  phone: string;
  email: string;
  gasSafeLicense?: string;
  fGasLicense?: string;
  gasSafeExpiry?: string;
  fGasExpiry?: string;
  skills: string[]; // e.g. ['Domestic Gas', 'Commercial Gas', 'F-Gas Heat Pumps', 'VRF Air Conditioning']
  color: string; // for calendar display
  active: boolean;
  vanRegistration?: string;
}

export type CustomerType = 'residential' | 'commercial' | 'landlord';

export interface ServiceLocation {
  inactive?: boolean;
  id: string;
  label: string; // e.g., 'Primary Residence', 'Branch Office', 'Plant Room'
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  accessNotes?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
  };
  serviceLocations: ServiceLocation[];
  notes?: string;
  communicationPreference: 'email' | 'sms' | 'both';
  gdprConsent: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EquipmentType = 
  | 'combi_boiler' 
  | 'system_boiler' 
  | 'heat_pump' 
  | 'air_conditioning' 
  | 'ventilation' 
  | 'chiller';

export interface EquipmentReading {
  flowTempC?: number;
  returnTempC?: number;
  pressureBar?: number;
  coPpm?: number;
  co2Percent?: number;
  refrigerantPsi?: number;
  deltaTC?: number;
}

export interface EquipmentServiceRecord {
  id: string;
  date: string;
  jobId: string;
  technicianName: string;
  serviceType: string;
  findings: string;
  readings?: EquipmentReading;
  partsReplaced: string[];
  recommendations?: string;
}

export interface Equipment {
  inactive?: boolean;
  expired?: boolean; // warranty has run out
  id: string;
  customerId: string;
  locationId: string;
  type: EquipmentType;
  brand: string;
  model: string;
  serialNumber: string;
  refrigerantType?: string | null;
  refrigerantChargeKg?: number | null;
  installationDate: string;
  warrantyExpiryDate: string;
  maintenanceFrequency: 'quarterly' | 'biannual' | 'annual';
  lastServiceDate?: string;
  nextServiceDueDate: string;
  status: 'operational' | 'requires_attention' | 'decommissioned';
  locationNotes?: string;
  serviceHistory: EquipmentServiceRecord[];
}

export type Priority = 'low' | 'medium' | 'high' | 'emergency';

export type ServiceRequestStatus = 'new' | 'awaiting_approval' | 'converted' | 'cancelled';

export interface ServiceRequest {
  id: string;
  requestNumber: string;
  customerId: string;
  locationId: string;
  equipmentId?: string;
  reportedProblem: string;
  priority: Priority;
  preferredSlot: 'morning' | 'afternoon' | 'all_day' | 'urgent';
  status: ServiceRequestStatus;
  contactPerson?: string;
  contactPhone?: string;
  internalNotes?: string;
  convertedJobId?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobType = 
  | 'installation' 
  | 'repair' 
  | 'inspection' 
  | 'emergency_callout' 
  | 'preventive_maintenance';

export type JobStatus = 
  | 'new' 
  | 'awaiting_approval' 
  | 'scheduled' 
  | 'dispatched' 
  | 'in_progress' 
  | 'on_hold' 
  | 'completed' 
  | 'cancelled';

export interface JobPartUsed {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
}

export interface AuditLog {
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  category: 'gas_safety' | 'electrical' | 'refrigerant' | 'general';
  checked: boolean;
  notes?: string;
}

/** Name, phone and address the API attaches to every job; technicians can't read /customers, so this is all they get. */
export interface JobSite {
  customerName: string; customerPhone: string;
  addressLine1: string; addressLine2?: string | null; city: string; postcode: string;
  accessNotes?: string | null; contactName?: string | null; contactPhone?: string | null;
}

export interface Job {
  id: string;
  site?: JobSite;
  slaDueAt?: string;
  slaBreached?: boolean; // contract response time passed while the job is still `new`
  jobNumber: string;
  title: string;
  requestId?: string;
  customerId: string;
  locationId: string;
  equipmentIds: string[];
  refrigerantLogs?: RefrigerantLogEntry[];
  type: JobType;
  priority: Priority;
  status: JobStatus;
  technicianId: string | null;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  estimatedDurationMinutes: number;
  requiredSkills: string[];
  description: string;
  internalNotes?: string;
  workPerformed?: string;
  partsUsed: JobPartUsed[];
  labourHours: number;
  hourlyRate: number;
  travelTimeMinutes: number;
  travelCharge: number;
  customerSignature?: {
    name: string;
    dataUrl: string;
    signedAt: string;
  };
  auditTrail: AuditLog[];
  checklist: JobChecklistItem[];
  followUpRecommended?: boolean;
  followUpNotes?: string;
  arrivalTime?: string;
  completionTime?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

export interface LineItem {
  id: string;
  type: 'labour' | 'part' | 'equipment' | 'travel' | 'discount' | 'fee';
  description: string;
  quantity: number;
  unitPrice: number;
  vatRatePercent?: number;
  option?: string; // quotation tier (Good/Better/Best); unset lines apply to every tier
  amount: number;
}

export interface Quotation {
  expired?: boolean; // past its expiry date without being accepted
  id: string;
  quoteNumber: string;
  customerId: string;
  locationId: string;
  jobId?: string;
  issueDate: string;
  expiryDate: string;
  status: QuotationStatus;
  items: LineItem[];
  subtotal: number;
  vatRatePercent: number;
  vatAmount: number;
  total: number;
  terms: string;
  notes?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  convertedToJobId?: string;
  convertedToInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void' | 'credited';

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'bacs' | 'card' | 'cheque' | 'cash';
  reference: string;
  recordedBy: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quoteId?: string;
  jobId?: string;
  customerId: string;
  locationId: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: LineItem[];
  subtotal: number;
  vatRatePercent: number;
  vatAmount: number;
  total: number;
  payments: PaymentRecord[];
  amountPaid: number;
  balanceDue: number;
  paymentTermsDays: number;
  notes?: string;
  reverseCharge?: boolean;
  cisRatePercent?: number;
  cisDeduction?: number;
  retentionPercent?: number;
  retentionHeld?: number;
  stageLabel?: string | null;
  stagePercent?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartItem {
  inactive?: boolean;
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  unitCost: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  location: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  partId: string;
  type: 'used_on_job' | 'stock_adjustment' | 'restock_purchase';
  quantityDelta: number;
  jobId?: string;
  notes: string;
  timestamp: string;
  userName: string;
}

export interface CustomerNotification {
  id: string;
  customerId: string;
  type: 'booking_confirmation' | 'appointment_reminder' | 'technician_arriving' | 'quotation_ready' | 'invoice_issued' | 'payment_reminder';
  recipient: string;
  channel: 'email' | 'sms';
  subject: string;
  messageBody: string;
  status: 'draft' | 'ready_to_send' | 'sending' | 'sent' | 'failed';
  sentAt?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  tradingName: string;
  gasSafeRegisterNo: string;
  fGasCertNo: string;
  vatNumber: string;
  companyNumber: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  postcode: string;
  website: string;
  currencySymbol: string;
  defaultVatRate: number; defaultHourlyRate: number; defaultTravelCharge: number;
  availableVatRates: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  enableInventory: boolean;
  autoSendEmails: boolean;
  prefixJob: string;
  prefixQuote: string;
  prefixInvoice: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    sortCode: string;
    accountNumber: string;
    iban?: string;
  };
  termsAndConditions: string;
}

export interface ChecklistTemplate {
  inactive?: boolean;
  id: string;
  jobType: JobType;
  label: string;
  category: JobChecklistItem['category'];
}

export interface RefrigerantLogEntry {
  id: string; equipmentId?: string; refrigerant: string; action: 'charge' | 'recover' | 'reclaim' | 'leak_check';
  amountKg: number; cylinderId: string; certNumber: string; notes?: string; createdBy: string; createdAt: string;
}

export interface MaintenanceAgreement {
  id: string;
  customerId: string;
  locationId: string;
  equipmentId?: string | null;
  frequency: 'quarterly' | 'biannual' | 'annual';
  nextDueDate: string;
  active: boolean;
  notes?: string | null;
  annualPrice: number;
  endDate?: string | null;
  slaResponseHours?: number | null;
  autoInvoice: boolean;
  autoRenew: boolean;
}

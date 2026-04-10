// ─────────────────────────────────────────────────────────────────────────────
// FSM Standalone — Core TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

export type Role =
  | 'ADMIN'
  | 'MANAGER'
  | 'DISPATCHER'
  | 'COORDINATOR'
  | 'TECHNICIAN'
  | 'BILLING'
  | 'EXECUTIVE';

export type Workspace = 'SERVICE' | 'INSTALLATION';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  workspace: Workspace;
  avatarInitials: string;
  technicianId?: string; // if role === TECHNICIAN
}

// ── Job / Work Order ──────────────────────────────────────────────────────────

export type JobStatus =
  | 'NEW'
  | 'SCHEDULED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'READY_FOR_SIGNATURE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'BILLING_READY'
  | 'INVOICED';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ServiceType =
  | 'INSTALLATION'
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'INSPECTION'
  | 'WARRANTY_REPAIR'
  | 'EMERGENCY'
  | 'PREVENTIVE_MAINTENANCE'
  | 'DECOMMISSION';

export type JobCategory = 'SERVICE' | 'INSTALLATION';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  full?: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  status: JobStatus;
  priority: Priority;
  serviceType: ServiceType;
  category: JobCategory;
  description: string;
  internalNotes?: string;
  customerId: string;
  customerName: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  serviceAddress: Address;
  technicianId?: string;
  technicianName?: string;
  technicianSecondaryId?: string;
  scheduledDate?: string; // ISO date string
  scheduledStart?: string; // HH:mm
  scheduledEnd?: string;   // HH:mm
  estimatedDuration?: number; // hours
  actualStart?: string;    // ISO datetime
  actualEnd?: string;
  actualDuration?: number;
  salesOrderId?: string;
  salesOrderNumber?: string;
  billingCode?: string;
  billingReady?: boolean;
  billingHold?: boolean;
  billingHoldReason?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  billableAmount?: number;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  warranty?: boolean;
  warrantyRef?: string;
  slaBreached?: boolean;
  followUpRequired?: boolean;
  followUpNotes?: string;
  resolution?: string;
  completionSignedBy?: string;
  completionSignature?: string; // base64
  techSignature?: string;
  assetId?: string;
  assetName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  // Local state
  _dirty?: boolean;
  _syncPending?: boolean;
}

// ── Customer ──────────────────────────────────────────────────────────────────

export interface CustomerAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
  isShipping: boolean;
  isBilling: boolean;
}

export interface Customer {
  id: string;
  entityId: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  website?: string;
  accountNumber?: string;
  addresses: CustomerAddress[];
  defaultAddress?: string;
  isActive: boolean;
  category?: string;
  createdAt: string;
  notes?: string;
  _dirty?: boolean;
}

// ── Sales Order ───────────────────────────────────────────────────────────────

export interface SOLine {
  id: string;
  itemId: string;
  itemName: string;
  description?: string;
  quantity: number;
  rate: number;
  amount: number;
  isClosed?: boolean;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  customerName: string;
  linkedJobId?: string;
  linkedJobNumber?: string;
  status: string;
  memo?: string;
  tranDate: string;
  dueDate?: string;
  lines: SOLine[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  amountPaid?: number;
  balance?: number;
  paymentMode?: string;
  billingCode?: string;
  billingHold?: boolean;
  billingHoldReason?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  terms?: string;
  updatedAt?: string;
  createdAt: string;
  _dirty?: boolean;
}

// ── Technician ────────────────────────────────────────────────────────────────

export type TechStatus = 'AVAILABLE' | 'ON_JOB' | 'ON_BREAK' | 'OFF_DUTY' | 'UNAVAILABLE';

export interface Technician {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  category: JobCategory;
  skills: string[];
  status: TechStatus;
  region?: string;
  avatarInitials: string;
  color: string; // for dispatch board
  currentJobId?: string;
  certifications?: string[];
  _dirty?: boolean;
}

// ── Time Entry ────────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  jobId: string;
  technicianId: string;
  technicianName: string;
  type: 'REGULAR' | 'TRAVEL' | 'OVERTIME' | 'EMERGENCY' | 'TRAINING' | 'ADMINISTRATIVE';
  date: string;
  startTime: string;
  endTime?: string;
  duration: number; // hours
  notes?: string;
  billable: boolean;
  _dirty?: boolean;
}

// ── Parts / Materials ─────────────────────────────────────────────────────────

export interface Part {
  id: string;
  jobId: string;
  itemId: string;
  itemName: string;
  partNumber?: string;
  description?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier?: string;
  serialNumber?: string;
  warranty?: boolean;
  installedDate?: string;
  _dirty?: boolean;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export type NoteType = 'INTERNAL' | 'CUSTOMER' | 'TECHNICIAN' | 'ACTIVITY' | 'BILLING';
export type NoteVisibility = 'PUBLIC' | 'INTERNAL' | 'TECHNICIAN_ONLY';

export interface JobNote {
  id: string;
  jobId: string;
  text: string;
  type: NoteType;
  visibility: NoteVisibility;
  authorId: string;
  authorName: string;
  createdAt: string;
  _dirty?: boolean;
}

// ── File / Attachment ─────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  customerId?: string;
  jobId?: string;
  jobNumber?: string;
  soId?: string;
  soNumber?: string;
  name: string;
  type: string; // mime type
  size: number;
  url: string;
  source: 'JOB' | 'SALES_ORDER';
  uploadedBy: string;
  createdAt: string;
  _dirty?: boolean;
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  order: number;
  type: 'CHECKBOX' | 'TEXT' | 'SIGNATURE' | 'PHOTO';
}

export interface ChecklistResponse {
  id: string;
  jobId: string;
  itemId: string;
  checked: boolean;
  notes?: string;
  technicianId?: string;
  completedAt?: string;
  _dirty?: boolean;
}

// ── Asset ─────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  equipmentTypeId: string;
  equipmentType: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  installDate?: string;
  warrantyExpiry?: string;
  status: 'ACTIVE' | 'IN_SERVICE' | 'DECOMMISSIONED' | 'RETIRED';
  location?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  notes?: string;
}

// ── Service History ───────────────────────────────────────────────────────────

export interface ServiceHistoryEntry {
  id: string;
  jobId: string;
  jobNumber: string;
  date: string;
  type: ServiceType;
  summary: string;
  technicianName: string;
  duration?: number;
  parts?: number; // count
  resolution?: string;
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  jobsToday: number;
  jobsOpen: number;
  jobsCompleted: number;
  jobsOverdue: number;
  techsAvailable: number;
  techsOnJob: number;
  soThisMonth: number;
  revenueThisMonth: number;
  avgJobDuration: number;
  slaBreachRate: number;
  jobsByStatus: Record<string, number>;
  jobsByType: Record<string, number>;
  revenueByWeek: Array<{ week: string; amount: number }>;
  jobsByTech: Array<{ name: string; count: number }>;
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';

export interface SyncState {
  lastSync?: string;
  status: SyncStatus;
  pendingChanges: number;
  error?: string;
  source?: 'LOCAL' | 'SUPABASE';
}

// ── Filter / Search ───────────────────────────────────────────────────────────

export interface JobFilters {
  status?: JobStatus[];
  priority?: Priority[];
  serviceType?: ServiceType[];
  technicianId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  search?: string;
}

export interface SearchResult {
  type: 'JOB' | 'CUSTOMER' | 'SALES_ORDER';
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
  url: string;
}

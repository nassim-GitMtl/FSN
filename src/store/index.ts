import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User, Job, Customer, SalesOrder, Technician, Asset,
  JobNote, TimeEntry, Part, Attachment, ChecklistItem, ChecklistResponse, ServiceHistoryEntry,
  JobFilters, JobStatus, Workspace, SyncState, DashboardKPIs,
} from '@/types';
import {
  fetchSupabaseBootstrap,
  isSupabaseConfigured,
  syncSupabaseSnapshot,
  type SupabaseBootstrapPayload,
  type SupabaseSyncSnapshot,
} from '@/lib/supabase';
import type { AppLanguage } from '@/lib/app-language';
import type { AppTheme } from '@/lib/app-theme';

const LABOR_RATE_BY_TYPE: Record<TimeEntry['type'], number> = {
  REGULAR: 125,
  TRAVEL: 75,
  OVERTIME: 160,
  EMERGENCY: 180,
  TRAINING: 95,
  ADMINISTRATIVE: 65,
};

function calculateJobFinancials(job: Job, timeEntries: TimeEntry[], parts: Part[]) {
  const relatedTimeEntries = timeEntries.filter((entry) => entry.jobId === job.id);
  const relatedParts = parts.filter((part) => part.jobId === job.id);

  const laborCost = relatedTimeEntries.reduce((sum, entry) => {
    if (!entry.billable) {
      return sum;
    }

    return sum + (entry.duration * LABOR_RATE_BY_TYPE[entry.type]);
  }, 0);

  const partsCost = relatedParts.reduce((sum, part) => sum + (part.totalCost || 0), 0);
  const totalCost = laborCost + partsCost;

  return {
    laborCost: Math.round(laborCost * 100) / 100,
    partsCost: Math.round(partsCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    billableAmount: job.warranty ? 0 : Math.round(totalCost * 100) / 100,
  };
}

function getTimeEntriesForJob(timeEntries: TimeEntry[], jobId: string) {
  return timeEntries.filter((entry) => entry.jobId === jobId);
}

function createRecordId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createRecordNumber(prefix: string) {
  return `${prefix}-${String(Date.now()).slice(-6)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH STORE
// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  workspace: Workspace;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  switchWorkspace: (ws: Workspace) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      workspace: 'SERVICE',
      isAuthenticated: false,
      login: (user) => set({ user, workspace: user.workspace, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      switchWorkspace: (workspace) => set((s) => ({
        workspace,
        user: s.user ? { ...s.user, workspace } : null,
      })),
    }),
    { name: 'fsm-auth', partialize: (s) => ({ user: s.user, workspace: s.workspace, isAuthenticated: s.isAuthenticated }) }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// JOB STORE
// ─────────────────────────────────────────────────────────────────────────────

interface JobState {
  jobs: Job[];
  filters: JobFilters;
  selectedJobId: string | null;
  isLoading: boolean;

  // CRUD
  getJob: (id: string) => Job | undefined;
  getJobsForTech: (techId: string) => Job[];
  getJobsForCustomer: (customerId: string) => Job[];
  createJob: (data: Partial<Job>) => Job;
  updateJob: (id: string, data: Partial<Job>) => void;
  assignTechnician: (jobId: string, techId: string, techName: string) => void;
  updateStatus: (jobId: string, status: JobStatus) => void;
  rescheduleJob: (jobId: string, data: { scheduledDate: string; scheduledStart?: string; scheduledEnd?: string; reason?: string }) => void;
  markBillingReady: (jobId: string) => void;
  setBillingHold: (jobId: string, reason: string) => void;
  removeBillingHold: (jobId: string) => void;
  generateInvoice: (jobId: string) => { invoiceNumber: string } | null;
  bulkMarkBillingReady: (jobIds: string[]) => number;
  bulkGenerateInvoices: (jobIds: string[]) => number;

  // Filters
  setFilters: (f: Partial<JobFilters>) => void;
  clearFilters: () => void;
  getFilteredJobs: (workspace: Workspace) => Job[];

  // Notes
  notes: JobNote[];
  getNotes: (jobId: string) => JobNote[];
  addNote: (
    jobId: string,
    text: string,
    type: string,
    authorId: string,
    authorName: string,
    options?: { createdAt?: string; visibility?: JobNote['visibility'] },
  ) => JobNote;

  // Time entries
  timeEntries: TimeEntry[];
  getTimeEntries: (jobId: string) => TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;

  // Parts
  parts: Part[];
  getParts: (jobId: string) => Part[];
  addPart: (part: Omit<Part, 'id'>) => void;
  updatePart: (id: string, data: Partial<Part>) => void;

  // Checklist
  checklistItems: ChecklistItem[];
  checklistResponses: ChecklistResponse[];
  getChecklistItems: () => ChecklistItem[];
  getChecklistResponses: (jobId: string) => ChecklistResponse[];
  upsertChecklistResponse: (jobId: string, itemId: string, data: Partial<Omit<ChecklistResponse, 'id' | 'jobId' | 'itemId'>>) => void;

  // Files
  attachments: Attachment[];
  getAttachmentsForJob: (jobId: string) => Attachment[];
  getAttachmentsForSO: (soId: string) => Attachment[];
  getUnifiedFilesForJob: (jobId: string) => Attachment[];
  getUnifiedFilesForCustomer: (customerId: string) => Attachment[];
  addAttachment: (data: Omit<Attachment, 'id' | 'createdAt'> & { createdAt?: string }) => void;

  setSelectedJob: (id: string | null) => void;
}

export const useJobStore = create<JobState>()(persist((set, get) => ({
  jobs: [],
  filters: {},
  selectedJobId: null,
  isLoading: false,
  notes: [],
  timeEntries: [],
  parts: [],
  checklistItems: [],
  checklistResponses: [],
  attachments: [],

  getJob: (id) => get().jobs.find(j => j.id === id),

  getJobsForTech: (techId) => get().jobs.filter(j => j.technicianId === techId),

  getJobsForCustomer: (customerId) => get().jobs.filter(j => j.customerId === customerId),

  createJob: (data) => {
    const now = new Date().toISOString();
    const job: Job = {
      id: createRecordId('job'),
      jobNumber: createRecordNumber('FSM'),
      status: 'NEW',
      priority: 'MEDIUM',
      serviceType: 'REPAIR',
      category: 'SERVICE',
      description: '',
      customerId: '',
      customerName: '',
      serviceAddress: { street: '', city: '', state: '', zip: '' },
      createdAt: now,
      updatedAt: now,
      _dirty: true,
      ...data,
    };
    set(s => ({ jobs: [job, ...s.jobs] }));
    scheduleAutoSync();
    return job;
  },

  updateJob: (id, data) => {
    set(s => ({
      jobs: s.jobs.map(j =>
        j.id === id ? { ...j, ...data, updatedAt: new Date().toISOString(), _dirty: true } : j
      ),
    }));
    scheduleAutoSync();
  },

  assignTechnician: (jobId, techId, techName) => {
    const tech = useTechStore.getState().technicians.find((candidate) => candidate.id === techId);
    get().updateJob(jobId, {
      technicianId: techId,
      technicianName: techName || tech?.name,
      status: 'SCHEDULED',
    });
  },

  updateStatus: (jobId, status) => {
    const job = get().getJob(jobId);
    if (!job || job.status === status) return;

    const now = new Date().toISOString();
    const nextData: Partial<Job> = { status };
    if (status === 'IN_PROGRESS' && !job.actualStart) {
      nextData.actualStart = now;
    }
    if (status === 'COMPLETED' && !job.actualEnd) {
      nextData.actualEnd = now;
      if (job.actualStart) {
        const durationHours = Math.max(0, (new Date(now).getTime() - new Date(job.actualStart).getTime()) / 3600000);
        nextData.actualDuration = Math.round(durationHours * 10) / 10;
      }
    }

    get().updateJob(jobId, nextData);

    const user = useAuthStore.getState().user;
    get().addNote(
      jobId,
      `Status changed from ${job.status} to ${status}.`,
      'ACTIVITY',
      user?.id || 'u-system',
      user?.name || 'System',
      { createdAt: now, visibility: 'TECHNICIAN_ONLY' },
    );

    if (job.technicianId) {
      const nextTechStatus = ['EN_ROUTE', 'IN_PROGRESS', 'READY_FOR_SIGNATURE'].includes(status)
        ? 'ON_JOB'
        : status === 'COMPLETED'
          ? 'AVAILABLE'
          : undefined;

      if (nextTechStatus) {
        useTechStore.getState().updateTechStatus(job.technicianId, nextTechStatus);
      }
    }
  },

  rescheduleJob: (jobId, data) => {
    const job = get().getJob(jobId);
    if (!job) return;

    get().updateJob(jobId, {
      scheduledDate: data.scheduledDate,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      status: job.technicianId ? 'SCHEDULED' : job.status,
    });

    if (data.reason) {
      const user = useAuthStore.getState().user;
      get().addNote(
        jobId,
        `Rescheduled to ${data.scheduledDate}${data.scheduledStart ? ` at ${data.scheduledStart}` : ''}. ${data.reason}`,
        'ACTIVITY',
        user?.id || 'u-system',
        user?.name || 'System',
      );
    }
  },

  markBillingReady: (jobId) => {
    const job = get().getJob(jobId);
    if (!job) return;

    get().updateJob(jobId, {
      status: 'BILLING_READY',
      billingReady: true,
      billingHold: false,
      billingHoldReason: '',
    });

    if (job.salesOrderId) {
      const salesOrder = useSOStore.getState().getSO(job.salesOrderId);
      if (salesOrder && salesOrder.status === 'Pending Approval') {
        useSOStore.getState().updateSO(job.salesOrderId, { status: 'Approved' });
      }
    }
  },

  setBillingHold: (jobId, reason) => {
    const job = get().getJob(jobId);
    if (!job) return;

    get().updateJob(jobId, {
      billingHold: true,
      billingHoldReason: reason,
      billingReady: false,
    });

    if (job.salesOrderId) {
      useSOStore.getState().toggleBillingHold(job.salesOrderId, reason);
    }
  },

  removeBillingHold: (jobId) => {
    const job = get().getJob(jobId);
    if (!job) return;

    get().updateJob(jobId, {
      billingHold: false,
      billingHoldReason: '',
    });

    if (job.salesOrderId) {
      useSOStore.getState().removeBillingHold(job.salesOrderId);
    }
  },

  generateInvoice: (jobId) => {
    const job = get().getJob(jobId);
    if (!job) return null;

    if (job.salesOrderId) {
      const result = useSOStore.getState().generateInvoice(job.salesOrderId);
      if (!result) return null;

      get().updateJob(jobId, {
        status: 'INVOICED',
        billingReady: true,
        billingHold: false,
        billingHoldReason: '',
        invoiceId: `invoice-${result.invoiceNumber}`,
        invoiceNumber: result.invoiceNumber,
      });

      return result;
    }

    const invoiceNumber = createRecordNumber('INV');
    get().updateJob(jobId, {
      status: 'INVOICED',
      billingReady: true,
      billingHold: false,
      billingHoldReason: '',
      invoiceId: `invoice-${invoiceNumber}`,
      invoiceNumber,
    });

    return { invoiceNumber };
  },

  bulkMarkBillingReady: (jobIds) => {
    let updated = 0;
    jobIds.forEach((jobId) => {
      const job = get().getJob(jobId);
      if (!job || job.warranty || job.status === 'INVOICED') return;
      get().markBillingReady(jobId);
      updated += 1;
    });
    return updated;
  },

  bulkGenerateInvoices: (jobIds) => {
    let updated = 0;
    jobIds.forEach((jobId) => {
      const job = get().getJob(jobId);
      if (!job || job.warranty || job.status === 'INVOICED' || !job.billingReady) return;
      const result = get().generateInvoice(jobId);
      if (result) {
        updated += 1;
      }
    });
    return updated;
  },

  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),
  clearFilters: () => set({ filters: {} }),

  getFilteredJobs: (workspace) => {
    const { jobs, filters } = get();
    return jobs.filter(j => {
      if (j.category !== (workspace === 'SERVICE' ? 'SERVICE' : 'INSTALLATION')) return false;
      if (filters.status?.length && !filters.status.includes(j.status)) return false;
      if (filters.priority?.length && !filters.priority.includes(j.priority)) return false;
      if (filters.serviceType?.length && !filters.serviceType.includes(j.serviceType)) return false;
      if (filters.technicianId && j.technicianId !== filters.technicianId) return false;
      if (filters.customerId && j.customerId !== filters.customerId) return false;
      if (filters.dateFrom && j.scheduledDate && j.scheduledDate < filters.dateFrom) return false;
      if (filters.dateTo && j.scheduledDate && j.scheduledDate > filters.dateTo) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return (
          j.jobNumber.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          j.customerName.toLowerCase().includes(q) ||
          j.technicianName?.toLowerCase().includes(q) ||
          j.serviceAddress.city?.toLowerCase().includes(q) ||
          j.serviceAddress.street?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  },

  getNotes: (jobId) => get().notes.filter(n => n.jobId === jobId),

  addNote: (jobId, text, type, authorId, authorName, options) => {
    const note: JobNote = {
      id: createRecordId('note'),
      jobId, text,
      type: type as JobNote['type'],
      visibility: options?.visibility || 'INTERNAL',
      authorId, authorName,
      createdAt: options?.createdAt || new Date().toISOString(),
      _dirty: true,
    };
    set(s => ({
      notes: [...s.notes, note],
      jobs: s.jobs.map((job) =>
        job.id === jobId ? { ...job, _dirty: true, _syncPending: true } : job,
      ),
    }));
    scheduleAutoSync();
    return note;
  },

  getTimeEntries: (jobId) => get().timeEntries.filter(te => te.jobId === jobId),

  addTimeEntry: (entry) => {
    set((state) => {
      const nextEntry = { ...entry, id: createRecordId('te'), _dirty: true };
      const timeEntries = [...state.timeEntries, nextEntry];

      return {
        timeEntries,
        jobs: state.jobs.map((job) => {
          if (job.id !== entry.jobId) return job;
          return {
            ...job,
            ...calculateJobFinancials(job, timeEntries, state.parts),
            actualStart: job.actualStart || `${entry.date}T${entry.startTime}:00`,
            actualEnd: entry.endTime ? `${entry.date}T${entry.endTime}:00` : job.actualEnd,
            actualDuration: Math.round(getTimeEntriesForJob(timeEntries, entry.jobId).reduce((sum, current) => sum + current.duration, 0) * 10) / 10,
            updatedAt: new Date().toISOString(),
            _dirty: true,
          };
        }),
      };
    });
    scheduleAutoSync();
  },

  getParts: (jobId) => get().parts.filter(p => p.jobId === jobId),

  addPart: (part) => {
    set((state) => {
      const nextPart = { ...part, id: createRecordId('part'), _dirty: true };
      const parts = [...state.parts, nextPart];

      return {
        parts,
        jobs: state.jobs.map((job) => {
          if (job.id !== part.jobId) return job;
          return {
            ...job,
            ...calculateJobFinancials(job, state.timeEntries, parts),
            updatedAt: new Date().toISOString(),
            _dirty: true,
          };
        }),
      };
    });
    scheduleAutoSync();
  },

  updatePart: (id, data) => {
    set((state) => {
      let affectedJobId: string | undefined;
      const parts = state.parts.map((part) => {
        if (part.id !== id) return part;
        affectedJobId = part.jobId;
        const quantity = Number(data.quantity ?? part.quantity) || 0;
        const unitCost = Number(data.unitCost ?? part.unitCost) || 0;
        return {
          ...part,
          ...data,
          quantity,
          unitCost,
          totalCost: Math.round(quantity * unitCost * 100) / 100,
          _dirty: true,
        };
      });

      return {
        parts,
        jobs: state.jobs.map((job) => {
          if (!affectedJobId || job.id !== affectedJobId) return job;
          return {
            ...job,
            ...calculateJobFinancials(job, state.timeEntries, parts),
            updatedAt: new Date().toISOString(),
            _dirty: true,
          };
        }),
      };
    });
    scheduleAutoSync();
  },

  getChecklistItems: () => get().checklistItems,

  getChecklistResponses: (jobId) => get().checklistResponses.filter((response) => response.jobId === jobId),

  upsertChecklistResponse: (jobId, itemId, data) => {
    set((state) => {
      const existing = state.checklistResponses.find((response) => response.jobId === jobId && response.itemId === itemId);
      const nextResponse: ChecklistResponse = existing
        ? {
            ...existing,
            ...data,
            checked: data.checked ?? existing.checked,
            notes: data.notes ?? existing.notes,
            technicianId: data.technicianId ?? existing.technicianId,
            completedAt: data.completedAt ?? (data.checked ? new Date().toISOString() : existing.completedAt),
            _dirty: true,
          }
        : {
            id: createRecordId('clr'),
            jobId,
            itemId,
            checked: data.checked ?? false,
            notes: data.notes,
            technicianId: data.technicianId,
            completedAt: data.checked ? new Date().toISOString() : undefined,
            _dirty: true,
          };

      return {
        checklistResponses: existing
          ? state.checklistResponses.map((response) =>
              response.id === existing.id ? nextResponse : response,
            )
          : [...state.checklistResponses, nextResponse],
        jobs: state.jobs.map((job) =>
          job.id === jobId ? { ...job, _dirty: true, _syncPending: true } : job,
        ),
      };
    });
    scheduleAutoSync();
  },

  getAttachmentsForJob: (jobId) => get().attachments.filter((attachment) => attachment.jobId === jobId),

  getAttachmentsForSO: (soId) => get().attachments.filter((attachment) => attachment.soId === soId),

  getUnifiedFilesForJob: (jobId) => {
    const job = get().jobs.find((candidate) => candidate.id === jobId);
    return get().attachments.filter((attachment) =>
      attachment.jobId === jobId || (job?.salesOrderId && attachment.soId === job.salesOrderId),
    );
  },

  getUnifiedFilesForCustomer: (customerId) => get().attachments.filter((attachment) => attachment.customerId === customerId),

  addAttachment: (data) => {
    set((state) => ({
      attachments: [
        ...state.attachments,
        {
          ...data,
          id: createRecordId('att'),
          createdAt: data.createdAt || new Date().toISOString(),
          _dirty: true,
        },
      ],
      jobs: state.jobs.map((job) =>
        job.id === data.jobId ? { ...job, _dirty: true, _syncPending: true } : job,
        ),
    }));
    scheduleAutoSync();
  },

  setSelectedJob: (id) => set({ selectedJobId: id }),
}), {
  name: 'fsm-job-store-v2',
  partialize: (state) => ({
    jobs: state.jobs,
    filters: state.filters,
    selectedJobId: state.selectedJobId,
    notes: state.notes,
    timeEntries: state.timeEntries,
    parts: state.parts,
    checklistItems: state.checklistItems,
    checklistResponses: state.checklistResponses,
    attachments: state.attachments,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER STORE
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerState {
  customers: Customer[];
  getCustomer: (id: string) => Customer | undefined;
  searchCustomers: (q: string) => Customer[];
  createCustomer: (data: Partial<Customer>) => Customer;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
}

export const useCustomerStore = create<CustomerState>()(persist((set, get) => ({
  customers: [],

  getCustomer: (id) => get().customers.find(c => c.id === id),

  searchCustomers: (q) => {
    if (!q || q.length < 2) return get().customers.slice(0, 20);
    const lower = q.toLowerCase();
    return get().customers.filter(c =>
      c.companyName.toLowerCase().includes(lower) ||
      c.entityId.toLowerCase().includes(lower) ||
      c.email?.toLowerCase().includes(lower) ||
      c.phone?.toLowerCase().includes(lower) ||
      c.altPhone?.toLowerCase().includes(lower) ||
      c.contactName?.toLowerCase().includes(lower) ||
      c.defaultAddress?.toLowerCase().includes(lower) ||
      c.addresses.some(a =>
        a.street.toLowerCase().includes(lower) ||
        a.city.toLowerCase().includes(lower) ||
        a.zip.includes(lower)
      )
    );
  },

  createCustomer: (data) => {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: createRecordId('cust'),
      entityId: createRecordNumber('CUST'),
      companyName: '',
      addresses: [],
      isActive: true,
      createdAt: now,
      _dirty: true,
      ...data,
    };

    set((state) => ({
      customers: [customer, ...state.customers],
    }));
    scheduleAutoSync();
    return customer;
  },

  updateCustomer: (id, data) => {
    set(s => ({
      customers: s.customers.map(c => c.id === id ? { ...c, ...data, _dirty: true } : c),
    }));
    scheduleAutoSync();
  },
}), {
  name: 'fsm-customer-store-v1',
  partialize: (state) => ({ customers: state.customers }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SALES ORDER STORE
// ─────────────────────────────────────────────────────────────────────────────

interface SOState {
  salesOrders: SalesOrder[];
  getSO: (id: string) => SalesOrder | undefined;
  getSOsForCustomer: (customerId: string) => SalesOrder[];
  getSOsForJob: (jobId: string) => SalesOrder[];
  createSO: (data: Partial<SalesOrder>) => SalesOrder;
  linkSOToJob: (soId: string, jobId: string) => void;
  updateSO: (id: string, data: Partial<SalesOrder>) => void;
  addSOLine: (soId: string, line: Omit<SalesOrder['lines'][0], 'id'>) => void;
  updateSOLine: (soId: string, lineId: string, data: Partial<SalesOrder['lines'][0]>) => void;
  removeSOLine: (soId: string, lineId: string) => void;
  toggleBillingHold: (soId: string, reason?: string) => void;
  removeBillingHold: (soId: string) => void;
  generateInvoice: (soId: string) => { invoiceNumber: string } | null;
  syncSOToJob: (soId: string) => void;
}

function recalcSalesOrder(so: SalesOrder): SalesOrder {
  const normalizedLines = so.lines.map((line) => {
    const quantity = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    const amount = Math.round(quantity * rate * 100) / 100;

    return {
      ...line,
      quantity,
      rate,
      amount,
    };
  });

  const subtotal = Math.round(normalizedLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const taxRate = so.taxRate ?? 8.5;
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  const amountPaid = Math.min(Number(so.amountPaid) || 0, total);
  const balance = Math.round((total - amountPaid) * 100) / 100;

  return {
    ...so,
    lines: normalizedLines,
    subtotal,
    taxRate,
    taxAmount,
    total,
    amountPaid,
    balance,
    updatedAt: new Date().toISOString(),
  };
}

export const useSOStore = create<SOState>()(persist((set, get) => ({
  salesOrders: [],

  getSO: (id) => get().salesOrders.find(s => s.id === id),

  getSOsForCustomer: (customerId) => get().salesOrders.filter(s => s.customerId === customerId),

  getSOsForJob: (jobId) => get().salesOrders.filter(s => s.linkedJobId === jobId),

  createSO: (data) => {
    const so: SalesOrder = {
      id: createRecordId('so'),
      soNumber: createRecordNumber('SO'),
      customerId: '',
      customerName: '',
      status: 'Pending Approval',
      tranDate: new Date().toISOString().split('T')[0],
      lines: [],
      subtotal: 0,
      total: 0,
      amountPaid: 0,
      balance: 0,
      terms: 'Net 30',
      createdAt: new Date().toISOString(),
      _dirty: true,
      ...data,
    };
    const normalized = recalcSalesOrder(so);
    set(s => ({ salesOrders: [normalized, ...s.salesOrders] }));
    scheduleAutoSync();
    if (normalized.linkedJobId) {
      useJobStore.getState().updateJob(normalized.linkedJobId, {
        salesOrderId: normalized.id,
        salesOrderNumber: normalized.soNumber,
        billableAmount: normalized.total,
        totalCost: normalized.total,
      });
    }
    return normalized;
  },

  linkSOToJob: (soId, jobId) => {
    const so = get().salesOrders.find((candidate) => candidate.id === soId);
    const job = useJobStore.getState().getJob(jobId);
    if (!so || !job) return;

    get().updateSO(soId, {
      customerId: job.customerId,
      customerName: job.customerName,
      linkedJobId: job.id,
      linkedJobNumber: job.jobNumber,
      billingCode: job.billingCode || so.billingCode,
    });

    useJobStore.getState().updateJob(job.id, {
      salesOrderId: so.id,
      salesOrderNumber: so.soNumber,
      billableAmount: so.total,
      totalCost: so.total,
      billingCode: so.billingCode || job.billingCode,
    });
  },

  updateSO: (id, data) => {
    set(s => ({
      salesOrders: s.salesOrders.map(so => {
        if (so.id !== id) return so;
        return recalcSalesOrder({ ...so, ...data, _dirty: true });
      }),
    }));
    scheduleAutoSync();
  },

  addSOLine: (soId, line) => {
    const newLine = { ...line, id: `sol-${Date.now()}` };
    const so = get().salesOrders.find(s => s.id === soId);
    if (!so) return;
    get().updateSO(soId, { lines: [...so.lines, newLine] });
  },

  updateSOLine: (soId, lineId, data) => {
    const so = get().salesOrders.find(s => s.id === soId);
    if (!so) return;
    const updatedLines = so.lines.map(l => {
      if (l.id !== lineId) return l;
      return { ...l, ...data };
    });
    get().updateSO(soId, { lines: updatedLines });
  },

  removeSOLine: (soId, lineId) => {
    const so = get().salesOrders.find(s => s.id === soId);
    if (!so) return;
    get().updateSO(soId, { lines: so.lines.filter((line) => line.id !== lineId) });
  },

  toggleBillingHold: (soId, reason) => {
    const so = get().salesOrders.find((candidate) => candidate.id === soId);
    if (!so) return;
    get().updateSO(soId, {
      billingHold: true,
      billingHoldReason: reason || 'Billing review required',
    });

    if (so.linkedJobId) {
      useJobStore.getState().updateJob(so.linkedJobId, {
        billingHold: true,
        billingHoldReason: reason || 'Billing review required',
        billingReady: false,
      });
    }
  },

  removeBillingHold: (soId) => {
    const so = get().salesOrders.find((candidate) => candidate.id === soId);
    if (!so) return;
    get().updateSO(soId, {
      billingHold: false,
      billingHoldReason: '',
    });

    if (so.linkedJobId) {
      useJobStore.getState().updateJob(so.linkedJobId, {
        billingHold: false,
        billingHoldReason: '',
      });
    }
  },

  generateInvoice: (soId) => {
    const so = get().salesOrders.find((candidate) => candidate.id === soId);
    if (!so) return null;

    const invoiceNumber = createRecordNumber('INV');

    get().updateSO(soId, {
      invoiceId: `invoice-${invoiceNumber}`,
      invoiceNumber,
      status: 'Fully Billed',
      amountPaid: so.total,
      balance: 0,
      billingHold: false,
      billingHoldReason: '',
    });

    if (so.linkedJobId) {
      useJobStore.getState().updateJob(so.linkedJobId, {
        status: 'INVOICED',
        billingReady: true,
        billingHold: false,
        billingHoldReason: '',
        invoiceId: `invoice-${invoiceNumber}`,
        invoiceNumber,
      });
    }

    return { invoiceNumber };
  },

  syncSOToJob: (soId) => {
    const so = get().salesOrders.find((candidate) => candidate.id === soId);
    if (!so?.linkedJobId) return;

    useJobStore.getState().updateJob(so.linkedJobId, {
      totalCost: so.total,
      billableAmount: so.total,
      salesOrderId: so.id,
      salesOrderNumber: so.soNumber,
      billingCode: so.billingCode,
    });
  },
}), {
  name: 'fsm-sales-order-store-v2',
  partialize: (state) => ({ salesOrders: state.salesOrders }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICIAN STORE
// ─────────────────────────────────────────────────────────────────────────────

interface TechState {
  technicians: Technician[];
  getTech: (id: string) => Technician | undefined;
  getTechsByCategory: (cat: 'SERVICE' | 'INSTALLATION') => Technician[];
  updateTechStatus: (id: string, status: Technician['status']) => void;
}

export const useTechStore = create<TechState>()(persist((set, get) => ({
  technicians: [],

  getTech: (id) => get().technicians.find(t => t.id === id),

  getTechsByCategory: (cat) => get().technicians.filter(t => t.category === cat),

  updateTechStatus: (id, status) => {
    set(s => ({
      technicians: s.technicians.map(t => t.id === id ? { ...t, status, _dirty: true } : t),
    }));
    scheduleAutoSync();
  },
}), {
  name: 'fsm-tech-store-v1',
  partialize: (state) => ({ technicians: state.technicians }),
}));

function getWorkspaceCategory(workspace: Workspace) {
  return workspace === 'SERVICE' ? 'SERVICE' : 'INSTALLATION';
}

function getScopedSalesOrdersForWorkspace(workspace: Workspace, jobs: Job[], salesOrders: SalesOrder[]) {
  const category = getWorkspaceCategory(workspace);
  const visibleJobIds = new Set(
    jobs
      .filter((job) => job.category === category)
      .map((job) => job.id)
  );

  return salesOrders.filter((order) => !order.linkedJobId || visibleJobIds.has(order.linkedJobId));
}

function computeLiveDashboardKPIs(workspace: Workspace): DashboardKPIs {
  const today = new Date().toISOString().split('T')[0];
  const category = getWorkspaceCategory(workspace);
  const allJobs = useJobStore.getState().jobs;
  const allSalesOrders = useSOStore.getState().salesOrders;
  const jobs = allJobs.filter((job) => job.category === category);
  const salesOrders = getScopedSalesOrdersForWorkspace(workspace, allJobs, allSalesOrders);
  const techs = useTechStore.getState().technicians.filter((tech) => tech.category === category);

  const jobsToday = jobs.filter((job) => job.scheduledDate === today).length;
  const jobsOpen = jobs.filter((job) => !['COMPLETED', 'CANCELLED', 'INVOICED'].includes(job.status)).length;
  const jobsCompleted = jobs.filter((job) => job.status === 'COMPLETED').length;
  const jobsOverdue = jobs.filter((job) =>
    job.scheduledDate && job.scheduledDate < today && !['COMPLETED', 'CANCELLED', 'INVOICED', 'BILLING_READY'].includes(job.status)
  ).length;

  const techsAvailable = techs.filter((tech) => tech.status === 'AVAILABLE').length;
  const techsOnJob = techs.filter((tech) => tech.status === 'ON_JOB').length;

  const thisMonthSOs = salesOrders.filter((order) => {
    const date = new Date(order.tranDate);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const soThisMonth = thisMonthSOs.length;
  const revenueThisMonth = Math.round(thisMonthSOs.reduce((sum, order) => sum + order.total, 0));

  const completedJobsWithDuration = jobs.filter((job) => job.actualDuration);
  const avgJobDuration = completedJobsWithDuration.length > 0
    ? Math.round((completedJobsWithDuration.reduce((sum, job) => sum + (job.actualDuration || 0), 0) / completedJobsWithDuration.length) * 10) / 10
    : 0;

  const slaBreachRate = jobs.length > 0
    ? Math.round((jobs.filter((job) => job.slaBreached).length / jobs.length) * 100)
    : 0;

  const jobsByStatus: Record<string, number> = {};
  jobs.forEach((job) => { jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1; });

  const jobsByType: Record<string, number> = {};
  jobs.forEach((job) => { jobsByType[job.serviceType] = (jobsByType[job.serviceType] || 0) + 1; });

  const revenueByWeek = Array.from({ length: 8 }, (_, weekIndex) => {
    const start = new Date();
    start.setDate(start.getDate() - (7 - weekIndex) * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(0, 0, 0, 0);

    const amount = salesOrders
      .filter((order) => {
        const date = new Date(order.tranDate);
        return date >= start && date < end;
      })
      .reduce((sum, order) => sum + order.total, 0);

    return {
      week: `W${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`,
      amount: Math.round(amount),
    };
  });

  const jobsByTech = techs.slice(0, 8).map((tech) => ({
    name: tech.name.split(' ')[0],
    count: jobs.filter((job) => job.technicianId === tech.id).length,
  })).sort((left, right) => right.count - left.count);

  return {
    jobsToday,
    jobsOpen,
    jobsCompleted,
    jobsOverdue,
    techsAvailable,
    techsOnJob,
    soThisMonth,
    revenueThisMonth,
    avgJobDuration,
    slaBreachRate,
    jobsByStatus,
    jobsByType,
    revenueByWeek,
    jobsByTech,
  };
}

function buildSupabaseSyncSnapshot(): SupabaseSyncSnapshot {
  const jobState = useJobStore.getState();
  const salesOrderState = useSOStore.getState();
  const customerState = useCustomerStore.getState();
  const techState = useTechStore.getState();

  const dirtyJobIds = new Set(
    jobState.jobs
      .filter((job) => job._dirty)
      .map((job) => job.id),
  );

  const dirtySalesOrders = salesOrderState.salesOrders.filter((salesOrder) =>
    salesOrder._dirty || (salesOrder.linkedJobId ? dirtyJobIds.has(salesOrder.linkedJobId) : false),
  );

  const relatedCustomerIds = new Set<string>();
  jobState.jobs.forEach((job) => {
    if (dirtyJobIds.has(job.id)) {
      relatedCustomerIds.add(job.customerId);
    }
  });
  dirtySalesOrders.forEach((salesOrder) => relatedCustomerIds.add(salesOrder.customerId));

  return {
    jobs: jobState.jobs.filter((job) => job._dirty),
    customers: customerState.customers.filter((customer) => customer._dirty || relatedCustomerIds.has(customer.id)),
    salesOrders: dirtySalesOrders,
    technicians: techState.technicians.filter((technician) => technician._dirty || dirtyJobIds.has(technician.currentJobId || '')),
    notes: jobState.notes.filter((note) => note._dirty),
    timeEntries: jobState.timeEntries.filter((timeEntry) => timeEntry._dirty),
    parts: jobState.parts.filter((part) => part._dirty),
    attachments: jobState.attachments.filter((attachment) => attachment._dirty),
    checklistItems: [],
    checklistResponses: jobState.checklistResponses.filter((response) => response._dirty),
    serviceHistory: [],
  };
}

function countPendingSyncChanges() {
  const jobState = useJobStore.getState();
  const salesOrderState = useSOStore.getState();
  const customerState = useCustomerStore.getState();
  const techState = useTechStore.getState();

  return (
    jobState.jobs.filter((job) => job._dirty).length +
    jobState.notes.filter((note) => note._dirty).length +
    jobState.timeEntries.filter((timeEntry) => timeEntry._dirty).length +
    jobState.parts.filter((part) => part._dirty).length +
    jobState.attachments.filter((attachment) => attachment._dirty).length +
    jobState.checklistResponses.filter((response) => response._dirty).length +
    salesOrderState.salesOrders.filter((salesOrder) => salesOrder._dirty).length +
    customerState.customers.filter((customer) => customer._dirty).length +
    techState.technicians.filter((technician) => technician._dirty).length
  );
}

function applySupabaseBootstrap(payload: SupabaseBootstrapPayload) {
  useJobStore.setState((state) => ({
    ...state,
    jobs: payload.jobs.map((job) => ({ ...job, _dirty: false, _syncPending: false })),
    notes: payload.notes.map((note) => ({ ...note, _dirty: false })),
    timeEntries: payload.timeEntries.map((timeEntry) => ({ ...timeEntry, _dirty: false })),
    parts: payload.parts.map((part) => ({ ...part, _dirty: false })),
    attachments: payload.attachments.map((attachment) => ({ ...attachment, _dirty: false })),
    checklistItems: payload.checklistItems,
    checklistResponses: payload.checklistResponses.map((response) => ({ ...response, _dirty: false })),
  }));

  useSOStore.setState((state) => ({
    ...state,
    salesOrders: payload.salesOrders.map((salesOrder) => ({ ...salesOrder, _dirty: false })),
  }));

  useCustomerStore.setState((state) => ({
    ...state,
    customers: payload.customers.map((customer) => ({ ...customer, _dirty: false })),
  }));

  useTechStore.setState((state) => ({
    ...state,
    technicians: payload.technicians.map((technician) => ({ ...technician, _dirty: false })),
  }));

  useAssetStore.setState((state) => ({
    ...state,
    assets: payload.assets,
    serviceHistory: payload.serviceHistory,
  }));
}

let autoSyncTimer: number | undefined;

function scheduleAutoSync() {
  useUIStore.setState((state) => ({
    ...state,
    syncState: {
      ...state.syncState,
      pendingChanges: countPendingSyncChanges(),
    },
  }));

  if (!isSupabaseConfigured() || typeof window === 'undefined') {
    return;
  }

  window.clearTimeout(autoSyncTimer);
  autoSyncTimer = window.setTimeout(() => {
    const uiState = useUIStore.getState();
    if (uiState.dataStatus !== 'READY' || uiState.syncState.status === 'SYNCING') {
      return;
    }
    void uiState.triggerSync({ silent: true });
  }, 900);
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET STORE
// ─────────────────────────────────────────────────────────────────────────────

interface AssetState {
  assets: Asset[];
  serviceHistory: ServiceHistoryEntry[];
  getAsset: (id: string) => Asset | undefined;
  getAssetsForCustomer: (customerId: string) => Asset[];
  getServiceHistory: (assetId: string) => ServiceHistoryEntry[];
}

export const useAssetStore = create<AssetState>()(persist((_set, get) => ({
  assets: [],
  serviceHistory: [],
  getAsset: (id) => get().assets.find((asset) => asset.id === id),
  getAssetsForCustomer: (customerId) => get().assets.filter((asset) => asset.customerId === customerId),
  getServiceHistory: (assetId) => {
    const asset = get().assets.find((candidate) => candidate.id === assetId);
    if (!asset) return [];
    return get().serviceHistory.filter((entry) =>
      useJobStore.getState().jobs.some((job) => job.id === entry.jobId && job.assetId === assetId),
    );
  },
}), {
  name: 'fsm-asset-store-v1',
  partialize: (state) => ({
    assets: state.assets,
    serviceHistory: state.serviceHistory,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// UI / APP STORE
// ─────────────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface UIState {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  language: AppLanguage;
  theme: AppTheme;
  toasts: Toast[];
  syncState: SyncState;
  dataStatus: 'IDLE' | 'LOADING' | 'READY' | 'ERROR';
  dataError?: string;
  dashboardKPIs: DashboardKPIs | null;
  unsavedChanges: boolean;
  workStart: string;
  workEnd: string;

  toggleSidebar: () => void;
  setMobileMenu: (open: boolean) => void;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  toast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
  setSyncState: (s: Partial<SyncState>) => void;
  bootstrapApp: () => Promise<void>;
  triggerSync: (options?: { silent?: boolean }) => Promise<void>;
  loadKPIs: (workspace: Workspace) => void;
  setUnsavedChanges: (val: boolean) => void;
  setWorkHours: (start: string, end: string) => void;
}

export const useUIStore = create<UIState>()(persist((set, get) => ({
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  language: 'en',
  theme: 'dark',
  toasts: [],
  syncState: { status: 'IDLE', pendingChanges: 0, source: 'LOCAL' },
  dataStatus: 'IDLE',
  dataError: undefined,
  dashboardKPIs: null,
  unsavedChanges: false,
  workStart: '07:00',
  workEnd: '18:00',

  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setMobileMenu: (open) => set({ mobileMenuOpen: open }),

  setLanguage: (language) => set({ language }),

  toggleLanguage: () => set((state) => ({ language: state.language === 'en' ? 'fr' : 'en' })),

  setTheme: (theme) => set({ theme }),

  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  toast: (type, message) => {
    const toastId = `toast-${Date.now()}`;
    set(s => ({ toasts: [...s.toasts, { id: toastId, type, message }] }));
    setTimeout(() => get().dismissToast(toastId), 4000);
  },

  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  setSyncState: (s) => set(st => ({ syncState: { ...st.syncState, ...s } })),

  bootstrapApp: async () => {
    if (!isSupabaseConfigured()) {
      const message = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running the demo.';
      set((state) => ({
        dataStatus: 'ERROR',
        dataError: message,
        syncState: {
          ...state.syncState,
          status: 'ERROR',
          source: 'LOCAL',
          error: message,
        },
      }));
      return;
    }

    set((state) => ({
      dataStatus: 'LOADING',
      dataError: undefined,
      syncState: {
        ...state.syncState,
        error: undefined,
      },
    }));

    try {
      const bootstrap = await fetchSupabaseBootstrap();
      applySupabaseBootstrap(bootstrap);
      const workspace = useAuthStore.getState().workspace;

      set((state) => ({
        dataStatus: 'READY',
        dataError: undefined,
        syncState: {
          ...state.syncState,
          status: 'IDLE',
          pendingChanges: 0,
          lastSync: bootstrap.syncedAt,
          source: 'SUPABASE',
          error: undefined,
        },
      }));

      get().loadKPIs(workspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load demo data from Supabase.';
      set((state) => ({
        dataStatus: 'ERROR',
        dataError: message,
        syncState: {
          ...state.syncState,
          status: 'ERROR',
          error: message,
        },
      }));
    }
  },

  triggerSync: async (options) => {
    const pendingChanges = countPendingSyncChanges();
    set((state) => ({
      syncState: {
        ...state.syncState,
        status: 'SYNCING',
        pendingChanges,
        error: undefined,
      },
    }));

    if (!isSupabaseConfigured()) {
      const message = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
      set((state) => ({
        syncState: {
          ...state.syncState,
          status: 'ERROR',
          error: message,
        },
      }));
      if (!options?.silent) {
        get().toast('error', message);
      }
      return;
    }

    try {
      const authState = useAuthStore.getState();
      let syncedAt = new Date().toISOString();

      if (pendingChanges > 0) {
        const snapshot = buildSupabaseSyncSnapshot();
        const result = await syncSupabaseSnapshot(snapshot);
        syncedAt = result.syncedAt;
      } else {
        syncedAt = new Date().toISOString();
      }

      const bootstrap = await fetchSupabaseBootstrap();
      applySupabaseBootstrap(bootstrap);

      set({
        syncState: {
          status: 'SUCCESS',
          pendingChanges: 0,
          lastSync: syncedAt,
          source: 'SUPABASE',
        },
      });
      get().loadKPIs(authState.workspace);

      if (!options?.silent) {
        get().toast('success', pendingChanges > 0 ? 'Changes saved to Supabase.' : 'Latest demo data loaded from Supabase.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supabase sync failed';
      set((state) => ({
        syncState: {
          ...state.syncState,
          status: 'ERROR',
          pendingChanges: countPendingSyncChanges(),
          error: message,
        },
      }));
      if (!options?.silent) {
        get().toast('error', message);
      }
    } finally {
      if (options?.silent) {
        set((state) => ({
          syncState: state.syncState.status === 'SUCCESS'
            ? { ...state.syncState, status: 'IDLE', pendingChanges: countPendingSyncChanges() }
            : state.syncState,
        }));
      } else {
        setTimeout(() => set((state) => ({ syncState: { ...state.syncState, status: 'IDLE', pendingChanges: countPendingSyncChanges() } })), 2500);
      }
    }
  },

  loadKPIs: (workspace) => {
    const kpis = computeLiveDashboardKPIs(workspace);
    set({ dashboardKPIs: kpis });
  },

  setUnsavedChanges: (val) => set({ unsavedChanges: val }),

  setWorkHours: (start, end) => set({ workStart: start, workEnd: end }),
}), {
  name: 'fsm-ui-store-v1',
  partialize: (state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    language: state.language,
    theme: state.theme,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH STORE
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from '@/types';

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  setQuery: (q: string) => void;
  search: (q: string) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: '',
  results: [],
  isSearching: false,

  setQuery: (q) => set({ query: q }),

  search: (q) => {
    if (!q || q.length < 2) { set({ results: [], isSearching: false }); return; }
    set({ isSearching: true });

    const lower = q.toLowerCase();
    const results: SearchResult[] = [];
    const workspace = useAuthStore.getState().workspace;
    const category = workspace === 'SERVICE' ? 'SERVICE' : 'INSTALLATION';
    const customers = useCustomerStore.getState().customers;
    const liveJobs = useJobStore.getState().jobs.filter(job => job.category === category);
    const liveSalesOrders = useSOStore.getState().salesOrders;
    const visibleJobIds = new Set(liveJobs.map(job => job.id));

    // Search customers
    customers.filter(c =>
      c.companyName.toLowerCase().includes(lower) ||
      c.email?.toLowerCase().includes(lower) ||
      c.phone?.toLowerCase().includes(lower) ||
      c.defaultAddress?.toLowerCase().includes(lower) ||
      c.contactName?.toLowerCase().includes(lower)
    ).slice(0, 5).forEach(c => {
      results.push({
        type: 'CUSTOMER',
        id: c.id,
        title: c.companyName,
        subtitle: c.contactName || c.email || '',
        meta: c.defaultAddress,
        url: `/clients/${c.id}`,
      });
    });

    // Search jobs
    liveJobs.filter(j =>
      j.jobNumber.toLowerCase().includes(lower) ||
      j.description.toLowerCase().includes(lower) ||
      j.customerName.toLowerCase().includes(lower) ||
      j.serviceAddress.city?.toLowerCase().includes(lower) ||
      j.serviceAddress.street?.toLowerCase().includes(lower) ||
      j.technicianName?.toLowerCase().includes(lower)
    ).slice(0, 5).forEach(j => {
      results.push({
        type: 'JOB',
        id: j.id,
        title: j.jobNumber,
        subtitle: j.customerName,
        meta: j.description.substring(0, 60),
        status: j.status,
        url: `/jobs/${j.id}`,
      });
    });

    // Search sales orders
    liveSalesOrders.filter(so =>
      (!so.linkedJobId || visibleJobIds.has(so.linkedJobId)) &&
      (
        so.soNumber.toLowerCase().includes(lower) ||
        so.customerName.toLowerCase().includes(lower) ||
        so.memo?.toLowerCase().includes(lower)
      )
    ).slice(0, 5).forEach(so => {
      results.push({
        type: 'SALES_ORDER',
        id: so.id,
        title: so.soNumber,
        subtitle: so.customerName,
        meta: so.memo,
        url: `/billing/${so.id}`,
      });
    });

    set({ results, isSearching: false });
  },

  clear: () => set({ query: '', results: [] }),
}));

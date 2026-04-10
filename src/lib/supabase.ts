import { createClient } from '@supabase/supabase-js';
import type {
  Attachment,
  Asset,
  ChecklistItem,
  ChecklistResponse,
  Customer,
  Job,
  JobNote,
  Part,
  SalesOrder,
  ServiceHistoryEntry,
  Technician,
  TimeEntry,
} from '@/types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export interface SupabaseBootstrapPayload {
  jobs: Job[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  technicians: Technician[];
  assets: Asset[];
  notes: JobNote[];
  timeEntries: TimeEntry[];
  parts: Part[];
  attachments: Attachment[];
  checklistItems: ChecklistItem[];
  checklistResponses: ChecklistResponse[];
  serviceHistory: ServiceHistoryEntry[];
  syncedAt: string;
}

export interface SupabaseSyncSnapshot {
  jobs: Job[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  technicians: Technician[];
  notes: JobNote[];
  timeEntries: TimeEntry[];
  parts: Part[];
  attachments: Attachment[];
  checklistItems: ChecklistItem[];
  checklistResponses: ChecklistResponse[];
  serviceHistory: ServiceHistoryEntry[];
}

export interface SupabaseSyncResult {
  syncedAt: string;
  counts: Record<string, number>;
}

function ensureSuccess<T>(value: { data: T | null; error: { message: string } | null }, label: string) {
  if (value.error) {
    throw new Error(`${label}: ${value.error.message}`);
  }

  return value.data;
}

async function loadTable<T>(table: string, orderBy?: string, ascending = true) {
  const client = getSupabaseClient();
  let query = client.from(table).select('*');

  if (orderBy) {
    query = query.order(orderBy, { ascending });
  }

  return ensureSuccess<T[]>(await query, table) || [];
}

async function upsertTable(table: string, rows: unknown[]) {
  if (!rows.length) {
    return 0;
  }

  const client = getSupabaseClient() as any;
  const { error } = await client.from(table).upsert(rows as any[], { onConflict: 'id' });
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return rows.length;
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function fetchSupabaseBootstrap() {
  const [
    customers,
    technicians,
    assets,
    jobs,
    salesOrders,
    notes,
    timeEntries,
    parts,
    attachments,
    checklistItems,
    checklistResponses,
    serviceHistory,
  ] = await Promise.all([
    loadTable<Customer>('customers', 'companyName'),
    loadTable<Technician>('technicians', 'name'),
    loadTable<Asset>('assets', 'name'),
    loadTable<Job>('jobs', 'scheduledDate'),
    loadTable<SalesOrder>('sales_orders', 'tranDate', false),
    loadTable<JobNote>('job_notes', 'createdAt'),
    loadTable<TimeEntry>('time_entries', 'date'),
    loadTable<Part>('parts', 'installedDate'),
    loadTable<Attachment>('attachments', 'createdAt', false),
    loadTable<ChecklistItem>('checklist_items', 'order'),
    loadTable<ChecklistResponse>('checklist_responses', 'completedAt'),
    loadTable<ServiceHistoryEntry>('service_history', 'date', false),
  ]);

  return {
    jobs,
    customers,
    salesOrders,
    technicians,
    assets,
    notes,
    timeEntries,
    parts,
    attachments,
    checklistItems,
    checklistResponses,
    serviceHistory,
    syncedAt: new Date().toISOString(),
  } satisfies SupabaseBootstrapPayload;
}

export async function syncSupabaseSnapshot(snapshot: SupabaseSyncSnapshot) {
  const counts = {
    customers: await upsertTable('customers', snapshot.customers),
    technicians: await upsertTable('technicians', snapshot.technicians),
    jobs: await upsertTable('jobs', snapshot.jobs),
    salesOrders: await upsertTable('sales_orders', snapshot.salesOrders),
    notes: await upsertTable('job_notes', snapshot.notes),
    timeEntries: await upsertTable('time_entries', snapshot.timeEntries),
    parts: await upsertTable('parts', snapshot.parts),
    attachments: await upsertTable('attachments', snapshot.attachments),
    checklistItems: await upsertTable('checklist_items', snapshot.checklistItems),
    checklistResponses: await upsertTable('checklist_responses', snapshot.checklistResponses),
    serviceHistory: await upsertTable('service_history', snapshot.serviceHistory),
  };

  return {
    syncedAt: new Date().toISOString(),
    counts,
  } satisfies SupabaseSyncResult;
}

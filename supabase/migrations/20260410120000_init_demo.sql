create table if not exists public.customers (
  id text primary key,
  "entityId" text not null,
  "companyName" text not null,
  "contactName" text,
  email text,
  phone text,
  "altPhone" text,
  website text,
  "accountNumber" text,
  addresses jsonb not null default '[]'::jsonb,
  "defaultAddress" text,
  "isActive" boolean not null default true,
  category text,
  "createdAt" timestamptz not null default timezone('utc', now()),
  notes text
);

create table if not exists public.technicians (
  id text primary key,
  "employeeId" text not null,
  name text not null,
  email text not null,
  phone text,
  category text not null,
  skills text[] not null default '{}'::text[],
  status text not null,
  region text,
  "avatarInitials" text not null,
  color text not null,
  "currentJobId" text,
  certifications text[] not null default '{}'::text[]
);

create table if not exists public.assets (
  id text primary key,
  name text not null,
  "customerId" text not null,
  "customerName" text not null,
  "equipmentTypeId" text not null,
  "equipmentType" text not null,
  "serialNumber" text,
  "modelNumber" text,
  manufacturer text,
  "installDate" date,
  "warrantyExpiry" date,
  status text not null,
  location text,
  "lastServiceDate" date,
  "nextServiceDate" date,
  notes text
);

create table if not exists public.jobs (
  id text primary key,
  "jobNumber" text not null unique,
  status text not null,
  priority text not null,
  "serviceType" text not null,
  category text not null,
  description text not null,
  "internalNotes" text,
  "customerId" text not null,
  "customerName" text not null,
  "contactName" text,
  "contactPhone" text,
  "contactEmail" text,
  "serviceAddress" jsonb not null default '{}'::jsonb,
  "technicianId" text,
  "technicianName" text,
  "technicianSecondaryId" text,
  "scheduledDate" date,
  "scheduledStart" text,
  "scheduledEnd" text,
  "estimatedDuration" numeric(10,2),
  "actualStart" timestamptz,
  "actualEnd" timestamptz,
  "actualDuration" numeric(10,2),
  "salesOrderId" text,
  "salesOrderNumber" text,
  "billingCode" text,
  "billingReady" boolean not null default false,
  "billingHold" boolean not null default false,
  "billingHoldReason" text,
  "invoiceId" text,
  "invoiceNumber" text,
  "billableAmount" numeric(12,2),
  "laborCost" numeric(12,2),
  "partsCost" numeric(12,2),
  "totalCost" numeric(12,2),
  warranty boolean not null default false,
  "warrantyRef" text,
  "slaBreached" boolean not null default false,
  "followUpRequired" boolean not null default false,
  "followUpNotes" text,
  resolution text,
  "completionSignedBy" text,
  "completionSignature" text,
  "techSignature" text,
  "assetId" text,
  "assetName" text,
  tags text[] not null default '{}'::text[],
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

create table if not exists public.sales_orders (
  id text primary key,
  "soNumber" text not null unique,
  "customerId" text not null,
  "customerName" text not null,
  "linkedJobId" text,
  "linkedJobNumber" text,
  status text not null,
  memo text,
  "tranDate" date not null,
  "dueDate" date,
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  "taxRate" numeric(10,2),
  "taxAmount" numeric(12,2),
  total numeric(12,2) not null default 0,
  "amountPaid" numeric(12,2),
  balance numeric(12,2),
  "paymentMode" text,
  "billingCode" text,
  "billingHold" boolean not null default false,
  "billingHoldReason" text,
  "invoiceId" text,
  "invoiceNumber" text,
  terms text,
  "updatedAt" timestamptz,
  "createdAt" timestamptz not null
);

create table if not exists public.job_notes (
  id text primary key,
  "jobId" text not null,
  text text not null,
  type text not null,
  visibility text not null,
  "authorId" text not null,
  "authorName" text not null,
  "createdAt" timestamptz not null
);

create table if not exists public.time_entries (
  id text primary key,
  "jobId" text not null,
  "technicianId" text not null,
  "technicianName" text not null,
  type text not null,
  date date not null,
  "startTime" text not null,
  "endTime" text,
  duration numeric(10,2) not null,
  notes text,
  billable boolean not null default true
);

create table if not exists public.parts (
  id text primary key,
  "jobId" text not null,
  "itemId" text not null,
  "itemName" text not null,
  "partNumber" text,
  description text,
  quantity numeric(10,2) not null,
  "unitCost" numeric(12,2) not null,
  "totalCost" numeric(12,2) not null,
  supplier text,
  "serialNumber" text,
  warranty boolean not null default false,
  "installedDate" date
);

create table if not exists public.attachments (
  id text primary key,
  "customerId" text,
  "jobId" text,
  "jobNumber" text,
  "soId" text,
  "soNumber" text,
  name text not null,
  type text not null,
  size bigint not null,
  url text not null,
  source text not null,
  "uploadedBy" text not null,
  "createdAt" timestamptz not null
);

create table if not exists public.checklist_items (
  id text primary key,
  label text not null,
  required boolean not null default false,
  "order" integer not null,
  type text not null
);

create table if not exists public.checklist_responses (
  id text primary key,
  "jobId" text not null,
  "itemId" text not null,
  checked boolean not null default false,
  notes text,
  "technicianId" text,
  "completedAt" timestamptz
);

create table if not exists public.service_history (
  id text primary key,
  "jobId" text not null,
  "jobNumber" text not null,
  date date not null,
  type text not null,
  summary text not null,
  "technicianName" text not null,
  duration numeric(10,2),
  parts integer,
  resolution text
);

create index if not exists jobs_category_status_idx on public.jobs (category, status);
create index if not exists jobs_customer_idx on public.jobs ("customerId");
create index if not exists jobs_technician_idx on public.jobs ("technicianId");
create index if not exists jobs_schedule_idx on public.jobs ("scheduledDate");
create index if not exists jobs_sales_order_idx on public.jobs ("salesOrderId");
create index if not exists sales_orders_customer_idx on public.sales_orders ("customerId");
create index if not exists sales_orders_linked_job_idx on public.sales_orders ("linkedJobId");
create index if not exists job_notes_job_idx on public.job_notes ("jobId", "createdAt");
create index if not exists time_entries_job_idx on public.time_entries ("jobId", date);
create index if not exists parts_job_idx on public.parts ("jobId");
create index if not exists attachments_job_idx on public.attachments ("jobId", "createdAt");
create index if not exists attachments_customer_idx on public.attachments ("customerId");
create index if not exists checklist_responses_job_idx on public.checklist_responses ("jobId");
create index if not exists assets_customer_idx on public.assets ("customerId");
create index if not exists service_history_job_idx on public.service_history ("jobId", date);

alter table public.customers enable row level security;
alter table public.technicians enable row level security;
alter table public.assets enable row level security;
alter table public.jobs enable row level security;
alter table public.sales_orders enable row level security;
alter table public.job_notes enable row level security;
alter table public.time_entries enable row level security;
alter table public.parts enable row level security;
alter table public.attachments enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_responses enable row level security;
alter table public.service_history enable row level security;

drop policy if exists "demo_customers_select" on public.customers;
drop policy if exists "demo_customers_insert" on public.customers;
drop policy if exists "demo_customers_update" on public.customers;
create policy "demo_customers_select" on public.customers for select to anon, authenticated using (true);
create policy "demo_customers_insert" on public.customers for insert to anon, authenticated with check (true);
create policy "demo_customers_update" on public.customers for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_technicians_select" on public.technicians;
drop policy if exists "demo_technicians_insert" on public.technicians;
drop policy if exists "demo_technicians_update" on public.technicians;
create policy "demo_technicians_select" on public.technicians for select to anon, authenticated using (true);
create policy "demo_technicians_insert" on public.technicians for insert to anon, authenticated with check (true);
create policy "demo_technicians_update" on public.technicians for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_assets_select" on public.assets;
drop policy if exists "demo_assets_insert" on public.assets;
drop policy if exists "demo_assets_update" on public.assets;
create policy "demo_assets_select" on public.assets for select to anon, authenticated using (true);
create policy "demo_assets_insert" on public.assets for insert to anon, authenticated with check (true);
create policy "demo_assets_update" on public.assets for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_jobs_select" on public.jobs;
drop policy if exists "demo_jobs_insert" on public.jobs;
drop policy if exists "demo_jobs_update" on public.jobs;
create policy "demo_jobs_select" on public.jobs for select to anon, authenticated using (true);
create policy "demo_jobs_insert" on public.jobs for insert to anon, authenticated with check (true);
create policy "demo_jobs_update" on public.jobs for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_sales_orders_select" on public.sales_orders;
drop policy if exists "demo_sales_orders_insert" on public.sales_orders;
drop policy if exists "demo_sales_orders_update" on public.sales_orders;
create policy "demo_sales_orders_select" on public.sales_orders for select to anon, authenticated using (true);
create policy "demo_sales_orders_insert" on public.sales_orders for insert to anon, authenticated with check (true);
create policy "demo_sales_orders_update" on public.sales_orders for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_job_notes_select" on public.job_notes;
drop policy if exists "demo_job_notes_insert" on public.job_notes;
drop policy if exists "demo_job_notes_update" on public.job_notes;
create policy "demo_job_notes_select" on public.job_notes for select to anon, authenticated using (true);
create policy "demo_job_notes_insert" on public.job_notes for insert to anon, authenticated with check (true);
create policy "demo_job_notes_update" on public.job_notes for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_time_entries_select" on public.time_entries;
drop policy if exists "demo_time_entries_insert" on public.time_entries;
drop policy if exists "demo_time_entries_update" on public.time_entries;
create policy "demo_time_entries_select" on public.time_entries for select to anon, authenticated using (true);
create policy "demo_time_entries_insert" on public.time_entries for insert to anon, authenticated with check (true);
create policy "demo_time_entries_update" on public.time_entries for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_parts_select" on public.parts;
drop policy if exists "demo_parts_insert" on public.parts;
drop policy if exists "demo_parts_update" on public.parts;
create policy "demo_parts_select" on public.parts for select to anon, authenticated using (true);
create policy "demo_parts_insert" on public.parts for insert to anon, authenticated with check (true);
create policy "demo_parts_update" on public.parts for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_attachments_select" on public.attachments;
drop policy if exists "demo_attachments_insert" on public.attachments;
drop policy if exists "demo_attachments_update" on public.attachments;
create policy "demo_attachments_select" on public.attachments for select to anon, authenticated using (true);
create policy "demo_attachments_insert" on public.attachments for insert to anon, authenticated with check (true);
create policy "demo_attachments_update" on public.attachments for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_checklist_items_select" on public.checklist_items;
drop policy if exists "demo_checklist_items_insert" on public.checklist_items;
drop policy if exists "demo_checklist_items_update" on public.checklist_items;
create policy "demo_checklist_items_select" on public.checklist_items for select to anon, authenticated using (true);
create policy "demo_checklist_items_insert" on public.checklist_items for insert to anon, authenticated with check (true);
create policy "demo_checklist_items_update" on public.checklist_items for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_checklist_responses_select" on public.checklist_responses;
drop policy if exists "demo_checklist_responses_insert" on public.checklist_responses;
drop policy if exists "demo_checklist_responses_update" on public.checklist_responses;
create policy "demo_checklist_responses_select" on public.checklist_responses for select to anon, authenticated using (true);
create policy "demo_checklist_responses_insert" on public.checklist_responses for insert to anon, authenticated with check (true);
create policy "demo_checklist_responses_update" on public.checklist_responses for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo_service_history_select" on public.service_history;
drop policy if exists "demo_service_history_insert" on public.service_history;
drop policy if exists "demo_service_history_update" on public.service_history;
create policy "demo_service_history_select" on public.service_history for select to anon, authenticated using (true);
create policy "demo_service_history_insert" on public.service_history for insert to anon, authenticated with check (true);
create policy "demo_service_history_update" on public.service_history for update to anon, authenticated using (true) with check (true);

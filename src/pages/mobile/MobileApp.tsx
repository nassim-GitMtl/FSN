import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore, useJobStore, useSOStore, useTechStore, useUIStore } from '@/store';
import { formatDate, formatCurrency, cn, STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/utils';
import type {
  Attachment,
  ChecklistItem,
  ChecklistResponse,
  Job,
  JobStatus,
  SalesOrder,
  Technician,
  TimeEntry,
} from '@/types';

// ── Bottom nav tabs ───────────────────────────────────────────────────────────

type MobileTab = 'home' | 'jobs' | 'sales' | 'schedule' | 'profile';

const NAV_ITEMS: Array<{ id: MobileTab; label: string; icon: string }> = [
  { id: 'home',     label: 'Home',     icon: '⬡' },
  { id: 'jobs',     label: 'Jobs',     icon: '🔧' },
  { id: 'sales',    label: 'Sales',    icon: '🧾' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'profile',  label: 'Profile',  icon: '👤' },
];

const STATUS_TRANSITIONS: Record<string, JobStatus[]> = {
  SCHEDULED:  ['EN_ROUTE'],
  DISPATCHED: ['EN_ROUTE'],
  EN_ROUTE:   ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD:    ['IN_PROGRESS'],
  COMPLETED: ['BILLING_READY'],
  BILLING_READY: ['INVOICED'],
};

function getPreviewTechnicianId(
  user: { workspace: 'SERVICE' | 'INSTALLATION'; technicianId?: string } | null,
  technicians: Technician[],
) {
  if (user?.technicianId) return user.technicianId;

  const category = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';
  return technicians.find((technician) => technician.category === category)?.id || technicians[0]?.id;
}

function getTechnicianSalesOrders(previewTechnicianId: string | undefined, jobs: Job[], salesOrders: SalesOrder[]) {
  const jobIds = new Set(
    jobs
      .filter((job) => job.technicianId === previewTechnicianId)
      .map((job) => job.id),
  );

  return salesOrders.filter((order) => order.linkedJobId && jobIds.has(order.linkedJobId));
}

const EMPTY_MOBILE_TIME_DRAFT = {
  type: 'REGULAR' as TimeEntry['type'],
  date: new Date().toISOString().split('T')[0],
  startTime: '08:00',
  endTime: '10:00',
  duration: '2',
  billable: true,
  notes: '',
};

const EMPTY_MOBILE_PART_DRAFT = {
  itemName: '',
  partNumber: '',
  description: '',
  quantity: '1',
  unitCost: '',
  warranty: false,
};

const EMPTY_MOBILE_FILE_DRAFT = {
  name: '',
  type: 'application/pdf',
  source: 'JOB' as Attachment['source'],
};

function buildChecklistState(items: ChecklistItem[], responses: ChecklistResponse[]) {
  return items.map((item) => ({
    item,
    response: responses.find((response) => response.itemId === item.id),
  }));
}

function getMobileBillingValidations(job: Job, timeEntries: TimeEntry[]) {
  if (job.warranty) {
    return [{ ok: true, label: 'Warranty job — billing validation skipped' }];
  }

  return [
    { ok: Boolean(job.resolution), label: 'Resolution summary provided' },
    { ok: timeEntries.length > 0, label: 'At least one time entry recorded' },
    { ok: Boolean(job.actualEnd), label: 'Actual end time recorded' },
    { ok: !job.billingHold, label: 'Not on billing hold' },
  ];
}

// ── Mobile App Root ───────────────────────────────────────────────────────────

export const MobileApp: React.FC = () => {
  const { user } = useAuthStore();
  const technicians = useTechStore(s => s.technicians);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<string | null>(null);
  const previewTechnicianId = getPreviewTechnicianId(user, technicians);

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#0f0f14] text-white overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
      {/* Status bar simulation */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 flex-shrink-0">
        <div className="text-xs font-semibold opacity-80">
          {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
        <div className="flex items-center gap-1.5 opacity-80">
          <div className="flex gap-0.5">
            {[1,2,3,4].map(i => <div key={i} className="w-1 rounded-sm bg-white" style={{ height: `${i * 3}px` }} />)}
          </div>
          <div className="text-xs">●●●</div>
          <div className="text-xs font-medium">100%</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedSalesOrderId ? (
          <MobileSalesOrderDetail salesOrderId={selectedSalesOrderId} onBack={() => setSelectedSalesOrderId(null)} />
        ) : selectedJobId ? (
          <MobileJobDetail jobId={selectedJobId} onBack={() => setSelectedJobId(null)} onOpenSalesOrder={setSelectedSalesOrderId} />
        ) : (
          <>
            {activeTab === 'home'     && <MobileHome onSelectJob={setSelectedJobId} previewTechnicianId={previewTechnicianId} />}
            {activeTab === 'jobs'     && <MobileJobList onSelectJob={setSelectedJobId} previewTechnicianId={previewTechnicianId} />}
            {activeTab === 'sales'    && <MobileSalesOrders onSelectSalesOrder={setSelectedSalesOrderId} previewTechnicianId={previewTechnicianId} />}
            {activeTab === 'schedule' && <MobileSchedule onSelectJob={setSelectedJobId} previewTechnicianId={previewTechnicianId} />}
            {activeTab === 'profile'  && <MobileProfile previewTechnicianId={previewTechnicianId} />}
          </>
        )}
      </div>

      {/* Bottom nav */}
      {!selectedJobId && !selectedSalesOrderId && (
        <div className="flex-shrink-0 flex items-center bg-[#1a1a24]/90 backdrop-blur-xl border-t border-white/10 pb-safe"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex-1 flex flex-col items-center py-2 gap-0.5 transition-all',
                activeTab === item.id ? 'text-brand-300' : 'text-white/40 hover:text-white/70'
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Home Screen ───────────────────────────────────────────────────────────────

const MobileHome: React.FC<{ onSelectJob: (id: string) => void; previewTechnicianId?: string }> = ({ onSelectJob, previewTechnicianId }) => {
  const { user } = useAuthStore();
  const jobs = useJobStore(s => s.jobs);

  const today = new Date().toISOString().split('T')[0];
  const myJobs = jobs.filter(j =>
    j.technicianId === previewTechnicianId &&
    !['CANCELLED', 'INVOICED'].includes(j.status)
  );
  const todayJobs = myJobs.filter(j => j.scheduledDate === today);
  const activeJob = myJobs.find(j => ['EN_ROUTE', 'IN_PROGRESS'].includes(j.status));

  return (
    <div className="h-full overflow-y-auto px-4 py-2">
      {/* Greeting */}
      <div className="mb-6 mt-2">
        <div className="text-white/50 text-sm">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'},</div>
        <div className="text-2xl font-bold">{user?.name?.split(' ')[0]}</div>
      </div>

      {/* Active job banner */}
      {activeJob && (
        <button onClick={() => onSelectJob(activeJob.id)}
          className="w-full mb-4 bg-gradient-to-r from-brand-600 to-cyan-600 rounded-2xl p-4 text-left shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Active Job</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{STATUS_LABELS[activeJob.status]}</span>
          </div>
          <div className="font-bold text-lg">{activeJob.customerName}</div>
          <div className="text-sm opacity-80">{activeJob.description.substring(0, 60)}</div>
          <div className="text-xs opacity-60 mt-1">📍 {activeJob.serviceAddress.city}</div>
        </button>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Today's Jobs", value: todayJobs.length, color: 'from-brand-500 to-brand-600' },
          { label: 'Total Assigned', value: myJobs.length, color: 'from-cyan-500 to-cyan-600' },
          { label: 'Completed', value: myJobs.filter(j => j.status === 'COMPLETED').length, color: 'from-emerald-500 to-emerald-600' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-[10px] opacity-80 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today's jobs */}
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Today — {todayJobs.length} jobs</div>
        {todayJobs.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">No jobs scheduled for today</div>
        ) : todayJobs.map(j => (
          <MobileJobCard key={j.id} job={j} onSelect={onSelectJob} />
        ))}
      </div>
    </div>
  );
};

// ── Job List ──────────────────────────────────────────────────────────────────

const MobileJobList: React.FC<{ onSelectJob: (id: string) => void; previewTechnicianId?: string }> = ({ onSelectJob, previewTechnicianId }) => {
  const jobs = useJobStore(s => s.jobs);
  const [filter, setFilter] = useState('');

  const myJobs = jobs.filter(j =>
    j.technicianId === previewTechnicianId &&
    !['CANCELLED', 'INVOICED'].includes(j.status)
  ).filter(j => filter === '' || j.status === filter);

  const upcoming = myJobs.filter(j => j.scheduledDate && j.scheduledDate >= new Date().toISOString().split('T')[0]).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold mb-3">My Jobs</h1>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[
            { value: '', label: 'All' },
            { value: 'SCHEDULED', label: 'Scheduled' },
            { value: 'EN_ROUTE', label: 'En Route' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'COMPLETED', label: 'Done' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all',
                filter === f.value ? 'bg-brand-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        {myJobs.length === 0 ? (
          <div className="text-center py-16 text-white/30">No jobs found</div>
        ) : myJobs.map(j => (
          <MobileJobCard key={j.id} job={j} onSelect={onSelectJob} />
        ))}
      </div>
    </div>
  );
};

// ── Schedule ──────────────────────────────────────────────────────────────────

const MobileSchedule: React.FC<{ onSelectJob: (id: string) => void; previewTechnicianId?: string }> = ({ onSelectJob, previewTechnicianId }) => {
  const jobs = useJobStore(s => s.jobs);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(today.toISOString().split('T')[0]);

  // Next 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const myJobs = jobs.filter(j => j.technicianId === previewTechnicianId);
  const dayJobs = myJobs.filter(j => j.scheduledDate === selectedDay);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold mb-3">Schedule</h1>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {days.map(d => {
            const dt = new Date(d + 'T12:00:00');
            const count = myJobs.filter(j => j.scheduledDate === d).length;
            const isToday = d === today.toISOString().split('T')[0];
            return (
              <button key={d} onClick={() => setSelectedDay(d)}
                className={cn('flex flex-col items-center px-3 py-2 rounded-2xl flex-shrink-0 transition-all min-w-12',
                  selectedDay === d ? 'bg-brand-500' : isToday ? 'bg-white/20' : 'bg-white/8 hover:bg-white/15'
                )}>
                <div className="text-[10px] opacity-70">{dt.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-base font-bold">{dt.getDate()}</div>
                {count > 0 && <div className="text-[9px] bg-white/30 rounded-full px-1">{count}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        <div className="text-xs text-white/40 mb-2">
          {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' — '}
          {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
        </div>
        {dayJobs.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">No jobs on this day</div>
        ) : dayJobs.map(j => (
          <MobileJobCard key={j.id} job={j} onSelect={onSelectJob} />
        ))}
      </div>
    </div>
  );
};

// ── Sales Orders ──────────────────────────────────────────────────────────────

const MobileSalesOrders: React.FC<{ onSelectSalesOrder: (id: string) => void; previewTechnicianId?: string }> = ({ onSelectSalesOrder, previewTechnicianId }) => {
  const jobs = useJobStore((state) => state.jobs);
  const salesOrders = useSOStore((state) => state.salesOrders);
  const [statusFilter, setStatusFilter] = useState('');

  const mySalesOrders = getTechnicianSalesOrders(previewTechnicianId, jobs, salesOrders)
    .filter((salesOrder) => !statusFilter || salesOrder.status === statusFilter)
    .sort((left, right) => right.tranDate.localeCompare(left.tranDate));

  const outstanding = mySalesOrders.reduce((sum, salesOrder) => sum + (salesOrder.balance || 0), 0);
  const onHold = mySalesOrders.filter((salesOrder) => salesOrder.billingHold).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 px-4 py-3">
        <h1 className="mb-3 text-xl font-bold">Sales Orders</h1>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { label: 'My SOs', value: mySalesOrders.length },
            { label: 'Outstanding', value: formatCurrency(outstanding) },
            { label: 'On Hold', value: String(onHold) },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/8 p-3">
              <div className="text-sm font-semibold">{item.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['', 'Pending Approval', 'Approved', 'Partially Billed', 'Fully Billed'].map((status) => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                statusFilter === status ? 'bg-brand-500 text-white' : 'bg-white/10 text-white/65',
              )}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {mySalesOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/30">No sales orders linked to this technician yet.</div>
        ) : mySalesOrders.map((salesOrder) => (
          <MobileSalesOrderCard key={salesOrder.id} salesOrder={salesOrder} onSelect={() => onSelectSalesOrder(salesOrder.id)} />
        ))}
      </div>
    </div>
  );
};

// ── Profile ───────────────────────────────────────────────────────────────────

const MobileProfile: React.FC<{ previewTechnicianId?: string }> = ({ previewTechnicianId }) => {
  const { user, logout } = useAuthStore();
  const { syncState, triggerSync } = useUIStore();
  const jobs = useJobStore(s => s.jobs);
  const previewTechnician = useTechStore(s => s.technicians.find(t => t.id === previewTechnicianId));

  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  const myJobs = jobs.filter(job => job.technicianId === previewTechnicianId && !['CANCELLED', 'INVOICED'].includes(job.status));
  const completedJobs = myJobs.filter(job => ['COMPLETED', 'BILLING_READY', 'INVOICED'].includes(job.status));
  const completedWithDuration = completedJobs.filter(job => job.actualDuration);
  const avgDuration = completedWithDuration.length > 0
    ? Math.round((completedWithDuration.reduce((sum, job) => sum + (job.actualDuration || 0), 0) / completedWithDuration.length) * 10) / 10
    : 0;

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold mb-4">Profile</h1>
      <div className="bg-white/10 rounded-2xl p-4 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center text-2xl font-bold">
          {user.avatarInitials}
        </div>
        <div>
          <div className="text-lg font-bold">{user.name}</div>
          <div className="text-sm opacity-60">{user.role}</div>
          <div className="text-xs text-brand-300 mt-1">{user.workspace} workspace</div>
        </div>
      </div>

      {previewTechnician && previewTechnician.id !== user.technicianId && (
        <div className="mb-4 rounded-2xl border border-brand-400/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-200">
          Previewing technician mobile for {previewTechnician.name}
        </div>
      )}

      {[
        { label: 'My Jobs Today', value: String(myJobs.filter(job => job.scheduledDate === today).length) },
        { label: 'Total Completed (all time)', value: String(completedJobs.length) },
        { label: 'Avg Job Duration', value: avgDuration > 0 ? `${avgDuration}h` : '—' },
      ].map(row => (
        <div key={row.label} className="flex items-center justify-between py-3 border-b border-white/10">
          <span className="text-sm opacity-70">{row.label}</span>
          <span className="font-semibold">{row.value}</span>
        </div>
      ))}

      <button
        onClick={() => triggerSync()}
        disabled={syncState.status === 'SYNCING'}
        className="w-full mt-6 py-3 bg-brand-500/20 text-brand-300 rounded-2xl font-medium text-sm hover:bg-brand-500/30 disabled:opacity-50 transition-colors"
      >
        {syncState.status === 'SYNCING'
          ? 'Saving…'
          : syncState.pendingChanges > 0
            ? `Save ${syncState.pendingChanges} changes`
            : syncState.lastSync
              ? `Refresh data · Last ${new Date(syncState.lastSync).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : 'Refresh data'}
      </button>

      <button onClick={logout} className="w-full mt-3 py-3 bg-red-500/20 text-red-400 rounded-2xl font-medium text-sm hover:bg-red-500/30 transition-colors">
        Sign Out
      </button>
    </div>
  );
};

// ── Job Card ──────────────────────────────────────────────────────────────────

const MobileJobCard: React.FC<{ job: Job; onSelect: (id: string) => void }> = ({ job, onSelect }) => {
  const STATUS_BG: Record<string, string> = {
    NEW: 'border-l-slate-400',
    SCHEDULED: 'border-l-blue-400',
    DISPATCHED: 'border-l-cyan-400',
    EN_ROUTE: 'border-l-amber-400',
    IN_PROGRESS: 'border-l-brand-400',
    ON_HOLD: 'border-l-orange-400',
    COMPLETED: 'border-l-emerald-400',
  };

  return (
    <button onClick={() => onSelect(job.id)}
      className={cn('w-full bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 text-left border-l-4 transition-all hover:bg-white/15', STATUS_BG[job.status] || 'border-l-white/20')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold text-brand-300">{job.jobNumber}</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{STATUS_LABELS[job.status]}</span>
          </div>
          <div className="font-semibold text-sm truncate">{job.customerName}</div>
          <div className="text-xs opacity-60 truncate">{job.description.substring(0, 55)}</div>
        </div>
        <div className="text-right flex-shrink-0">
          {job.scheduledStart && <div className="text-xs text-brand-300">{job.scheduledStart}</div>}
          {job.estimatedDuration && <div className="text-[10px] opacity-50">{job.estimatedDuration}h est.</div>}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs opacity-50">
        <span>📍 {job.serviceAddress.city}</span>
        {job.scheduledDate && <span>📅 {formatDate(job.scheduledDate)}</span>}
      </div>
    </button>
  );
};

const MobileSalesOrderCard: React.FC<{ salesOrder: SalesOrder; onSelect: () => void }> = ({ salesOrder, onSelect }) => (
  <button onClick={onSelect} className="w-full rounded-2xl border border-white/10 bg-white/8 p-3.5 text-left transition-all hover:bg-white/12">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-300">{salesOrder.soNumber}</span>
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{salesOrder.status}</span>
        </div>
        <div className="mt-1 truncate text-sm font-semibold">{salesOrder.customerName}</div>
        <div className="mt-1 truncate text-xs opacity-60">{salesOrder.memo || salesOrder.linkedJobNumber || 'No memo'}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold">{formatCurrency(salesOrder.total)}</div>
        <div className="text-[10px] opacity-50">Bal. {formatCurrency(salesOrder.balance || 0)}</div>
      </div>
    </div>
    <div className="mt-2 flex items-center gap-3 text-xs opacity-50">
      <span>{salesOrder.linkedJobNumber || 'No job link'}</span>
      {salesOrder.invoiceNumber && <span>{salesOrder.invoiceNumber}</span>}
      {salesOrder.billingHold && <span className="text-amber-300">On hold</span>}
    </div>
  </button>
);

// ── Job Detail (mobile) ───────────────────────────────────────────────────────

const MobileJobDetail: React.FC<{ jobId: string; onBack: () => void; onOpenSalesOrder: (id: string) => void }> = ({ jobId, onBack, onOpenSalesOrder }) => {
  const {
    getJob,
    getNotes,
    getTimeEntries,
    getParts,
    updateJob,
    updateStatus,
    addNote,
    addTimeEntry,
    addPart,
    rescheduleJob,
    markBillingReady,
    setBillingHold,
    removeBillingHold,
    generateInvoice,
    getChecklistItems,
    getChecklistResponses,
    upsertChecklistResponse,
    getUnifiedFilesForJob,
    addAttachment,
  } = useJobStore();
  const { getSOsForJob, createSO } = useSOStore();
  const { user } = useAuthStore();
  const { toast } = useUIStore();
  const job = getJob(jobId);
  const [activeTab, setActiveTab] = useState('info');
  const [noteText, setNoteText] = useState('');
  const [jobDraft, setJobDraft] = useState({
    resolution: '',
    billingCode: '',
    followUpRequired: false,
    followUpNotes: '',
  });
  const [timeDraft, setTimeDraft] = useState(EMPTY_MOBILE_TIME_DRAFT);
  const [partDraft, setPartDraft] = useState(EMPTY_MOBILE_PART_DRAFT);
  const [rescheduleDraft, setRescheduleDraft] = useState({
    scheduledDate: '',
    scheduledStart: '',
    scheduledEnd: '',
    reason: '',
  });
  const [holdReason, setHoldReason] = useState('');
  const [fileDraft, setFileDraft] = useState(EMPTY_MOBILE_FILE_DRAFT);

  useEffect(() => {
    if (!job) return;

    setJobDraft({
      resolution: job.resolution || '',
      billingCode: job.billingCode || '',
      followUpRequired: Boolean(job.followUpRequired),
      followUpNotes: job.followUpNotes || '',
    });
    setRescheduleDraft({
      scheduledDate: job.scheduledDate || new Date().toISOString().split('T')[0],
      scheduledStart: job.scheduledStart || '',
      scheduledEnd: job.scheduledEnd || '',
      reason: '',
    });
    setHoldReason(job.billingHoldReason || '');
    setTimeDraft((current) => ({ ...current, date: job.scheduledDate || current.date }));
  }, [
    job?.id,
    job?.resolution,
    job?.billingCode,
    job?.followUpRequired,
    job?.followUpNotes,
    job?.scheduledDate,
    job?.scheduledStart,
    job?.scheduledEnd,
    job?.billingHoldReason,
  ]);

  if (!job) return null;

  const notes = getNotes(job.id);
  const timeEntries = getTimeEntries(job.id);
  const parts = getParts(job.id);
  const salesOrders = getSOsForJob(job.id);
  const primarySalesOrder = salesOrders[0];
  const checklist = buildChecklistState(getChecklistItems(), getChecklistResponses(job.id));
  const files = getUnifiedFilesForJob(job.id);
  const nextStatuses = STATUS_TRANSITIONS[job.status] || [];
  const billingValidations = getMobileBillingValidations(job, timeEntries);
  const billingReady = job.billingReady || job.status === 'BILLING_READY' || job.status === 'INVOICED';
  const allBillingValid = billingValidations.every((validation) => validation.ok);
  const checklistCompleted = checklist.filter((entry) => entry.response?.checked).length;
  const totalTimeHours = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
  const totalPartsCost = parts.reduce((sum, part) => sum + part.totalCost, 0);

  const TABS = [
    { id: 'info',     label: 'Info' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'sales',    label: `Sales (${salesOrders.length})` },
    { id: 'time',     label: `Time (${timeEntries.length})` },
    { id: 'parts',    label: `Parts (${parts.length})` },
    { id: 'checklist', label: `Checklist (${checklistCompleted}/${checklist.length || 0})` },
    { id: 'files',    label: `Files (${files.length})` },
    { id: 'billing',  label: 'Billing' },
    { id: 'notes',    label: 'Notes' },
    { id: 'signoff',  label: 'Sign-off' },
  ];

  const handleStatusChange = (status: JobStatus) => {
    updateStatus(job.id, status);
    toast('success', `Status: ${STATUS_LABELS[status]}`);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(job.id, noteText, 'TECHNICIAN', user?.id || 'u-tech', user?.name || 'Tech');
    setNoteText('');
    toast('success', 'Note saved');
  };

  const handleSaveJobUpdates = () => {
    updateJob(job.id, {
      resolution: jobDraft.resolution.trim() || undefined,
      billingCode: jobDraft.billingCode.trim() || undefined,
      followUpRequired: jobDraft.followUpRequired,
      followUpNotes: jobDraft.followUpNotes.trim() || undefined,
    });
    toast('success', 'Job updates saved');
  };

  const handleAddTimeEntry = () => {
    if (!timeDraft.date || !timeDraft.startTime) return;

    addTimeEntry({
      jobId: job.id,
      technicianId: job.technicianId || user?.technicianId || 'tech-unassigned',
      technicianName: job.technicianName || user?.name || 'Unassigned',
      type: timeDraft.type,
      date: timeDraft.date,
      startTime: timeDraft.startTime,
      endTime: timeDraft.endTime || undefined,
      duration: Number(timeDraft.duration) || 0,
      notes: timeDraft.notes.trim() || undefined,
      billable: timeDraft.billable,
    });
    setTimeDraft({ ...EMPTY_MOBILE_TIME_DRAFT, date: job.scheduledDate || EMPTY_MOBILE_TIME_DRAFT.date });
    toast('success', 'Time entry added');
  };

  const handleAddPart = () => {
    const quantity = Number(partDraft.quantity) || 0;
    const unitCost = Number(partDraft.unitCost) || 0;
    if (!partDraft.itemName.trim() || quantity <= 0) return;

    addPart({
      jobId: job.id,
      itemId: `item-${Date.now()}`,
      itemName: partDraft.itemName.trim(),
      partNumber: partDraft.partNumber.trim() || undefined,
      description: partDraft.description.trim() || undefined,
      quantity,
      unitCost,
      totalCost: Math.round(quantity * unitCost * 100) / 100,
      warranty: partDraft.warranty,
    });
    setPartDraft(EMPTY_MOBILE_PART_DRAFT);
    toast('success', 'Part added');
  };

  const handleReschedule = () => {
    if (!rescheduleDraft.scheduledDate) return;

    rescheduleJob(job.id, {
      scheduledDate: rescheduleDraft.scheduledDate,
      scheduledStart: rescheduleDraft.scheduledStart || undefined,
      scheduledEnd: rescheduleDraft.scheduledEnd || undefined,
      reason: rescheduleDraft.reason.trim() || undefined,
    });
    setRescheduleDraft((current) => ({ ...current, reason: '' }));
    toast('success', 'Job rescheduled');
  };

  const handleCreateSalesOrder = () => {
    const salesOrder = createSO({
      customerId: job.customerId,
      customerName: job.customerName,
      linkedJobId: job.id,
      linkedJobNumber: job.jobNumber,
      memo: `Work order ${job.jobNumber} — ${job.description}`,
      billingCode: job.billingCode,
    });
    toast('success', `Sales order ${salesOrder.soNumber} created`);
    onOpenSalesOrder(salesOrder.id);
  };

  const handleAddFile = () => {
    if (!fileDraft.name.trim()) return;
    if (fileDraft.source === 'SALES_ORDER' && !primarySalesOrder) {
      toast('error', 'Create a sales order before attaching SO files');
      return;
    }

    addAttachment({
      customerId: job.customerId,
      jobId: fileDraft.source === 'JOB' ? job.id : undefined,
      jobNumber: fileDraft.source === 'JOB' ? job.jobNumber : undefined,
      soId: fileDraft.source === 'SALES_ORDER' ? primarySalesOrder?.id : undefined,
      soNumber: fileDraft.source === 'SALES_ORDER' ? primarySalesOrder?.soNumber : undefined,
      name: fileDraft.name.trim(),
      type: fileDraft.type,
      size: 128000,
      url: '#',
      source: fileDraft.source,
      uploadedBy: user?.name || 'System',
    });
    setFileDraft(EMPTY_MOBILE_FILE_DRAFT);
    toast('success', 'File attached');
  };

  const handleBillingReady = () => {
    if (!allBillingValid) return;
    markBillingReady(job.id);
    toast('success', 'Job marked billing ready');
  };

  const handleBillingHold = () => {
    if (job.billingHold) {
      removeBillingHold(job.id);
      setHoldReason('');
      toast('success', 'Billing hold removed');
      return;
    }

    if (!holdReason.trim()) return;
    setBillingHold(job.id, holdReason.trim());
    toast('success', 'Billing hold applied');
  };

  const handleGenerateInvoice = () => {
    const result = generateInvoice(job.id);
    if (result) {
      toast('success', `Invoice ${result.invoiceNumber} generated`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-300">{job.jobNumber}</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{STATUS_LABELS[job.status]}</span>
          </div>
          <div className="text-sm font-semibold truncate">{job.customerName}</div>
        </div>
      </div>

      {(job.slaBreached || job.status === 'ON_HOLD' || job.warranty) && (
        <div className="space-y-2 px-4 py-3">
          {job.slaBreached && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              SLA breached. This job needs immediate attention.
            </div>
          )}
          {job.status === 'ON_HOLD' && (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              Job is currently on hold.
            </div>
          )}
          {job.warranty && (
            <div className="rounded-2xl border border-brand-300/20 bg-brand-400/10 px-4 py-3 text-sm text-brand-100">
              Warranty job. Billing validation is bypassed.
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {nextStatuses.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {nextStatuses.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)}
              className="flex-shrink-0 px-3 py-2 bg-brand-500 text-white text-xs font-semibold rounded-xl hover:bg-brand-600 transition-colors">
              → {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-hide flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-medium flex-shrink-0 transition-all',
              activeTab === t.id ? 'bg-brand-500 text-white' : 'bg-white/10 text-white/60'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeTab === 'info' && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Scheduled', value: job.scheduledDate ? `${formatDate(job.scheduledDate)} ${job.scheduledStart || ''}`.trim() : 'Unscheduled' },
                { label: 'Sales Order', value: primarySalesOrder?.soNumber || job.salesOrderNumber || 'Not linked' },
                { label: 'Time Logged', value: `${totalTimeHours.toFixed(1)}h` },
                { label: 'Billable', value: job.warranty ? 'Warranty' : formatCurrency(job.billableAmount ?? job.totalCost ?? 0) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/8 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-white/40">{item.label}</div>
                  <div className="mt-2 text-sm font-semibold">{item.value}</div>
                </div>
              ))}
            </div>

            <InfoBlock>
              <InfoRow label="Job #" value={job.jobNumber} />
              <InfoRow label="Customer" value={job.customerName} />
              <InfoRow label="Contact" value={job.contactName} />
              <InfoRow label="Phone" value={job.contactPhone} link={`tel:${job.contactPhone}`} />
              <InfoRow label="Email" value={job.contactEmail} link={job.contactEmail ? `mailto:${job.contactEmail}` : undefined} />
              <InfoRow label="Address" value={`${job.serviceAddress.street}, ${job.serviceAddress.city}`} />
              <InfoRow label="Type" value={SERVICE_TYPE_LABELS[job.serviceType]} />
              <InfoRow label="Priority" value={job.priority} />
              <InfoRow label="Status" value={STATUS_LABELS[job.status]} />
              <InfoRow label="Technician" value={job.technicianName} />
              <InfoRow label="Scheduled Date" value={job.scheduledDate ? formatDate(job.scheduledDate) : undefined} />
              <InfoRow label="Start" value={job.scheduledStart} />
              <InfoRow label="End" value={job.scheduledEnd} />
              <InfoRow label="Billing Code" value={job.billingCode} />
              <InfoRow label="Sales Order" value={job.salesOrderNumber} />
              <InfoRow label="Invoice" value={job.invoiceNumber} />
              <InfoRow label="Asset" value={job.assetName} />
              <InfoRow label="Warranty Ref" value={job.warrantyRef} />
            </InfoBlock>
            <InfoBlock title="Description">
              <p className="text-sm opacity-80 leading-relaxed">{job.description}</p>
            </InfoBlock>
            {job.internalNotes && (
              <InfoBlock title="Dispatcher Notes">
                <p className="text-sm text-amber-300 leading-relaxed">{job.internalNotes}</p>
              </InfoBlock>
            )}
            {job.resolution && (
              <InfoBlock title="Resolution">
                <p className="text-sm opacity-80 leading-relaxed">{job.resolution}</p>
              </InfoBlock>
            )}
            <InfoBlock title="Technician Updates">
              <div className="space-y-3">
                <MobileField label="Resolution Summary">
                  <textarea
                    className="mobile-input min-h-[88px]"
                    value={jobDraft.resolution}
                    onChange={(event) => setJobDraft((current) => ({ ...current, resolution: event.target.value }))}
                    placeholder="What was done on site?"
                  />
                </MobileField>
                <MobileField label="Billing Code">
                  <input
                    className="mobile-input"
                    value={jobDraft.billingCode}
                    onChange={(event) => setJobDraft((current) => ({ ...current, billingCode: event.target.value }))}
                    placeholder="Enter billing code"
                  />
                </MobileField>
                <label className="flex items-center gap-3 rounded-2xl bg-white/6 px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={jobDraft.followUpRequired}
                    onChange={(event) => setJobDraft((current) => ({ ...current, followUpRequired: event.target.checked }))}
                  />
                  Follow-up required
                </label>
                <MobileField label="Follow-up Notes">
                  <textarea
                    className="mobile-input min-h-[72px]"
                    value={jobDraft.followUpNotes}
                    onChange={(event) => setJobDraft((current) => ({ ...current, followUpNotes: event.target.value }))}
                    placeholder="Anything the office should know?"
                  />
                </MobileField>
                <button onClick={handleSaveJobUpdates} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">
                  Save Updates
                </button>
              </div>
            </InfoBlock>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-3 pt-2">
            <InfoBlock title="Current Schedule">
              <InfoRow label="Date" value={job.scheduledDate ? formatDate(job.scheduledDate) : 'Not scheduled'} />
              <InfoRow label="Start" value={job.scheduledStart} />
              <InfoRow label="End" value={job.scheduledEnd} />
              <InfoRow label="Estimated" value={job.estimatedDuration ? `${job.estimatedDuration}h` : undefined} />
              <InfoRow label="Actual Start" value={job.actualStart ? new Date(job.actualStart).toLocaleString() : undefined} />
              <InfoRow label="Actual End" value={job.actualEnd ? new Date(job.actualEnd).toLocaleString() : undefined} />
            </InfoBlock>

            <InfoBlock title="Reschedule Job">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Date">
                    <input
                      className="mobile-input"
                      type="date"
                      value={rescheduleDraft.scheduledDate}
                      onChange={(event) => setRescheduleDraft((current) => ({ ...current, scheduledDate: event.target.value }))}
                    />
                  </MobileField>
                  <MobileField label="Start">
                    <input
                      className="mobile-input"
                      type="time"
                      value={rescheduleDraft.scheduledStart}
                      onChange={(event) => setRescheduleDraft((current) => ({ ...current, scheduledStart: event.target.value }))}
                    />
                  </MobileField>
                  <MobileField label="End">
                    <input
                      className="mobile-input"
                      type="time"
                      value={rescheduleDraft.scheduledEnd}
                      onChange={(event) => setRescheduleDraft((current) => ({ ...current, scheduledEnd: event.target.value }))}
                    />
                  </MobileField>
                </div>
                <MobileField label="Reason">
                  <textarea
                    className="mobile-input min-h-[72px]"
                    value={rescheduleDraft.reason}
                    onChange={(event) => setRescheduleDraft((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Why is the appointment moving?"
                  />
                </MobileField>
                <button onClick={handleReschedule} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">
                  Save Schedule
                </button>
              </div>
            </InfoBlock>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="space-y-3 pt-2">
            {salesOrders.length === 0 ? (
              <InfoBlock title="Sales Order">
                <div className="space-y-3 text-center">
                  <div className="rounded-2xl bg-white/6 px-4 py-6 text-sm text-white/40">
                    No sales order is linked to this job yet.
                  </div>
                  <button onClick={handleCreateSalesOrder} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">
                    Create Sales Order
                  </button>
                </div>
              </InfoBlock>
            ) : salesOrders.map((salesOrder) => (
              <MobileSalesOrderCard key={salesOrder.id} salesOrder={salesOrder} onSelect={() => onOpenSalesOrder(salesOrder.id)} />
            ))}
            {salesOrders.length > 0 && (
              <button onClick={handleCreateSalesOrder} className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/80">
                Create Another Sales Order
              </button>
            )}
          </div>
        )}

        {activeTab === 'time' && (
          <div className="space-y-3 pt-2">
            <InfoBlock title="Add Time Entry">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Type">
                    <select className="mobile-input" value={timeDraft.type} onChange={(event) => setTimeDraft((current) => ({ ...current, type: event.target.value as TimeEntry['type'] }))}>
                      {['REGULAR', 'TRAVEL', 'OVERTIME', 'EMERGENCY', 'TRAINING', 'ADMINISTRATIVE'].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </MobileField>
                  <MobileField label="Date">
                    <input className="mobile-input" type="date" value={timeDraft.date} onChange={(event) => setTimeDraft((current) => ({ ...current, date: event.target.value }))} />
                  </MobileField>
                  <MobileField label="Start">
                    <input className="mobile-input" type="time" value={timeDraft.startTime} onChange={(event) => setTimeDraft((current) => ({ ...current, startTime: event.target.value }))} />
                  </MobileField>
                  <MobileField label="End">
                    <input className="mobile-input" type="time" value={timeDraft.endTime} onChange={(event) => setTimeDraft((current) => ({ ...current, endTime: event.target.value }))} />
                  </MobileField>
                  <MobileField label="Duration (hrs)">
                    <input className="mobile-input" type="number" step="0.25" value={timeDraft.duration} onChange={(event) => setTimeDraft((current) => ({ ...current, duration: event.target.value }))} />
                  </MobileField>
                </div>
                <MobileField label="Notes">
                  <textarea className="mobile-input min-h-[72px]" value={timeDraft.notes} onChange={(event) => setTimeDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Travel, labor, access notes..." />
                </MobileField>
                <label className="flex items-center gap-3 rounded-2xl bg-white/6 px-3 py-3 text-sm">
                  <input type="checkbox" checked={timeDraft.billable} onChange={(event) => setTimeDraft((current) => ({ ...current, billable: event.target.checked }))} />
                  Billable entry
                </label>
                <button onClick={handleAddTimeEntry} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">
                  Add Time Entry
                </button>
              </div>
            </InfoBlock>

            {timeEntries.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">No time entries</div>
            ) : timeEntries.map(te => (
              <InfoBlock key={te.id}>
                <InfoRow label="Type" value={te.type} />
                <InfoRow label="Duration" value={`${te.duration}h`} />
                <InfoRow label="Date" value={formatDate(te.date)} />
                <InfoRow label="Time" value={`${te.startTime}${te.endTime ? ` - ${te.endTime}` : ''}`} />
                <InfoRow label="Billable" value={te.billable ? 'Yes' : 'No'} />
                {te.notes && <p className="mt-2 text-sm text-white/70">{te.notes}</p>}
              </InfoBlock>
            ))}
          </div>
        )}

        {activeTab === 'parts' && (
          <div className="space-y-3 pt-2">
            <InfoBlock title="Add Part">
              <div className="space-y-3">
                <MobileField label="Item Name">
                  <input className="mobile-input" value={partDraft.itemName} onChange={(event) => setPartDraft((current) => ({ ...current, itemName: event.target.value }))} placeholder="Part or material" />
                </MobileField>
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Part Number">
                    <input className="mobile-input" value={partDraft.partNumber} onChange={(event) => setPartDraft((current) => ({ ...current, partNumber: event.target.value }))} placeholder="Optional" />
                  </MobileField>
                  <MobileField label="Quantity">
                    <input className="mobile-input" type="number" min="1" step="1" value={partDraft.quantity} onChange={(event) => setPartDraft((current) => ({ ...current, quantity: event.target.value }))} />
                  </MobileField>
                  <MobileField label="Unit Cost">
                    <input className="mobile-input" type="number" step="0.01" value={partDraft.unitCost} onChange={(event) => setPartDraft((current) => ({ ...current, unitCost: event.target.value }))} />
                  </MobileField>
                </div>
                <MobileField label="Description">
                  <textarea className="mobile-input min-h-[72px]" value={partDraft.description} onChange={(event) => setPartDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Installed material details" />
                </MobileField>
                <label className="flex items-center gap-3 rounded-2xl bg-white/6 px-3 py-3 text-sm">
                  <input type="checkbox" checked={partDraft.warranty} onChange={(event) => setPartDraft((current) => ({ ...current, warranty: event.target.checked }))} />
                  Warranty-covered part
                </label>
                <button onClick={handleAddPart} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">
                  Add Part
                </button>
              </div>
            </InfoBlock>

            {parts.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">No parts added</div>
            ) : parts.map(p => (
              <InfoBlock key={p.id}>
                <InfoRow label="Item" value={p.itemName} />
                <InfoRow label="Part #" value={p.partNumber} />
                <InfoRow label="Qty" value={String(p.quantity)} />
                <InfoRow label="Unit Cost" value={formatCurrency(p.unitCost)} />
                <InfoRow label="Total" value={formatCurrency(p.totalCost)} />
                <InfoRow label="Warranty" value={p.warranty ? 'Yes' : 'No'} />
                {p.description && <p className="mt-2 text-sm text-white/70">{p.description}</p>}
              </InfoBlock>
            ))}
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-3 pt-2">
            <InfoBlock title="Completion Progress">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-white/60">Completed items</span>
                <span className="font-semibold">{checklistCompleted} / {checklist.length}</span>
              </div>
              <div className="h-2 rounded-full bg-white/8">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${checklist.length ? (checklistCompleted / checklist.length) * 100 : 0}%` }}
                />
              </div>
            </InfoBlock>

            {checklist.map(({ item, response }) => (
              <InfoBlock key={item.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/40">
                        {item.type}{item.required ? ' • Required' : ' • Optional'}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(response?.checked)}
                        onChange={(event) => upsertChecklistResponse(job.id, item.id, {
                          checked: event.target.checked,
                          notes: response?.notes,
                          technicianId: user?.technicianId,
                          completedAt: event.target.checked ? new Date().toISOString() : undefined,
                        })}
                      />
                      Done
                    </label>
                  </div>
                  <textarea
                    className="mobile-input min-h-[72px]"
                    value={response?.notes || ''}
                    onChange={(event) => upsertChecklistResponse(job.id, item.id, {
                      checked: response?.checked || false,
                      notes: event.target.value,
                      technicianId: user?.technicianId,
                    })}
                    placeholder="Add checklist notes"
                  />
                </div>
              </InfoBlock>
            ))}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-3 pt-2">
            <InfoBlock title="Attach File">
              <div className="space-y-3">
                <MobileField label="File Name">
                  <input className="mobile-input" value={fileDraft.name} onChange={(event) => setFileDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Photo, PDF, invoice backup..." />
                </MobileField>
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="File Type">
                    <select className="mobile-input" value={fileDraft.type} onChange={(event) => setFileDraft((current) => ({ ...current, type: event.target.value }))}>
                      {[
                        'application/pdf',
                        'image/jpeg',
                        'image/png',
                        'text/plain',
                      ].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </MobileField>
                  <MobileField label="Attach To">
                    <select className="mobile-input" value={fileDraft.source} onChange={(event) => setFileDraft((current) => ({ ...current, source: event.target.value as Attachment['source'] }))}>
                      <option value="JOB">Job</option>
                      <option value="SALES_ORDER" disabled={!primarySalesOrder}>Sales Order</option>
                    </select>
                  </MobileField>
                </div>
                <button onClick={handleAddFile} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">
                  Attach File
                </button>
              </div>
            </InfoBlock>

            {files.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">No files attached yet</div>
            ) : files.map((file) => (
              <InfoBlock key={file.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{file.name}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {file.source === 'JOB' ? (file.jobNumber || 'Job file') : (file.soNumber || 'Sales order file')}
                    </div>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-white/60">{file.source}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/45">
                  <span>{file.type}</span>
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                </div>
              </InfoBlock>
            ))}
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-3 pt-2">
            {job.invoiceNumber ? (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                Invoice {job.invoiceNumber} has been generated for this job.
              </div>
            ) : job.billingHold ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                Billing on hold: {job.billingHoldReason || 'No reason provided'}
              </div>
            ) : billingReady ? (
              <div className="rounded-2xl border border-brand-300/20 bg-brand-400/10 px-4 py-3 text-sm text-brand-100">
                Billing ready and waiting for invoice generation.
              </div>
            ) : job.status === 'COMPLETED' ? (
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/70">
                Review the checklist below, then mark this job billing ready.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/55">
                Billing review opens after the job is completed.
              </div>
            )}

            <InfoBlock title="Billing Snapshot">
              <InfoRow label="Labor Cost" value={formatCurrency(job.laborCost || 0)} />
              <InfoRow label="Parts Cost" value={formatCurrency(totalPartsCost || 0)} />
              <InfoRow label="Time Logged" value={`${totalTimeHours.toFixed(1)}h`} />
              <InfoRow label="Billable Amount" value={job.warranty ? 'N/A (Warranty)' : formatCurrency(job.billableAmount ?? job.totalCost ?? 0)} />
            </InfoBlock>

            {!job.warranty && !job.invoiceNumber && (
              <InfoBlock title="Billing Actions">
                <div className="space-y-3">
                  <MobileField label="Hold Reason">
                    <textarea
                      className="mobile-input min-h-[72px]"
                      value={holdReason}
                      onChange={(event) => setHoldReason(event.target.value)}
                      placeholder="Why is billing on hold?"
                    />
                  </MobileField>
                  <div className="flex flex-wrap gap-2">
                    {job.status === 'COMPLETED' && !billingReady && !job.billingHold && (
                      <button onClick={handleBillingReady} disabled={!allBillingValid} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                        Mark Billing Ready
                      </button>
                    )}
                    {billingReady && (
                      <button onClick={handleGenerateInvoice} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white">
                        Generate Invoice
                      </button>
                    )}
                    <button onClick={handleBillingHold} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
                      {job.billingHold ? 'Remove Hold' : 'Put on Hold'}
                    </button>
                  </div>
                </div>
              </InfoBlock>
            )}

            <InfoBlock title="Billing Validation">
              <div className="space-y-2">
                {billingValidations.map((validation) => (
                  <div key={validation.label} className="flex items-center gap-3 rounded-2xl bg-white/6 px-3 py-3">
                    <span>{validation.ok ? '✓' : '!'}</span>
                    <span className={cn('text-sm', validation.ok ? 'text-white/80' : 'text-red-300')}>{validation.label}</span>
                  </div>
                ))}
              </div>
            </InfoBlock>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3 pt-2">
            {/* Add note */}
            <div className="bg-white/10 rounded-2xl p-3">
              <textarea
                className="w-full bg-transparent text-sm outline-none resize-none text-white placeholder-white/30"
                rows={3}
                placeholder="Add a note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button onClick={handleAddNote} disabled={!noteText.trim()}
                  className="bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-brand-600 disabled:opacity-30 transition-colors">
                  Save Note
                </button>
              </div>
            </div>

            {notes.map(n => (
              <div key={n.id} className="bg-white/5 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-brand-300 font-medium">{n.authorName}</span>
                  <span className="text-[10px] opacity-40">{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm opacity-80">{n.text}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'signoff' && (
          <div className="space-y-4 pt-2">
            <InfoBlock title="Customer Sign-off">
              <SignaturePad
                height={120}
                value={job.completionSignature}
                onChange={(signature) => updateJob(job.id, { completionSignature: signature })}
              />
            </InfoBlock>

            <InfoBlock title="Technician Sign-off">
              <SignaturePad
                height={80}
                value={job.techSignature}
                onChange={(signature) => updateJob(job.id, { techSignature: signature })}
              />
            </InfoBlock>

            {job.status === 'IN_PROGRESS' && (
              <button onClick={() => handleStatusChange('COMPLETED')}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-base hover:bg-emerald-600 transition-colors">
                ✅ Complete Job
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MobileSalesOrderDetail: React.FC<{ salesOrderId: string; onBack: () => void }> = ({ salesOrderId, onBack }) => {
  const { getSO, updateSO, addSOLine, updateSOLine, removeSOLine, toggleBillingHold, removeBillingHold, generateInvoice, syncSOToJob } = useSOStore();
  const { toast } = useUIStore();
  const salesOrder = getSO(salesOrderId);

  const [headerDraft, setHeaderDraft] = useState(() => ({
    memo: salesOrder?.memo || '',
    billingCode: salesOrder?.billingCode || '',
    paymentMode: salesOrder?.paymentMode || 'Invoice / Net 30',
    terms: salesOrder?.terms || 'Net 30',
    dueDate: salesOrder?.dueDate || '',
    status: salesOrder?.status || 'Pending Approval',
  }));
  const [newLine, setNewLine] = useState({ itemName: '', description: '', quantity: '1', rate: '' });
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState({ itemName: '', description: '', quantity: '1', rate: '' });
  const [holdReason, setHoldReason] = useState('');

  React.useEffect(() => {
    if (!salesOrder) return;
    setHeaderDraft({
      memo: salesOrder.memo || '',
      billingCode: salesOrder.billingCode || '',
      paymentMode: salesOrder.paymentMode || 'Invoice / Net 30',
      terms: salesOrder.terms || 'Net 30',
      dueDate: salesOrder.dueDate || '',
      status: salesOrder.status || 'Pending Approval',
    });
  }, [salesOrder]);

  if (!salesOrder) return null;

  const handleSaveHeader = () => {
    updateSO(salesOrder.id, {
      memo: headerDraft.memo,
      billingCode: headerDraft.billingCode,
      paymentMode: headerDraft.paymentMode,
      terms: headerDraft.terms,
      dueDate: headerDraft.dueDate,
      status: headerDraft.status,
    });
    toast('success', 'Sales order updated');
  };

  const handleAddLine = () => {
    if (!newLine.itemName.trim() || !newLine.rate) return;
    addSOLine(salesOrder.id, {
      itemId: `item-${Date.now()}`,
      itemName: newLine.itemName.trim(),
      description: newLine.description.trim() || undefined,
      quantity: Number(newLine.quantity) || 1,
      rate: Number(newLine.rate) || 0,
      amount: (Number(newLine.quantity) || 1) * (Number(newLine.rate) || 0),
    });
    setNewLine({ itemName: '', description: '', quantity: '1', rate: '' });
    toast('success', 'Line added');
  };

  const beginEdit = (lineId: string) => {
    const line = salesOrder.lines.find((candidate) => candidate.id === lineId);
    if (!line) return;
    setEditingLineId(lineId);
    setEditingDraft({
      itemName: line.itemName,
      description: line.description || '',
      quantity: String(line.quantity),
      rate: String(line.rate),
    });
  };

  const handleSaveLine = () => {
    if (!editingLineId) return;
    updateSOLine(salesOrder.id, editingLineId, {
      itemName: editingDraft.itemName.trim(),
      description: editingDraft.description.trim() || undefined,
      quantity: Number(editingDraft.quantity) || 0,
      rate: Number(editingDraft.rate) || 0,
    });
    setEditingLineId(null);
    toast('success', 'Line updated');
  };

  const handleHold = () => {
    if (salesOrder.billingHold) {
      removeBillingHold(salesOrder.id);
      toast('success', 'Billing hold removed');
      return;
    }
    toggleBillingHold(salesOrder.id, holdReason || 'Waiting on review');
    toast('success', 'Billing hold added');
  };

  const handleInvoice = () => {
    const result = generateInvoice(salesOrder.id);
    if (result) toast('success', `Invoice ${result.invoiceNumber} generated`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={onBack} className="rounded-xl bg-white/10 p-2 transition-colors hover:bg-white/20">‹</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-300">{salesOrder.soNumber}</span>
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{salesOrder.status}</span>
          </div>
          <div className="truncate text-sm font-semibold">{salesOrder.customerName}</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6 pt-3">
        {salesOrder.billingHold && (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Billing hold: {salesOrder.billingHoldReason || 'Review required'}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total', value: formatCurrency(salesOrder.total) },
            { label: 'Balance', value: formatCurrency(salesOrder.balance || 0) },
            { label: 'Linked Job', value: salesOrder.linkedJobNumber || '—' },
            { label: 'Invoice', value: salesOrder.invoiceNumber || 'Pending' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/8 p-3">
              <div className="text-[10px] uppercase tracking-wide text-white/40">{item.label}</div>
              <div className="mt-2 text-sm font-semibold">{item.value}</div>
            </div>
          ))}
        </div>

        <InfoBlock title="Sales order header">
          <div className="space-y-3">
            <MobileField label="Memo">
              <textarea className="mobile-input min-h-[88px]" value={headerDraft.memo} onChange={(event) => setHeaderDraft((current) => ({ ...current, memo: event.target.value }))} />
            </MobileField>
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Billing Code">
                <input className="mobile-input" value={headerDraft.billingCode} onChange={(event) => setHeaderDraft((current) => ({ ...current, billingCode: event.target.value }))} />
              </MobileField>
              <MobileField label="Terms">
                <input className="mobile-input" value={headerDraft.terms} onChange={(event) => setHeaderDraft((current) => ({ ...current, terms: event.target.value }))} />
              </MobileField>
              <MobileField label="Payment">
                <select className="mobile-input" value={headerDraft.paymentMode} onChange={(event) => setHeaderDraft((current) => ({ ...current, paymentMode: event.target.value }))}>
                  {['Invoice / Net 30', 'Credit Card', 'E-Transfer', 'Cheque', 'ACH'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Status">
                <select className="mobile-input" value={headerDraft.status} onChange={(event) => setHeaderDraft((current) => ({ ...current, status: event.target.value }))}>
                  {['Pending Approval', 'Approved', 'Billed', 'Partially Billed', 'Fully Billed', 'Cancelled'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Due Date">
                <input className="mobile-input" type="date" value={headerDraft.dueDate} onChange={(event) => setHeaderDraft((current) => ({ ...current, dueDate: event.target.value }))} />
              </MobileField>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSaveHeader} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white">Save Header</button>
              <button onClick={() => { syncSOToJob(salesOrder.id); toast('success', 'Synced total to job'); }} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">Sync Total</button>
            </div>
          </div>
        </InfoBlock>

        <InfoBlock title="Billing actions">
          <div className="space-y-3">
            <MobileField label="Hold Reason">
              <textarea className="mobile-input min-h-[72px]" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder="Why is billing on hold?" />
            </MobileField>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleHold} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
                {salesOrder.billingHold ? 'Remove Hold' : 'Put on Hold'}
              </button>
              <button onClick={handleInvoice} disabled={!!salesOrder.invoiceNumber || salesOrder.billingHold} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                Generate Invoice
              </button>
            </div>
          </div>
        </InfoBlock>

        <InfoBlock title="Line Items">
          <div className="space-y-3">
            {salesOrder.lines.map((line) => (
              <div key={line.id} className="rounded-2xl bg-white/6 p-3">
                {editingLineId === line.id ? (
                  <div className="space-y-3">
                    <input className="mobile-input" value={editingDraft.itemName} onChange={(event) => setEditingDraft((current) => ({ ...current, itemName: event.target.value }))} />
                    <input className="mobile-input" value={editingDraft.description} onChange={(event) => setEditingDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
                    <div className="grid grid-cols-2 gap-3">
                      <input className="mobile-input" type="number" step="0.25" value={editingDraft.quantity} onChange={(event) => setEditingDraft((current) => ({ ...current, quantity: event.target.value }))} />
                      <input className="mobile-input" type="number" step="0.01" value={editingDraft.rate} onChange={(event) => setEditingDraft((current) => ({ ...current, rate: event.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveLine} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white">Save</button>
                      <button onClick={() => setEditingLineId(null)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/70">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{line.itemName}</div>
                        <div className="mt-1 text-xs text-white/45">{line.description || 'No description'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatCurrency(line.amount)}</div>
                        <div className="text-[10px] text-white/40">{line.quantity} × {formatCurrency(line.rate)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3 text-xs">
                      <button onClick={() => beginEdit(line.id)} className="font-medium text-brand-300">Edit</button>
                      <button onClick={() => { removeSOLine(salesOrder.id, line.id); toast('success', 'Line removed'); }} className="font-medium text-red-300">Remove</button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-white/15 p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Add line</div>
              <div className="space-y-3">
                <input className="mobile-input" value={newLine.itemName} onChange={(event) => setNewLine((current) => ({ ...current, itemName: event.target.value }))} placeholder="Item name" />
                <input className="mobile-input" value={newLine.description} onChange={(event) => setNewLine((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
                <div className="grid grid-cols-2 gap-3">
                  <input className="mobile-input" type="number" step="0.25" value={newLine.quantity} onChange={(event) => setNewLine((current) => ({ ...current, quantity: event.target.value }))} placeholder="Qty" />
                  <input className="mobile-input" type="number" step="0.01" value={newLine.rate} onChange={(event) => setNewLine((current) => ({ ...current, rate: event.target.value }))} placeholder="Rate" />
                </div>
                <button onClick={handleAddLine} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white">Add Line</button>
              </div>
            </div>
          </div>
        </InfoBlock>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const InfoBlock: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <div className="bg-white/8 rounded-2xl p-3">
    {title && <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">{title}</div>}
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value?: string; link?: string }> = ({ label, value, link }) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-white/40">{label}</span>
      {link ? (
        <a href={link} className="text-xs font-medium text-brand-300 hover:underline">{value}</a>
      ) : (
        <span className="text-xs font-medium text-right max-w-44 truncate">{value}</span>
      )}
    </div>
  );
};

const MobileField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</div>
    {children}
  </label>
);

const SignaturePad: React.FC<{
  value?: string;
  onChange: (value?: string) => void;
  height: number;
}> = ({ value, onChange, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    canvas.width = width * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.fillStyle = 'rgba(255,255,255,0.05)';
    context.fillRect(0, 0, width, canvasHeight);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2;
    context.strokeStyle = '#f8fafc';

    if (!value) return;

    const image = new Image();
    image.onload = () => {
      context.fillStyle = 'rgba(255,255,255,0.05)';
      context.fillRect(0, 0, width, canvasHeight);
      context.drawImage(image, 0, 0, width, canvasHeight);
    };
    image.src = value;
  }, [value, height]);

  const getPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getPointerPosition(event);
    if (!canvas || !context || !point) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const continueDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getPointerPosition(event);
    if (!canvas || !context || !point) return;

    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current?.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.fillStyle = 'rgba(255,255,255,0.05)';
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    onChange(undefined);
  };

  return (
    <>
      <div className="bg-white/5 rounded-xl overflow-hidden mb-2" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair touch-none"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
          onPointerCancel={finishDrawing}
        />
      </div>
      <button
        onClick={clearSignature}
        className="w-full text-xs text-white/50 hover:text-white/80 text-center py-1 transition-colors"
      >
        Clear signature
      </button>
    </>
  );
};

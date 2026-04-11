import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Avatar, Button, Card, EmptyState, PriorityBadge, StatusBadge } from '@/components/ui';
import { useAuthStore, useJobStore, useSOStore, useTechStore, useUIStore } from '@/store';
import {
  TECH_STATUS_COLORS,
  TECH_STATUS_LABELS,
  STATUS_LABELS,
  cn,
  formatCurrency,
  formatRelative,
  toISODate,
} from '@/lib/utils';
const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'INVOICED'];

// Inline SVG icon components
type IconProps = { size?: number; className?: string };

const NavigationIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const ClockIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ZapIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const RefreshCwIcon: React.FC<IconProps> = ({ size = 10, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ArrowRightIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface ActionItem {
  title: string;
  count: number;
  description: string;
  href: string;
}

const SummaryMetric: React.FC<{ label: string; value: string | number; detail: string; tone?: string }> = ({
  label,
  value,
  detail,
  tone = 'text-foreground',
}) => (
  <div className="metric-tile">
    <div className="kpi-label">{label}</div>
    <div className={cn('mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]', tone)}>{value}</div>
    <div className="mt-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{detail}</div>
  </div>
);

// Status chip component matching mobile style
const StatusChip: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const statusStyles: Record<string, string> = {
    SCHEDULED: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
    DISPATCHED: 'bg-[hsl(var(--info)/0.2)] text-[hsl(var(--info))]',
    EN_ROUTE: 'bg-[hsl(var(--info)/0.2)] text-[hsl(var(--info))]',
    IN_PROGRESS: 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]',
    WAITING_FOR_PARTS: 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
    READY_FOR_SIGNATURE: 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
    ON_HOLD: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    COMPLETED: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
    BILLING_READY: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
    INVOICED: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
    NEW: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
    CANCELLED: 'bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full',
        statusStyles[status] || statusStyles.NEW,
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      )}
    >
      {status === 'IN_PROGRESS' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] mr-1.5 animate-pulse-slow" />
      )}
      {STATUS_LABELS[status] || status}
    </span>
  );
};

// Priority indicator for job cards
const priorityIndicator: Record<string, string> = {
  LOW: '',
  MEDIUM: '',
  HIGH: 'border-l-[hsl(var(--primary))]',
  CRITICAL: 'border-l-[hsl(var(--destructive))]',
};

// Job card component matching mobile style
const JobCard: React.FC<{ job: any; compact?: boolean; onClick: () => void }> = ({ job, compact = false, onClick }) => {
  const handleNavigateToMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = `${job.serviceAddress.street}, ${job.serviceAddress.city}, ${job.serviceAddress.state} ${job.serviceAddress.zip}`;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl p-4 transition-all active:scale-[0.98] border-l-[3px]',
        'bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--accent))]',
        priorityIndicator[job.priority] || 'border-l-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[hsl(var(--foreground))] font-semibold text-[15px] truncate">{job.customerName}</h3>
            <StatusChip status={job.status} />
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm truncate mb-1">
            {job.serviceType.replace(/_/g, ' ')}
          </p>
          {!compact && (
            <p className="text-[hsl(var(--muted-foreground))] text-xs truncate">
              {job.serviceAddress.street}, {job.serviceAddress.city}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <ClockIcon size={12} />
              {job.scheduledStart || 'Unscheduled'}
            </span>
            {job.estimatedDuration && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">~{job.estimatedDuration}h</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 shrink-0">
          <button
            onClick={handleNavigateToMap}
            className="w-10 h-10 rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center hover:bg-[hsl(var(--primary)/0.2)] transition-colors"
            aria-label="Navigate"
          >
            <NavigationIcon size={18} />
          </button>
          <ChevronRightIcon size={16} className="text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>
    </button>
  );
};

// Active job hero component matching mobile style
const ActiveJobHero: React.FC<{ job: any; onOpen: () => void }> = ({ job, onOpen }) => {
  const handleNavigateToMap = () => {
    const address = `${job.serviceAddress.street}, ${job.serviceAddress.city}, ${job.serviceAddress.state} ${job.serviceAddress.zip}`;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className="active-job-hero">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[hsl(var(--primary))] uppercase tracking-wider">Active Job</span>
        <StatusChip status={job.status} size="md" />
      </div>
      <h2 className="text-xl font-bold text-[hsl(var(--foreground))] mb-1">{job.customerName}</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">{job.serviceType.replace(/_/g, ' ')}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
        {job.serviceAddress.street}, {job.serviceAddress.city}
      </p>
      <div className="flex items-center gap-2 mb-4">
        <ClockIcon size={14} className="text-[hsl(var(--muted-foreground))]" />
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {job.scheduledStart || 'Unscheduled'} {job.estimatedDuration ? `· ${job.estimatedDuration}h` : ''}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onOpen}
          className="flex-1 h-12 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          Open Job <ArrowRightIcon size={16} />
        </button>
        <button
          onClick={handleNavigateToMap}
          className="w-12 h-12 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <NavigationIcon size={18} />
        </button>
      </div>
    </div>
  );
};

const getTimeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboardKPIs, loadKPIs, syncState } = useUIStore();
  const jobs = useJobStore((state) => state.jobs);
  const salesOrders = useSOStore((state) => state.salesOrders);
  const technicians = useTechStore((state) => state.technicians);
  const navigate = useNavigate();

  const workspace = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';

  useEffect(() => {
    if (user) {
      loadKPIs(workspace);
    }
  }, [user, workspace, jobs, salesOrders, technicians, loadKPIs]);

  const kpis = dashboardKPIs;
  const today = toISODate(new Date());
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const scopedJobs = jobs.filter((job) => job.category === workspace);
  const activeJobs = scopedJobs.filter((job) => !CLOSED_STATUSES.includes(job.status));
  
  // Get active job (in progress, en route, or arrived)
  const activeJob = scopedJobs.find((j) => 
    j.status === 'IN_PROGRESS' || j.status === 'EN_ROUTE' || j.status === 'READY_FOR_SIGNATURE'
  );
  
  const todayJobs = scopedJobs
    .filter((job) => job.scheduledDate === today && job.status !== 'COMPLETED' && job.id !== activeJob?.id)
    .sort((left, right) => (left.scheduledStart || '').localeCompare(right.scheduledStart || ''))
    .slice(0, 8);
  
  const nextJob = todayJobs.find((j) => j.status === 'SCHEDULED' || j.status === 'DISPATCHED');
  const remainingJobs = todayJobs.filter((j) => j.id !== nextJob?.id);
  
  const recentJobs = [...scopedJobs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 7);
  const activeTechs = technicians
    .filter((tech) => tech.category === workspace)
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 6);

  const statusData = useMemo(
    () => (kpis
      ? Object.entries(kpis.jobsByStatus)
          .map(([key, value]) => ({ name: STATUS_LABELS[key] || key, value }))
          .sort((left, right) => right.value - left.value)
          .slice(0, 6)
      : []),
    [kpis],
  );

  const serviceMixData = useMemo(
    () => (kpis
      ? Object.entries(kpis.jobsByType)
          .map(([key, value]) => ({ name: key.replace(/_/g, ' '), value }))
          .sort((left, right) => right.value - left.value)
          .slice(0, 5)
      : []),
    [kpis],
  );

  const maxStatusValue = Math.max(...statusData.map((item) => item.value), 1);
  const maxServiceTypeValue = Math.max(...serviceMixData.map((item) => item.value), 1);

  const actionItems: ActionItem[] = [
    {
      title: 'Unassigned work',
      count: activeJobs.filter((job) => !job.technicianId).length,
      description: 'Jobs waiting for a technician or route slot.',
      href: '/dispatch',
    },
    {
      title: 'SLA risk',
      count: activeJobs.filter((job) => job.slaBreached).length,
      description: 'Work orders that need intervention before the customer window slips.',
      href: '/jobs?focus=sla',
    },
    {
      title: 'Follow-up required',
      count: scopedJobs.filter((job) => job.followUpRequired).length,
      description: 'Completed visits that still need a callback, revisit, or confirmation.',
      href: '/jobs?focus=followup',
    },
    {
      title: 'Ready to bill',
      count: scopedJobs.filter((job) => job.status === 'BILLING_READY').length,
      description: 'Operational work ready for sales order review.',
      href: '/billing',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header section matching mobile style */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Good {getTimeOfDay()}</p>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{user?.name?.split(' ')[0] || 'User'}</h1>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          <RefreshCwIcon size={10} />
          <span>Synced {syncState?.lastSync ? new Date(syncState.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'never'}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          <ZapIcon size={14} className="text-[hsl(var(--primary))]" />
          <span><strong className="text-[hsl(var(--foreground))]">{kpis?.jobsToday ?? 0}</strong> jobs today</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/dispatch')}>
            Open dispatch
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/jobs/new')}>
            New work order
          </Button>
        </div>
      </div>

      {/* SLA warning */}
      {kpis && kpis.slaBreachRate > 10 && (
        <div className="rounded-[18px] border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] px-4 py-3 text-sm text-[hsl(var(--warning))]">
          <span className="font-semibold">{kpis.slaBreachRate}% of active jobs</span> are outside the SLA target. Dispatch should review the queue next.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-4">
          {/* Active job hero */}
          {activeJob && (
            <ActiveJobHero job={activeJob} onOpen={() => navigate(`/jobs/${activeJob.id}`)} />
          )}

          {/* Next up */}
          {nextJob && (
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Next Up</p>
              <JobCard job={nextJob} onClick={() => navigate(`/jobs/${nextJob.id}`)} />
            </div>
          )}

          {/* Today's remaining jobs */}
          {remainingJobs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
                Today ({remainingJobs.length})
              </p>
              <div className="space-y-2">
                {remainingJobs.map((job) => (
                  <JobCard key={job.id} job={job} compact onClick={() => navigate(`/jobs/${job.id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!activeJob && todayJobs.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[hsl(var(--muted-foreground))] text-lg font-medium">No jobs today</p>
              <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">Use dispatch to schedule work</p>
            </div>
          )}

          {/* KPI metrics */}
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <SummaryMetric label="Jobs today" value={kpis?.jobsToday ?? 0} detail="Scheduled visits today" tone="text-[hsl(var(--primary))]" />
            <SummaryMetric label="Open work" value={kpis?.jobsOpen ?? 0} detail="Jobs in dispatch or execution" />
            <SummaryMetric label="Revenue MTD" value={formatCurrency(kpis?.revenueThisMonth ?? 0)} detail="Booked sales order value" tone="text-[hsl(var(--success))]" />
            <SummaryMetric label="Avg duration" value={`${kpis?.avgJobDuration ?? 0}h`} detail="Average completed job" />
          </div>

          {/* Recent activity */}
          <Card title="Recent activity" subtitle="Latest job updates and operational movement.">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <td className="font-mono text-xs font-semibold text-[hsl(var(--primary))]">{job.jobNumber}</td>
                      <td className="font-medium">{job.customerName}</td>
                      <td><StatusChip status={job.status} /></td>
                      <td><PriorityBadge priority={job.priority} /></td>
                      <td className="text-xs text-[hsl(var(--muted-foreground))]">{formatRelative(job.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Revenue chart */}
          <Card title="Revenue this month" subtitle="Weekly booked sales order movement.">
            {kpis && (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={kpis.revenueByWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <ReTooltip 
                    formatter={(value: number) => formatCurrency(value)} 
                    contentStyle={{ 
                      borderRadius: '14px', 
                      border: '1px solid hsl(var(--border))', 
                      background: 'hsl(var(--surface-elevated))',
                      color: 'hsl(var(--foreground))',
                      boxShadow: '0 16px 30px -24px rgba(0, 0, 0, 0.35)' 
                    }} 
                  />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--success))" strokeWidth={3} dot={{ fill: 'hsl(var(--success))', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Dispatch priorities */}
          <Card title="Dispatch priorities" subtitle="The first places to focus next.">
            <div className="space-y-3">
              {actionItems.map((item) => (
                <button
                  key={item.title}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-start gap-4 rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4 text-left transition-colors hover:bg-[hsl(var(--accent))]"
                >
                  <div className="min-w-[52px] text-2xl font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))]">{item.count}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Field coverage */}
          <Card title="Field coverage" subtitle="Technicians with current load.">
            <div className="space-y-3">
              {activeTechs.map((tech) => {
                const techJobs = scopedJobs.filter((job) => job.technicianId === tech.id && !CLOSED_STATUSES.includes(job.status));
                return (
                  <div key={tech.id} className="flex items-center gap-4 rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4">
                    <Avatar initials={tech.avatarInitials} color={tech.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{tech.name}</div>
                      <div className={cn('mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]', TECH_STATUS_COLORS[tech.status])}>
                        {TECH_STATUS_LABELS[tech.status]}
                      </div>
                      <div className="mt-2 truncate text-xs text-[hsl(var(--muted-foreground))]">{tech.skills.slice(0, 3).join(' · ') || 'General field coverage'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-[hsl(var(--foreground))]">{techJobs.length}</div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">Open jobs</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Work mix */}
          <Card title="Work mix" subtitle="Where the current load is concentrated.">
            <div className="space-y-5">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">By status</div>
                <div className="space-y-3">
                  {statusData.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-[hsl(var(--muted-foreground))]">{item.name}</span>
                        <span className="font-semibold text-[hsl(var(--foreground))]">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))]">
                        <div className="h-2 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${(item.value / maxStatusValue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[hsl(var(--border))] pt-5">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">By service type</div>
                <div className="space-y-3">
                  {serviceMixData.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-[hsl(var(--muted-foreground))]">{item.name}</span>
                        <span className="font-semibold text-[hsl(var(--foreground))]">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))]">
                        <div className="h-2 rounded-full bg-[hsl(var(--foreground))]" style={{ width: `${(item.value / maxServiceTypeValue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

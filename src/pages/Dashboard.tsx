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
import { getDesktopCopy } from '@/lib/desktop-copy';

const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'INVOICED'];

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
  tone = 'text-surface-900',
}) => (
  <div className="metric-tile">
    <div className="kpi-label">{label}</div>
    <div className={cn('mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]', tone)}>{value}</div>
    <div className="mt-2 text-sm text-surface-500">{detail}</div>
  </div>
);

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboardKPIs, loadKPIs } = useUIStore();
  const jobs = useJobStore((state) => state.jobs);
  const salesOrders = useSOStore((state) => state.salesOrders);
  const technicians = useTechStore((state) => state.technicians);
  const navigate = useNavigate();

  const language = useUIStore((state) => state.language);
  const copy = getDesktopCopy(language);
  const workspace = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';

  useEffect(() => {
    if (user) {
      loadKPIs(workspace);
    }
  }, [user, workspace, jobs, salesOrders, technicians, loadKPIs]);

  const kpis = dashboardKPIs;
  const today = toISODate(new Date());
  const workspaceLabel = workspace === 'SERVICE' ? copy.dashboard.serviceCommandDesk : copy.dashboard.installationCommandDesk;
  const locale = language === 'fr' ? 'fr-CA' : 'en-US';
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const scopedJobs = jobs.filter((job) => job.category === workspace);
  const activeJobs = scopedJobs.filter((job) => !CLOSED_STATUSES.includes(job.status));
  const todayJobs = scopedJobs
    .filter((job) => job.scheduledDate === today)
    .sort((left, right) => (left.scheduledStart || '').localeCompare(right.scheduledStart || ''))
    .slice(0, 8);
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
      title: copy.dashboard.unassignedWork,
      count: activeJobs.filter((job) => !job.technicianId).length,
      description: copy.dashboard.jobsWaiting,
      href: '/dispatch',
    },
    {
      title: copy.dashboard.slaRisk,
      count: activeJobs.filter((job) => job.slaBreached).length,
      description: copy.dashboard.workOrdersIntervention,
      href: '/jobs?focus=sla',
    },
    {
      title: copy.dashboard.followUpRequired,
      count: scopedJobs.filter((job) => job.followUpRequired).length,
      description: copy.dashboard.completedVisits,
      href: '/jobs?focus=followup',
    },
    {
      title: copy.dashboard.readyToBill,
      count: scopedJobs.filter((job) => job.status === 'BILLING_READY').length,
      description: copy.dashboard.operationalWork,
      href: '/billing',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="section-shell">
        <div className="page-header">
          <div>
            <div className="eyebrow">{copy.dashboard.operationsOverview}</div>
            <h1 className="page-title mt-2">{workspaceLabel}</h1>
            <p className="page-subtitle max-w-2xl">
              {copy.dashboard.liveWorkload} {dateLabel}. {copy.dashboard.keepSync}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/dispatch')}>
              {copy.dashboard.openDispatch}
            </Button>
            <Button variant="primary" onClick={() => navigate('/jobs/new')}>
              {copy.dashboard.newWorkOrder}
            </Button>
          </div>
        </div>

        {kpis && kpis.slaBreachRate > 10 && (
          <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">{kpis.slaBreachRate}% of active jobs</span> are outside the SLA target. Dispatch should review the queue next.
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label={copy.dashboard.jobsToday} value={kpis?.jobsToday ?? 0} detail={copy.dashboard.scheduledVisits} tone="text-brand-800" />
          <SummaryMetric label={copy.dashboard.openWork} value={kpis?.jobsOpen ?? 0} detail={copy.dashboard.jobsMoving} />
          <SummaryMetric label={copy.dashboard.revenueMTD} value={formatCurrency(kpis?.revenueThisMonth ?? 0)} detail={copy.dashboard.bookedSalesOrder} tone="text-emerald-700" />
          <SummaryMetric label={copy.dashboard.avgDuration} value={`${kpis?.avgJobDuration ?? 0}h`} detail={copy.dashboard.averageCompleted} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-6">
          <Card
            title={copy.dashboard.todaySchedule}
            subtitle={copy.dashboard.firstPassView}
            actions={(
              <button onClick={() => navigate('/dispatch')} className="text-sm font-medium text-brand-700 hover:underline">
                {copy.dashboard.manageSchedule}
              </button>
            )}
          >
            {todayJobs.length === 0 ? (
              <EmptyState title={copy.dashboard.noWorkOrdersToday} subtitle={copy.dashboard.useDispatch} icon="-" />
            ) : (
              <div className="space-y-3">
                {todayJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="flex w-full items-center gap-4 rounded-[18px] border border-surface-200 bg-surface-50/70 px-4 py-4 text-left transition-colors hover:bg-surface-50"
                  >
                    <div className="min-w-[82px]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">
                        {job.scheduledStart || 'Unscheduled'}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-surface-900">{job.jobNumber}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-surface-900">{job.customerName}</div>
                      <div className="mt-1 truncate text-sm text-surface-500">{job.description}</div>
                      <div className="mt-2 text-xs text-surface-400">{job.serviceAddress.city}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={job.status} />
                      <PriorityBadge priority={job.priority} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title={copy.dashboard.recentActivity} subtitle={copy.dashboard.latestJobUpdates}>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{copy.dashboard.job}</th>
                    <th>{copy.dashboard.customer}</th>
                    <th>{copy.dashboard.status}</th>
                    <th>{copy.dashboard.priority}</th>
                    <th>{copy.dashboard.updated}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <td className="font-mono text-xs font-semibold text-brand-800">{job.jobNumber}</td>
                      <td className="font-medium">{job.customerName}</td>
                      <td><StatusBadge status={job.status} /></td>
                      <td><PriorityBadge priority={job.priority} /></td>
                      <td className="text-xs text-surface-400">{formatRelative(job.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={copy.dashboard.revenueThisMonth} subtitle={copy.dashboard.weeklyBooked}>
            {kpis && (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={kpis.revenueByWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7dee4" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#667681' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#667681' }} axisLine={false} tickLine={false} />
                  <ReTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '14px', border: '1px solid #d7dee4', boxShadow: '0 16px 30px -24px rgba(15, 23, 32, 0.35)' }} />
                  <Line type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={3} dot={{ fill: '#0f766e', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={copy.dashboard.dispatchPriorities} subtitle={copy.dashboard.firstPlaces}>
            <div className="space-y-3">
              {actionItems.map((item) => (
                <button
                  key={item.title}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-start gap-4 rounded-[18px] border border-surface-200 bg-surface-50/70 px-4 py-4 text-left transition-colors hover:bg-surface-50"
                >
                  <div className="min-w-[52px] text-2xl font-semibold tracking-[-0.04em] text-surface-900">{item.count}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-surface-900">{item.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-surface-500">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title={copy.dashboard.fieldCoverage} subtitle={copy.dashboard.techniciansLoad}>
            <div className="space-y-3">
              {activeTechs.map((tech) => {
                const techJobs = scopedJobs.filter((job) => job.technicianId === tech.id && !CLOSED_STATUSES.includes(job.status));
                return (
                  <div key={tech.id} className="flex items-center gap-4 rounded-[18px] border border-surface-200 bg-surface-50/70 px-4 py-4">
                    <Avatar initials={tech.avatarInitials} color={tech.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-surface-900">{tech.name}</div>
                      <div className={cn('mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]', TECH_STATUS_COLORS[tech.status])}>
                        {TECH_STATUS_LABELS[tech.status]}
                      </div>
                      <div className="mt-2 truncate text-xs text-surface-500">{tech.skills.slice(0, 3).join(' · ') || copy.dashboard.generalFieldCoverage}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-surface-900">{techJobs.length}</div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">{copy.dashboard.openJobs}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={copy.dashboard.workMix} subtitle={copy.dashboard.currentLoad}>
            <div className="space-y-5">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">{copy.dashboard.byStatus}</div>
                <div className="space-y-3">
                  {statusData.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-surface-600">{item.name}</span>
                        <span className="font-semibold text-surface-900">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-100">
                        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(item.value / maxStatusValue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-surface-100 pt-5">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">{copy.dashboard.byServiceType}</div>
                <div className="space-y-3">
                  {serviceMixData.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-surface-600">{item.name}</span>
                        <span className="font-semibold text-surface-900">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-100">
                        <div className="h-2 rounded-full bg-surface-950" style={{ width: `${(item.value / maxServiceTypeValue) * 100}%` }} />
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

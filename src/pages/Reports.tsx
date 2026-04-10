import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuthStore, useJobStore, useSOStore, useTechStore } from '@/store';
import { Card, Tabs } from '@/components/ui';
import { formatCurrency, STATUS_LABELS, SERVICE_TYPE_LABELS, PRIORITY_LABELS, cn, parseDateValue } from '@/lib/utils';

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#64748b','#ec4899'];

export const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const { jobs } = useJobStore();
  const { salesOrders } = useSOStore();
  const { technicians } = useTechStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30'); // days

  const ws = user?.workspace || 'SERVICE';
  const cat = ws === 'SERVICE' ? 'SERVICE' : 'INSTALLATION';
  const rangeDays = Number(dateRange);
  const rangeEnd = useMemo(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }, []);
  const rangeStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (rangeDays - 1));
    return date;
  }, [rangeDays]);

  const inRange = (dateStr?: string) => {
    const parsed = parseDateValue(dateStr);
    return Boolean(parsed && parsed >= rangeStart && parsed <= rangeEnd);
  };

  const scopedJobIds = useMemo(
    () => new Set(jobs.filter(job => job.category === cat).map(job => job.id)),
    [jobs, cat]
  );
  const scopedJobs = useMemo(
    () => jobs.filter(job => job.category === cat && inRange(job.scheduledDate || job.createdAt)),
    [jobs, cat, rangeStart, rangeEnd]
  );
  const scopedSalesOrders = useMemo(
    () => salesOrders.filter(order => (!order.linkedJobId || scopedJobIds.has(order.linkedJobId)) && inRange(order.tranDate)),
    [salesOrders, scopedJobIds, rangeStart, rangeEnd]
  );

  // ── Computed metrics ──

  const completedJobs = scopedJobs.filter(j => ['COMPLETED', 'BILLING_READY', 'INVOICED'].includes(j.status));
  const cancelledJobs = scopedJobs.filter(j => j.status === 'CANCELLED');
  const completionRate = scopedJobs.length > 0 ? Math.round((completedJobs.length / scopedJobs.length) * 100) : 0;
  const avgDuration = completedJobs.filter(j => j.actualDuration).reduce((s, j) => s + (j.actualDuration || 0), 0) / (completedJobs.filter(j => j.actualDuration).length || 1);
  const slaBreached = scopedJobs.filter(j => j.slaBreached).length;
  const warrantyJobs = scopedJobs.filter(j => j.warranty).length;
  const readyToBill = scopedJobs.filter(j => j.status === 'BILLING_READY').length;
  const followUps = scopedJobs.filter(j => j.followUpRequired).length;

  // Jobs by status
  const byStatus = Object.entries(
    scopedJobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([status, value]) => ({
    status,
    name: STATUS_LABELS[status] || status,
    value,
  })).sort((a, b) => b.value - a.value);

  // Jobs by type
  const byType = Object.entries(
    scopedJobs.reduce((acc, j) => { acc[j.serviceType] = (acc[j.serviceType] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([k, v]) => ({ name: SERVICE_TYPE_LABELS[k] || k, value: v })).sort((a, b) => b.value - a.value);

  // Jobs by priority
  const byPriority = Object.entries(
    scopedJobs.reduce((acc, j) => { acc[j.priority] = (acc[j.priority] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([k, v]) => ({ name: PRIORITY_LABELS[k] || k, value: v }));

  const revenueByPeriod = useMemo(() => {
    const bucketSize = Math.max(7, Math.ceil(rangeDays / 8));
    const bucketCount = Math.max(1, Math.ceil(rangeDays / bucketSize));

    return Array.from({ length: bucketCount }, (_, index) => {
      const bucketEnd = new Date(rangeEnd);
      bucketEnd.setDate(rangeEnd.getDate() - index * bucketSize);
      bucketEnd.setHours(23, 59, 59, 999);

      const bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketEnd.getDate() - bucketSize + 1);
      bucketStart.setHours(0, 0, 0, 0);

      const amount = scopedSalesOrders
        .filter(order => {
          const orderDate = parseDateValue(order.tranDate);
          return Boolean(orderDate && orderDate >= bucketStart && orderDate <= bucketEnd);
        })
        .reduce((sum, order) => sum + order.total, 0);

      return {
        period: `${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`,
        amount: Math.round(amount),
      };
    }).reverse();
  }, [rangeDays, rangeEnd, scopedSalesOrders]);

  // Tech performance
  const catTechs = technicians.filter(t => t.category === cat);
  const techPerf = catTechs.map(t => {
    const techJobs = scopedJobs.filter(j => j.technicianId === t.id);
    const completed = techJobs.filter(j => ['COMPLETED', 'BILLING_READY', 'INVOICED'].includes(j.status));
    const avg = completed.filter(j => j.actualDuration).length > 0
      ? completed.filter(j => j.actualDuration).reduce((s, j) => s + (j.actualDuration || 0), 0) / completed.filter(j => j.actualDuration).length
      : 0;
    return {
      name: t.name.split(' ')[0],
      total: techJobs.length,
      completed: completed.length,
      avgDuration: Math.round(avg * 10) / 10,
      completionRate: techJobs.length > 0 ? Math.round(completed.length / techJobs.length * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total).slice(0, 8);

  // Top customers
  const topCustomers = Object.entries(
    scopedJobs.reduce((acc, j) => { acc[j.customerName] = (acc[j.customerName] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">{ws === 'SERVICE' ? 'Service Operations' : 'Installation Projects'} Analytics · last {rangeDays} days</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select text-sm" value={dateRange} onChange={e => setDateRange(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      <Tabs variant="pill" active={activeTab} onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'jobs', label: 'Jobs' },
          { id: 'revenue', label: 'Revenue' },
          { id: 'technicians', label: 'Technicians' },
          { id: 'customers', label: 'Customers' },
        ]}
      />

      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
              {[
                { label: 'Total Jobs', value: scopedJobs.length, icon: '🔧', color: 'text-brand-600' },
                { label: 'Completed', value: completedJobs.length, icon: '✅', color: 'text-emerald-600' },
                { label: 'Completion Rate', value: `${completionRate}%`, icon: '📈', color: 'text-green-600' },
                { label: 'SLA Breached', value: slaBreached, icon: '🚨', color: 'text-red-600' },
                { label: 'Warranty Jobs', value: warrantyJobs, icon: '🛡️', color: 'text-amber-600' },
                { label: 'Ready to Bill', value: readyToBill, icon: '🧾', color: 'text-cyan-600' },
                { label: 'Follow-ups', value: followUps, icon: '☎️', color: 'text-brand-700' },
                { label: 'Avg Duration', value: `${Math.round(avgDuration * 10) / 10}h`, icon: '⏱️', color: 'text-cyan-700' },
              ].map(m => (
                <div key={m.label} className="surface-card p-4">
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className={cn('text-2xl font-bold', m.color)}>{m.value}</div>
                <div className="text-xs text-surface-500">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Jobs by status */}
            <Card title="Jobs by Status">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byStatus} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Jobs by type */}
            <Card title="Jobs by Service Type">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byType} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
                  <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Revenue trend */}
          <Card title="Revenue Trend" subtitle={`Trend rolled up across the last ${rangeDays} days`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueByPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <ReTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Jobs by Priority">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={byPriority} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={e => `${e.name}: ${e.value}`}>
                    {byPriority.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Job Completion Table">
              <table className="data-table">
                <thead><tr><th>Status</th><th className="text-right">Count</th><th className="text-right">%</th></tr></thead>
                <tbody>
                  {byStatus.map(row => (
                    <tr key={row.status} className="cursor-pointer" onClick={() => navigate(`/jobs?status=${row.status}`)}>
                      <td>{row.name}</td>
                      <td className="text-right font-bold">{row.value}</td>
                      <td className="text-right text-surface-400">{scopedJobs.length > 0 ? Math.round(row.value / scopedJobs.length * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="space-y-5">
          <Card title="Revenue Trend" subtitle={`Financial output for the last ${rangeDays} days`}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueByPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <ReTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Revenue Summary">
            <dl className="grid grid-cols-3 gap-6 text-sm">
              {[
                ['Total SO Revenue', formatCurrency(scopedSalesOrders.reduce((s, so) => s + so.total, 0))],
                ['Fully Billed', formatCurrency(scopedSalesOrders.filter(so => so.status === 'Fully Billed').reduce((s, so) => s + so.total, 0))],
                ['Outstanding', formatCurrency(scopedSalesOrders.filter(so => !['Fully Billed', 'Cancelled'].includes(so.status)).reduce((s, so) => s + (so.balance || 0), 0))],
              ].map(([l, v]) => (
                <div key={l} className="text-center p-4 bg-surface-50 rounded-xl">
                  <div className="text-2xl font-bold text-surface-900">{v}</div>
                  <div className="text-xs text-surface-500 mt-1">{l}</div>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'technicians' && (
        <Card title="Technician Performance">
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={techPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Legend />
                <Bar dataKey="total" name="Total Jobs" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <table className="data-table">
              <thead><tr><th>Technician</th><th className="text-right">Total</th><th className="text-right">Completed</th><th className="text-right">Rate</th><th className="text-right">Avg Duration</th></tr></thead>
              <tbody>
                {techPerf.map(t => (
                  <tr key={t.name}>
                    <td className="font-medium">{t.name}</td>
                    <td className="text-right">{t.total}</td>
                    <td className="text-right">{t.completed}</td>
                    <td className="text-right">
                      <span className={cn('font-medium', t.completionRate >= 80 ? 'text-emerald-600' : t.completionRate >= 60 ? 'text-amber-600' : 'text-red-500')}>
                        {t.completionRate}%
                      </span>
                    </td>
                    <td className="text-right">{t.avgDuration > 0 ? `${t.avgDuration}h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'customers' && (
        <Card title="Top Customers by Job Count">
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCustomers} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={140} />
                <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topCustomers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="data-table">
            <thead><tr><th>Customer</th><th className="text-right">Total Jobs</th></tr></thead>
            <tbody>
              {topCustomers.map(c => (
                <tr key={c.name} className="cursor-pointer" onClick={() => navigate(`/clients?q=${encodeURIComponent(c.name)}`)}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-right font-bold">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

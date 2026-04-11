import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, useJobStore, useTechStore, useUIStore } from '@/store';
import { StatusBadge, PriorityBadge, ServiceTypeBadge, Button, Input, EmptyState, Tabs } from '@/components/ui';
import { formatDate, cn, STATUS_LABELS, PRIORITY_LABELS, SERVICE_TYPE_LABELS, isPast, toISODate } from '@/lib/utils';
import { getDesktopCopy } from '@/lib/desktop-copy';

const ACTIVE_JOB_STATUSES = ['COMPLETED', 'CANCELLED', 'INVOICED'];
const CLOSED_JOB_STATUSES = ['COMPLETED', 'CANCELLED', 'INVOICED', 'BILLING_READY'];

export const JobList: React.FC = () => {
  const { user } = useAuthStore();
  const { jobs } = useJobStore();
  const technicians = useTechStore((state) => state.technicians);
  const language = useUIStore((state) => state.language);
  const copy = getDesktopCopy(language);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const STATUS_OPTS = [
    { value: '', label: copy.jobList.allStatuses },
    ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ];
  const PRIORITY_OPTS = [
    { value: '', label: copy.jobList.allPriorities },
    ...Object.entries(PRIORITY_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ];
  const TYPE_OPTS = [
    { value: '', label: copy.jobList.allTypes },
    ...Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ];
  const ASSIGNMENT_OPTS = [
    { value: '', label: copy.jobList.allAssignments },
    { value: 'assigned', label: copy.jobList.assigned },
    { value: 'unassigned', label: copy.jobList.unassigned },
  ];
  const FOCUS_OPTS = [
    { value: '', label: copy.jobList.allFocusAreas },
    { value: 'sla', label: copy.jobList.slaRisk },
    { value: 'followup', label: copy.jobList.followUpRequired },
    { value: 'warranty', label: copy.jobList.warranty },
    { value: 'unscheduled', label: copy.jobList.missingSchedule },
  ];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [focusFilter, setFocusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'jobNumber' | 'scheduledDate' | 'updatedAt' | 'priority' | 'customerName'>('scheduledDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const ws = user?.workspace || 'SERVICE';
  const cat = ws === 'SERVICE' ? 'SERVICE' : 'INSTALLATION';
  const today = toISODate(new Date());
  const requestedDate = searchParams.get('date') || '';
  const techPool = technicians.filter((technician) => technician.category === cat);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const requestedStatus = searchParams.get('status');

    if (requestedTab) {
      setActiveTab(requestedTab);
    } else if (requestedStatus === 'open' || searchParams.get('overdue') === '1') {
      setActiveTab(requestedStatus === 'open' ? 'open' : 'overdue');
    } else if (searchParams.get('billing') === '1') {
      setActiveTab('billing');
    } else if (searchParams.get('date')) {
      setActiveTab('today');
    } else {
      setActiveTab('all');
    }

    setStatusFilter(requestedStatus && requestedStatus !== 'open' ? requestedStatus : '');
    setPriorityFilter(searchParams.get('priority') || '');
    setTypeFilter(searchParams.get('type') || '');
    setTechnicianFilter(searchParams.get('technician') || '');
    setDateFromFilter(searchParams.get('dateFrom') || '');
    setDateToFilter(searchParams.get('dateTo') || '');
    setAssignmentFilter(searchParams.get('assignment') || '');
    setFocusFilter(searchParams.get('focus') || '');
    setSearch(searchParams.get('search') || '');
    setPage(1);
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = jobs.filter(j => j.category === cat);

    // Tab filter
    if (requestedDate) list = list.filter(j => j.scheduledDate === requestedDate);
    else if (activeTab === 'today') list = list.filter(j => j.scheduledDate === today);
    else if (activeTab === 'open') list = list.filter(j => !ACTIVE_JOB_STATUSES.includes(j.status));
    else if (activeTab === 'overdue') list = list.filter(j =>
      j.scheduledDate && j.scheduledDate < today && !CLOSED_JOB_STATUSES.includes(j.status)
    );
    else if (activeTab === 'billing') list = list.filter(j => ['BILLING_READY', 'INVOICED'].includes(j.status));

    if (statusFilter) list = list.filter(j => j.status === statusFilter);
    if (priorityFilter) list = list.filter(j => j.priority === priorityFilter);
    if (typeFilter) list = list.filter(j => j.serviceType === typeFilter);
    if (technicianFilter) list = list.filter(j => j.technicianId === technicianFilter);
    if (dateFromFilter) list = list.filter(j => j.scheduledDate && j.scheduledDate >= dateFromFilter);
    if (dateToFilter) list = list.filter(j => j.scheduledDate && j.scheduledDate <= dateToFilter);
    if (assignmentFilter === 'assigned') list = list.filter(j => Boolean(j.technicianId));
    if (assignmentFilter === 'unassigned') list = list.filter(j => !j.technicianId);

    if (focusFilter === 'sla') list = list.filter(j => j.slaBreached);
    if (focusFilter === 'followup') list = list.filter(j => j.followUpRequired);
    if (focusFilter === 'warranty') list = list.filter(j => j.warranty);
    if (focusFilter === 'unscheduled') list = list.filter(j => !j.scheduledDate);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(j =>
        j.jobNumber.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.technicianName?.toLowerCase().includes(q) ||
        j.serviceAddress.city.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let va: string = '', vb: string = '';
      if (sortBy === 'priority') {
        const porder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return sortDir === 'asc' ? porder[a.priority] - porder[b.priority] : porder[b.priority] - porder[a.priority];
      }
      va = (a as any)[sortBy] || '';
      vb = (b as any)[sortBy] || '';
      if (sortDir === 'asc') return va.localeCompare(vb);
      return vb.localeCompare(va);
    });

    return list;
  }, [jobs, cat, activeTab, statusFilter, priorityFilter, typeFilter, technicianFilter, dateFromFilter, dateToFilter, assignmentFilter, focusFilter, search, sortBy, sortDir, today, requestedDate]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const openCount = jobs.filter(j => j.category === cat && !ACTIVE_JOB_STATUSES.includes(j.status)).length;
  const todayCount = jobs.filter(j => j.category === cat && j.scheduledDate === today).length;
  const overdueCount = jobs.filter(j =>
    j.category === cat && j.scheduledDate && j.scheduledDate < today &&
    !CLOSED_JOB_STATUSES.includes(j.status)
  ).length;
  const billingCount = jobs.filter(j => j.category === cat && ['BILLING_READY', 'INVOICED'].includes(j.status)).length;

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon: React.FC<{ col: typeof sortBy }> = ({ col }) => (
    <span className="ml-1 text-surface-300">
      {sortBy !== col ? '⇅' : sortDir === 'asc' ? '↑' : '↓'}
    </span>
  );

  const exportVisibleJobs = () => {
    const rows = [
      ['Job Number', 'Customer', 'Status', 'Priority', 'Type', 'Scheduled Date', 'Scheduled Start', 'Technician', 'City', 'Sales Order'],
      ...filtered.map((job) => [
        job.jobNumber,
        job.customerName,
        job.status,
        job.priority,
        job.serviceType,
        job.scheduledDate || '',
        job.scheduledStart || '',
        job.technicianName || '',
        job.serviceAddress.city,
        job.salesOrderNumber || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cat.toLowerCase()}-jobs-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{ws === 'SERVICE' ? copy.jobList.serviceJobs : copy.jobList.installationProjects}</h1>
          <p className="page-subtitle">{filtered.length} {copy.jobList.results}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportVisibleJobs}>
            {copy.jobList.exportCSV}
          </Button>
          <Button variant="primary" onClick={() => navigate('/jobs/new')} icon={<span>+</span>}>
            {copy.jobList.newJob}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        variant="pill"
        active={activeTab}
        onChange={t => { setActiveTab(t); setPage(1); }}
        tabs={[
          { id: 'all',     label: copy.jobList.allJobs,  badge: jobs.filter(j => j.category === cat).length },
          { id: 'today',   label: copy.jobList.today,    badge: todayCount },
          { id: 'open',    label: copy.jobList.open,     badge: openCount },
          { id: 'overdue', label: copy.jobList.overdue,  badge: overdueCount },
          { id: 'billing', label: copy.jobList.billing,  badge: billingCount },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            placeholder={copy.jobList.searchJobs}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          />
        </div>
        <select className="select w-auto" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select w-auto" value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}>
          {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select w-auto" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select w-auto" value={technicianFilter} onChange={e => { setTechnicianFilter(e.target.value); setPage(1); }}>
          <option value="">{copy.jobList.allTechnicians}</option>
          {techPool.map((technician) => (
            <option key={technician.id} value={technician.id}>{technician.name}</option>
          ))}
        </select>
        <input
          type="date"
          className="select w-auto"
          value={dateFromFilter}
          onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
        />
        <input
          type="date"
          className="select w-auto"
          value={dateToFilter}
          onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
        />
        <select className="select w-auto" value={assignmentFilter} onChange={e => { setAssignmentFilter(e.target.value); setPage(1); }}>
          {ASSIGNMENT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select w-auto" value={focusFilter} onChange={e => { setFocusFilter(e.target.value); setPage(1); }}>
          {FOCUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(search || statusFilter || priorityFilter || typeFilter || technicianFilter || dateFromFilter || dateToFilter || assignmentFilter || focusFilter || requestedDate || searchParams.toString()) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setTypeFilter(''); setTechnicianFilter(''); setDateFromFilter(''); setDateToFilter(''); setAssignmentFilter(''); setFocusFilter(''); setActiveTab('all'); setPage(1); navigate('/jobs'); }}
            className="text-xs text-surface-500 hover:text-surface-700 underline">
            {copy.jobList.clearFilters}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <button onClick={() => handleSort('jobNumber')} className="hover:text-surface-700 transition-colors">
                    {copy.jobList.jobNumber} <SortIcon col="jobNumber" />
                  </button>
                </th>
                <th><button onClick={() => handleSort('customerName')} className="hover:text-surface-700">{copy.jobList.customer} <SortIcon col="customerName" /></button></th>
                <th>{copy.jobList.description}</th>
                <th>{copy.jobList.status}</th>
                <th>{copy.jobList.priority}</th>
                <th>{copy.jobList.type}</th>
                <th><button onClick={() => handleSort('scheduledDate')} className="hover:text-surface-700">{copy.jobList.scheduled} <SortIcon col="scheduledDate" /></button></th>
                <th>{copy.jobList.technician}</th>
                <th>{copy.jobList.salesOrder}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={9} className="py-12">
                  <EmptyState icon="🔧" title={copy.jobList.noJobsFound} subtitle={copy.jobList.tryAdjusting} />
                </td></tr>
              ) : paginated.map(j => (
                <tr
                  key={j.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/jobs/${j.id}`)}
                >
                  <td>
                    <div className="flex items-center gap-1.5">
                      {j.slaBreached && <span title="SLA Breached" className="text-red-500 text-xs">🚨</span>}
                      {j.warranty && <span title="Warranty" className="text-amber-500 text-xs">🛡️</span>}
                      <span className="font-mono text-xs font-semibold text-brand-600">{j.jobNumber}</span>
                    </div>
                  </td>
                  <td>
                    <div className="font-medium text-sm">{j.customerName}</div>
                    <div className="text-xs text-surface-400">{j.serviceAddress.city}, {j.serviceAddress.state}</div>
                  </td>
                  <td className="max-w-48">
                    <span className="text-sm text-surface-600 line-clamp-2">{j.description}</span>
                  </td>
                  <td><StatusBadge status={j.status} /></td>
                  <td><PriorityBadge priority={j.priority} /></td>
                  <td><ServiceTypeBadge type={j.serviceType} /></td>
                  <td>
                    {j.scheduledDate ? (
                      <span className={cn('text-sm', isPast(j.scheduledDate) && !CLOSED_JOB_STATUSES.includes(j.status) && 'text-red-600 font-medium')}>
                        {formatDate(j.scheduledDate)}
                        {j.scheduledStart && <span className="text-xs text-surface-400 ml-1">{j.scheduledStart}</span>}
                      </span>
                    ) : <span className="text-surface-300">—</span>}
                  </td>
                  <td>{j.technicianName || <span className="text-surface-300 text-xs">{copy.jobList.unassigned}</span>}</td>
                  <td>
                    {j.salesOrderNumber ? (
                      <span className="text-xs font-mono text-cyan-600">{j.salesOrderNumber}</span>
                    ) : <span className="text-surface-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
            <span className="text-xs text-surface-500">
              {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length} jobs
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 disabled:opacity-30 transition-colors"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={cn('w-8 h-8 rounded-lg text-sm transition-colors',
                      p === page ? 'bg-brand-600 text-white' : 'text-surface-600 hover:bg-surface-100'
                    )}>
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 disabled:opacity-30 transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

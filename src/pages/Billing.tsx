import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSOStore, useJobStore, useAuthStore, useUIStore, useCustomerStore } from '@/store';
import { Button, EmptyState, Input, Modal, Tabs, Textarea } from '@/components/ui';
import { SalesOrderWorkbench } from '@/components/billing/SalesOrderWorkbench';
import { formatDate, formatCurrency, cn, SERVICE_TYPE_LABELS } from '@/lib/utils';
import type { Job } from '@/types';

type BillingTab = 'pending' | 'ready' | 'warranty' | 'salesorders';

const BILLING_STATUS_STYLES: Record<string, string> = {
  HOLD: 'bg-red-100 text-red-700',
  READY: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-amber-100 text-amber-700',
  WARRANTY: 'bg-violet-100 text-violet-700',
};

function getBillingQueueStatus(job: Job) {
  if (job.warranty) return 'WARRANTY';
  if (job.billingHold) return 'HOLD';
  if (job.billingReady) return 'READY';
  return 'PENDING';
}

const BillingQueueTable: React.FC<{
  jobs: Job[];
  selectedJobIds: string[];
  onToggleJob: (jobId: string) => void;
  onToggleAll: () => void;
  onReview: (jobId: string) => void;
  onMarkReady: (jobId: string) => void;
  onInvoice: (jobId: string) => void;
  onHold: (job: Job) => void;
  onRemoveHold: (jobId: string) => void;
}> = ({
  jobs,
  selectedJobIds,
  onToggleJob,
  onToggleAll,
  onReview,
  onMarkReady,
  onInvoice,
  onHold,
  onRemoveHold,
}) => {
  const allSelected = jobs.length > 0 && jobs.every((job) => selectedJobIds.includes(job.id));

  if (jobs.length === 0) {
    return <EmptyState icon="🧾" title="No jobs in this queue" subtitle="Everything in this billing queue has been cleared." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-10">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
            </th>
            <th>Job #</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Completed</th>
            <th>Technician</th>
            <th className="text-right">Labor</th>
            <th className="text-right">Parts</th>
            <th className="text-right">Total</th>
            <th>Billing</th>
            <th className="w-[280px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const billingStatus = getBillingQueueStatus(job);
            const total = job.billableAmount ?? job.totalCost ?? ((job.laborCost || 0) + (job.partsCost || 0));

            return (
              <tr key={job.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={() => onToggleJob(job.id)}
                  />
                </td>
                <td className="font-mono text-xs font-semibold text-brand-600">{job.jobNumber}</td>
                <td>
                  <div className="text-sm font-medium text-surface-900">{job.customerName}</div>
                  <div className="text-xs text-surface-400">{job.description.slice(0, 52)}</div>
                </td>
                <td className="text-sm text-surface-600">{SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType}</td>
                <td className="text-sm text-surface-600">{formatDate(job.actualEnd || job.scheduledDate)}</td>
                <td className="text-sm text-surface-600">{job.technicianName || '—'}</td>
                <td className="text-right font-medium">{formatCurrency(job.laborCost || 0)}</td>
                <td className="text-right font-medium">{formatCurrency(job.partsCost || 0)}</td>
                <td className="text-right font-semibold">{job.warranty ? 'N/A' : formatCurrency(total)}</td>
                <td>
                  <span className={cn('badge', BILLING_STATUS_STYLES[billingStatus])}>
                    {billingStatus === 'WARRANTY' ? 'Warranty' : billingStatus}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onReview(job.id)}>Review</Button>
                    {!job.warranty && !job.billingReady && !job.billingHold && (
                      <Button variant="outline" size="sm" onClick={() => onMarkReady(job.id)}>Mark Ready</Button>
                    )}
                    {!job.warranty && job.billingReady && job.status !== 'INVOICED' && (
                      <Button variant="success" size="sm" onClick={() => onInvoice(job.id)}>Invoice</Button>
                    )}
                    {!job.warranty && !job.billingHold && (
                      <Button variant="outline" size="sm" onClick={() => onHold(job)}>Hold</Button>
                    )}
                    {!job.warranty && job.billingHold && (
                      <Button variant="outline" size="sm" onClick={() => onRemoveHold(job.id)}>Remove Hold</Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const BillingList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useUIStore();
  const jobs = useJobStore((state) => state.jobs);
  const {
    markBillingReady,
    generateInvoice,
    bulkMarkBillingReady,
    bulkGenerateInvoices,
    setBillingHold,
    removeBillingHold,
  } = useJobStore();
  const salesOrders = useSOStore((state) => state.salesOrders);
  const createSO = useSOStore((state) => state.createSO);
  const { searchCustomers } = useCustomerStore();
  const [activeTab, setActiveTab] = useState<BillingTab>('pending');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [holdDraft, setHoldDraft] = useState({ jobId: '', jobNumber: '', reason: '' });
  const [createSOOpen, setCreateSOOpen] = useState(false);
  const [soCustomerSearch, setSOCustomerSearch] = useState('');
  const [soCustomerId, setSOCustomerId] = useState('');
  const [soCustomerName, setSOCustomerName] = useState('');
  const [soMemo, setSOmemo] = useState('');
  const [showSOCustomerDrop, setShowSOCustomerDrop] = useState(false);
  const soCustomerResults = searchCustomers(soCustomerSearch);
  const PAGE_SIZE = 25;
  const cat = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';

  const scopedJobs = useMemo(() => jobs.filter((job) => job.category === cat), [jobs, cat]);
  const visibleJobIds = useMemo(() => new Set(scopedJobs.map((job) => job.id)), [scopedJobs]);
  const visibleSalesOrders = useMemo(
    () => salesOrders.filter((order) => !order.linkedJobId || visibleJobIds.has(order.linkedJobId)),
    [salesOrders, visibleJobIds],
  );

  const pendingJobs = useMemo(
    () => scopedJobs
      .filter((job) => job.status === 'COMPLETED' && !job.billingReady && !job.invoiceId && !job.warranty)
      .sort((left, right) => (left.actualEnd || left.scheduledDate || '').localeCompare(right.actualEnd || right.scheduledDate || '')),
    [scopedJobs],
  );

  const readyJobs = useMemo(
    () => scopedJobs
      .filter((job) => job.billingReady && job.status !== 'INVOICED' && !job.warranty)
      .sort((left, right) => (left.scheduledDate || '').localeCompare(right.scheduledDate || '')),
    [scopedJobs],
  );

  const warrantyJobs = useMemo(
    () => scopedJobs
      .filter((job) => job.warranty && !['CANCELLED', 'INVOICED'].includes(job.status))
      .sort((left, right) => (left.scheduledDate || '').localeCompare(right.scheduledDate || '')),
    [scopedJobs],
  );

  const filteredSalesOrders = useMemo(() => {
    let list = [...visibleSalesOrders];
    if (statusFilter) list = list.filter((so) => so.status === statusFilter);
    if (search) {
      const query = search.toLowerCase();
      list = list.filter((so) =>
        so.soNumber.toLowerCase().includes(query) ||
        so.customerName.toLowerCase().includes(query) ||
        so.memo?.toLowerCase().includes(query),
      );
    }
    return list.sort((left, right) => right.tranDate.localeCompare(left.tranDate));
  }, [visibleSalesOrders, search, statusFilter]);

  const paginatedSalesOrders = filteredSalesOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredSalesOrders.length / PAGE_SIZE) || 1;
  const totalRevenue = visibleSalesOrders.reduce((sum, salesOrder) => sum + salesOrder.total, 0);
  const pendingRevenue = visibleSalesOrders
    .filter((salesOrder) => !['Fully Billed', 'Cancelled'].includes(salesOrder.status))
    .reduce((sum, salesOrder) => sum + (salesOrder.balance || 0), 0);

  const currentQueueJobs = activeTab === 'pending'
    ? pendingJobs
    : activeTab === 'ready'
      ? readyJobs
      : activeTab === 'warranty'
        ? warrantyJobs
        : [];

  useEffect(() => {
    setSelectedJobIds([]);
  }, [activeTab]);

  const toggleSelectedJob = (jobId: string) => {
    setSelectedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId],
    );
  };

  const toggleAllJobs = () => {
    setSelectedJobIds((current) =>
      currentQueueJobs.every((job) => current.includes(job.id))
        ? current.filter((id) => !currentQueueJobs.some((job) => job.id === id))
        : Array.from(new Set([...current, ...currentQueueJobs.map((job) => job.id)])),
    );
  };

  const openHoldModal = (job: Job) => {
    setHoldDraft({
      jobId: job.id,
      jobNumber: job.jobNumber,
      reason: job.billingHoldReason || '',
    });
  };

  const confirmHold = () => {
    if (!holdDraft.jobId || !holdDraft.reason.trim()) return;
    setBillingHold(holdDraft.jobId, holdDraft.reason.trim());
    toast('success', `Billing hold saved for ${holdDraft.jobNumber}`);
    setHoldDraft({ jobId: '', jobNumber: '', reason: '' });
  };

  const handleBulkReady = () => {
    const updated = bulkMarkBillingReady(selectedJobIds);
    if (updated > 0) {
      toast('success', `${updated} job${updated === 1 ? '' : 's'} marked billing ready`);
      return;
    }
    toast('warning', 'Select at least one eligible job first');
  };

  const handleBulkInvoice = () => {
    const updated = bulkGenerateInvoices(selectedJobIds);
    if (updated > 0) {
      toast('success', `${updated} invoice${updated === 1 ? '' : 's'} generated`);
      return;
    }
    toast('warning', 'Select at least one billing-ready job first');
  };

  const handleCreateSO = () => {
    if (!soCustomerId) return;
    const newSO = createSO({
      customerId: soCustomerId,
      customerName: soCustomerName,
      memo: soMemo.trim() || undefined,
    });
    toast('success', `Sales order ${newSO.soNumber} created`);
    setCreateSOOpen(false);
    setSOCustomerSearch('');
    setSOCustomerId('');
    setSOCustomerName('');
    setSOmemo('');
    navigate(`/billing/${newSO.id}`);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...['Pending Approval', 'Approved', 'Billed', 'Partially Billed', 'Fully Billed', 'Cancelled'].map((status) => ({
      value: status,
      label: status,
    })),
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Pending review, billing-ready queues, warranty jobs, and sales-order controls.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== 'salesorders' && (
            <>
              <Button variant="outline" onClick={handleBulkReady}>Bulk Billing Ready</Button>
              <Button variant="success" onClick={handleBulkInvoice}>Generate Invoices</Button>
            </>
          )}
          <Button variant="primary" onClick={() => navigate('/jobs/new')}>+ New Job / SO</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Pending Review', value: pendingJobs.length, icon: '⚠️' },
          { label: 'Billing Ready', value: readyJobs.length, icon: '✅' },
          { label: 'Warranty Open', value: warrantyJobs.length, icon: '🛡️' },
          { label: 'Pending Balance', value: formatCurrency(pendingRevenue), icon: '💰' },
        ].map((item) => (
          <div key={item.label} className="surface-card flex items-center gap-3 p-4">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <div className="text-xl font-bold text-surface-900">{item.value}</div>
              <div className="text-xs text-surface-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs
        variant="pill"
        active={activeTab}
        onChange={(value) => setActiveTab(value as BillingTab)}
        tabs={[
          { id: 'pending', label: 'Pending Review', badge: pendingJobs.length },
          { id: 'ready', label: 'Billing Ready', badge: readyJobs.length },
          { id: 'warranty', label: 'Warranty Jobs', badge: warrantyJobs.length },
          { id: 'salesorders', label: 'Sales Orders', badge: visibleSalesOrders.length },
        ]}
      />

      {activeTab === 'pending' && (
        <div className="surface-card p-0">
          <BillingQueueTable
            jobs={pendingJobs}
            selectedJobIds={selectedJobIds}
            onToggleJob={toggleSelectedJob}
            onToggleAll={toggleAllJobs}
            onReview={(jobId) => navigate(`/jobs/${jobId}?tab=billing`)}
            onMarkReady={(jobId) => {
              markBillingReady(jobId);
              toast('success', 'Marked billing ready');
            }}
            onInvoice={(jobId) => {
              const result = generateInvoice(jobId);
              if (result) toast('success', `Invoice ${result.invoiceNumber} generated`);
            }}
            onHold={openHoldModal}
            onRemoveHold={(jobId) => {
              removeBillingHold(jobId);
              toast('success', 'Billing hold removed');
            }}
          />
        </div>
      )}

      {activeTab === 'ready' && (
        <div className="surface-card p-0">
          <BillingQueueTable
            jobs={readyJobs}
            selectedJobIds={selectedJobIds}
            onToggleJob={toggleSelectedJob}
            onToggleAll={toggleAllJobs}
            onReview={(jobId) => navigate(`/jobs/${jobId}?tab=billing`)}
            onMarkReady={() => undefined}
            onInvoice={(jobId) => {
              const result = generateInvoice(jobId);
              if (result) toast('success', `Invoice ${result.invoiceNumber} generated`);
            }}
            onHold={openHoldModal}
            onRemoveHold={(jobId) => {
              removeBillingHold(jobId);
              toast('success', 'Billing hold removed');
            }}
          />
        </div>
      )}

      {activeTab === 'warranty' && (
        <div className="surface-card p-0">
          <BillingQueueTable
            jobs={warrantyJobs}
            selectedJobIds={selectedJobIds}
            onToggleJob={toggleSelectedJob}
            onToggleAll={toggleAllJobs}
            onReview={(jobId) => navigate(`/jobs/${jobId}?tab=billing`)}
            onMarkReady={() => undefined}
            onInvoice={() => undefined}
            onHold={openHoldModal}
            onRemoveHold={() => undefined}
          />
        </div>
      )}

      {activeTab === 'salesorders' && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Total SOs', value: String(visibleSalesOrders.length), icon: '🧾' },
              { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: '📈' },
              { label: 'Pending Balance', value: formatCurrency(pendingRevenue), icon: '⏳' },
              { label: 'Linked Jobs', value: String(scopedJobs.filter((job) => job.salesOrderId).length), icon: '🔗' },
            ].map((item) => (
              <div key={item.label} className="surface-card flex items-center gap-3 p-4">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="text-xl font-bold text-surface-900">{item.value}</div>
                  <div className="text-xs text-surface-500">{item.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Search sales orders…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="select w-auto"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button variant="primary" onClick={() => setCreateSOOpen(true)}>+ New SO</Button>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SO #</th>
                    <th>Customer</th>
                    <th>Memo</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Balance</th>
                    <th>Linked Job</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSalesOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState icon="🧾" title="No sales orders found" />
                      </td>
                    </tr>
                  ) : paginatedSalesOrders.map((salesOrder) => (
                    <tr key={salesOrder.id} className="cursor-pointer" onClick={() => navigate(`/billing/${salesOrder.id}`)}>
                      <td className="font-mono text-xs font-semibold text-cyan-600">{salesOrder.soNumber}</td>
                      <td className="font-medium text-sm text-surface-900">{salesOrder.customerName}</td>
                      <td className="max-w-48 text-sm text-surface-500 line-clamp-1">{salesOrder.memo || '—'}</td>
                      <td>
                        <span className={cn(
                          'badge',
                          salesOrder.status === 'Fully Billed' ? 'bg-emerald-100 text-emerald-700'
                            : salesOrder.status === 'Cancelled' ? 'bg-red-100 text-red-700'
                              : salesOrder.status === 'Approved' ? 'bg-blue-100 text-blue-700'
                                : 'bg-surface-100 text-surface-700',
                        )}>
                          {salesOrder.status}
                        </span>
                      </td>
                      <td className="text-sm">{formatDate(salesOrder.tranDate)}</td>
                      <td className="text-right font-bold">{formatCurrency(salesOrder.total)}</td>
                      <td className={cn(
                        'text-right font-medium',
                        (salesOrder.balance || 0) > 0 ? 'text-amber-600' : 'text-emerald-600',
                      )}>
                        {formatCurrency(salesOrder.balance || 0)}
                      </td>
                      <td>
                        {salesOrder.linkedJobNumber ? (
                          <Link
                            to={`/jobs/${salesOrder.linkedJobId}`}
                            onClick={(event) => event.stopPropagation()}
                            className="text-xs font-mono text-brand-600 hover:underline"
                          >
                            {salesOrder.linkedJobNumber}
                          </Link>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3">
                <span className="text-xs text-surface-500">
                  {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredSalesOrders.length)} of {filteredSalesOrders.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 disabled:opacity-30">‹</button>
                  <span className="px-2 text-sm">{page} / {totalPages}</span>
                  <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 disabled:opacity-30">›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={Boolean(holdDraft.jobId)}
        onClose={() => setHoldDraft({ jobId: '', jobNumber: '', reason: '' })}
        title={`Billing Hold${holdDraft.jobNumber ? ` · ${holdDraft.jobNumber}` : ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setHoldDraft({ jobId: '', jobNumber: '', reason: '' })}>Cancel</Button>
            <Button variant="primary" onClick={confirmHold}>Put on Hold</Button>
          </>
        )}
      >
        <Textarea
          label="Reason"
          rows={4}
          value={holdDraft.reason}
          onChange={(event) => setHoldDraft((current) => ({ ...current, reason: event.target.value }))}
          placeholder="Why is this job on billing hold?"
        />
      </Modal>

      <Modal
        open={createSOOpen}
        onClose={() => { setCreateSOOpen(false); setSOCustomerSearch(''); setSOCustomerId(''); setSOCustomerName(''); setSOmemo(''); setShowSOCustomerDrop(false); }}
        title="New Sales Order"
        footer={(
          <>
            <Button variant="secondary" onClick={() => { setCreateSOOpen(false); setSOCustomerSearch(''); setSOCustomerId(''); setSOCustomerName(''); setSOmemo(''); }}>Cancel</Button>
            <Button variant="primary" disabled={!soCustomerId} onClick={handleCreateSO}>Create Sales Order</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="label">Customer *</label>
            <input
              className="input"
              placeholder="Search customers…"
              value={soCustomerSearch}
              onChange={(e) => { setSOCustomerSearch(e.target.value); setSOCustomerId(''); setShowSOCustomerDrop(true); }}
              onFocus={() => setShowSOCustomerDrop(true)}
            />
            {showSOCustomerDrop && soCustomerSearch.length >= 1 && soCustomerResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                {soCustomerResults.slice(0, 6).map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => { setSOCustomerId(c.id); setSOCustomerName(c.companyName); setSOCustomerSearch(c.companyName); setShowSOCustomerDrop(false); }}
                    className="w-full px-4 py-2.5 text-left hover:bg-surface-50 text-sm border-b border-surface-100 last:border-0"
                  >
                    <div className="font-medium">{c.companyName}</div>
                    <div className="text-xs text-surface-400">{c.defaultAddress}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Textarea
            label="Memo"
            rows={3}
            placeholder="Brief summary for this sales order…"
            value={soMemo}
            onChange={(e) => setSOmemo(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export const SODetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const jobs = useJobStore((state) => state.jobs);
  const { getSO } = useSOStore();

  const so = id ? getSO(id) : undefined;
  const cat = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';
  const visibleJobIds = new Set(jobs.filter((job) => job.category === cat).map((job) => job.id));

  if (!so || (so.linkedJobId && !visibleJobIds.has(so.linkedJobId))) {
    return (
      <EmptyState
        icon="🧾"
        title="Sales Order not found"
        action={<Button onClick={() => navigate('/billing')}>Back to Billing</Button>}
      />
    );
  }

  return (
    <div className="max-w-6xl space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <Link to="/billing" className="hover:text-brand-600">Billing</Link>
        <span>/</span>
        <span className="text-surface-700">{so.soNumber}</span>
      </div>

      <SalesOrderWorkbench salesOrderId={so.id} />
    </div>
  );
};

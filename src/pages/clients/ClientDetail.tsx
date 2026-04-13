import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCustomerStore, useJobStore, useSOStore, useAssetStore, useUIStore } from '@/store';
import { getDesktopCopy } from '@/lib/desktop-copy';
import { Card, StatusBadge, PriorityBadge, ServiceTypeBadge, Tabs, EmptyState, Button, Modal } from '@/components/ui';
import { formatDate, formatCurrency, cn, SERVICE_TYPE_LABELS } from '@/lib/utils';
import { ClientEditorFields } from '@/components/clients/ClientEditorFields';
import { buildCustomerDraft, buildCustomerPayloadFromDraft, type CustomerDraft } from '@/lib/customer-form';

export const ClientDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, language } = useUIStore((state) => ({ toast: state.toast, language: state.language }));
  const copy = getDesktopCopy(language);
  const { getCustomer, updateCustomer } = useCustomerStore();
  const { getJobsForCustomer, getUnifiedFilesForCustomer } = useJobStore();
  const { getSOsForCustomer } = useSOStore();
  const { getAssetsForCustomer } = useAssetStore();

  const customer = id ? getCustomer(id) : undefined;
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDraft, setEditDraft] = useState<CustomerDraft>(() => buildCustomerDraft());

  if (!customer) {
    return <EmptyState icon="🏢" title={copy.clientDetail.clientNotFound} action={<Button onClick={() => navigate('/clients')}>{copy.clientDetail.backToClients}</Button>} />;
  }

  const jobs = getJobsForCustomer(customer.id);
  const salesOrders = getSOsForCustomer(customer.id);
  const assets = getAssetsForCustomer(customer.id);
  const files = getUnifiedFilesForCustomer(customer.id);
  const openJobs = jobs.filter(j => !['COMPLETED','CANCELLED','INVOICED'].includes(j.status));
  const totalRevenue = salesOrders.filter(s => s.status !== 'Cancelled').reduce((sum, so) => sum + so.total, 0);

  const openEditModal = () => {
    setEditDraft(buildCustomerDraft(customer));
    setShowEditModal(true);
  };

  const saveCustomerChanges = () => {
    if (!editDraft.companyName.trim()) {
      toast('warning', 'Enter a company name before saving.');
      return;
    }
    if (!editDraft.phone.trim()) {
      toast('warning', 'A phone number is required.');
      return;
    }
    if (!editDraft.street.trim() || !editDraft.state.trim() || !editDraft.zip.trim()) {
      toast('warning', 'Street, state/province, and postal code are required.');
      return;
    }

    updateCustomer(customer.id, buildCustomerPayloadFromDraft(editDraft, customer));
    setShowEditModal(false);
  };

  const tabs = [
    { id: 'overview',    label: copy.clientDetail.overview },
    { id: 'jobs',        label: `${copy.clientDetail.allJobs} (${jobs.length})` },
    { id: 'salesorders', label: `${copy.clientDetail.salesOrders} (${salesOrders.length})` },
    { id: 'files',       label: `${copy.clientDetail.files} (${files.length})` },
    { id: 'assets',      label: `${copy.clientDetail.assets} (${assets.length})` },
  ];

  return (
    <div className="space-y-4 max-w-5xl animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <Link to="/clients" className="hover:text-brand-600">{copy.clientDetail.clients}</Link>
        <span>/</span>
        <span className="text-surface-700">{customer.companyName}</span>
      </div>

      {/* Client header */}
      <div className="surface-card p-5">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {customer.companyName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-surface-900">{customer.companyName}</h1>
              {!customer.isActive && <span className="badge bg-red-100 text-red-600">{copy.clients.inactive}</span>}
              {customer.category && <span className="badge bg-surface-100 text-surface-600">{customer.category}</span>}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-surface-500 flex-wrap">
              {customer.contactName && <span>👤 {customer.contactName}</span>}
              {customer.email && <a href={`mailto:${customer.email}`} className="hover:text-brand-600">✉ {customer.email}</a>}
              {customer.phone && <span>📞 {customer.phone}</span>}
            </div>
          </div>
          {/* KPI pills */}
          <div className="flex gap-3">
            {[
              { label: copy.clients.jobs, value: jobs.length },
              { label: copy.clients.open, value: openJobs.length },
              { label: copy.clientDetail.salesOrders, value: salesOrders.length },
              { label: copy.clientDetail.files, value: files.length },
            ].map(k => (
              <div key={k.label} className="text-center bg-surface-50 rounded-xl px-3 py-2">
                <div className="text-lg font-bold text-surface-900">{k.value}</div>
                <div className="text-xs text-surface-400">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => navigate(`/jobs/new?customerId=${customer.id}`)}>{copy.clientDetail.newJob}</Button>
        <Button variant="outline" onClick={openEditModal}>{copy.clientDetail.editClient}</Button>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact info */}
          <Card title={copy.clientDetail.contactInformation}>
            <dl className="space-y-2 text-sm">
              {[
                [copy.clientDetail.entityId, customer.entityId],
                [copy.clientDetail.company, customer.companyName],
                [copy.clientDetail.contact, customer.contactName],
                [copy.clientDetail.email, customer.email],
                [copy.clientDetail.phone, customer.phone],
                [copy.clientDetail.altPhone, customer.altPhone],
                [copy.clientDetail.website, customer.website],
                [copy.clientDetail.accountNumber, customer.accountNumber],
                [copy.clientDetail.category, customer.category],
                [copy.clientDetail.customerSince, formatDate(customer.createdAt)],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="flex gap-2">
                  <dt className="w-28 flex-shrink-0 text-surface-500 font-medium">{l}</dt>
                  <dd className="text-surface-900">{v}</dd>
                </div>
              ))}
            </dl>
            {customer.notes && (
              <div className="mt-4 pt-4 border-t border-surface-100 bg-amber-50 rounded-xl p-3">
                <div className="text-xs font-medium text-amber-700 mb-1">{copy.clientDetail.note}</div>
                <p className="text-sm text-amber-900">{customer.notes}</p>
              </div>
            )}
          </Card>

          {/* Addresses */}
          <Card title={copy.clientDetail.addresses}>
            <div className="space-y-3">
              {customer.addresses.map(addr => (
                <div key={addr.id} className="p-3 bg-surface-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-surface-800">{addr.label}</span>
                    {addr.isDefault && <span className="badge bg-brand-100 text-brand-700 text-[10px]">{copy.clientDetail.defaultBadge}</span>}
                    {addr.isShipping && <span className="badge bg-blue-100 text-blue-700 text-[10px]">{copy.clientDetail.shipBadge}</span>}
                    {addr.isBilling && <span className="badge bg-amber-100 text-amber-700 text-[10px]">{copy.clientDetail.billBadge}</span>}
                  </div>
                  <div className="text-sm text-surface-600">
                    {addr.street}<br />
                    {addr.city}, {addr.state} {addr.zip}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent jobs quick list */}
          <Card title={copy.clientDetail.recentJobs} actions={
            <button onClick={() => setActiveTab('jobs')} className="text-xs text-brand-600 hover:underline">{copy.clientDetail.viewAll}</button>
          }>
            {jobs.slice(0, 5).map(j => (
              <Link key={j.id} to={`/jobs/${j.id}`}
                className="flex items-center gap-3 py-2 border-b border-surface-100 last:border-0 hover:bg-surface-50 -mx-2 px-2 rounded-lg transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-brand-600">{j.jobNumber}</div>
                  <div className="text-xs text-surface-600 truncate">{j.description.substring(0, 50)}</div>
                </div>
                <StatusBadge status={j.status} className="text-[10px]" />
              </Link>
            ))}
            {jobs.length === 0 && <EmptyState icon="🔧" title={copy.clientDetail.noJobsYet} />}
          </Card>

          {/* SO quick list */}
          <Card title={copy.clientDetail.recentSalesOrders} actions={
            <button onClick={() => setActiveTab('salesorders')} className="text-xs text-brand-600 hover:underline">{copy.clientDetail.viewAll}</button>
          }>
            {salesOrders.slice(0, 5).map(so => (
              <Link key={so.id} to={`/billing/${so.id}`}
                className="flex items-center gap-3 py-2 border-b border-surface-100 last:border-0 hover:bg-surface-50 -mx-2 px-2 rounded-lg transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-cyan-600">{so.soNumber}</div>
                  <div className="text-xs text-surface-400">{formatDate(so.tranDate)}</div>
                </div>
                <div className="text-sm font-bold text-surface-900">{formatCurrency(so.total)}</div>
              </Link>
            ))}
            {salesOrders.length === 0 && <EmptyState icon="🧾" title={copy.clientDetail.noSalesOrders} />}
          </Card>
        </div>
      )}

      {activeTab === 'jobs' && (
        <Card title={`${copy.clientDetail.allJobs} (${jobs.length})`}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>{copy.clientDetail.jobNumber}</th><th>{copy.clientDetail.description}</th><th>{copy.clientDetail.status}</th><th>{copy.clientDetail.priority}</th><th>{copy.clientDetail.type}</th><th>{copy.clientDetail.scheduled}</th><th>{copy.clientDetail.technician}</th><th>{copy.clientDetail.salesOrder}</th></tr></thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="🔧" title={copy.clientDetail.noJobs} /></td></tr>
                ) : jobs.map(j => (
                  <tr key={j.id} className="cursor-pointer" onClick={() => navigate(`/jobs/${j.id}`)}>
                    <td className="font-mono text-xs font-semibold text-brand-600">{j.jobNumber}</td>
                    <td><span className="text-sm line-clamp-1">{j.description}</span></td>
                    <td><StatusBadge status={j.status} /></td>
                    <td><PriorityBadge priority={j.priority} /></td>
                    <td><ServiceTypeBadge type={j.serviceType} /></td>
                    <td className="text-sm">{formatDate(j.scheduledDate)}</td>
                    <td className="text-sm">{j.technicianName || '—'}</td>
                    <td>{j.salesOrderNumber ? <span className="text-xs font-mono text-cyan-600">{j.salesOrderNumber}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'salesorders' && (
        <Card title={`${copy.clientDetail.salesOrders} (${salesOrders.length})`}>
          <table className="data-table">
            <thead><tr><th>{copy.clientDetail.soNumber}</th><th>{copy.clientDetail.memo}</th><th>{copy.clientDetail.status}</th><th>{copy.clientDetail.date}</th><th className="text-right">{copy.clientDetail.total}</th><th>{copy.clientDetail.linkedJob}</th></tr></thead>
            <tbody>
              {salesOrders.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon="🧾" title={copy.clientDetail.noSalesOrders} /></td></tr>
              ) : salesOrders.map(so => (
                <tr key={so.id} className="cursor-pointer" onClick={() => navigate(`/billing/${so.id}`)}>
                  <td className="font-mono text-xs font-semibold text-cyan-600">{so.soNumber}</td>
                  <td className="text-sm text-surface-600 max-w-48 line-clamp-1">{so.memo || '—'}</td>
                  <td><span className="badge bg-surface-100 text-surface-700">{so.status}</span></td>
                  <td className="text-sm">{formatDate(so.tranDate)}</td>
                  <td className="text-right font-bold">{formatCurrency(so.total)}</td>
                  <td>{so.linkedJobNumber ? <Link to={`/jobs/${so.linkedJobId}`} className="text-xs text-brand-600 font-mono hover:underline">{so.linkedJobNumber}</Link> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'files' && (
        <Card title={`Files (${files.length})`} subtitle={`Customer revenue to date: ${formatCurrency(totalRevenue)}`}>
          {files.length === 0 ? (
            <EmptyState icon="📎" title={copy.clientDetail.noFilesFound} subtitle={copy.clientDetail.noFilesAttached} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{copy.clientDetail.fileName}</th>
                    <th>{copy.clientDetail.source}</th>
                    <th>{copy.clientDetail.jobNumber}</th>
                    <th>{copy.clientDetail.type}</th>
                    <th>{copy.clientDetail.uploaded}</th>
                    <th>{copy.clientDetail.by}</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td className="font-medium text-sm text-surface-900">{file.name}</td>
                      <td>
                        <span className={cn('badge', file.source === 'SALES_ORDER' ? 'bg-blue-100 text-blue-700' : 'bg-surface-100 text-surface-700')}>
                          {file.source === 'SALES_ORDER' ? 'SO' : 'Job'}
                        </span>
                      </td>
                      <td>
                        {file.jobId ? (
                          <Link to={`/jobs/${file.jobId}`} className="text-xs font-mono text-brand-600 hover:underline">
                            {file.jobNumber || file.jobId}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="text-sm text-surface-500">{file.type}</td>
                      <td className="text-sm text-surface-500">{formatDate(file.createdAt)}</td>
                      <td className="text-sm text-surface-500">{file.uploadedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'assets' && (
        <Card title={`Assets (${assets.length})`}>
          {assets.length === 0 ? (
            <EmptyState icon="⚙️" title={copy.clientDetail.noAssetsOnRecord} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assets.map(a => (
                <div key={a.id} className="p-3 bg-surface-50 rounded-xl border border-surface-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm text-surface-800">{a.name}</div>
                      <div className="text-xs text-surface-500">{a.manufacturer} · {a.modelNumber}</div>
                    </div>
                    <span className={cn('badge', a.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>
                      {a.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs text-surface-500">
                    <div>SN: {a.serialNumber || '—'}</div>
                    <div>Installed: {formatDate(a.installDate)}</div>
                    <div>Last Service: {formatDate(a.lastServiceDate)}</div>
                    <div>Next Service: {formatDate(a.nextServiceDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={copy.clientDetail.editClient}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>{copy.clientDetail.cancel}</Button>
            <Button variant="primary" onClick={saveCustomerChanges}>{copy.clientDetail.saveChanges}</Button>
          </>
        )}
      >
        <ClientEditorFields draft={editDraft} onChange={(patch) => setEditDraft((current) => ({ ...current, ...patch }))} />
      </Modal>
    </div>
  );
};

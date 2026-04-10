import React, { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useJobStore, useSOStore, useAuthStore, useTechStore, useUIStore } from '@/store';
import {
  Card, StatusBadge, PriorityBadge, ServiceTypeBadge, Button, Tabs, Alert,
  EmptyState, Modal, Input, Select, Textarea, Avatar,
} from '@/components/ui';
import { SalesOrderWorkbench } from '@/components/billing/SalesOrderWorkbench';
import {
  formatDate, formatDateTime, formatCurrency, formatDuration, cn,
  STATUS_LABELS, TECH_STATUS_LABELS,
} from '@/lib/utils';
import type { Attachment, ChecklistItem, ChecklistResponse, JobStatus, NoteType, Part, TimeEntry } from '@/types';

const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  NEW: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['DISPATCHED', 'EN_ROUTE', 'CANCELLED', 'ON_HOLD'],
  DISPATCHED: ['EN_ROUTE', 'CANCELLED', 'ON_HOLD'],
  EN_ROUTE: ['IN_PROGRESS', 'ON_HOLD'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['SCHEDULED', 'EN_ROUTE', 'CANCELLED'],
  COMPLETED: ['BILLING_READY'],
  BILLING_READY: ['INVOICED'],
  INVOICED: [],
  CANCELLED: [],
};

const EMPTY_TIME_DRAFT = {
  type: 'REGULAR',
  date: new Date().toISOString().split('T')[0],
  startTime: '08:00',
  endTime: '10:00',
  duration: 2,
  billable: true,
  notes: '',
};

const EMPTY_PART_DRAFT = {
  itemName: '',
  partNumber: '',
  description: '',
  quantity: 1,
  unitCost: 0,
  warranty: false,
};

const EMPTY_FILE_DRAFT = {
  name: '',
  type: 'application/pdf',
  source: 'JOB',
};

function buildChecklistState(items: ChecklistItem[], responses: ChecklistResponse[]) {
  return items.map((item) => ({
    item,
    response: responses.find((response) => response.itemId === item.id),
  }));
}

function getBillingValidations(job: ReturnType<typeof useJobStore.getState>['jobs'][number], timeEntries: TimeEntry[]) {
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

export const JobDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    getJob,
    getJobsForCustomer,
    getNotes,
    getTimeEntries,
    getParts,
    addNote,
    addTimeEntry,
    addPart,
    updateJob,
    updateStatus,
    assignTechnician,
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
  const { getSOsForJob, getSOsForCustomer, createSO, linkSOToJob } = useSOStore();
  const { user } = useAuthStore();
  const techs = useTechStore((state) => state.technicians);
  const { toast } = useUIStore();

  const job = id ? getJob(id) : undefined;
  const initialTab = new URLSearchParams(location.search).get('tab') || 'summary';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('INTERNAL');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [timeDraft, setTimeDraft] = useState(EMPTY_TIME_DRAFT);
  const [partDraft, setPartDraft] = useState(EMPTY_PART_DRAFT);
  const [rescheduleDraft, setRescheduleDraft] = useState({ scheduledDate: '', scheduledStart: '', scheduledEnd: '', reason: '' });
  const [holdReason, setHoldReason] = useState('');
  const [fileDraft, setFileDraft] = useState(EMPTY_FILE_DRAFT);
  const [linkSOId, setLinkSOId] = useState('');

  if (!job) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="🔍"
          title="Job not found"
          subtitle="This job may have been removed or you may not have access."
          action={<Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>}
        />
      </div>
    );
  }

  const notes = getNotes(job.id);
  const timeEntries = getTimeEntries(job.id);
  const parts = getParts(job.id);
  const salesOrders = getSOsForJob(job.id);
  const primarySalesOrder = salesOrders[0];
  const checklist = buildChecklistState(getChecklistItems(), getChecklistResponses(job.id));
  const files = getUnifiedFilesForJob(job.id);
  const totalLabor = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
  const totalParts = parts.reduce((sum, part) => sum + part.totalCost, 0);
  const availableTechs = techs.filter((tech) => tech.category === job.category);
  const nextStatuses = STATUS_TRANSITIONS[job.status] || [];
  const customerJobs = getJobsForCustomer(job.customerId).filter((customerJob) => customerJob.id !== job.id);
  const customerSalesOrders = getSOsForCustomer(job.customerId)
    .filter((salesOrder) => !salesOrder.linkedJobId || salesOrder.linkedJobId === job.id)
    .sort((left, right) => new Date(right.tranDate).getTime() - new Date(left.tranDate).getTime());
  const latestNote = [...notes].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  const billingValidations = getBillingValidations(job, timeEntries);
  const billingReady = job.billingReady || job.status === 'BILLING_READY' || job.status === 'INVOICED';
  const allBillingValid = billingValidations.every((validation) => validation.ok);
  const checklistComplete = checklist.filter((entry) => entry.response?.checked).length;

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'schedule', label: 'Scheduling' },
    { id: 'time', label: `Time (${timeEntries.length})` },
    { id: 'parts', label: `Parts (${parts.length})` },
    { id: 'checklist', label: 'Checklist' },
    { id: 'notes', label: `Notes (${notes.length})` },
    { id: 'salesorder', label: `Sales Order${salesOrders.length ? ` (${salesOrders.length})` : ''}` },
    { id: 'files', label: `Files (${files.length})` },
    { id: 'billing', label: 'Billing' },
    { id: 'history', label: 'History' },
  ];

  const handleStatusChange = (status: JobStatus) => {
    updateStatus(job.id, status);
    toast('success', `Status updated to ${STATUS_LABELS[status]}`);
  };

  const handleAssign = () => {
    if (!selectedTechId) return;
    const tech = techs.find((candidate) => candidate.id === selectedTechId);
    if (!tech) return;
    assignTechnician(job.id, tech.id, tech.name);
    toast('success', `Assigned to ${tech.name}`);
    setShowAssignModal(false);
    setSelectedTechId('');
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(job.id, noteText.trim(), noteType, user?.id || 'u-system', user?.name || 'System');
    toast('success', 'Note added');
    setNoteText('');
    setNoteType('INTERNAL');
    setShowNoteModal(false);
  };

  const handleAddTimeEntry = () => {
    addTimeEntry({
      jobId: job.id,
      technicianId: job.technicianId || user?.technicianId || 'tech-unassigned',
      technicianName: job.technicianName || user?.name || 'Unassigned',
      type: timeDraft.type as TimeEntry['type'],
      date: timeDraft.date,
      startTime: timeDraft.startTime,
      endTime: timeDraft.endTime || undefined,
      duration: Number(timeDraft.duration) || 0,
      notes: timeDraft.notes || undefined,
      billable: timeDraft.billable,
    });
    toast('success', 'Time entry added');
    setTimeDraft(EMPTY_TIME_DRAFT);
    setShowTimeModal(false);
  };

  const handleAddPart = () => {
    const quantity = Number(partDraft.quantity) || 0;
    const unitCost = Number(partDraft.unitCost) || 0;
    addPart({
      jobId: job.id,
      itemId: `item-${Date.now()}`,
      itemName: partDraft.itemName || 'Field Material',
      partNumber: partDraft.partNumber || undefined,
      description: partDraft.description || undefined,
      quantity,
      unitCost,
      totalCost: Math.round(quantity * unitCost * 100) / 100,
      warranty: partDraft.warranty,
    });
    toast('success', 'Part added');
    setPartDraft(EMPTY_PART_DRAFT);
    setShowPartModal(false);
  };

  const handleCreateSO = () => {
    const salesOrder = createSO({
      customerId: job.customerId,
      customerName: job.customerName,
      linkedJobId: job.id,
      linkedJobNumber: job.jobNumber,
      memo: `Work order ${job.jobNumber} — ${job.description}`,
      billingCode: job.billingCode,
    });
    toast('success', `Sales Order ${salesOrder.soNumber} created`);
    navigate(`/billing/${salesOrder.id}`);
  };

  const handleLinkSO = () => {
    if (!linkSOId) return;
    linkSOToJob(linkSOId, job.id);
    toast('success', 'Sales order linked to this job');
  };

  const handleReschedule = () => {
    if (!rescheduleDraft.scheduledDate) return;
    rescheduleJob(job.id, {
      scheduledDate: rescheduleDraft.scheduledDate,
      scheduledStart: rescheduleDraft.scheduledStart || undefined,
      scheduledEnd: rescheduleDraft.scheduledEnd || undefined,
      reason: rescheduleDraft.reason,
    });
    toast('success', 'Job rescheduled');
    setShowRescheduleModal(false);
  };

  const handleBillingReady = () => {
    if (!allBillingValid) return;
    markBillingReady(job.id);
    toast('success', 'Job marked billing ready');
  };

  const handleBillingHold = () => {
    if (!holdReason.trim()) return;
    setBillingHold(job.id, holdReason.trim());
    toast('success', 'Billing hold applied');
    setHoldReason('');
    setShowHoldModal(false);
  };

  const handleGenerateInvoice = () => {
    const result = generateInvoice(job.id);
    if (result) {
      toast('success', `Invoice ${result.invoiceNumber} generated`);
    }
  };

  const handleAddFile = () => {
    addAttachment({
      customerId: job.customerId,
      jobId: fileDraft.source === 'JOB' ? job.id : undefined,
      jobNumber: fileDraft.source === 'JOB' ? job.jobNumber : undefined,
      soId: fileDraft.source === 'SALES_ORDER' ? primarySalesOrder?.id : undefined,
      soNumber: fileDraft.source === 'SALES_ORDER' ? primarySalesOrder?.soNumber : undefined,
      name: fileDraft.name || `${job.jobNumber} Attachment`,
      type: fileDraft.type,
      size: 128000,
      url: '#',
      source: fileDraft.source as Attachment['source'],
      uploadedBy: user?.name || 'System',
    });
    toast('success', 'File attached');
    setFileDraft(EMPTY_FILE_DRAFT);
    setShowFileModal(false);
  };

  return (
    <div className="max-w-6xl space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <Link to="/jobs" className="hover:text-brand-600 transition-colors">Jobs</Link>
        <span>/</span>
        <span className="text-surface-700 font-medium">{job.jobNumber}</span>
      </div>

      {job.slaBreached && <Alert type="danger" icon="🚨">SLA breached — this job requires immediate attention.</Alert>}
      {job.status === 'ON_HOLD' && <Alert type="warning" icon="⏸">This job is currently on hold.</Alert>}
      {job.warranty && <Alert type="info" icon="🛡️">This job is covered under warranty.</Alert>}

      <div className="surface-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg font-bold text-brand-600">{job.jobNumber}</span>
              <StatusBadge status={job.status} />
              <PriorityBadge priority={job.priority} />
              <ServiceTypeBadge type={job.serviceType} />
              {job.warranty && <span className="badge bg-amber-100 text-amber-700">Warranty</span>}
            </div>
            <h1 className="mt-2 text-xl font-bold text-surface-900">{job.description}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
              <Link to={`/clients/${job.customerId}`} className="hover:text-brand-600">🏢 {job.customerName}</Link>
              <span>📍 {job.serviceAddress.street}, {job.serviceAddress.city}, {job.serviceAddress.state}</span>
              {job.scheduledDate && <span>📅 {formatDate(job.scheduledDate)} {job.scheduledStart || ''}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/jobs/${job.id}/edit`)}>Edit</Button>
            <Button variant="outline" size="sm" onClick={() => {
              setSelectedTechId(job.technicianId || '');
              setShowAssignModal(true);
            }}>
              {job.technicianId ? 'Reassign Tech' : 'Assign Tech'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setRescheduleDraft({
                scheduledDate: job.scheduledDate || new Date().toISOString().split('T')[0],
                scheduledStart: job.scheduledStart || '',
                scheduledEnd: job.scheduledEnd || '',
                reason: '',
              });
              setShowRescheduleModal(true);
            }}>
              Reschedule
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowNoteModal(true)}>+ Note</Button>
            {nextStatuses.length > 0 && (
              <div className="group relative">
                <Button variant="secondary" size="sm">Update Status ▾</Button>
                <div className="invisible absolute right-0 top-full z-10 mt-1 min-w-44 overflow-hidden rounded-xl border border-surface-200 bg-white opacity-0 shadow-card-hover transition-all group-hover:visible group-hover:opacity-100">
                  {nextStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-50"
                    >
                      <StatusBadge status={status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card title="Job Details">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['Job Number', job.jobNumber],
                  ['Status', <StatusBadge key="status" status={job.status} />],
                  ['Priority', <PriorityBadge key="priority" priority={job.priority} />],
                  ['Service Type', <ServiceTypeBadge key="service-type" type={job.serviceType} />],
                  ['Category', job.category],
                  ['Customer', <Link key="customer" to={`/clients/${job.customerId}`} className="text-brand-600 hover:underline">{job.customerName}</Link>],
                  ['Contact', job.contactName || '—'],
                  ['Phone', job.contactPhone || '—'],
                  ['Email', job.contactEmail || '—'],
                  ['Service Address', `${job.serviceAddress.street}, ${job.serviceAddress.city}, ${job.serviceAddress.state} ${job.serviceAddress.zip}`],
                  ['Asset', job.assetName || job.assetId || '—'],
                  ['Billing Code', job.billingCode || '—'],
                ].map(([label, value]) => (
                  <React.Fragment key={String(label)}>
                    <dt className="font-medium text-surface-500">{label}</dt>
                    <dd className="text-surface-900">{value}</dd>
                  </React.Fragment>
                ))}
              </dl>
              {job.internalNotes && (
                <div className="mt-4 border-t border-surface-100 pt-4">
                  <div className="mb-1 text-xs font-medium text-surface-500">INTERNAL NOTES</div>
                  <p className="text-sm text-surface-700">{job.internalNotes}</p>
                </div>
              )}
            </Card>

            <Card title="Operational Summary">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Time Entries', value: timeEntries.length },
                  { label: 'Labor Hours', value: totalLabor ? formatDuration(totalLabor) : '—' },
                  { label: 'Parts Used', value: parts.length },
                  { label: 'Files', value: files.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-surface-400">{item.label}</div>
                    <div className="mt-1 text-base font-semibold text-surface-900">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                <div className="rounded-xl border border-surface-200 p-4">
                  <div className="mb-2 text-xs font-medium text-surface-500">LATEST NOTE</div>
                  <p className="text-surface-700">{latestNote ? latestNote.text : 'No notes have been added yet.'}</p>
                </div>
                <div className="rounded-xl border border-surface-200 p-4">
                  <div className="mb-2 text-xs font-medium text-surface-500">RESOLUTION</div>
                  <p className="text-surface-700">{job.resolution || 'Resolution summary has not been captured yet.'}</p>
                </div>
              </div>
            </Card>

            {job.followUpRequired && (
              <Alert type="warning" icon="🔔">
                <strong>Follow-up required:</strong> {job.followUpNotes || 'See job notes for details.'}
              </Alert>
            )}
          </div>

          <div className="space-y-4">
            <Card title="Assigned Technician">
              {job.technicianId ? (
                <div className="flex items-center gap-3">
                  <Avatar initials={job.technicianName?.split(' ').map((word) => word[0]).join('') || 'T'} color="bg-brand-500" size="lg" />
                  <div>
                    <div className="font-semibold text-surface-900">{job.technicianName}</div>
                    <div className="text-xs text-surface-500">Primary Technician</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-surface-400">No technician assigned</div>
              )}
            </Card>

            <Card title="Sales Order">
              {salesOrders.length > 0 ? (
                <div className="space-y-2">
                  {salesOrders.map((salesOrder) => (
                    <Link key={salesOrder.id} to={`/billing/${salesOrder.id}`} className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-surface-50">
                      <div>
                        <div className="text-sm font-semibold text-brand-600">{salesOrder.soNumber}</div>
                        <div className="text-xs text-surface-400">{salesOrder.status}</div>
                      </div>
                      <div className="text-sm font-bold">{formatCurrency(salesOrder.total)}</div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-surface-400">No sales order linked</div>
              )}
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleCreateSO}>
                {primarySalesOrder ? 'Create Additional SO' : '+ Create Sales Order'}
              </Button>
            </Card>

            <Card title="Customer History">
              {customerJobs.length === 0 ? (
                <div className="text-sm text-surface-400">No prior jobs found for this customer.</div>
              ) : (
                <div className="space-y-2">
                  {customerJobs.slice(0, 5).map((customerJob) => (
                    <Link key={customerJob.id} to={`/jobs/${customerJob.id}`} className="block rounded-xl border border-surface-200 px-3 py-3 hover:bg-surface-50">
                      <div className="text-xs font-mono font-semibold text-brand-600">{customerJob.jobNumber}</div>
                      <div className="mt-1 text-sm text-surface-800 line-clamp-1">{customerJob.description}</div>
                      <div className="mt-1 text-xs text-surface-500">
                        {formatDate(customerJob.actualEnd || customerJob.scheduledDate || customerJob.updatedAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <Card
          title="Scheduling"
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRescheduleDraft({
                  scheduledDate: job.scheduledDate || new Date().toISOString().split('T')[0],
                  scheduledStart: job.scheduledStart || '',
                  scheduledEnd: job.scheduledEnd || '',
                  reason: '',
                });
                setShowRescheduleModal(true);
              }}
            >
              Reschedule
            </Button>
          )}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Scheduled Date', formatDate(job.scheduledDate)],
              ['Start Time', job.scheduledStart || '—'],
              ['End Time', job.scheduledEnd || '—'],
              ['Est. Duration', formatDuration(job.estimatedDuration)],
              ['Actual Start', formatDateTime(job.actualStart)],
              ['Actual End', formatDateTime(job.actualEnd)],
              ['Actual Duration', formatDuration(job.actualDuration)],
            ].map(([label, value]) => (
              <React.Fragment key={String(label)}>
                <dt className="font-medium text-surface-500">{label}</dt>
                <dd className="text-surface-900">{value || '—'}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Card>
      )}

      {activeTab === 'time' && (
        <Card title="Time Entries" actions={<Button variant="primary" size="sm" onClick={() => setShowTimeModal(true)}>+ Add Time Entry</Button>}>
          {timeEntries.length === 0 ? (
            <EmptyState icon="⏱️" title="No time entries" subtitle="Add time entries to track labor and close-out readiness." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Duration</th>
                    <th>Billable</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="font-medium">{entry.technicianName}</td>
                      <td><span className="badge bg-surface-100 text-surface-700">{entry.type}</span></td>
                      <td>{formatDate(entry.date)}</td>
                      <td>{entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ''}</td>
                      <td>{formatDuration(entry.duration)}</td>
                      <td>{entry.billable ? 'Yes' : 'No'}</td>
                      <td className="max-w-52 text-sm text-surface-500 line-clamp-1">{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'parts' && (
        <Card title="Parts & Materials" actions={<Button variant="primary" size="sm" onClick={() => setShowPartModal(true)}>+ Add Part</Button>}>
          {parts.length === 0 ? (
            <EmptyState icon="🔩" title="No parts recorded" subtitle="Capture field materials to complete billing and cost tracking." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part: Part) => (
                    <tr key={part.id}>
                      <td>
                        <div className="font-medium text-sm">{part.itemName}</div>
                        <div className="text-xs text-surface-400">{part.partNumber || 'No part number'}</div>
                      </td>
                      <td className="max-w-56 text-sm text-surface-500 line-clamp-2">{part.description || '—'}</td>
                      <td>{part.quantity}</td>
                      <td>{formatCurrency(part.unitCost)}</td>
                      <td className="text-right font-medium">{formatCurrency(part.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'checklist' && (
        <Card title="Checklist" subtitle={`${checklistComplete} of ${checklist.length} items completed`}>
          <div className="mb-4 h-2 rounded-full bg-surface-100">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${checklist.length ? (checklistComplete / checklist.length) * 100 : 0}%` }} />
          </div>
          <div className="space-y-3">
            {checklist.map(({ item, response }) => (
              <div key={item.id} className="rounded-xl border border-surface-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(response?.checked)}
                      onChange={(event) => upsertChecklistResponse(job.id, item.id, {
                        checked: event.target.checked,
                        completedAt: event.target.checked ? new Date().toISOString() : undefined,
                        technicianId: job.technicianId,
                      })}
                    />
                    <div>
                      <div className="text-sm font-medium text-surface-900">{item.label}</div>
                      <div className="mt-1 text-xs text-surface-400">{item.required ? 'Required' : 'Optional'} · {item.type}</div>
                    </div>
                  </div>
                  {response?.completedAt && (
                    <div className="text-xs text-surface-400">{formatDateTime(response.completedAt)}</div>
                  )}
                </div>
                {item.type !== 'CHECKBOX' && (
                  <Textarea
                    className="mt-3"
                    rows={3}
                    value={response?.notes || ''}
                    onChange={(event) => upsertChecklistResponse(job.id, item.id, {
                      checked: true,
                      notes: event.target.value,
                      technicianId: job.technicianId,
                      completedAt: new Date().toISOString(),
                    })}
                    placeholder={item.type === 'SIGNATURE' ? 'Capture sign-off notes or reference details…' : 'Add supporting notes…'}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setShowNoteModal(true)}>+ Add Note</Button>
          </div>
          {notes.length === 0 ? (
            <EmptyState icon="📝" title="No notes yet" subtitle="Add a note to document activity on this job." />
          ) : notes.map((note) => (
            <div key={note.id} className="surface-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar initials={note.authorName.split(' ').map((word) => word[0]).join('')} size="sm" />
                  <div>
                    <span className="text-sm font-medium text-surface-800">{note.authorName}</span>
                    <span className="ml-2 text-xs text-surface-400">{formatDateTime(note.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <span className="badge bg-surface-100 text-surface-600">{note.type}</span>
                  <span className="badge bg-surface-100 text-surface-500">{note.visibility}</span>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-surface-700">{note.text}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'salesorder' && (
        <div className="space-y-4">
          {salesOrders.length === 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Link Existing Sales Order">
                {customerSalesOrders.length === 0 ? (
                  <div className="text-sm text-surface-400">No existing customer sales orders are available to link.</div>
                ) : (
                  <div className="space-y-3">
                    <Select
                      label="Sales Order"
                      value={linkSOId}
                      onChange={(event) => setLinkSOId(event.target.value)}
                      options={[
                        { value: '', label: 'Select a sales order' },
                        ...customerSalesOrders.map((salesOrder) => ({ value: salesOrder.id, label: `${salesOrder.soNumber} · ${salesOrder.status}` })),
                      ]}
                    />
                    <Button variant="outline" onClick={handleLinkSO}>Link Sales Order</Button>
                  </div>
                )}
              </Card>

              <Card title="Create New Sales Order">
                <p className="text-sm text-surface-500">Create and link a new sales order for this work order.</p>
                <Button variant="primary" className="mt-4" onClick={handleCreateSO}>Create & Link Sales Order</Button>
              </Card>
            </div>
          )}

          {salesOrders.map((salesOrder) => (
            <SalesOrderWorkbench key={salesOrder.id} salesOrderId={salesOrder.id} />
          ))}

          {salesOrders.length > 0 && (
            <Button variant="outline" onClick={handleCreateSO}>+ Add Sales Order</Button>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <Card title="Files" actions={<Button variant="primary" size="sm" onClick={() => setShowFileModal(true)}>+ Add File</Button>}>
          {files.length === 0 ? (
            <EmptyState icon="📎" title="No files attached" subtitle="Attach job packets, site photos, or billing documents here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file: Attachment) => (
                    <tr key={file.id}>
                      <td className="font-medium text-sm text-surface-900">{file.name}</td>
                      <td>
                        <span className={cn('badge', file.source === 'SALES_ORDER' ? 'bg-blue-100 text-blue-700' : 'bg-surface-100 text-surface-700')}>
                          {file.source === 'SALES_ORDER' ? 'Sales Order' : 'Job'}
                        </span>
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

      {activeTab === 'billing' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Billing Status">
            {job.invoiceNumber ? (
              <Alert type="success" icon="✅">
                <strong>Invoiced.</strong> Invoice {job.invoiceNumber} has been generated for this job.
              </Alert>
            ) : job.warranty ? (
              <Alert type="info" icon="🛡️">
                <strong>Warranty job.</strong> Billing validation is bypassed for warranty-only work.
              </Alert>
            ) : job.billingHold ? (
              <Alert type="warning" icon="⏸">
                <strong>Billing on hold.</strong> Reason: {job.billingHoldReason || 'No reason provided.'}
              </Alert>
            ) : billingReady ? (
              <Alert type="info" icon="📄">
                <strong>Billing ready.</strong> Awaiting invoice generation.
              </Alert>
            ) : job.status === 'COMPLETED' ? (
              <Alert type="warning" icon="⚠️">
                <strong>Pending billing review.</strong> Complete validation and mark this job billing ready.
              </Alert>
            ) : (
              <Alert type="info" icon="ℹ️">
                Billing review opens once the job is completed.
              </Alert>
            )}

            <div className="mt-4 rounded-xl border border-surface-200 p-4">
              <div className="flex justify-between py-2 text-sm">
                <span className="text-surface-500">Labor Cost</span>
                <span className="font-medium">{formatCurrency(job.laborCost || 0)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm">
                <span className="text-surface-500">Parts Cost</span>
                <span className="font-medium">{formatCurrency(job.partsCost || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-surface-100 pt-3 text-sm font-semibold">
                <span>Total Billable</span>
                <span>{job.warranty ? 'N/A (Warranty)' : formatCurrency(job.billableAmount ?? job.totalCost ?? 0)}</span>
              </div>
            </div>

            {!job.invoiceNumber && !job.warranty && (
              <div className="mt-4 flex flex-wrap gap-2">
                {job.status === 'COMPLETED' && !billingReady && !job.billingHold && (
                  <Button variant="primary" onClick={handleBillingReady} disabled={!allBillingValid}>Mark Billing Ready</Button>
                )}
                {billingReady && <Button variant="success" onClick={handleGenerateInvoice}>Generate Invoice</Button>}
                {!job.billingHold && <Button variant="outline" onClick={() => {
                  setHoldReason(job.billingHoldReason || '');
                  setShowHoldModal(true);
                }}>Put on Hold</Button>}
                {job.billingHold && <Button variant="outline" onClick={() => {
                  removeBillingHold(job.id);
                  toast('success', 'Billing hold removed');
                }}>Remove Hold</Button>}
              </div>
            )}
          </Card>

          <Card title="Billing Validation">
            <div className="space-y-3">
              {billingValidations.map((validation) => (
                <div key={validation.label} className="flex items-center gap-3 rounded-xl border border-surface-200 px-4 py-3">
                  <span className="text-lg">{validation.ok ? '✅' : '❌'}</span>
                  <span className={cn('text-sm', validation.ok ? 'text-surface-700' : 'text-red-600')}>{validation.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <Card title="Job History">
          <div className="space-y-3">
            {[
              { label: 'Job Created', date: job.createdAt, icon: '➕', color: 'bg-surface-100' },
              job.actualStart && { label: 'Work Started', date: job.actualStart, icon: '▶️', color: 'bg-brand-50' },
              job.actualEnd && { label: 'Work Completed', date: job.actualEnd, icon: '✅', color: 'bg-emerald-50' },
              job.invoiceNumber && { label: `Invoice ${job.invoiceNumber} Created`, date: job.updatedAt, icon: '🧾', color: 'bg-blue-50' },
            ].filter(Boolean).map((event: any, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm', event.color)}>{event.icon}</div>
                <div>
                  <div className="text-sm font-medium text-surface-800">{event.label}</div>
                  <div className="text-xs text-surface-400">{formatDateTime(event.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Technician"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAssign}>Assign</Button>
          </>
        )}
      >
        <div className="space-y-3">
          {availableTechs.map((tech) => (
            <button
              key={tech.id}
              onClick={() => setSelectedTechId(tech.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-all',
                selectedTechId === tech.id ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300',
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar initials={tech.avatarInitials} color={tech.color} size="md" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{tech.name}</div>
                  <div className="text-xs text-surface-500">{tech.skills.join(', ')}</div>
                </div>
                <div className={cn('text-xs font-medium', tech.status === 'AVAILABLE' ? 'text-emerald-600' : 'text-amber-600')}>
                  {TECH_STATUS_LABELS[tech.status]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Add Note"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowNoteModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddNote}>Add Note</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Select
            label="Note Type"
            value={noteType}
            onChange={(event) => setNoteType(event.target.value as NoteType)}
            options={['INTERNAL', 'CUSTOMER', 'TECHNICIAN', 'ACTIVITY', 'BILLING'].map((type) => ({ value: type, label: type }))}
          />
          <Textarea label="Note" rows={4} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Enter note text…" />
        </div>
      </Modal>

      <Modal
        open={showTimeModal}
        onClose={() => setShowTimeModal(false)}
        title="Add Time Entry"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowTimeModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddTimeEntry}>Add Time Entry</Button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Type"
            value={timeDraft.type}
            onChange={(event) => setTimeDraft((current) => ({ ...current, type: event.target.value }))}
            options={['REGULAR', 'TRAVEL', 'OVERTIME', 'EMERGENCY', 'TRAINING', 'ADMINISTRATIVE'].map((type) => ({ value: type, label: type }))}
          />
          <Input
            label="Date"
            type="date"
            value={timeDraft.date}
            onChange={(event) => setTimeDraft((current) => ({ ...current, date: event.target.value }))}
          />
          <Input
            label="Start Time"
            type="time"
            value={timeDraft.startTime}
            onChange={(event) => setTimeDraft((current) => ({ ...current, startTime: event.target.value }))}
          />
          <Input
            label="End Time"
            type="time"
            value={timeDraft.endTime}
            onChange={(event) => setTimeDraft((current) => ({ ...current, endTime: event.target.value }))}
          />
          <Input
            label="Duration (hours)"
            type="number"
            step="0.25"
            value={String(timeDraft.duration)}
            onChange={(event) => setTimeDraft((current) => ({ ...current, duration: Number(event.target.value) }))}
          />
          <label className="flex items-center gap-2 pt-7 text-sm text-surface-700">
            <input
              type="checkbox"
              checked={timeDraft.billable}
              onChange={(event) => setTimeDraft((current) => ({ ...current, billable: event.target.checked }))}
            />
            Billable
          </label>
          <div className="md:col-span-2">
            <Textarea
              label="Notes"
              rows={3}
              value={timeDraft.notes}
              onChange={(event) => setTimeDraft((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showPartModal}
        onClose={() => setShowPartModal(false)}
        title="Add Part"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowPartModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddPart}>Add Part</Button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Item Name" value={partDraft.itemName} onChange={(event) => setPartDraft((current) => ({ ...current, itemName: event.target.value }))} />
          <Input label="Part Number" value={partDraft.partNumber} onChange={(event) => setPartDraft((current) => ({ ...current, partNumber: event.target.value }))} />
          <Input label="Quantity" type="number" step="1" value={String(partDraft.quantity)} onChange={(event) => setPartDraft((current) => ({ ...current, quantity: Number(event.target.value) }))} />
          <Input label="Unit Cost" type="number" step="0.01" value={String(partDraft.unitCost)} onChange={(event) => setPartDraft((current) => ({ ...current, unitCost: Number(event.target.value) }))} />
          <div className="md:col-span-2">
            <Textarea label="Description" rows={3} value={partDraft.description} onChange={(event) => setPartDraft((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" checked={partDraft.warranty} onChange={(event) => setPartDraft((current) => ({ ...current, warranty: event.target.checked }))} />
            Warranty replacement
          </label>
        </div>
      </Modal>

      <Modal
        open={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reschedule Job"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowRescheduleModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleReschedule}>Reschedule</Button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="New Date" type="date" value={rescheduleDraft.scheduledDate} onChange={(event) => setRescheduleDraft((current) => ({ ...current, scheduledDate: event.target.value }))} />
          <Input label="Start Time" type="time" value={rescheduleDraft.scheduledStart} onChange={(event) => setRescheduleDraft((current) => ({ ...current, scheduledStart: event.target.value }))} />
          <Input label="End Time" type="time" value={rescheduleDraft.scheduledEnd} onChange={(event) => setRescheduleDraft((current) => ({ ...current, scheduledEnd: event.target.value }))} />
          <div className="md:col-span-2">
            <Textarea label="Reason" rows={3} value={rescheduleDraft.reason} onChange={(event) => setRescheduleDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Why is this job being rescheduled?" />
          </div>
        </div>
      </Modal>

      <Modal
        open={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        title="Put on Billing Hold"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowHoldModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleBillingHold}>Put on Hold</Button>
          </>
        )}
      >
        <Textarea
          label="Reason"
          rows={4}
          value={holdReason}
          onChange={(event) => setHoldReason(event.target.value)}
          placeholder="Why is this job on billing hold?"
        />
      </Modal>

      <Modal
        open={showFileModal}
        onClose={() => setShowFileModal(false)}
        title="Attach File"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowFileModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddFile}>Attach File</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Input label="File Name" value={fileDraft.name} onChange={(event) => setFileDraft((current) => ({ ...current, name: event.target.value }))} placeholder={`${job.jobNumber} Attachment`} />
          <Select
            label="File Type"
            value={fileDraft.type}
            onChange={(event) => setFileDraft((current) => ({ ...current, type: event.target.value }))}
            options={[
              { value: 'application/pdf', label: 'PDF' },
              { value: 'image/jpeg', label: 'Image' },
              { value: 'text/csv', label: 'CSV' },
              { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Document' },
            ]}
          />
          <Select
            label="Attach To"
            value={fileDraft.source}
            onChange={(event) => setFileDraft((current) => ({ ...current, source: event.target.value }))}
            options={[
              { value: 'JOB', label: 'Job' },
              ...(primarySalesOrder ? [{ value: 'SALES_ORDER', label: 'Linked Sales Order' }] : []),
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

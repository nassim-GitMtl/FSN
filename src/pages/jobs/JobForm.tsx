import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useBeforeUnload, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useJobStore, useCustomerStore, useTechStore, useSOStore, useAuthStore, useUIStore } from '@/store';
import { Card, Button, Input, Select, Textarea, Alert } from '@/components/ui';
import { cn, formatCurrency, formatDate, PRIORITY_LABELS, SERVICE_TYPE_LABELS } from '@/lib/utils';

const CATALOG_ITEMS = [
  { itemId: 'LAB-REG',    itemName: 'Regular Labor',            description: 'Standard diagnostic and repair',                rate: 125  },
  { itemId: 'LAB-EMR',    itemName: 'Emergency Labor',          description: 'Emergency diagnostic and repair',               rate: 195  },
  { itemId: 'LAB-AH',     itemName: 'After-Hours Labor',        description: 'After-hours emergency response labor',          rate: 195  },
  { itemId: 'LAB-REP',    itemName: 'Repair Labor',             description: 'Diagnostics and replacement labor',             rate: 145  },
  { itemId: 'LAB-TRAV',   itemName: 'Travel Charge',            description: 'Trip/travel fee',                               rate: 75   },
  { itemId: 'PM-HVAC',    itemName: 'PM – HVAC',                description: 'Quarterly rooftop preventive maintenance',      rate: 360  },
  { itemId: 'PM-MAU',     itemName: 'PM – Make-Up Air',         description: 'MAU: filters, belts, combustion review',        rate: 540  },
  { itemId: 'INSP-STD',   itemName: 'Standard Inspection',      description: 'Scheduled inspection and written report',       rate: 185  },
  { itemId: 'INSP-BOI',   itemName: 'Boiler Inspection',        description: 'Annual combustion report',                      rate: 195  },
  { itemId: 'CTL-RESET',  itemName: 'Controls Reset',           description: 'BMS recommissioning',                           rate: 220  },
  { itemId: 'VFD-TUNE',   itemName: 'VFD Tuning',               description: 'Controller tune and verification',              rate: 280  },
  { itemId: 'AIR-BAL',    itemName: 'Air Balance Service',      description: 'Exhaust balancing and pressure verification',   rate: 760  },
  { itemId: 'STARTUP',    itemName: 'Startup & Commissioning',  description: 'Install startup package',                       rate: 980  },
  { itemId: 'FLT-SET',    itemName: 'Filter Set (MERV 13)',     description: 'MERV 13 replacement filters (each)',            rate: 58   },
  { itemId: 'COMP-01',    itemName: 'Compressor Replacement',   description: 'Compressor swap and installation',              rate: 1240 },
  { itemId: 'FAN-EVAP',   itemName: 'Evaporator Fan Motor',     description: 'Evaporator fan motor swap',                     rate: 420  },
  { itemId: 'IGN-MOD',    itemName: 'Ignition Module',          description: 'Heating ignition module replacement',           rate: 235  },
  { itemId: 'REF-404A',   itemName: 'Refrigerant R-404A',       description: 'R-404A refrigerant refill (per lb)',            rate: 42   },
  { itemId: 'REF-410A',   itemName: 'Refrigerant R-410A',       description: 'R-410A refrigerant refill (per lb)',            rate: 35   },
  { itemId: 'MISC-PARTS', itemName: 'Misc. Parts & Materials',  description: 'Miscellaneous parts and materials',             rate: 0    },
];

type InlineSOLine = { id: string; itemId: string; itemName: string; description: string; quantity: number; rate: number; };

type FormData = {
  customerId: string;
  description: string;
  priority: string;
  serviceType: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedDuration: string;
  technicianId: string;
  salesOrderId: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  internalNotes: string;
  billingCode: string;
  warranty: boolean;
};

export const JobForm: React.FC = () => {
  const { id } = useParams();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getJob, getJobsForCustomer, createJob, updateJob } = useJobStore();
  const { customers, searchCustomers } = useCustomerStore();
  const { technicians } = useTechStore();
  const { getSOsForCustomer, createSO, updateSO } = useSOStore();
  const { user } = useAuthStore();
  const { toast, setUnsavedChanges } = useUIStore();

  const job = isEdit ? getJob(id!) : undefined;
  const requestedCustomerId = searchParams.get('customerId') || '';
  const [customerSearch, setCustomerSearch] = useState(job?.customerName || '');
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [salesOrderMode, setSalesOrderMode] = useState<'existing' | 'new'>(() => (job?.salesOrderId ? 'existing' : 'new'));
  const [newSalesOrderMemo, setNewSalesOrderMemo] = useState(job?.description || '');
  const [newSOLines, setNewSOLines] = useState<InlineSOLine[]>([]);
  const [submissionError, setSubmissionError] = useState('');
  const customerResults = searchCustomers(customerSearch);

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    defaultValues: {
      customerId: job?.customerId || '',
      description: job?.description || '',
      priority: job?.priority || 'MEDIUM',
      serviceType: job?.serviceType || 'REPAIR',
      scheduledDate: job?.scheduledDate || '',
      scheduledStart: job?.scheduledStart || '',
      scheduledEnd: job?.scheduledEnd || '',
      estimatedDuration: String(job?.estimatedDuration || ''),
      technicianId: job?.technicianId || '',
      salesOrderId: job?.salesOrderId || '',
      street: job?.serviceAddress.street || '',
      city: job?.serviceAddress.city || '',
      state: job?.serviceAddress.state || '',
      zip: job?.serviceAddress.zip || '',
      contactName: job?.contactName || '',
      contactPhone: job?.contactPhone || '',
      contactEmail: job?.contactEmail || '',
      internalNotes: job?.internalNotes || '',
      billingCode: job?.billingCode || '1',
      warranty: job?.warranty || false,
    },
  });

  const selectedCustomerId = watch('customerId');
  const selectedSalesOrderId = watch('salesOrderId');
  const description = watch('description');

  useEffect(() => {
    setUnsavedChanges(isDirty);
    return () => setUnsavedChanges(false);
  }, [isDirty, setUnsavedChanges]);

  useBeforeUnload(
    React.useCallback((event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }, [isDirty])
  );

  const ws = user?.workspace || 'SERVICE';
  const techPool = technicians.filter(t => t.category === (ws === 'SERVICE' ? 'SERVICE' : 'INSTALLATION'));
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const customerJobs = selectedCustomerId
    ? getJobsForCustomer(selectedCustomerId).filter((customerJob) => customerJob.id !== job?.id)
    : [];
  const customerHistory = [...customerJobs].sort((a, b) => {
    const aDate = a.actualEnd || a.scheduledDate || a.updatedAt;
    const bDate = b.actualEnd || b.scheduledDate || b.updatedAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
  const customerOpenJobs = customerJobs.filter((customerJob) => !['COMPLETED', 'BILLING_READY', 'INVOICED', 'CANCELLED'].includes(customerJob.status));
  const customerCompletedJobs = customerHistory.filter((customerJob) => ['COMPLETED', 'BILLING_READY', 'INVOICED'].includes(customerJob.status));
  // All SOs for this customer — shown in both the display panel AND the Link Existing dropdown.
  // We show all (including already-linked ones) so dispatchers can re-assign if needed;
  // the dropdown label notes which SO is already linked to another job.
  const customerSalesOrders = selectedCustomerId
    ? getSOsForCustomer(selectedCustomerId)
        .sort((a, b) => new Date(b.tranDate).getTime() - new Date(a.tranDate).getTime())
    : [];
  const selectedSalesOrder = customerSalesOrders.find((salesOrder) => salesOrder.id === selectedSalesOrderId);

  useEffect(() => {
    if (!selectedCustomerId) return;
    if (selectedSalesOrderId && !customerSalesOrders.some((salesOrder) => salesOrder.id === selectedSalesOrderId)) {
      setValue('salesOrderId', '', { shouldDirty: true, shouldValidate: true });
    }
    // Only auto-switch to 'new' when the customer truly has no SOs yet
    if (customerSalesOrders.length === 0 && salesOrderMode !== 'new') {
      setSalesOrderMode('new');
    }
  }, [customerSalesOrders, salesOrderMode, selectedCustomerId, selectedSalesOrderId, setValue]);

  useEffect(() => {
    if (!submissionError) return;
    setSubmissionError('');
  }, [selectedCustomerId, selectedSalesOrderId, salesOrderMode]);

  useEffect(() => {
    if (!description || newSalesOrderMemo.trim()) return;
    setNewSalesOrderMemo(description);
  }, [description, newSalesOrderMemo]);

  const detachSalesOrder = (salesOrderId?: string) => {
    if (!salesOrderId) return;
    updateSO(salesOrderId, { linkedJobId: undefined, linkedJobNumber: undefined });
  };

  const onSubmit = (data: FormData) => {
    setSubmissionError('');

    const customer = customers.find(c => c.id === data.customerId);
    if (!customer) {
      setSubmissionError('Select a customer before creating the job.');
      return;
    }

    const tech = technicians.find(t => t.id === data.technicianId);
    const existingSalesOrder = customerSalesOrders.find((salesOrder) => salesOrder.id === data.salesOrderId);
    if (salesOrderMode === 'existing' && !existingSalesOrder) {
      setSubmissionError('Link an existing sales order or switch to creating a new one inline.');
      return;
    }

    const payload = {
      customerId: data.customerId,
      customerName: customer?.companyName || '',
      description: data.description,
      priority: data.priority as any,
      serviceType: data.serviceType as any,
      category: (ws === 'SERVICE' ? 'SERVICE' : 'INSTALLATION') as any,
      scheduledDate: data.scheduledDate || undefined,
      scheduledStart: data.scheduledStart || undefined,
      scheduledEnd: data.scheduledEnd || undefined,
      estimatedDuration: data.estimatedDuration ? Number(data.estimatedDuration) : undefined,
      technicianId: data.technicianId || undefined,
      technicianName: tech?.name,
      serviceAddress: { street: data.street, city: data.city, state: data.state, zip: data.zip },
      contactName: data.contactName || undefined,
      contactPhone: data.contactPhone || undefined,
      contactEmail: data.contactEmail || undefined,
      internalNotes: data.internalNotes || undefined,
      billingCode: data.billingCode,
      warranty: data.warranty,
      salesOrderId: salesOrderMode === 'existing' ? existingSalesOrder?.id : undefined,
      salesOrderNumber: salesOrderMode === 'existing' ? existingSalesOrder?.soNumber : undefined,
      status: job?.status || (data.technicianId ? 'SCHEDULED' : 'NEW'),
    };

    if (isEdit) {
      let nextSalesOrderId = payload.salesOrderId;
      let nextSalesOrderNumber = payload.salesOrderNumber;

      if (salesOrderMode === 'new') {
        if (job?.salesOrderId) detachSalesOrder(job.salesOrderId);
        const createdSalesOrder = createSO({
          customerId: customer.id,
          customerName: customer.companyName,
          linkedJobId: id!,
          linkedJobNumber: job?.jobNumber,
          memo: newSalesOrderMemo.trim() || data.description,
          billingCode: data.billingCode,
          lines: newSOLines.map((l, i) => ({
            id: `sol-${Date.now()}-${i}`,
            itemId: l.itemId,
            itemName: l.itemName,
            description: l.description || undefined,
            quantity: l.quantity,
            rate: l.rate,
            amount: Math.round(l.quantity * l.rate * 100) / 100,
            isClosed: false,
          })),
        });
        nextSalesOrderId = createdSalesOrder.id;
        nextSalesOrderNumber = createdSalesOrder.soNumber;
      } else if (existingSalesOrder) {
        if (job?.salesOrderId && job.salesOrderId !== existingSalesOrder.id) {
          detachSalesOrder(job.salesOrderId);
        }
        updateSO(existingSalesOrder.id, {
          customerId: customer.id,
          customerName: customer.companyName,
          linkedJobId: id!,
          linkedJobNumber: job?.jobNumber,
          billingCode: data.billingCode,
          memo: existingSalesOrder.memo || data.description,
        });
      }

      updateJob(id!, {
        ...payload,
        salesOrderId: nextSalesOrderId,
        salesOrderNumber: nextSalesOrderNumber,
      });
      setUnsavedChanges(false);
      toast('success', 'Job updated');
      navigate(`/jobs/${id}`);
    } else {
      const newJob = createJob(payload);
      if (salesOrderMode === 'new') {
        const createdSalesOrder = createSO({
          customerId: customer.id,
          customerName: customer.companyName,
          linkedJobId: newJob.id,
          linkedJobNumber: newJob.jobNumber,
          memo: newSalesOrderMemo.trim() || data.description,
          billingCode: data.billingCode,
          lines: newSOLines.map((l, i) => ({
            id: `sol-${Date.now()}-${i}`,
            itemId: l.itemId,
            itemName: l.itemName,
            description: l.description || undefined,
            quantity: l.quantity,
            rate: l.rate,
            amount: Math.round(l.quantity * l.rate * 100) / 100,
            isClosed: false,
          })),
        });
        updateJob(newJob.id, {
          salesOrderId: createdSalesOrder.id,
          salesOrderNumber: createdSalesOrder.soNumber,
        });
      } else if (existingSalesOrder) {
        updateSO(existingSalesOrder.id, {
          customerId: customer.id,
          customerName: customer.companyName,
          linkedJobId: newJob.id,
          linkedJobNumber: newJob.jobNumber,
          billingCode: data.billingCode,
          memo: existingSalesOrder.memo || data.description,
        });
      }
      setUnsavedChanges(false);
      toast('success', `Job ${newJob.jobNumber} created`);
      navigate(`/jobs/${newJob.id}`);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const c = customers.find(x => x.id === customerId);
    if (!c) return;
    setValue('customerId', customerId, { shouldDirty: true, shouldValidate: true });
    setValue('contactName', c.contactName || '', { shouldDirty: true });
    setValue('contactPhone', c.phone || '', { shouldDirty: true });
    setValue('contactEmail', c.email || '', { shouldDirty: true });
    const addr = c.addresses.find(a => a.isDefault) || c.addresses[0];
    if (addr) {
      setValue('street', addr.street, { shouldDirty: true });
      setValue('city', addr.city, { shouldDirty: true });
      setValue('state', addr.state, { shouldDirty: true });
      setValue('zip', addr.zip, { shouldDirty: true });
    }
    setValue('salesOrderId', '', { shouldDirty: true, shouldValidate: true });
    setNewSOLines([]);
    setShowCustomerDrop(false);
    setCustomerSearch(c.companyName);
  };

  // Sync the search label when selectedCustomerId changes (e.g. URL param pre-fill).
  // customerSearch is intentionally excluded from deps — including it would override
  // the user's typing every keystroke, making it impossible to change the customer.
  useEffect(() => {
    if (!selectedCustomerId) return;
    const foundCustomer = customers.find((c) => c.id === selectedCustomerId);
    if (foundCustomer) setCustomerSearch(foundCustomer.companyName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    if (isEdit || !requestedCustomerId || selectedCustomerId === requestedCustomerId) return;
    handleCustomerSelect(requestedCustomerId);
  }, [isEdit, requestedCustomerId, selectedCustomerId, customers]);

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <Link to="/jobs" className="hover:text-brand-600">Jobs</Link>
        <span>/</span>
        <span className="text-surface-700">{isEdit ? `Edit ${job?.jobNumber}` : 'New Job'}</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">{isEdit ? `Edit ${job?.jobNumber}` : 'Create New Job'}</h1>
      </div>

      {isDirty && <Alert type="warning" icon="⚠️">You have unsaved changes</Alert>}
      {submissionError && <Alert type="danger" icon="🚫">{submissionError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Customer */}
        <Card title="Customer">
          <div className="relative">
            <label className="label">Customer *</label>
            <input
              className="input"
              placeholder="Search customers…"
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
              onFocus={() => setShowCustomerDrop(true)}
            />
            {showCustomerDrop && customerSearch.length >= 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-card-hover z-20 overflow-hidden max-h-48 overflow-y-auto">
                {customerResults.slice(0, 6).map(c => (
                  <button type="button" key={c.id} onClick={() => handleCustomerSelect(c.id)}
                    className="w-full px-4 py-2.5 text-left hover:bg-surface-50 text-sm border-b border-surface-100 last:border-0">
                    <div className="font-medium">{c.companyName}</div>
                    <div className="text-xs text-surface-400">{c.defaultAddress}</div>
                  </button>
                ))}
              </div>
            )}
            <input type="hidden" {...register('customerId', { required: true })} />
            {errors.customerId && <p className="mt-1 text-xs text-red-500">Select a customer to continue.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Contact Name" {...register('contactName')} />
            <Input label="Contact Phone" {...register('contactPhone')} />
            <Input label="Contact Email" type="email" {...register('contactEmail')} className="col-span-2" />
          </div>
        </Card>

        {selectedCustomer && (
          <Card title="Customer Context" subtitle="Recent job history and commercial context for this client">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Open Jobs', value: customerOpenJobs.length },
                { label: 'Completed Visits', value: customerCompletedJobs.length },
                { label: 'Sales Orders', value: customerSalesOrders.length },
                { label: 'Latest Visit', value: customerCompletedJobs[0] ? formatDate(customerCompletedJobs[0].actualEnd || customerCompletedJobs[0].scheduledDate) : '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-surface-400">{item.label}</div>
                  <div className="mt-1 text-lg font-semibold text-surface-900">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
              <div className="rounded-2xl border border-surface-200">
                <div className="border-b border-surface-200 px-4 py-3">
                  <div className="text-sm font-semibold text-surface-900">Recent Job History</div>
                  <div className="text-xs text-surface-500">Previous work completed or scheduled at this client.</div>
                </div>
                <div className="divide-y divide-surface-100">
                  {customerHistory.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-surface-500">No prior jobs recorded for this customer yet.</div>
                  ) : customerHistory.slice(0, 5).map((customerJob) => (
                    <Link
                      key={customerJob.id}
                      to={`/jobs/${customerJob.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-semibold text-brand-600">{customerJob.jobNumber}</div>
                        <div className="text-sm text-surface-800 line-clamp-1">{customerJob.description}</div>
                        <div className="text-xs text-surface-500 mt-1">
                          {formatDate(customerJob.actualEnd || customerJob.scheduledDate || customerJob.updatedAt)}
                          {customerJob.technicianName ? ` · ${customerJob.technicianName}` : ''}
                        </div>
                      </div>
                      <span className="badge bg-surface-100 text-surface-700 flex-shrink-0">{customerJob.status.replace('_', ' ')}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-200">
                <div className="border-b border-surface-200 px-4 py-3">
                  <div className="text-sm font-semibold text-surface-900">Recent Sales Orders</div>
                  <div className="text-xs text-surface-500">Use an existing order or create a fresh one from this job.</div>
                </div>
                <div className="divide-y divide-surface-100">
                  {customerSalesOrders.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-surface-500">No sales orders found for this customer yet.</div>
                  ) : customerSalesOrders.slice(0, 4).map((salesOrder) => (
                    <Link
                      key={salesOrder.id}
                      to={`/billing/${salesOrder.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-50 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-mono font-semibold text-cyan-600">{salesOrder.soNumber}</div>
                        <div className="text-sm text-surface-800">{salesOrder.memo || 'No memo added yet'}</div>
                        <div className="text-xs text-surface-500 mt-1">{formatDate(salesOrder.tranDate)} · {salesOrder.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-surface-900">{formatCurrency(salesOrder.total)}</div>
                        {salesOrder.linkedJobNumber && (
                          <div className="text-xs text-surface-500">{salesOrder.linkedJobNumber}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card title="Sales Order" subtitle="Every job should link to an existing order or create one inline.">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={cn(
                'rounded-2xl border px-4 py-3 text-left transition-colors',
                salesOrderMode === 'existing'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-surface-200 hover:border-surface-300'
              )}
              onClick={() => setSalesOrderMode('existing')}
              disabled={!selectedCustomerId}
            >
              <div className="text-sm font-semibold">Link Existing Order</div>
              <div className="text-xs text-surface-500 mt-1">Attach this job to an order already on the customer account.</div>
            </button>
            <button
              type="button"
              className={cn(
                'rounded-2xl border px-4 py-3 text-left transition-colors',
                salesOrderMode === 'new'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-surface-200 hover:border-surface-300'
              )}
              onClick={() => {
                setSalesOrderMode('new');
                setValue('salesOrderId', '', { shouldDirty: true, shouldValidate: true });
              }}
              disabled={!selectedCustomerId}
            >
              <div className="text-sm font-semibold">Create New Order</div>
              <div className="text-xs text-surface-500 mt-1">Generate a new sales order automatically when you save the job.</div>
            </button>
          </div>

          {!selectedCustomerId && (
            <Alert type="info" className="mt-4" icon="ℹ️">
              Choose a customer first so we can show matching sales orders and customer history.
            </Alert>
          )}

          {selectedCustomerId && salesOrderMode === 'existing' && (
            <div className="mt-4 space-y-4">
              <Select
                label="Sales Order *"
                value={selectedSalesOrderId}
                onChange={(event) => setValue('salesOrderId', event.target.value, { shouldDirty: true, shouldValidate: true })}
                options={[
                  { value: '', label: customerSalesOrders.length ? 'Select a sales order' : 'No sales orders for this client yet' },
                  ...customerSalesOrders.map((salesOrder) => ({
                    value: salesOrder.id,
                    label: `${salesOrder.soNumber} · ${salesOrder.status} · ${formatCurrency(salesOrder.total)}${salesOrder.linkedJobNumber && salesOrder.linkedJobId !== job?.id ? ` · linked: ${salesOrder.linkedJobNumber}` : ''}`,
                  })),
                ]}
              />
              <input type="hidden" {...register('salesOrderId')} />

              {selectedSalesOrder && (
                <div className={cn(
                  'rounded-2xl border px-4 py-4',
                  selectedSalesOrder.linkedJobId && selectedSalesOrder.linkedJobId !== job?.id
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-cyan-200 bg-cyan-50',
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-mono font-semibold text-cyan-700">{selectedSalesOrder.soNumber}</div>
                      <div className="text-sm font-semibold text-surface-900 mt-1">{selectedSalesOrder.memo || 'No memo added yet'}</div>
                      <div className="text-xs text-surface-600 mt-1">
                        {formatDate(selectedSalesOrder.tranDate)} · {selectedSalesOrder.status}
                      </div>
                      {selectedSalesOrder.linkedJobId && selectedSalesOrder.linkedJobId !== job?.id && (
                        <div className="text-xs text-amber-700 font-medium mt-1">
                          ⚠ Currently linked to {selectedSalesOrder.linkedJobNumber} — saving will re-assign it to this job.
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-surface-500">Total</div>
                      <div className="text-lg font-semibold text-surface-900">{formatCurrency(selectedSalesOrder.total)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedCustomerId && salesOrderMode === 'new' && (
            <div className="mt-4 space-y-4">
              <Input
                label="Sales Order Memo"
                placeholder="Brief summary for the order"
                value={newSalesOrderMemo}
                onChange={(event) => setNewSalesOrderMemo(event.target.value)}
              />

              {/* Inline line items */}
              <div>
                <label className="label">Add Line Items (optional)</label>
                <select
                  className="select"
                  value=""
                  onChange={(e) => {
                    const item = CATALOG_ITEMS.find(i => i.itemId === e.target.value);
                    if (item) {
                      setNewSOLines(prev => [...prev, {
                        id: `inline-${Date.now()}-${prev.length}`,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        description: item.description,
                        quantity: 1,
                        rate: item.rate,
                      }]);
                    }
                  }}
                >
                  <option value="">— Pick from catalog to add a line —</option>
                  {CATALOG_ITEMS.map(item => (
                    <option key={item.itemId} value={item.itemId}>
                      {item.itemName}{item.rate > 0 ? ` · $${item.rate}` : ''}
                    </option>
                  ))}
                </select>

                {newSOLines.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {newSOLines.map(line => (
                      <div key={line.id} className="flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-surface-900 truncate">{line.itemName}</div>
                          {line.description && <div className="text-xs text-surface-500 truncate">{line.description}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-surface-400">Qty</span>
                          <input
                            type="number" min={0.25} step={0.25}
                            className="input w-16 py-1 text-sm text-center"
                            value={line.quantity}
                            onChange={(e) => setNewSOLines(prev => prev.map(l => l.id === line.id ? { ...l, quantity: Number(e.target.value) || 1 } : l))}
                          />
                          <span className="text-xs text-surface-400">@ $</span>
                          <input
                            type="number" min={0} step={0.01}
                            className="input w-20 py-1 text-sm text-center"
                            value={line.rate}
                            onChange={(e) => setNewSOLines(prev => prev.map(l => l.id === line.id ? { ...l, rate: Number(e.target.value) || 0 } : l))}
                          />
                          <span className="w-20 text-right font-semibold text-surface-700">
                            ${(line.quantity * line.rate).toFixed(2)}
                          </span>
                          <button type="button" onClick={() => setNewSOLines(prev => prev.filter(l => l.id !== line.id))} className="ml-1 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                        </div>
                      </div>
                    ))}
                    <div className="text-right text-sm font-semibold text-surface-800 pr-1">
                      Subtotal: ${newSOLines.reduce((s, l) => s + l.quantity * l.rate, 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              <Alert type="info" icon="🧾">
                A new sales order will be created and linked automatically when you save this job.
              </Alert>
            </div>
          )}
        </Card>

        {/* Service details */}
        <Card title="Service Details">
          <div className="space-y-4">
            <Textarea label="Description *" rows={3} {...register('description', { required: 'Description is required' })} error={errors.description?.message} />
            <div className="grid grid-cols-3 gap-4">
              <Select label="Service Type *" options={Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} {...register('serviceType')} />
              <Select label="Priority" options={Object.entries(PRIORITY_LABELS).map(([k, v]) => ({ value: k, label: v }))} {...register('priority')} />
              <Select label="Billing Code" options={[
                { value: '1', label: 'Code 1 – Time + Exp + Parts' },
                { value: '2', label: 'Code 2 – Time + Expenses' },
                { value: '3', label: 'Code 3 – Time Only' },
                { value: '7', label: 'Code 7 – Warranty (No Charge)' },
              ]} {...register('billingCode')} />
            </div>
            <Textarea label="Internal Notes" rows={2} placeholder="Dispatcher/coordinator notes (not shown to technician)" {...register('internalNotes')} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('warranty')} className="w-4 h-4 rounded text-brand-600" />
              <span className="text-sm text-surface-700">Under warranty</span>
            </label>
          </div>
        </Card>

        {/* Service address */}
        <Card title="Service Address">
          <div className="grid grid-cols-1 gap-4">
            <Input label="Street Address" {...register('street')} />
            <div className="grid grid-cols-3 gap-4">
              <Input label="City" {...register('city')} />
              <Input label="State" {...register('state')} />
              <Input label="Postal Code" {...register('zip')} />
            </div>
          </div>
        </Card>

        {/* Scheduling */}
        <Card title="Scheduling">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Scheduled Date" type="date" {...register('scheduledDate')} />
            <Input label="Estimated Duration (hours)" type="number" step="0.5" {...register('estimatedDuration')} />
            <Input label="Start Time" type="time" {...register('scheduledStart')} />
            <Input label="End Time" type="time" {...register('scheduledEnd')} />
          </div>
        </Card>

        {/* Technician */}
        <Card title="Technician Assignment">
          <Select label="Assign Technician" options={[
            { value: '', label: '— Unassigned —' },
            ...techPool.map(t => ({ value: t.id, label: `${t.name} (${t.status === 'AVAILABLE' ? '✓ Available' : t.status})` })),
          ]} {...register('technicianId')} />
        </Card>

        {/* Form actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Discard them and go back?')) return;
              setUnsavedChanges(false);
              navigate(-1);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg">
            {isEdit ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
      </form>
    </div>
  );
};

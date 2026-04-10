import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Input, Textarea } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSOStore, useUIStore } from '@/store';

const STATUS_TONES: Record<string, string> = {
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Billed: 'bg-cyan-100 text-cyan-700',
  'Partially Billed': 'bg-indigo-100 text-indigo-700',
  'Fully Billed': 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS = ['Pending Approval', 'Approved', 'Billed', 'Partially Billed', 'Fully Billed', 'Cancelled'];
const PAYMENT_OPTIONS = ['Invoice / Net 30', 'Credit Card', 'E-Transfer', 'Cheque', 'ACH'];

interface SalesOrderWorkbenchProps {
  salesOrderId: string;
  className?: string;
  showLinkedJob?: boolean;
}

export const SalesOrderWorkbench: React.FC<SalesOrderWorkbenchProps> = ({ salesOrderId, className, showLinkedJob = true }) => {
  const {
    getSO,
    updateSO,
    addSOLine,
    updateSOLine,
    removeSOLine,
    toggleBillingHold,
    removeBillingHold,
    generateInvoice,
    syncSOToJob,
  } = useSOStore();
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
  const [newLine, setNewLine] = useState({
    itemName: '',
    description: '',
    quantity: '1',
    rate: '',
  });
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState({
    itemName: '',
    description: '',
    quantity: '1',
    rate: '',
  });
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

  const subtotal = salesOrder?.subtotal || 0;
  const taxAmount = salesOrder?.taxAmount || 0;
  const total = salesOrder?.total || 0;

  const dirtyHeader = useMemo(() => {
    if (!salesOrder) return false;
    return (
      headerDraft.memo !== (salesOrder.memo || '') ||
      headerDraft.billingCode !== (salesOrder.billingCode || '') ||
      headerDraft.paymentMode !== (salesOrder.paymentMode || 'Invoice / Net 30') ||
      headerDraft.terms !== (salesOrder.terms || 'Net 30') ||
      headerDraft.dueDate !== (salesOrder.dueDate || '') ||
      headerDraft.status !== salesOrder.status
    );
  }, [headerDraft, salesOrder]);

  if (!salesOrder) {
    return null;
  }

  const handleSaveHeader = () => {
    updateSO(salesOrder.id, {
      memo: headerDraft.memo,
      billingCode: headerDraft.billingCode,
      paymentMode: headerDraft.paymentMode,
      terms: headerDraft.terms,
      dueDate: headerDraft.dueDate,
      status: headerDraft.status,
    });
    toast('success', 'Sales order header updated');
  };

  const handleAddLine = () => {
    if (!newLine.itemName.trim() || !newLine.rate) {
      return;
    }

    addSOLine(salesOrder.id, {
      itemId: `item-${Date.now()}`,
      itemName: newLine.itemName.trim(),
      description: newLine.description.trim() || undefined,
      quantity: Number(newLine.quantity) || 1,
      rate: Number(newLine.rate) || 0,
      amount: (Number(newLine.quantity) || 1) * (Number(newLine.rate) || 0),
    });

    setNewLine({
      itemName: '',
      description: '',
      quantity: '1',
      rate: '',
    });
    toast('success', 'Line added');
  };

  const beginEditLine = (lineId: string) => {
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

  const handleHoldToggle = () => {
    if (salesOrder.billingHold) {
      removeBillingHold(salesOrder.id);
      setHoldReason('');
      toast('success', 'Billing hold removed');
      return;
    }

    toggleBillingHold(salesOrder.id, holdReason || 'Waiting on review');
    toast('success', 'Billing hold added');
  };

  const handleGenerateInvoice = () => {
    const result = generateInvoice(salesOrder.id);
    if (result) {
      toast('success', `Invoice ${result.invoiceNumber} generated`);
    }
  };

  const handleSync = () => {
    syncSOToJob(salesOrder.id);
    toast('success', 'Sales order total synced to the linked job');
  };

  return (
    <div className={className}>
      <Card
        title={salesOrder.soNumber}
        subtitle={`${salesOrder.customerName} · ${formatDate(salesOrder.tranDate)}`}
        actions={(
          <div className="flex items-center gap-2">
            <Badge color={STATUS_TONES[salesOrder.status] || 'bg-surface-100 text-surface-700'}>
              {salesOrder.status}
            </Badge>
            {salesOrder.invoiceNumber && <Badge color="bg-emerald-100 text-emerald-700">{salesOrder.invoiceNumber}</Badge>}
          </div>
        )}
      >
        <div className="space-y-5">
          {salesOrder.billingHold && (
            <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">Billing hold:</span> {salesOrder.billingHoldReason || 'Review required'}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="metric-tile">
              <div className="kpi-label">SO total</div>
              <div className="mt-2 text-[1.6rem] font-semibold tracking-[-0.04em] text-surface-900">{formatCurrency(total)}</div>
              <div className="mt-2 text-sm text-surface-500">Subtotal {formatCurrency(subtotal)} · Tax {formatCurrency(taxAmount)}</div>
            </div>
            <div className="metric-tile">
              <div className="kpi-label">Balance</div>
              <div className="mt-2 text-[1.6rem] font-semibold tracking-[-0.04em] text-surface-900">{formatCurrency(salesOrder.balance || 0)}</div>
              <div className="mt-2 text-sm text-surface-500">Paid {formatCurrency(salesOrder.amountPaid || 0)}</div>
            </div>
            <div className="metric-tile">
              <div className="kpi-label">Terms</div>
              <div className="mt-2 text-lg font-semibold text-surface-900">{salesOrder.terms || 'Net 30'}</div>
              <div className="mt-2 text-sm text-surface-500">Due {formatDate(salesOrder.dueDate)}</div>
            </div>
            <div className="metric-tile">
              <div className="kpi-label">Linked job</div>
              <div className="mt-2 text-lg font-semibold text-surface-900">{salesOrder.linkedJobNumber || 'Not linked'}</div>
              <div className="mt-2 text-sm text-surface-500">{salesOrder.paymentMode || 'Invoice / Net 30'}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="surface-card rounded-[18px] p-4">
              <div className="mb-3 text-sm font-semibold text-surface-900">Header details</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Textarea
                    label="Memo"
                    rows={3}
                    value={headerDraft.memo}
                    onChange={(event) => setHeaderDraft((current) => ({ ...current, memo: event.target.value }))}
                    placeholder="Sales order memo"
                  />
                </div>
                <Input label="Billing Code" value={headerDraft.billingCode} onChange={(event) => setHeaderDraft((current) => ({ ...current, billingCode: event.target.value }))} />
                <label className="w-full">
                  <span className="label">Status</span>
                  <select className="select" value={headerDraft.status} onChange={(event) => setHeaderDraft((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="w-full">
                  <span className="label">Payment Mode</span>
                  <select className="select" value={headerDraft.paymentMode} onChange={(event) => setHeaderDraft((current) => ({ ...current, paymentMode: event.target.value }))}>
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <Input label="Terms" value={headerDraft.terms} onChange={(event) => setHeaderDraft((current) => ({ ...current, terms: event.target.value }))} />
                <Input label="Due Date" type="date" value={headerDraft.dueDate} onChange={(event) => setHeaderDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                {showLinkedJob && salesOrder.linkedJobId && (
                  <div className="md:col-span-2 rounded-[16px] border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
                    Linked job:{' '}
                    <Link to={`/jobs/${salesOrder.linkedJobId}`} className="font-semibold text-brand-700 hover:underline">
                      {salesOrder.linkedJobNumber}
                    </Link>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={handleSaveHeader} disabled={!dirtyHeader}>
                  Save header
                </Button>
                <Button variant="outline" size="sm" onClick={handleSync}>
                  Sync total to job
                </Button>
              </div>
            </div>

            <div className="surface-card rounded-[18px] p-4">
              <div className="mb-3 text-sm font-semibold text-surface-900">Billing actions</div>
              <div className="space-y-3">
                <div>
                  <div className="label">Hold Reason</div>
                  <Textarea
                    rows={3}
                    value={holdReason}
                    onChange={(event) => setHoldReason(event.target.value)}
                    placeholder="Why is billing on hold?"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleHoldToggle}>
                    {salesOrder.billingHold ? 'Remove Hold' : 'Put on Hold'}
                  </Button>
                  <Button variant="success" size="sm" onClick={handleGenerateInvoice} disabled={!!salesOrder.invoiceNumber || salesOrder.billingHold}>
                    Generate Invoice
                  </Button>
                </div>
                <div className="text-xs text-surface-500">
                  Invoices are disabled while the sales order is on hold or already invoiced.
                </div>
              </div>
            </div>
          </div>

          <div className="surface-card rounded-[18px] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-surface-900">Line items</div>
              <div className="text-xs text-surface-500">{salesOrder.lines.length} line{salesOrder.lines.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {salesOrder.lines.map((line) => {
                    const isEditing = editingLineId === line.id;

                    return (
                      <tr key={line.id}>
                        <td>
                          {isEditing ? (
                            <input className="input py-2 text-sm" value={editingDraft.itemName} onChange={(event) => setEditingDraft((current) => ({ ...current, itemName: event.target.value }))} />
                          ) : (
                            <div className="font-medium text-surface-900">{line.itemName}</div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input className="input py-2 text-sm" value={editingDraft.description} onChange={(event) => setEditingDraft((current) => ({ ...current, description: event.target.value }))} />
                          ) : (
                            <div className="text-sm text-surface-500">{line.description || '—'}</div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input className="input w-20 py-2 text-sm" type="number" step="0.25" value={editingDraft.quantity} onChange={(event) => setEditingDraft((current) => ({ ...current, quantity: event.target.value }))} />
                          ) : (
                            line.quantity
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input className="input w-28 py-2 text-sm" type="number" step="0.01" value={editingDraft.rate} onChange={(event) => setEditingDraft((current) => ({ ...current, rate: event.target.value }))} />
                          ) : (
                            formatCurrency(line.rate)
                          )}
                        </td>
                        <td className="text-right font-medium text-surface-900">{formatCurrency(line.amount)}</td>
                        <td>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button onClick={handleSaveLine} className="text-xs font-medium text-emerald-700 hover:underline">Save</button>
                              <button onClick={() => setEditingLineId(null)} className="text-xs font-medium text-surface-500 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => beginEditLine(line.id)} className="text-xs font-medium text-brand-700 hover:underline">Edit</button>
                              <button onClick={() => { removeSOLine(salesOrder.id, line.id); toast('success', 'Line removed'); }} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 border-t border-surface-100 pt-4 md:grid-cols-[minmax(0,1.4fr)_1fr_120px_120px_auto]">
              <Input label="Item" value={newLine.itemName} onChange={(event) => setNewLine((current) => ({ ...current, itemName: event.target.value }))} />
              <Input label="Description" value={newLine.description} onChange={(event) => setNewLine((current) => ({ ...current, description: event.target.value }))} />
              <Input label="Qty" type="number" step="0.25" value={newLine.quantity} onChange={(event) => setNewLine((current) => ({ ...current, quantity: event.target.value }))} />
              <Input label="Rate" type="number" step="0.01" value={newLine.rate} onChange={(event) => setNewLine((current) => ({ ...current, rate: event.target.value }))} />
              <div className="flex items-end">
                <Button variant="primary" size="sm" className="w-full" onClick={handleAddLine}>
                  Add line
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

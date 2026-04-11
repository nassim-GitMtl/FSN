import React from 'react';
import { Input, Textarea } from '@/components/ui';
import type { CustomerDraft } from '@/lib/customer-form';

interface ClientEditorFieldsProps {
  draft: CustomerDraft;
  onChange: (patch: Partial<CustomerDraft>) => void;
}

export const ClientEditorFields: React.FC<ClientEditorFieldsProps> = ({ draft, onChange }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Input label="Company Name" value={draft.companyName} onChange={(event) => onChange({ companyName: event.target.value })} />
    <Input label="Contact Name" value={draft.contactName} onChange={(event) => onChange({ contactName: event.target.value })} />
    <Input label="Email" type="email" value={draft.email} onChange={(event) => onChange({ email: event.target.value })} />
    <Input label="Phone" value={draft.phone} onChange={(event) => onChange({ phone: event.target.value })} />
    <Input label="Alt Phone" value={draft.altPhone} onChange={(event) => onChange({ altPhone: event.target.value })} />
    <Input label="Website" value={draft.website} onChange={(event) => onChange({ website: event.target.value })} />
    <Input label="Category" value={draft.category} onChange={(event) => onChange({ category: event.target.value })} />
    <Input label="Account #" value={draft.accountNumber} onChange={(event) => onChange({ accountNumber: event.target.value })} />
    <Input label="Address Label" value={draft.addressLabel} onChange={(event) => onChange({ addressLabel: event.target.value })} />
    <Input label="Street" value={draft.street} onChange={(event) => onChange({ street: event.target.value })} />
    <Input label="City" value={draft.city} onChange={(event) => onChange({ city: event.target.value })} />
    <Input label="State / Province" value={draft.state} onChange={(event) => onChange({ state: event.target.value })} />
    <Input label="Postal / ZIP" value={draft.zip} onChange={(event) => onChange({ zip: event.target.value })} />
    <div className="md:col-span-2">
      <Textarea
        label="Notes"
        rows={4}
        value={draft.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
      />
    </div>
  </div>
);

import type { Customer } from '@/types';

export type CustomerDraft = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  altPhone: string;
  website: string;
  category: string;
  accountNumber: string;
  addressLabel: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
};

function clean(value?: string) {
  return value?.trim() || '';
}

function buildDefaultAddressLabel(draft: CustomerDraft) {
  return [clean(draft.street), clean(draft.city), clean(draft.state), clean(draft.zip)].filter(Boolean).join(', ');
}

export function buildCustomerDraft(customer?: Customer): CustomerDraft {
  const defaultAddress = customer?.addresses.find((address) => address.isDefault) || customer?.addresses[0];

  return {
    companyName: customer?.companyName || '',
    contactName: customer?.contactName || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    altPhone: customer?.altPhone || '',
    website: customer?.website || '',
    category: customer?.category || '',
    accountNumber: customer?.accountNumber || '',
    addressLabel: defaultAddress?.label || 'Primary',
    street: defaultAddress?.street || '',
    city: defaultAddress?.city || '',
    state: defaultAddress?.state || '',
    zip: defaultAddress?.zip || '',
    notes: customer?.notes || '',
  };
}

export function buildCustomerPayloadFromDraft(draft: CustomerDraft, existing?: Customer): Partial<Customer> {
  const normalizedDraft = {
    companyName: clean(draft.companyName),
    contactName: clean(draft.contactName),
    email: clean(draft.email),
    phone: clean(draft.phone),
    altPhone: clean(draft.altPhone),
    website: clean(draft.website),
    category: clean(draft.category),
    accountNumber: clean(draft.accountNumber),
    addressLabel: clean(draft.addressLabel) || 'Primary',
    street: clean(draft.street),
    city: clean(draft.city),
    state: clean(draft.state),
    zip: clean(draft.zip),
    notes: clean(draft.notes),
  };

  const hasAddress = [normalizedDraft.street, normalizedDraft.city, normalizedDraft.state, normalizedDraft.zip].some(Boolean);
  const defaultIndex = existing?.addresses.findIndex((address) => address.isDefault) ?? -1;
  const resolvedIndex = defaultIndex >= 0 ? defaultIndex : 0;

  const updatedAddresses = existing?.addresses?.length
    ? existing.addresses.map((address, index) => (
        index === resolvedIndex
          ? {
              ...address,
              label: normalizedDraft.addressLabel,
              street: normalizedDraft.street,
              city: normalizedDraft.city,
              state: normalizedDraft.state,
              zip: normalizedDraft.zip,
              isDefault: true,
            }
          : { ...address, isDefault: false }
      ))
    : hasAddress
      ? [{
          id: `addr-${Date.now()}`,
          label: normalizedDraft.addressLabel,
          street: normalizedDraft.street,
          city: normalizedDraft.city,
          state: normalizedDraft.state,
          zip: normalizedDraft.zip,
          isDefault: true,
          isShipping: true,
          isBilling: true,
        }]
      : [];

  return {
    companyName: normalizedDraft.companyName,
    contactName: normalizedDraft.contactName || undefined,
    email: normalizedDraft.email || undefined,
    phone: normalizedDraft.phone || undefined,
    altPhone: normalizedDraft.altPhone || undefined,
    website: normalizedDraft.website || undefined,
    category: normalizedDraft.category || undefined,
    accountNumber: normalizedDraft.accountNumber || undefined,
    notes: normalizedDraft.notes || undefined,
    addresses: updatedAddresses,
    defaultAddress: hasAddress ? buildDefaultAddressLabel(draft) : undefined,
    isActive: existing?.isActive ?? true,
  };
}

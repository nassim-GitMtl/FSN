import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomerStore, useJobStore } from '@/store';
import { Card, Input, EmptyState, Button, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';

export const ClientList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customers = useCustomerStore(s => s.customers);
  const jobs = useJobStore(s => s.jobs);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState<'companyName' | 'createdAt'>('companyName');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setPage(1);
  }, [searchParams]);

  const results = useMemo(() => {
    let list = [...customers];
    if (filterCategory) list = list.filter(c => c.category === filterCategory);
    if (search.length >= 1) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.companyName.toLowerCase().includes(q) ||
        c.entityId.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.altPhone?.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        c.defaultAddress?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [customers, search, filterCategory]);

  const paginated = results.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const totalPages = Math.ceil(results.length / PAGE_SIZE);

  const getJobCount = (id: string) => jobs.filter(j => j.customerId === id).length;
  const getOpenJobCount = (id: string) => jobs.filter(j => j.customerId === id && !['COMPLETED','CANCELLED','INVOICED'].includes(j.status)).length;

  const categories = [...new Set(customers.map(c => c.category).filter(Boolean))];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{results.length} customers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search by name, phone, email, address…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          />
        </div>
        <select className="select w-auto" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }} className="text-xs text-surface-500 hover:text-surface-700 underline">
            Clear
          </button>
        )}
      </div>

      {/* Grid of cards */}
      {paginated.length === 0 ? (
        <EmptyState icon="🏢" title="No clients found" subtitle="Try a different search term." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map(c => {
            const jobCount = getJobCount(c.id);
            const openCount = getOpenJobCount(c.id);
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className="surface-card p-4 text-left hover:shadow-card-hover transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {c.companyName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-surface-900 truncate">{c.companyName}</h3>
                      {!c.isActive && <span className="badge bg-red-100 text-red-600 text-[10px]">Inactive</span>}
                    </div>
                    {c.contactName && <div className="text-xs text-surface-500 truncate">{c.contactName}</div>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-400 flex-wrap">
                      {c.email && <span className="truncate max-w-32">✉ {c.email}</span>}
                      {c.phone && <span>📞 {c.phone}</span>}
                    </div>
                    {c.defaultAddress && (
                      <div className="text-xs text-surface-400 mt-0.5 truncate">📍 {c.defaultAddress}</div>
                    )}
                    {c.category && (
                      <span className="badge bg-surface-100 text-surface-600 mt-1.5 text-[10px]">{c.category}</span>
                    )}
                  </div>
                </div>
                {/* KPIs */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-100 text-xs">
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-surface-900">{jobCount}</span>
                    <span className="text-surface-400">Jobs</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={cn('font-bold', openCount > 0 ? 'text-brand-600' : 'text-surface-900')}>{openCount}</span>
                    <span className="text-surface-400">Open</span>
                  </div>
                  <div className="ml-auto text-surface-400">
                    Since {formatDate(c.createdAt).replace(', ' + new Date(c.createdAt).getFullYear(), '')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-2 rounded-xl text-surface-500 hover:bg-surface-100 disabled:opacity-30">‹</button>
          <span className="text-sm text-surface-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="p-2 rounded-xl text-surface-500 hover:bg-surface-100 disabled:opacity-30">›</button>
        </div>
      )}
    </div>
  );
};

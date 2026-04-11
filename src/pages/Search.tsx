import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSearchStore, useUIStore } from '@/store';
import { StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getDesktopCopy } from '@/lib/desktop-copy';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { query, results, setQuery, search, clear, isSearching } = useSearchStore();
  const language = useUIStore((state) => state.language);
  const copy = getDesktopCopy(language);
  const [localQ, setLocalQ] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setLocalQ(q);
    setQuery(q);
    if (q.length >= 2) search(q);
    else clear();
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(localQ)}`);
  };

  const jobResults = results.filter(r => r.type === 'JOB');
  const customerResults = results.filter(r => r.type === 'CUSTOMER');
  const soResults = results.filter(r => r.type === 'SALES_ORDER');

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Search bar */}
      <div className="page-header">
        <h1 className="page-title">{copy.search.search}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full pl-11 pr-4 py-3.5 text-base bg-white border border-surface-200 rounded-2xl shadow-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 transition-all placeholder-surface-400"
            placeholder={copy.search.searchPlaceholder}
            value={localQ}
            onChange={e => setLocalQ(e.target.value)}
            autoFocus
          />
          {localQ && (
            <button
              type="button"
              onClick={() => {
                setLocalQ('');
                clear();
                setQuery('');
                navigate('/search');
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {/* Help text when empty */}
      {!localQ && (
        <div className="surface-card p-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold text-surface-700 mb-2">{copy.search.searchEverything}</h2>
          <p className="text-sm text-surface-400 max-w-sm mx-auto">
            {copy.search.searchByDescription}
          </p>
        </div>
      )}

      {/* Results */}
      {localQ.length >= 2 && (
        <>
          {isSearching ? (
            <div className="text-center py-8 text-surface-400">{copy.search.searching}</div>
          ) : results.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <div className="text-3xl mb-3">😕</div>
              <p className="text-surface-500">{copy.search.noResultsFor} <strong>"{localQ}"</strong></p>
              <p className="text-sm text-surface-400 mt-1">{copy.search.tryBroader}</p>
            </div>
          ) : (
            <div className="text-sm text-surface-500 -mb-2">
              {results.length} {copy.search.resultsFor} <strong>"{localQ}"</strong>
            </div>
          )}

          {/* Customer results */}
          {customerResults.length > 0 && (
            <Section title={copy.search.customers} icon="🏢" count={customerResults.length}>
              {customerResults.map(r => (
                <ResultCard key={r.id} result={r} onClick={() => navigate(r.url)} />
              ))}
            </Section>
          )}

          {/* Job results */}
          {jobResults.length > 0 && (
            <Section title={copy.search.jobs} icon="🔧" count={jobResults.length}>
              {jobResults.map(r => (
                <ResultCard key={r.id} result={r} onClick={() => navigate(r.url)}
                  extra={r.status ? <StatusBadge status={r.status as any} /> : undefined} />
              ))}
            </Section>
          )}

          {/* SO results */}
          {soResults.length > 0 && (
            <Section title={copy.search.salesOrders} icon="🧾" count={soResults.length}>
              {soResults.map(r => (
                <ResultCard key={r.id} result={r} onClick={() => navigate(r.url)} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: string; count: number; children: React.ReactNode }> = ({ title, icon, count, children }) => (
  <div className="surface-card overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 bg-surface-50 border-b border-surface-100">
      <span className="text-lg">{icon}</span>
      <span className="font-semibold text-surface-700">{title}</span>
      <span className="badge bg-surface-200 text-surface-600">{count}</span>
    </div>
    <div className="divide-y divide-surface-100">{children}</div>
  </div>
);

const ResultCard: React.FC<{ result: any; onClick: () => void; extra?: React.ReactNode }> = ({ result, onClick, extra }) => (
  <button onClick={onClick} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-50 text-left transition-colors">
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-surface-900">{result.title}</div>
      <div className="text-xs text-surface-500 truncate">{result.subtitle}</div>
      {result.meta && <div className="text-xs text-surface-400 truncate mt-0.5">{result.meta}</div>}
    </div>
    {extra && <div className="flex-shrink-0 ml-2">{extra}</div>}
    <div className="text-surface-300 ml-1">›</div>
  </button>
);

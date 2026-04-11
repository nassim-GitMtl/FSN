import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn, toISODate } from '@/lib/utils';
import { useAuthStore, useJobStore, useSearchStore, useUIStore } from '@/store';
import { Spinner } from '@/components/ui';

const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'INVOICED'];

const PAGE_META = [
  {
    match: (pathname: string) => pathname === '/dashboard',
    title: 'Dashboard',
    description: 'Live view of workload, field capacity, and billing readiness.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dispatch'),
    title: 'Dispatch',
    description: 'Assign work, balance routes, and recover the queue.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/technicians'),
    title: 'Technicians',
    description: 'Availability, skills, and workload across the field team.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/jobs'),
    title: 'Work Orders',
    description: 'Track the full lifecycle of active and completed jobs.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/clients'),
    title: 'Clients',
    description: 'Customer accounts, service history, and account health.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/billing'),
    title: 'Billing',
    description: 'Sales orders, approvals, and invoice readiness.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/reports'),
    title: 'Reports',
    description: 'Operational and financial reporting across the workspace.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/search'),
    title: 'Search',
    description: 'Find jobs, customers, and sales orders quickly.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/mobile'),
    title: 'Mobile Preview',
    description: 'Preview the technician mobile experience.',
  },
];

const RESULT_LABELS: Record<string, string> = {
  JOB: 'WO',
  CUSTOMER: 'CL',
  SALES_ORDER: 'SO',
};

const RESULT_TONES: Record<string, string> = {
  JOB: 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]',
  CUSTOMER: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
  SALES_ORDER: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
};

export const Header: React.FC = () => {
  const { user, logout, switchWorkspace } = useAuthStore();
  const { syncState, triggerSync, sidebarCollapsed } = useUIStore();
  const jobs = useJobStore((state) => state.jobs);
  const { query, results, setQuery, search, clear } = useSearchStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

  const category = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.category === category && !CLOSED_STATUSES.includes(job.status)),
    [jobs, category],
  );

  const overdueJobs = useMemo(() => {
    const today = toISODate(new Date());
    return activeJobs.filter((job) => job.scheduledDate && job.scheduledDate < today).length;
  }, [activeJobs]);

  const unassignedJobs = useMemo(
    () => activeJobs.filter((job) => !job.technicianId).length,
    [activeJobs],
  );

  const dirtyCount = syncState.pendingChanges;

  const pageMeta = useMemo(
    () => PAGE_META.find((page) => page.match(location.pathname)) ?? PAGE_META[0],
    [location.pathname],
  );

  useEffect(() => {
    const nextQuery = deferredQuery.trim();
    if (nextQuery.length >= 2) {
      search(nextQuery);
    } else if (!nextQuery) {
      clear();
    }
  }, [deferredQuery, search, clear]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  if (!user) {
    return null;
  }

  const workspaceLabel = user.workspace === 'SERVICE' ? 'Service workspace' : 'Installation workspace';

  const handleSearchSelect = (url: string) => {
    navigate(url);
    clear();
    setSearchFocused(false);
  };

  const handleQueryChange = (value: string) => {
    startTransition(() => setQuery(value));
    setSearchFocused(true);
  };

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-20 border-b backdrop-blur-md transition-[left] duration-200',
        'bg-[hsl(var(--background)/0.94)] border-[hsl(var(--border))]',
        sidebarCollapsed ? 'left-[88px]' : 'left-[272px]',
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-[1480px] items-center gap-4 px-5 xl:px-8">
        <div className="hidden w-[190px] flex-none lg:block xl:w-[240px]">
          <div className="eyebrow">{workspaceLabel}</div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="truncate text-base font-semibold text-[hsl(var(--foreground))] xl:text-lg">{pageMeta.title}</h1>
            <span className="hidden truncate text-sm text-[hsl(var(--muted-foreground))] 2xl:block">{pageMeta.description}</span>
          </div>
        </div>

        <div ref={searchRef} className="relative min-w-0 flex-1 max-w-xl">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search work orders, clients, or sales orders"
              className="input h-11 pl-10 pr-10 shadow-none"
            />
            {query && (
              <button
                onClick={() => handleQueryChange('')}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {searchFocused && query.trim().length >= 2 && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] shadow-[0_24px_48px_-32px_rgba(0,0,0,0.55)]">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No results for "{query.trim()}"</div>
              ) : (
                <>
                  {results.slice(0, 8).map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSearchSelect(result.url)}
                      className="flex w-full items-center gap-3 border-b border-[hsl(var(--border)/0.5)] px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--accent))] last:border-b-0"
                    >
                      <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase tracking-[0.14em]', RESULT_TONES[result.type] ?? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]')}>
                        {RESULT_LABELS[result.type] ?? result.type.slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{result.title}</div>
                        <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">{result.subtitle}</div>
                      </div>
                      {result.meta && <div className="hidden max-w-[180px] truncate text-xs text-[hsl(var(--muted-foreground)/0.6)] xl:block">{result.meta}</div>}
                    </button>
                  ))}
                  <button
                    onClick={() => handleSearchSelect('/search')}
                    className="w-full border-t border-[hsl(var(--border))] px-4 py-3 text-left text-sm font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary)/0.1)]"
                  >
                    Open full search results
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 2xl:flex">
          {[
            { label: 'Open', value: activeJobs.length },
            { label: 'Unassigned', value: unassignedJobs },
            { label: 'Overdue', value: overdueJobs },
          ].map((item) => (
            <div key={item.label} className="min-w-[74px] border-r border-[hsl(var(--border)/0.5)] pr-3 last:border-r-0 last:pr-0">
              <div className="text-base font-semibold text-[hsl(var(--foreground))]">{item.value}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-1">
            {(['SERVICE', 'INSTALLATION'] as const).map((workspace) => (
              <button
                key={workspace}
                onClick={() => switchWorkspace(workspace)}
                className={cn(
                  'rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                  user.workspace === workspace
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {workspace === 'SERVICE' ? 'Service' : 'Install'}
              </button>
            ))}
          </div>

          <button
            onClick={() => triggerSync()}
            disabled={syncState.status === 'SYNCING'}
            className={cn(
              'flex h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
              syncState.status === 'SUCCESS'
                ? 'border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]'
                : syncState.status === 'ERROR'
                  ? 'border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]'
                  : dirtyCount > 0
                    ? 'border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]',
            )}
          >
            {syncState.status === 'SYNCING' ? <Spinner size={14} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            {syncState.status === 'SYNCING' ? 'Saving' : dirtyCount > 0 ? `Save ${dirtyCount}` : 'Refresh'}
          </button>

          <div className="group relative">
            <button className="flex h-11 items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-left transition-colors hover:bg-[hsl(var(--accent))]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-xs font-semibold text-[hsl(var(--primary-foreground))]">
                {user.avatarInitials}
              </div>
              <div className="hidden min-w-0 xl:block">
                <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{user.name}</div>
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">{user.role}</div>
              </div>
              <svg className="h-4 w-4 text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="invisible absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] opacity-0 shadow-[0_24px_48px_-32px_rgba(0,0,0,0.55)] transition-all group-hover:visible group-hover:opacity-100">
              <div className="border-b border-[hsl(var(--border))] px-4 py-4">
                <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{user.name}</div>
                <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{user.email}</div>
              </div>
              <div className="p-2">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive)/0.1)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

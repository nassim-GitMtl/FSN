import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore, useJobStore, useUIStore } from '@/store';
import { Avatar, Tooltip } from '@/components/ui';

const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'INVOICED'];

type NavIconKey = 'dashboard' | 'jobs' | 'dispatch' | 'schedule' | 'techs' | 'clients' | 'search' | 'billing' | 'reports' | 'mobile';

const NAV_ITEMS = [
  {
    section: 'Operations',
    items: [
      { to: '/dashboard', label: 'Dashboard', caption: 'Overview', icon: 'dashboard' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR', 'BILLING', 'EXECUTIVE', 'TECHNICIAN'] },
      { to: '/jobs', label: 'Work Orders', caption: 'Queue and lifecycle', icon: 'jobs' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR', 'BILLING', 'TECHNICIAN'] },
      { to: '/dispatch', label: 'Dispatch', caption: 'Scheduling board', icon: 'dispatch' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR'] },
      { to: '/schedule', label: 'Schedule', caption: 'Calendar view', icon: 'schedule' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR'] },
      { to: '/technicians', label: 'Technicians', caption: 'Field roster', icon: 'techs' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR'] },
      { to: '/clients', label: 'Clients', caption: 'Accounts', icon: 'clients' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR', 'BILLING', 'TECHNICIAN'] },
      { to: '/search', label: 'Search', caption: 'Global lookup', icon: 'search' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR', 'BILLING', 'EXECUTIVE', 'TECHNICIAN'] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/billing', label: 'Billing', caption: 'Sales orders', icon: 'billing' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'BILLING', 'TECHNICIAN'] },
      { to: '/reports', label: 'Reports', caption: 'Performance', icon: 'reports' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'BILLING', 'EXECUTIVE'] },
    ],
  },
  {
    section: 'Field',
    items: [
      { to: '/mobile', label: 'Mobile Preview', caption: 'Technician view', icon: 'mobile' as NavIconKey, roles: ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR', 'TECHNICIAN'] },
    ],
  },
];

const NavIcon: React.FC<{ icon: NavIconKey; active?: boolean }> = ({ icon, active }) => {
  const classes = cn('h-4 w-4', active ? 'text-[hsl(var(--primary-foreground))]' : 'text-current');

  switch (icon) {
    case 'dashboard':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 13h7V4H4v9zm9 7h7v-5h-7v5zm0-9h7V4h-7v7zM4 20h7v-3H4v3z" />
        </svg>
      );
    case 'jobs':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'dispatch':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7M4 5h4m-4 14h4m8-14h4m-4 14h4" />
        </svg>
      );
    case 'schedule':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v4m8-4v4M3 10h18" />
        </svg>
      );
    case 'techs':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20a4 4 0 00-8 0m8 0H7m10 0h3m-13 0H4m8-9a4 4 0 100-8 4 4 0 000 8zm6 2a3 3 0 013 3v4m-18 0v-4a3 3 0 013-3" />
        </svg>
      );
    case 'clients':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14M7 21V7h10v14M9 7V4h6v3M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01" />
        </svg>
      );
    case 'search':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'billing':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2m-2 0h14l-1 10H6L5 9zm5 4h4" />
        </svg>
      );
    case 'reports':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20V10m5 10V4m5 16v-6" />
        </svg>
      );
    case 'mobile':
      return (
        <svg className={classes} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="7" y="2" width="10" height="20" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 18h2" />
        </svg>
      );
    default:
      return null;
  }
};

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const jobs = useJobStore((state) => state.jobs);
  const location = useLocation();

  if (!user) {
    return null;
  }

  const category = user.workspace === 'SERVICE' ? 'SERVICE' : 'INSTALLATION';
  const scopedJobs = jobs.filter((job) => job.category === category);
  const activeJobs = scopedJobs.filter((job) => !CLOSED_STATUSES.includes(job.status));
  const unassignedJobs = activeJobs.filter((job) => !job.technicianId);

  const filteredNav = NAV_ITEMS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(user.role)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-full flex-col border-r transition-[width] duration-200',
        'bg-[hsl(var(--background))] border-[hsl(var(--border))]',
        sidebarCollapsed ? 'w-[88px]' : 'w-[272px]',
      )}
    >
      <div className="flex h-[76px] items-center gap-3 border-b border-[hsl(var(--border))] px-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
          FM
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">FSM Command</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">Field service operations</div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        >
          <svg className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="mx-4 mt-4 rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">Workspace</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[hsl(var(--foreground))]">
              {user.workspace === 'SERVICE' ? 'Service Operations' : 'Installation Operations'}
            </div>
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[hsl(var(--surface-overlay))] px-3 py-3">
              <div className="text-lg font-semibold text-[hsl(var(--foreground))]">{activeJobs.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Open jobs</div>
            </div>
            <div className="rounded-xl bg-[hsl(var(--surface-overlay))] px-3 py-3">
              <div className="text-lg font-semibold text-[hsl(var(--foreground))]">{unassignedJobs.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Unassigned</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {filteredNav.map((section) => (
          <div key={section.section} className="mb-5">
            {!sidebarCollapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground)/0.6)]">
                {section.section}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = item.to === '/dashboard'
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(item.to);

                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
                      sidebarCollapsed ? 'justify-center' : '',
                      isActive
                        ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                        isActive ? 'bg-[hsl(var(--primary-foreground)/0.2)] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--surface))] text-current',
                      )}
                    >
                      <NavIcon icon={item.icon} active={isActive} />
                    </span>
                    {!sidebarCollapsed && (
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.label}</div>
                        <div className={cn('truncate text-[11px]', isActive ? 'text-[hsl(var(--primary-foreground)/0.7)]' : 'text-[hsl(var(--muted-foreground)/0.6)]')}>
                          {item.caption}
                        </div>
                      </div>
                    )}
                  </NavLink>
                );

                return sidebarCollapsed ? (
                  <Tooltip key={item.to} text={item.label}>
                    {link}
                  </Tooltip>
                ) : link;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-[hsl(var(--border))] p-4', sidebarCollapsed && 'flex justify-center')}>
        {!sidebarCollapsed ? (
          <div className="rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-3">
            <div className="flex items-center gap-3">
              <Avatar initials={user.avatarInitials} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{user.name}</div>
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">{user.role}</div>
              </div>
            </div>
          </div>
        ) : (
          <Avatar initials={user.avatarInitials} size="sm" />
        )}
      </div>
    </aside>
  );
};

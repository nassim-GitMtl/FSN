import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_USERS } from '@/data/demoUsers';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import type { User } from '@/types';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  DISPATCHER: 'Assign work, tune routes, and recover delayed jobs before they miss customer windows.',
  COORDINATOR: 'Run installation milestones, crews, and project readiness across active sites.',
  MANAGER: 'See the full operating picture across dispatch, service quality, and revenue.',
  TECHNICIAN: 'Review assigned jobs, update progress, and capture job details from the field.',
  BILLING: 'Track sales orders, billing readiness, and invoice movement without leaving the workspace.',
  ADMIN: 'Configure the system, role access, and the operating environment for the team.',
  EXECUTIVE: 'Monitor delivery, backlog, and financial performance from a clean command surface.',
};

const ROLE_TONES: Record<string, string> = {
  DISPATCHER: 'bg-[hsl(var(--primary))]',
  COORDINATOR: 'bg-[hsl(var(--info))]',
  MANAGER: 'bg-[hsl(var(--secondary))]',
  TECHNICIAN: 'bg-[hsl(var(--success))]',
  BILLING: 'bg-[hsl(var(--warning))]',
  ADMIN: 'bg-[hsl(var(--muted))]',
  EXECUTIVE: 'bg-[hsl(var(--accent))]',
};

const ROLE_SHORT: Record<string, string> = {
  DISPATCHER: 'DP',
  COORDINATOR: 'CO',
  MANAGER: 'MG',
  TECHNICIAN: 'TC',
  BILLING: 'BL',
  ADMIN: 'AD',
  EXECUTIVE: 'EX',
};

export const Login: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<User | null>(DEMO_USERS[0]);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!selected) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    login(selected);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto grid min-h-screen max-w-[1380px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col justify-between px-8 py-8 lg:px-14 lg:py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
              FM
            </div>
            <div>
              <div className="text-lg font-semibold tracking-[0.01em]">FSM Command</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Field service operations</div>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="eyebrow text-[hsl(var(--muted-foreground))]">Demo workspace</div>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.98] tracking-[-0.05em] md:text-6xl">
              A simpler field service workspace for dispatch, technicians, clients, and billing.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
              This build focuses on the essentials: clear workload visibility, faster routing decisions, and cleaner day-to-day execution for every role.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { title: 'Dispatch', detail: 'Keep queue pressure, technician capacity, and SLA risk in one place.' },
                { title: 'Field', detail: 'Track technician status, current assignments, and skill coverage quickly.' },
                { title: 'Billing', detail: 'Move completed work into review without losing operational context.' },
              ].map((item) => (
                <div key={item.title} className="rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4">
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.title}</div>
                  <div className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { value: 'Shared', label: 'Supabase data' },
              { value: 'Fast', label: 'Role switching' },
              { value: 'Ready', label: 'Vercel deploy' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4">
                <div className="text-3xl font-semibold tracking-[-0.04em]">{stat.value}</div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center px-6 py-8 lg:px-8">
          <div className="w-full rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))] shadow-[0_40px_90px_-60px_rgba(0,0,0,0.7)]">
            <div className="border-b border-[hsl(var(--border))] px-6 py-6">
              <div className="eyebrow">Access</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Open the demo workspace</h2>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                Choose a role and launch into the shared Supabase-backed demo workspace.
              </p>
            </div>

            <div className="space-y-3 p-6">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelected(user)}
                  className={cn(
                    'w-full rounded-[18px] border p-4 text-left transition-colors',
                    selected?.id === user.id
                      ? 'border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.1)]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:bg-[hsl(var(--accent))]',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-[hsl(var(--primary-foreground))]', ROLE_TONES[user.role])}>
                      {ROLE_SHORT[user.role]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{user.name}</div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">{user.role}</div>
                      </div>
                      <div className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{ROLE_DESCRIPTIONS[user.role]}</div>
                    </div>
                  </div>
                </button>
              ))}

              {selected && (
                <div className="rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4">
                  <div className="eyebrow">Selected session</div>
                  <div className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">{selected.name}</div>
                  <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{ROLE_DESCRIPTIONS[selected.role]}</div>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="mt-2 w-full"
                loading={loading}
                onClick={handleLogin}
                disabled={!selected}
              >
                {loading ? 'Launching workspace...' : `Launch as ${selected?.name || 'selected role'}`}
              </Button>

              <p className="text-center text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                Demo access only. No credentials are required, and changes save to the shared demo workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

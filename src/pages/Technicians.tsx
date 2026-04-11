import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, EmptyState, Modal } from '@/components/ui';
import { useAuthStore, useJobStore, useTechStore, useUIStore } from '@/store';
import { getDesktopCopy } from '@/lib/desktop-copy';
import { TECH_STATUS_COLORS, TECH_STATUS_LABELS, cn } from '@/lib/utils';
import type { TechStatus } from '@/types';

const STATUS_DOT: Record<TechStatus, string> = {
  AVAILABLE: 'bg-emerald-400',
  ON_JOB: 'bg-brand-500',
  ON_BREAK: 'bg-amber-400',
  OFF_DUTY: 'bg-slate-400',
  UNAVAILABLE: 'bg-red-400',
};

const STATUS_BG: Record<TechStatus, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ON_JOB: 'bg-brand-50 text-brand-700 border-brand-200',
  ON_BREAK: 'bg-amber-50 text-amber-700 border-amber-200',
  OFF_DUTY: 'bg-slate-100 text-slate-500 border-slate-200',
  UNAVAILABLE: 'bg-red-50 text-red-600 border-red-200',
};

const CAN_CHANGE_STATUS = ['ADMIN', 'MANAGER', 'DISPATCHER', 'COORDINATOR'];

export const Technicians: React.FC = () => {
  const { technicians, updateTechStatus } = useTechStore();
  const { jobs } = useJobStore();
  const { user } = useAuthStore();
  const language = useUIStore((state) => state.language);
  const copy = getDesktopCopy(language);
  const navigate = useNavigate();

  const workspace = user?.workspace ?? 'SERVICE';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TechStatus | ''>('');
  const [regionFilter, setRegionFilter] = useState('');
  const [editingTechId, setEditingTechId] = useState<string | null>(null);

  const canEditStatus = user ? CAN_CHANGE_STATUS.includes(user.role) : false;
  const workspaceTechs = technicians.filter((tech) => tech.category === workspace);

  const regions = useMemo(
    () => Array.from(new Set(workspaceTechs.map((tech) => tech.region).filter(Boolean))).sort() as string[],
    [workspaceTechs],
  );

  const filtered = useMemo(
    () => workspaceTechs.filter((tech) => {
      if (statusFilter && tech.status !== statusFilter) return false;
      if (regionFilter && tech.region !== regionFilter) return false;
      if (!search) return true;

      const query = search.toLowerCase();
      return (
        tech.name.toLowerCase().includes(query) ||
        tech.email.toLowerCase().includes(query) ||
        tech.skills.some((skill) => skill.toLowerCase().includes(query))
      );
    }),
    [workspaceTechs, statusFilter, regionFilter, search],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { AVAILABLE: 0, ON_JOB: 0, ON_BREAK: 0, OFF_DUTY: 0, UNAVAILABLE: 0 };
    workspaceTechs.forEach((tech) => {
      counts[tech.status] = (counts[tech.status] || 0) + 1;
    });
    return counts;
  }, [workspaceTechs]);

  const getTechStats = (techId: string) => {
    const techJobs = jobs.filter((job) => job.technicianId === techId);
    return {
      total: techJobs.length,
      completed: techJobs.filter((job) => job.status === 'COMPLETED').length,
      active: techJobs.filter((job) => ['EN_ROUTE', 'IN_PROGRESS', 'DISPATCHED', 'SCHEDULED'].includes(job.status)).length,
    };
  };

  const getCurrentJob = (techId: string) => jobs.find((job) => job.technicianId === techId && ['EN_ROUTE', 'IN_PROGRESS'].includes(job.status));

  const totalActiveJobs = workspaceTechs.reduce((sum, tech) => sum + getTechStats(tech.id).active, 0);
  const averageLoad = workspaceTechs.length > 0 ? (totalActiveJobs / workspaceTechs.length).toFixed(1) : '0.0';
  const editingTech = editingTechId ? technicians.find((tech) => tech.id === editingTechId) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="section-shell">
        <div className="page-header">
          <div>
            <div className="eyebrow">{copy.technicians.fieldCoverage}</div>
            <h1 className="page-title mt-2">{copy.technicians.technicianWorkspace}</h1>
            <p className="page-subtitle max-w-2xl">
              {language === 'fr'
                ? `Disponibilité, charge et assignations de l'équipe ${workspace === 'SERVICE' ? 'de service' : "d'installation"}.`
                : `Availability, workload, and current assignments across the ${workspace === 'SERVICE' ? 'service' : 'installation'} team.`}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: copy.technicians.availableNow, value: statusCounts.AVAILABLE ?? 0, detail: copy.technicians.techniciansReady },
            { label: copy.technicians.onJob, value: statusCounts.ON_JOB ?? 0, detail: copy.technicians.crewMembers },
            { label: copy.technicians.activeLoad, value: totalActiveJobs, detail: copy.technicians.openAssigned },
            { label: copy.technicians.avgLoadTech, value: averageLoad, detail: copy.technicians.averageWorkload },
          ].map((item) => (
            <div key={item.label} className="metric-tile">
              <div className="kpi-label">{item.label}</div>
              <div className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-surface-900">{item.value}</div>
              <div className="mt-2 text-sm text-surface-500">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell space-y-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={copy.technicians.searchByName}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input pl-10"
            />
          </div>

          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="select">
            <option value="">{copy.technicians.allRegions}</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          {(search || statusFilter || regionFilter) ? (
            <Button variant="ghost" onClick={() => { setSearch(''); setStatusFilter(''); setRegionFilter(''); }}>
              {copy.technicians.clearFilters}
            </Button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_DOT) as TechStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter((current) => (current === status ? '' : status))}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                statusFilter === status ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
              <span>{TECH_STATUS_LABELS[status]}</span>
              <span className="text-xs font-semibold text-surface-400">{statusCounts[status] ?? 0}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="-"
            title={copy.technicians.noTechniciansMatch}
            subtitle={search || statusFilter || regionFilter ? copy.technicians.tryWidening : copy.technicians.noTechniciansAvailable}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((tech) => {
              const stats = getTechStats(tech.id);
              const currentJob = getCurrentJob(tech.id);

              return (
                <div key={tech.id} className="surface-card rounded-[18px] p-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_170px_120px_minmax(0,1fr)_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <Avatar initials={tech.avatarInitials} size="md" color={tech.color} />
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-surface-900">{tech.name}</div>
                          <div className="truncate text-sm text-surface-500">{tech.email}</div>
                        </div>
                      </div>
                      {currentJob && (
                        <button
                          onClick={() => navigate(`/jobs/${currentJob.id}`)}
                          className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 transition-colors hover:bg-brand-100"
                        >
                          <span className="font-semibold">{currentJob.jobNumber}</span>
                          <span className="truncate">{currentJob.customerName}</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]', STATUS_BG[tech.status])}>
                        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[tech.status])} />
                        {TECH_STATUS_LABELS[tech.status]}
                      </div>
                      <div className="mt-2 text-xs text-surface-500">{tech.region || 'No region assigned'}</div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-surface-900">{stats.active} active</div>
                      <div className="mt-1 text-xs text-surface-500">{stats.completed} completed</div>
                      <div className="mt-1 text-xs text-surface-400">{stats.total} total jobs</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">{copy.technicians.skills}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tech.skills.slice(0, 4).map((skill) => (
                          <span key={skill} className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
                            {skill}
                          </span>
                        ))}
                        {tech.skills.length > 4 && (
                          <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-500">
                            +{tech.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    {canEditStatus && (
                      <div className="xl:justify-self-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingTechId(tech.id)}>
                          {copy.technicians.updateStatus}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={!!editingTech} onClose={() => setEditingTechId(null)} title={`${copy.technicians.updateStatus} - ${editingTech?.name}`} size="sm">
        {editingTech && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-surface-500">
              {copy.technicians.currentStatus}{' '}
              <span className={cn('font-semibold', TECH_STATUS_COLORS[editingTech.status])}>
                {TECH_STATUS_LABELS[editingTech.status]}
              </span>
            </p>
            {(Object.keys(TECH_STATUS_LABELS) as TechStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => {
                  updateTechStatus(editingTech.id, status);
                  setEditingTechId(null);
                }}
                disabled={editingTech.status === status}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[16px] border px-4 py-4 text-left transition-colors',
                  editingTech.status === status ? 'border-brand-300 bg-brand-50' : 'border-surface-200 bg-white hover:bg-surface-50',
                )}
              >
                <span className={cn('h-3 w-3 rounded-full', STATUS_DOT[status])} />
                <span className="text-sm font-semibold text-surface-900">{TECH_STATUS_LABELS[status]}</span>
                {editingTech.status === status && <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">{copy.technicians.current}</span>}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

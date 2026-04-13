import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useJobStore, useTechStore, useUIStore } from '@/store';
import { Button, Modal, StatusBadge, Input, Textarea } from '@/components/ui';
import { cn, getWorkWeekDates, parseDateValue, shiftISODate, toISODate } from '@/lib/utils';
import { getDesktopCopy } from '@/lib/desktop-copy';
import type { Job, Technician } from '@/types';

type RescheduleDraft = {
  jobId: string;
  jobNumber: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  reason: string;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Convert "HH:MM" to minutes since midnight */
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Generate hour labels between workStart and workEnd */
const buildHours = (start: string, end: string) => {
  const startH = Math.floor(toMinutes(start) / 60);
  const endH = Math.ceil(toMinutes(end) / 60);
  const hours: string[] = [];
  for (let h = startH; h <= endH; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`);
  }
  return hours;
};

const SLOT_HEIGHT = 60; // px per hour slot

// ─── JobBlock — positioned absolutely inside the tech column ─────────────────
const JobBlock: React.FC<{
  job: Job;
  workStart: string;
  onPreview: (job: Job) => void;
  onReschedule: (job: Job) => void;
  timeTBD: string;
  rescheduleLabel: string;
}> = ({ job, workStart, onPreview, onReschedule, timeTBD, rescheduleLabel }) => {
  const startMin = job.scheduledStart ? toMinutes(job.scheduledStart) : toMinutes(workStart);
  const endMin = job.scheduledEnd ? toMinutes(job.scheduledEnd) : startMin + 60;
  const workStartMin = toMinutes(workStart);

  const top = ((startMin - workStartMin) / 60) * SLOT_HEIGHT;
  const height = Math.max(((endMin - startMin) / 60) * SLOT_HEIGHT, 36);

  return (
    <div
      className="absolute left-1 right-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 overflow-hidden shadow-sm"
      style={{ top, height }}
    >
      <button type="button" onClick={() => onPreview(job)} className="w-full text-left">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-[10px] font-bold text-brand-700">{job.jobNumber}</span>
          <StatusBadge status={job.status} className="text-[9px] px-1 py-0" />
        </div>
        <div className="text-[11px] font-medium text-surface-800 truncate">{job.customerName}</div>
        {height > 50 && (
          <div className="text-[10px] text-surface-500">
            {job.scheduledStart
              ? `${job.scheduledStart}${job.scheduledEnd ? ` – ${job.scheduledEnd}` : ''}`
              : timeTBD}
          </div>
        )}
      </button>
      {height > 62 && (
        <button
          type="button"
          onClick={() => onReschedule(job)}
          className="mt-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-800"
        >
          {rescheduleLabel}
        </button>
      )}
    </div>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
export const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { jobs, rescheduleJob } = useJobStore();
  const technicians = useTechStore((state) => state.technicians);
  const { toast, language, workStart, workEnd, setWorkHours } = useUIStore();
  const copy = getDesktopCopy(language);
  const locale = language === 'fr' ? 'fr-CA' : 'en-US';
  const today = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [draft, setDraft] = useState<RescheduleDraft | null>(null);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [draftStart, setDraftStart] = useState(workStart);
  const [draftEnd, setDraftEnd] = useState(workEnd);
  const gridRef = useRef<HTMLDivElement>(null);

  const category = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';
  const techPool = useMemo(
    () => technicians.filter((t) => t.category === category),
    [technicians, category],
  );
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.category === category && !['CANCELLED', 'INVOICED'].includes(j.status)),
    [jobs, category],
  );

  const assignedDayJobs = useMemo(
    () => activeJobs.filter((j) => j.technicianId && j.scheduledDate === selectedDate),
    [activeJobs, selectedDate],
  );

  const unassignedJobs = useMemo(
    () => activeJobs.filter((j) => !j.technicianId),
    [activeJobs],
  );

  const jobsByTech = useMemo(() => {
    const map = new Map<string, Job[]>();
    assignedDayJobs.forEach((job) => {
      const list = map.get(job.technicianId!) || [];
      list.push(job);
      map.set(job.technicianId!, list);
    });
    return map;
  }, [assignedDayJobs]);

  const hours = useMemo(() => buildHours(workStart, workEnd), [workStart, workEnd]);
  const totalH = hours.length - 1; // number of hour slots

  const summary = useMemo(() => ({
    scheduled: activeJobs.filter((j) => j.scheduledDate === selectedDate && j.technicianId).length,
    unassigned: unassignedJobs.length,
    sameDay: activeJobs.filter((j) => j.scheduledDate === selectedDate).length,
    techs: techPool.length,
  }), [activeJobs, selectedDate, unassignedJobs.length, techPool.length]);

  const openReschedule = (job: Job) => {
    setDraft({
      jobId: job.id,
      jobNumber: job.jobNumber,
      scheduledDate: job.scheduledDate || today,
      scheduledStart: job.scheduledStart || '',
      scheduledEnd: job.scheduledEnd || '',
      reason: '',
    });
  };

  const confirmReschedule = () => {
    if (!draft) return;
    rescheduleJob(draft.jobId, {
      scheduledDate: draft.scheduledDate,
      scheduledStart: draft.scheduledStart || undefined,
      scheduledEnd: draft.scheduledEnd || undefined,
      reason: draft.reason,
    });
    toast('success', `${draft.jobNumber} rescheduled`);
    setDraft(null);
  };

  const saveWorkHours = () => {
    if (draftStart >= draftEnd) {
      toast('warning', 'Start time must be before end time.');
      return;
    }
    setWorkHours(draftStart, draftEnd);
    setShowHoursModal(false);
  };

  const parsedDate = parseDateValue(selectedDate);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">{copy.schedule.schedule}</h1>
          <p className="page-subtitle">{copy.schedule.weeklyCalendar}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { setDraftStart(workStart); setDraftEnd(workEnd); setShowHoursModal(true); }}>
            ⏱ {copy.schedule.workingHours}
          </Button>
          <Button variant="primary" onClick={() => navigate('/jobs/new')}>{copy.schedule.newJob}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 flex-shrink-0">
        {[
          { label: copy.schedule.scheduledThisWeek, value: summary.scheduled },
          { label: copy.schedule.sameDayJobs, value: summary.sameDay },
          { label: copy.schedule.unassigned, value: summary.unassigned },
          { label: copy.schedule.technicians, value: summary.techs },
        ].map((item) => (
          <div key={item.label} className="surface-card p-4">
            <div className="text-xs uppercase tracking-wide text-surface-400">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-surface-900">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Nav bar */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1 rounded-xl border border-surface-200 bg-surface-50 p-1">
          <button onClick={() => setSelectedDate((d) => shiftISODate(d, -1))} className="rounded-lg px-3 py-2 text-sm text-surface-600 hover:bg-white">{copy.schedule.prev}</button>
          <button onClick={() => setSelectedDate(today)} className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-surface-600 hover:bg-white">{copy.schedule.today}</button>
          <button onClick={() => setSelectedDate((d) => shiftISODate(d, 1))} className="rounded-lg px-3 py-2 text-sm text-surface-600 hover:bg-white">{copy.schedule.next}</button>
        </div>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
        {parsedDate && (
          <span className="text-sm font-medium text-surface-600">
            {parsedDate.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        )}
        <span className="ml-auto text-xs text-surface-400">
          {workStart} – {workEnd}
        </span>
      </div>

      {/* Main body: grid + unassigned sidebar */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">

        {/* ── Time grid ───────────────────────────────────────────────────── */}
        <div className="surface-card flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Sticky tech header row */}
          <div className="flex flex-shrink-0 border-b border-surface-200">
            {/* time gutter */}
            <div className="w-14 flex-shrink-0 border-r border-surface-200 bg-surface-50" />
            <div className="flex min-w-0 flex-1 overflow-x-auto">
              {techPool.map((tech: Technician) => (
                <div
                  key={tech.id}
                  className="min-w-[160px] flex-1 border-r border-surface-200 bg-surface-50 px-3 py-3"
                >
                  <div className="text-sm font-semibold text-surface-900 truncate">{tech.name}</div>
                  <div className="mt-0.5 text-[11px] text-surface-400 truncate">
                    {tech.region || 'Field'} · {tech.skills.slice(0, 2).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable time body */}
          <div className="flex min-h-0 flex-1 overflow-y-auto overflow-x-auto" ref={gridRef}>
            {/* Hour labels */}
            <div className="w-14 flex-shrink-0 border-r border-surface-200 bg-surface-50">
              {hours.slice(0, -1).map((h) => (
                <div
                  key={h}
                  className="flex items-start justify-end pr-2 text-[10px] font-medium text-surface-400"
                  style={{ height: SLOT_HEIGHT }}
                >
                  <span className="-mt-1.5">{h}</span>
                </div>
              ))}
            </div>

            {/* Tech columns */}
            <div className="flex min-w-0 flex-1">
              {techPool.map((tech: Technician) => {
                const techJobs = jobsByTech.get(tech.id) || [];
                return (
                  <div
                    key={tech.id}
                    className="relative min-w-[160px] flex-1 border-r border-surface-200"
                    style={{ height: totalH * SLOT_HEIGHT }}
                  >
                    {/* Hour grid lines */}
                    {hours.slice(0, -1).map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-b border-surface-100"
                        style={{ top: hours.indexOf(h) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      />
                    ))}
                    {/* Jobs */}
                    {techJobs.map((job) => (
                      <JobBlock
                        key={job.id}
                        job={job}
                        workStart={workStart}
                        onPreview={(j) => navigate(`/jobs/${j.id}`)}
                        onReschedule={openReschedule}
                        timeTBD={copy.schedule.timeTBD}
                        rescheduleLabel={copy.schedule.reschedule}
                      />
                    ))}
                  </div>
                );
              })}
              {techPool.length === 0 && (
                <div className="flex flex-1 items-center justify-center text-sm text-surface-400 py-12">
                  No technicians in this workspace.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Unassigned sidebar ──────────────────────────────────────────── */}
        <div className="surface-card flex w-64 flex-shrink-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
            <span className="text-sm font-semibold text-surface-800">{copy.schedule.unassignedJobs}</span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs font-bold',
              unassignedJobs.length > 0 ? 'bg-red-100 text-red-600' : 'bg-surface-100 text-surface-500',
            )}>
              {unassignedJobs.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {unassignedJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-200 px-4 py-6 text-center text-xs text-surface-400">
                {copy.schedule.noJobs}
              </div>
            ) : unassignedJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="w-full rounded-xl border border-surface-200 bg-white p-3 text-left hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] font-bold text-brand-600">{job.jobNumber}</span>
                  <StatusBadge status={job.status} className="text-[9px]" />
                </div>
                <div className="mt-1 text-xs font-medium text-surface-800 truncate">{job.customerName}</div>
                {job.scheduledDate && (
                  <div className="mt-0.5 text-[10px] text-surface-400">
                    {parseDateValue(job.scheduledDate)?.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                    {job.scheduledStart ? ` · ${job.scheduledStart}` : ''}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openReschedule(job); }}
                  className="mt-1.5 text-[10px] font-medium text-brand-600 hover:text-brand-800"
                >
                  {copy.schedule.reschedule}
                </button>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reschedule modal ────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft ? `${copy.schedule.reschedule} ${draft.jobNumber}` : copy.schedule.reschedule}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button variant="primary" onClick={confirmReschedule}>{copy.schedule.reschedule}</Button>
          </>
        )}
      >
        {draft && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label={copy.schedule.newDate} type="date" value={draft.scheduledDate}
              onChange={(e) => setDraft((c) => c ? { ...c, scheduledDate: e.target.value } : c)} />
            <Input label={copy.schedule.startTime} type="time" value={draft.scheduledStart}
              onChange={(e) => setDraft((c) => c ? { ...c, scheduledStart: e.target.value } : c)} />
            <Input label={copy.schedule.endTime} type="time" value={draft.scheduledEnd}
              onChange={(e) => setDraft((c) => c ? { ...c, scheduledEnd: e.target.value } : c)} />
            <div className="md:col-span-2">
              <Textarea label={copy.schedule.reason} rows={3} value={draft.reason}
                onChange={(e) => setDraft((c) => c ? { ...c, reason: e.target.value } : c)}
                placeholder={copy.schedule.whyRescheduled} />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Working Hours modal ─────────────────────────────────────────────── */}
      <Modal
        open={showHoursModal}
        onClose={() => setShowHoursModal(false)}
        title={copy.schedule.workingHours}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowHoursModal(false)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button variant="primary" onClick={saveWorkHours}>{language === 'fr' ? 'Enregistrer' : 'Save'}</Button>
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label={copy.schedule.workStart} type="time" value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)} />
          <Input label={copy.schedule.workEnd} type="time" value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
};

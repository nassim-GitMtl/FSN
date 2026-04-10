import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useJobStore, useTechStore, useUIStore } from '@/store';
import { Button, Modal, StatusBadge, Input, Textarea } from '@/components/ui';
import { cn, getWorkWeekDates, parseDateValue, shiftISODate, toISODate } from '@/lib/utils';
import type { Job, Technician } from '@/types';

type RescheduleDraft = {
  jobId: string;
  jobNumber: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  reason: string;
};

const JobChip: React.FC<{ job: Job; onPreview: (job: Job) => void; onReschedule: (job: Job) => void }> = ({ job, onPreview, onReschedule }) => (
  <div className="rounded-xl border border-surface-200 bg-white p-2 shadow-card">
    <button type="button" onClick={() => onPreview(job)} className="w-full text-left">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-brand-600">{job.jobNumber}</span>
        <StatusBadge status={job.status} className="text-[10px]" />
      </div>
      <div className="mt-1 text-xs font-medium text-surface-800">{job.customerName}</div>
      <div className="mt-1 text-[11px] text-surface-500">
        {job.scheduledStart ? `${job.scheduledStart}${job.scheduledEnd ? ` - ${job.scheduledEnd}` : ''}` : 'Time TBD'}
      </div>
    </button>
    <button type="button" onClick={() => onReschedule(job)} className="mt-2 text-[11px] font-medium text-brand-600 hover:text-brand-700">
      Reschedule
    </button>
  </div>
);

export const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { jobs, rescheduleJob } = useJobStore();
  const technicians = useTechStore((state) => state.technicians);
  const { toast } = useUIStore();
  const today = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [draft, setDraft] = useState<RescheduleDraft | null>(null);

  const category = user?.workspace === 'INSTALLATION' ? 'INSTALLATION' : 'SERVICE';
  const techPool = useMemo(
    () => technicians.filter((technician) => technician.category === category),
    [technicians, category],
  );
  const activeJobs = useMemo(
    () => jobs.filter((job) => job.category === category && !['CANCELLED', 'INVOICED'].includes(job.status)),
    [jobs, category],
  );
  const weekDates = useMemo(() => getWorkWeekDates(selectedDate, 7), [selectedDate]);

  const jobsByTechAndDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    activeJobs.forEach((job) => {
      const key = `${job.technicianId || 'unassigned'}:${job.scheduledDate || 'unscheduled'}`;
      const list = map.get(key) || [];
      list.push(job);
      map.set(key, list);
    });
    return map;
  }, [activeJobs]);

  const summary = useMemo(() => ({
    scheduled: activeJobs.filter((job) => job.scheduledDate && weekDates.includes(job.scheduledDate)).length,
    unassigned: activeJobs.filter((job) => !job.technicianId).length,
    sameDay: activeJobs.filter((job) => job.scheduledDate === selectedDate).length,
    techs: techPool.length,
  }), [activeJobs, weekDates, selectedDate, techPool.length]);

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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Schedule</h1>
          <p className="page-subtitle">Weekly calendar view across technicians with quick reschedule controls.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/jobs/new')}>+ New Job</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Scheduled This Week', value: summary.scheduled },
          { label: 'Same Day Jobs', value: summary.sameDay },
          { label: 'Unassigned', value: summary.unassigned },
          { label: 'Technicians', value: summary.techs },
        ].map((item) => (
          <div key={item.label} className="surface-card p-4">
            <div className="text-xs uppercase tracking-wide text-surface-400">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-surface-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-surface-200 bg-surface-50 p-1">
          <button onClick={() => setSelectedDate((current) => shiftISODate(current, -7))} className="rounded-lg px-3 py-2 text-sm text-surface-600 hover:bg-white">← Prev</button>
          <button onClick={() => setSelectedDate(today)} className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-surface-600 hover:bg-white">Today</button>
          <button onClick={() => setSelectedDate((current) => shiftISODate(current, 7))} className="rounded-lg px-3 py-2 text-sm text-surface-600 hover:bg-white">Next →</button>
        </div>
        <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-auto" />
      </div>

      <div className="surface-card overflow-hidden">
        <div className="min-w-[1100px] overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: '180px repeat(7, minmax(130px, 1fr))' }}>
            <div className="border-b border-r border-surface-200 bg-surface-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
              Technician
            </div>
            {weekDates.map((date) => {
              const parsed = parseDateValue(date);
              const isToday = date === today;
              return (
                <div key={date} className={cn('border-b border-surface-200 px-4 py-3 text-center', isToday && 'bg-brand-50')}>
                  <div className="text-[11px] uppercase tracking-wide text-surface-400">
                    {parsed?.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={cn('mt-1 text-base font-semibold text-surface-900', isToday && 'text-brand-700')}>
                    {parsed?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}

            {techPool.map((technician: Technician) => (
              <React.Fragment key={technician.id}>
                <div className="border-r border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="text-sm font-semibold text-surface-900">{technician.name}</div>
                  <div className="mt-1 text-xs text-surface-500">{technician.region || 'Field'} · {technician.skills.slice(0, 2).join(', ')}</div>
                </div>
                {weekDates.map((date) => {
                  const key = `${technician.id}:${date}`;
                  const dayJobs = [...(jobsByTechAndDay.get(key) || [])].sort((left, right) => (left.scheduledStart || '').localeCompare(right.scheduledStart || ''));

                  return (
                    <div key={key} className="min-h-[150px] border-l border-surface-200 px-3 py-3">
                      <div className="space-y-2">
                        {dayJobs.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-surface-200 px-3 py-4 text-center text-xs text-surface-300">
                            No jobs
                          </div>
                        ) : dayJobs.map((job) => (
                          <JobChip
                            key={job.id}
                            job={job}
                            onPreview={(target) => navigate(`/jobs/${target.id}`)}
                            onReschedule={openReschedule}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft ? `Reschedule ${draft.jobNumber}` : 'Reschedule Job'}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmReschedule}>Reschedule</Button>
          </>
        )}
      >
        {draft && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="New Date"
              type="date"
              value={draft.scheduledDate}
              onChange={(event) => setDraft((current) => current ? { ...current, scheduledDate: event.target.value } : current)}
            />
            <Input
              label="Start Time"
              type="time"
              value={draft.scheduledStart}
              onChange={(event) => setDraft((current) => current ? { ...current, scheduledStart: event.target.value } : current)}
            />
            <Input
              label="End Time"
              type="time"
              value={draft.scheduledEnd}
              onChange={(event) => setDraft((current) => current ? { ...current, scheduledEnd: event.target.value } : current)}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Reason"
                rows={3}
                value={draft.reason}
                onChange={(event) => setDraft((current) => current ? { ...current, reason: event.target.value } : current)}
                placeholder="Why is this job being rescheduled?"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

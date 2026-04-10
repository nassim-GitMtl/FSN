import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAuthStore, useJobStore, useTechStore, useUIStore } from '@/store';
import { StatusBadge, PriorityBadge, Avatar, Button, Tabs } from '@/components/ui';
import { cn, getWorkWeekDates, parseDateValue, shiftISODate, toISODate } from '@/lib/utils';
import type { Job, Technician } from '@/types';

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
] as const;

const WORKDAY_START_MINUTES = 6 * 60;
const WORKDAY_END_MINUTES = 20 * 60;
const RESIZE_STEP_MINUTES = 15;
const RESIZE_SNAP_PX = 12;

type TimeWindow = { start: number; end: number };
type ResizeEdge = 'start' | 'end';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function timeToMinutes(value?: string): number | null {
  if (value) {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return (hours * 60) + minutes;
  }
  return null;
}

function minutesToTime(value: number): string {
  const clamped = clamp(value, 0, (24 * 60) - RESIZE_STEP_MINUTES);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getJobTimeWindow(job: Job): { start: number; end: number } | null {
  const start = timeToMinutes(job.scheduledStart);
  if (start == null) return null;

  const endFromField = timeToMinutes(job.scheduledEnd);
  if (endFromField != null) {
    return { start, end: endFromField };
  }

  if (job.estimatedDuration && job.estimatedDuration > 0) {
    return { start, end: start + (job.estimatedDuration * 60) };
  }

  return null;
}

function getEditableJobTimeWindow(job: Job): TimeWindow {
  const existing = getJobTimeWindow(job);
  if (existing) {
    return existing;
  }

  const start = timeToMinutes(job.scheduledStart) ?? (8 * 60);
  const duration = Math.max(RESIZE_STEP_MINUTES * 2, Math.round((job.estimatedDuration || 1) * 60));
  return { start, end: clamp(start + duration, start + RESIZE_STEP_MINUTES, WORKDAY_END_MINUTES) };
}

function sortJobsBySchedule(jobs: Job[]): Job[] {
  return [...jobs].sort((left, right) => {
    const leftWindow = getEditableJobTimeWindow(left);
    const rightWindow = getEditableJobTimeWindow(right);

    if (leftWindow.start !== rightWindow.start) {
      return leftWindow.start - rightWindow.start;
    }

    return left.customerName.localeCompare(right.customerName);
  });
}

function getLatestScheduledEnd(jobs: Job[]): number | null {
  const windows = jobs
    .map((job) => getJobTimeWindow(job))
    .filter((window): window is TimeWindow => Boolean(window));

  if (windows.length === 0) {
    return null;
  }

  return Math.max(...windows.map((window) => window.end));
}

function getAutoScheduledWindow(job: Job, jobs: Job[]): TimeWindow {
  const durationMinutes = Math.max(
    RESIZE_STEP_MINUTES,
    Math.round(((job.estimatedDuration || 1) * 60) / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES,
  );
  const latestEnd = getLatestScheduledEnd(jobs);
  const start = latestEnd ?? (8 * 60);
  const end = start + durationMinutes;

  return { start, end };
}

function hasSchedulingConflict(job: Job, targetJobs: Job[]): boolean {
  const window = getJobTimeWindow(job);
  if (!window) {
    return false;
  }

  return targetJobs.some(existing => {
    if (existing.id === job.id) return false;

    const existingWindow = getJobTimeWindow(existing);
    if (!existingWindow) {
      return false;
    }

    return window.start < existingWindow.end && window.end > existingWindow.start;
  });
}

// ── Draggable Job Card ──────────────────────────────────────────────────────

const DraggableJobCard: React.FC<{ job: Job; compact?: boolean }> = ({ job, compact }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const navigate = useNavigate();

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'rounded-xl border cursor-grab active:cursor-grabbing transition-all select-none',
        isDragging ? 'opacity-30 shadow-lg' : 'bg-white border-surface-200 shadow-card hover:shadow-card-hover',
        compact ? 'p-2' : 'p-3',
      )}
    >
      <div {...listeners} className="w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold text-brand-600">{job.jobNumber}</span>
          <StatusBadge status={job.status} className="text-[10px] py-0 px-1.5" />
        </div>
        <div className="text-xs font-medium text-surface-800 truncate">{job.customerName}</div>
        {!compact && (
          <div className="text-[10px] text-surface-500 truncate mt-0.5">{job.description.substring(0, 50)}</div>
        )}
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          <PriorityBadge priority={job.priority} className="text-[10px] py-0 px-1.5" />
          {job.scheduledStart && (
            <span className="text-[10px] bg-surface-100 px-1.5 py-0.5 rounded text-surface-600">
              {job.scheduledStart}
            </span>
          )}
          {job.estimatedDuration && (
            <span className="text-[10px] bg-surface-100 px-1.5 py-0.5 rounded text-surface-600">
              {job.estimatedDuration}h
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}`); }}
        className="mt-1.5 w-full text-[10px] text-brand-500 hover:text-brand-700 text-left"
      >
        View details →
      </button>
    </div>
  );
};

const ScheduledJobCard: React.FC<{
  job: Job;
  compact?: boolean;
  onResize: (job: Job, window: TimeWindow) => void;
  hasConflict?: boolean;
}> = ({ job, compact, onResize, hasConflict }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const navigate = useNavigate();
  const [previewWindow, setPreviewWindow] = useState<TimeWindow | null>(null);
  const previewRef = useRef<TimeWindow | null>(null);

  const activeWindow = previewWindow ?? getEditableJobTimeWindow(job);
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const durationHours = Math.round(((activeWindow.end - activeWindow.start) / 60) * 10) / 10;
  const timelineLeft = ((activeWindow.start - WORKDAY_START_MINUTES) / (WORKDAY_END_MINUTES - WORKDAY_START_MINUTES)) * 100;
  const timelineWidth = ((activeWindow.end - activeWindow.start) / (WORKDAY_END_MINUTES - WORKDAY_START_MINUTES)) * 100;
  const canResize = Boolean(job.technicianId && job.scheduledDate);

  const startResize = (edge: ResizeEdge, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canResize) return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const initialWindow = getEditableJobTimeWindow(job);
    previewRef.current = initialWindow;
    setPreviewWindow(initialWindow);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const stepCount = Math.round((moveEvent.clientX - startX) / RESIZE_SNAP_PX);
      const deltaMinutes = stepCount * RESIZE_STEP_MINUTES;

      let nextStart = initialWindow.start;
      let nextEnd = initialWindow.end;

      if (edge === 'start') {
        nextStart = clamp(initialWindow.start + deltaMinutes, WORKDAY_START_MINUTES, initialWindow.end - RESIZE_STEP_MINUTES);
      } else {
        nextEnd = clamp(initialWindow.end + deltaMinutes, initialWindow.start + RESIZE_STEP_MINUTES, WORKDAY_END_MINUTES);
      }

      const nextWindow = { start: nextStart, end: nextEnd };
      previewRef.current = nextWindow;
      setPreviewWindow(nextWindow);
    };

    const finishResize = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);

      const finalWindow = previewRef.current ?? initialWindow;
      previewRef.current = null;
      setPreviewWindow(null);

      if (finalWindow.start !== initialWindow.start || finalWindow.end !== initialWindow.end) {
        onResize(job, finalWindow);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'rounded-xl border transition-all select-none',
        isDragging ? 'opacity-30 shadow-lg' : hasConflict ? 'bg-amber-50 border-amber-300 shadow-card hover:shadow-card-hover' : 'bg-white border-surface-200 shadow-card hover:shadow-card-hover',
        compact ? 'p-2' : 'p-3',
      )}
    >
      <div {...listeners} className={cn('w-full cursor-grab active:cursor-grabbing', compact && 'pb-1')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold text-brand-600">{job.jobNumber}</span>
          <StatusBadge status={job.status} className="text-[10px] py-0 px-1.5" />
          {hasConflict && (
            <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
              Conflict
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-surface-800 truncate">{job.customerName}</div>
        {!compact && (
          <div className="text-[10px] text-surface-500 truncate mt-0.5">{job.description.substring(0, 50)}</div>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between gap-2 text-[10px] text-surface-500">
          <span>{minutesToTime(activeWindow.start)} - {minutesToTime(activeWindow.end)}</span>
          <span>{durationHours}h</span>
        </div>
        <div className="relative mt-1 h-6 rounded-lg bg-surface-100 overflow-hidden">
          <div
            className="absolute inset-y-1 rounded-md border border-brand-300 bg-brand-500/15"
            style={{
              left: `${timelineLeft}%`,
              width: `${Math.max(timelineWidth, 8)}%`,
            }}
          >
            {canResize && (
              <>
                <button
                  type="button"
                  aria-label={`Adjust start time for ${job.jobNumber}`}
                  onPointerDown={(event) => startResize('start', event)}
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-brand-500/40 hover:bg-brand-500/55 transition-colors"
                />
                <button
                  type="button"
                  aria-label={`Adjust end time for ${job.jobNumber}`}
                  onPointerDown={(event) => startResize('end', event)}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-brand-500/40 hover:bg-brand-500/55 transition-colors"
                />
              </>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}`); }}
        className="mt-1.5 w-full text-[10px] text-brand-500 hover:text-brand-700 text-left"
      >
        View details →
      </button>
    </div>
  );
};

// ── Droppable Tech Column ───────────────────────────────────────────────────

const TechColumn: React.FC<{
  tech: Technician;
  jobs: Job[];
  onResize: (job: Job, window: TimeWindow) => void;
}> = ({ tech, jobs, onResize }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `day:${tech.id}` });
  const sortedJobs = useMemo(() => sortJobsBySchedule(jobs), [jobs]);

  return (
    <div className="flex flex-col w-52 flex-shrink-0">
      {/* Tech header */}
      <div className="flex items-center gap-2 px-2 py-2 bg-white border border-surface-200 rounded-xl mb-2">
        <Avatar initials={tech.avatarInitials} color={tech.color} size="sm" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-surface-800 truncate">{tech.name}</div>
          <div className={cn('text-[10px]',
            tech.status === 'AVAILABLE' ? 'text-emerald-600' :
            tech.status === 'ON_JOB' ? 'text-brand-600' : 'text-amber-600'
          )}>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[200px] rounded-xl p-2 transition-all space-y-2',
          isOver ? 'bg-brand-50 border-2 border-brand-400 border-dashed' : 'bg-surface-50 border border-surface-200',
        )}
      >
        {sortedJobs.map(j => (
          <ScheduledJobCard
            key={j.id}
            job={j}
            compact
            onResize={onResize}
            hasConflict={hasSchedulingConflict(j, sortedJobs)}
          />
        ))}
        {sortedJobs.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px] text-surface-300">Drop job here</span>
          </div>
        )}
      </div>
    </div>
  );
};

const WeekTechCell: React.FC<{
  tech: Technician;
  date: string;
  jobs: Job[];
  onResize: (job: Job, window: TimeWindow) => void;
}> = ({ tech, date, jobs, onResize }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `week:${tech.id}:${date}` });
  const sortedJobs = useMemo(() => sortJobsBySchedule(jobs), [jobs]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-h-16 rounded-xl p-1.5 space-y-1 transition-all',
        isOver ? 'bg-brand-50 border border-brand-400' : 'bg-surface-50 border border-surface-200'
      )}
    >
      {sortedJobs.map(job => (
        <ScheduledJobCard
          key={job.id}
          job={job}
          compact
          onResize={onResize}
          hasConflict={hasSchedulingConflict(job, sortedJobs)}
        />
      ))}
    </div>
  );
};

// ── Unassigned Panel ────────────────────────────────────────────────────────

const UnassignedPanel: React.FC<{
  jobs: Job[];
  search: string;
  onSearch: (v: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyBoardRange: () => void;
}> = ({
  jobs,
  search,
  onSearch,
  priority,
  onPriorityChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApplyBoardRange,
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'unassigned' });

  return (
    <div className="w-60 flex-shrink-0 flex flex-col">
      <div className="mb-2">
        <div className="text-sm font-semibold text-surface-700 mb-1.5">Unassigned ({jobs.length})</div>
        <input
          className="w-full px-2.5 py-1.5 text-xs bg-surface-100 rounded-lg border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white placeholder-surface-400 transition-all"
          placeholder="Filter…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        <select
          className="mt-2 w-full px-2.5 py-1.5 text-xs bg-surface-100 rounded-lg border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white transition-all"
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
        >
          {PRIORITY_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input
            type="date"
            className="w-full px-2 py-1.5 text-xs bg-surface-100 rounded-lg border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white transition-all"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <input
            type="date"
            className="w-full px-2 py-1.5 text-xs bg-surface-100 rounded-lg border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white transition-all"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={onApplyBoardRange}
          className="mt-2 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors"
        >
          Use board range
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto rounded-xl p-2 space-y-2 transition-all',
          isOver ? 'bg-brand-50 border-2 border-brand-400 border-dashed' : 'bg-surface-50 border border-surface-200',
        )}
      >
        {jobs.length === 0 ? (
          <div className="h-20 flex items-center justify-center">
            <span className="text-xs text-surface-300">No unassigned jobs</span>
          </div>
        ) : jobs.map(j => <DraggableJobCard key={j.id} job={j} compact />)}
      </div>
    </div>
  );
};

// ── MAIN DISPATCH PAGE ──────────────────────────────────────────────────────

export const Dispatch: React.FC = () => {
  const { user } = useAuthStore();
  const { jobs, assignTechnician, updateJob } = useJobStore();
  const technicians = useTechStore(s => s.technicians);
  const { toast } = useUIStore();
  const navigate = useNavigate();

  const today = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [unassignedPriority, setUnassignedPriority] = useState('');
  const [queueDateFrom, setQueueDateFrom] = useState('');
  const [queueDateTo, setQueueDateTo] = useState('');
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const ws = user?.workspace || 'SERVICE';
  const cat = ws === 'SERVICE' ? 'SERVICE' : 'INSTALLATION';

  const techPool = technicians.filter(t => t.category === cat);

  const catJobs = jobs.filter(j => j.category === cat);

  const unassignedJobs = useMemo(() =>
    catJobs.filter(j =>
      !j.technicianId &&
      !['COMPLETED', 'CANCELLED', 'INVOICED'].includes(j.status) &&
      (unassignedSearch === '' || j.jobNumber.toLowerCase().includes(unassignedSearch.toLowerCase()) ||
        j.customerName.toLowerCase().includes(unassignedSearch.toLowerCase())) &&
      (unassignedPriority === '' || j.priority === unassignedPriority) &&
      (!queueDateFrom || (j.scheduledDate && j.scheduledDate >= queueDateFrom)) &&
      (!queueDateTo || (j.scheduledDate && j.scheduledDate <= queueDateTo))
    ),
    [catJobs, unassignedSearch, unassignedPriority, queueDateFrom, queueDateTo]
  );

  const getJobsForTech = (techId: string) =>
    catJobs.filter(j =>
      j.technicianId === techId &&
      j.scheduledDate === selectedDate &&
      !['CANCELLED', 'INVOICED'].includes(j.status)
    );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const job = catJobs.find(j => j.id === event.active.id);
    setActiveJob(job || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveJob(null);
    const { over, active } = event;
    if (!over) return;

    const jobId = String(active.id);
    const overId = String(over.id);

    if (overId.startsWith('day:') || overId.startsWith('week:')) {
      const target = overId.split(':');
      const techId = target[1];
      const targetDate = target[0] === 'week' ? target[2] : selectedDate;
      const tech = techPool.find(t => t.id === techId);
      if (tech) {
        const draggedJob = catJobs.find(j => j.id === jobId);
        if (!draggedJob) return;

        const targetJobs = catJobs.filter(j =>
          j.technicianId === techId &&
          j.scheduledDate === targetDate &&
          !['CANCELLED', 'INVOICED'].includes(j.status)
        );
        const isNewAssignment = !draggedJob.technicianId;
        const autoWindow = isNewAssignment ? getAutoScheduledWindow(draggedJob, targetJobs) : null;
        const scheduledStart = autoWindow ? minutesToTime(autoWindow.start) : draggedJob.scheduledStart;
        const scheduledEnd = autoWindow ? minutesToTime(autoWindow.end) : draggedJob.scheduledEnd;
        const estimatedDuration = autoWindow
          ? Math.round((((autoWindow.end - autoWindow.start) / 60) * 10)) / 10
          : draggedJob.estimatedDuration;

        const candidateJob = {
          ...draggedJob,
          technicianId: techId,
          technicianName: tech.name,
          scheduledDate: targetDate,
          scheduledStart,
          scheduledEnd,
          estimatedDuration,
        };
        const hasConflict = hasSchedulingConflict(candidateJob, targetJobs);

        assignTechnician(jobId, techId, tech.name);
        updateJob(jobId, {
          scheduledDate: targetDate,
          scheduledStart,
          scheduledEnd,
          estimatedDuration,
        });

        if (hasConflict) {
          toast('warning', `Assigned to ${tech.name}${scheduledStart ? ` at ${scheduledStart}` : ''}, but it overlaps with another job.`);
        } else {
          toast('success', `Assigned to ${tech.name}${scheduledStart ? ` at ${scheduledStart}` : ''}${targetDate ? ` on ${targetDate}` : ''}`);
        }
      }
    } else if (overId === 'unassigned') {
      updateJob(jobId, { technicianId: undefined, technicianName: undefined, status: 'NEW' });
      toast('info', 'Job moved to unassigned');
    }
  };

  const handleResizeJob = (job: Job, window: TimeWindow) => {
    if (!job.technicianId || !job.scheduledDate) return;

    const resizedJob: Job = {
      ...job,
      scheduledStart: minutesToTime(window.start),
      scheduledEnd: minutesToTime(window.end),
      estimatedDuration: Math.round((((window.end - window.start) / 60) * 10)) / 10,
    };

    const targetJobs = catJobs.filter(candidate =>
      candidate.technicianId === job.technicianId &&
      candidate.scheduledDate === job.scheduledDate &&
      !['CANCELLED', 'INVOICED'].includes(candidate.status)
    );

    if (hasSchedulingConflict(resizedJob, targetJobs)) {
      toast('warning', `Scheduling conflict for ${job.technicianName || 'this technician'}. Resize applied with overlap warning.`);
    }

    updateJob(job.id, {
      scheduledStart: resizedJob.scheduledStart,
      scheduledEnd: resizedJob.scheduledEnd,
      estimatedDuration: resizedJob.estimatedDuration,
    });
  };

  const weekDates = useMemo(() => getWorkWeekDates(selectedDate), [selectedDate]);
  const boardDateFrom = viewMode === 'week' ? weekDates[0] : selectedDate;
  const boardDateTo = viewMode === 'week' ? weekDates[weekDates.length - 1] : selectedDate;
  const activeBoardJobs = catJobs.filter((job) => !['COMPLETED', 'CANCELLED', 'INVOICED'].includes(job.status));
  const scheduledWindowJobs = catJobs.filter((job) =>
    job.technicianId &&
    job.scheduledDate &&
    job.scheduledDate >= boardDateFrom &&
    job.scheduledDate <= boardDateTo &&
    !['CANCELLED', 'INVOICED'].includes(job.status)
  );
  const availableTechCount = techPool.filter((tech) => tech.status === 'AVAILABLE').length;
  const slaRiskJobs = activeBoardJobs.filter((job) => job.slaBreached).length;

  const prevDay = () => setSelectedDate((current) => shiftISODate(current, -1));
  const nextDay = () => setSelectedDate((current) => shiftISODate(current, 1));

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col gap-4 animate-fade-in">
      <section className="section-shell space-y-4">
        <div className="page-header">
          <div>
            <div className="eyebrow">Live routing</div>
            <h1 className="page-title mt-2">Dispatch board</h1>
            <p className="page-subtitle max-w-2xl">
              Manage routing, balance field load, and move queued work onto technicians without leaving the board.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobilePreview(!showMobilePreview)}
              className={cn(
                'rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
                showMobilePreview ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50',
              )}
            >
              Tech preview
            </button>
            <Button variant="primary" size="sm" onClick={() => navigate('/jobs/new')}>
              New job
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active jobs', value: activeBoardJobs.length },
            { label: 'Scheduled in range', value: scheduledWindowJobs.length },
            { label: 'Available techs', value: availableTechCount },
            { label: 'SLA risk', value: slaRiskJobs },
          ].map((item) => (
            <div key={item.label} className="metric-tile">
              <div className="kpi-label">{item.label}</div>
              <div className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em] text-surface-900">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-surface-200 pt-4">
          <div className="flex items-center gap-1 rounded-xl border border-surface-200 bg-surface-50 p-1">
            <button onClick={prevDay} className="rounded-2xl p-2 text-surface-600 transition-colors hover:bg-white hover:text-surface-900">‹</button>
            <button onClick={() => setSelectedDate(today)} className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-surface-600 transition-colors hover:bg-white">
              Today
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-semibold text-surface-800 outline-none"
            />
            <button onClick={nextDay} className="rounded-2xl p-2 text-surface-600 transition-colors hover:bg-white hover:text-surface-900">›</button>
          </div>

          <Tabs
            variant="pill"
            active={viewMode}
            onChange={(value) => setViewMode(value as 'day' | 'week')}
            tabs={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }]}
          />

          <div className="rounded-[22px] border border-surface-200 bg-surface-50/80 px-4 py-3 text-xs text-surface-600">
            From <span className="font-semibold text-surface-900">{boardDateFrom}</span> to <span className="font-semibold text-surface-900">{boardDateTo}</span>
          </div>
        </div>
      </section>

      <section className="section-shell flex min-h-0 flex-1 overflow-hidden p-0">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-surface-200/70 bg-surface-50/50 p-3">
            <UnassignedPanel
              jobs={unassignedJobs}
              search={unassignedSearch}
              onSearch={setUnassignedSearch}
              priority={unassignedPriority}
              onPriorityChange={setUnassignedPriority}
              dateFrom={queueDateFrom}
              dateTo={queueDateTo}
              onDateFromChange={setQueueDateFrom}
              onDateToChange={setQueueDateTo}
              onApplyBoardRange={() => {
                setQueueDateFrom(boardDateFrom);
                setQueueDateTo(boardDateTo);
              }}
            />
          </div>

          <div className="flex-1 overflow-auto p-4">
            {viewMode === 'day' ? (
              <div className="flex gap-3 min-w-max">
                {techPool.map(tech => (
                  <TechColumn
                    key={tech.id}
                    tech={tech}
                    jobs={getJobsForTech(tech.id)}
                    onResize={handleResizeJob}
                  />
                ))}
              </div>
            ) : (
              // Week view
              <div className="space-y-4">
                {/* Week header */}
                <div className="sticky top-0 z-10 flex gap-2 bg-white pb-2">
                  <div className="w-32 flex-shrink-0" />
                  {weekDates.map(d => {
                    const dt = parseDateValue(d);
                    const isToday = d === today;
                    if (!dt) return null;
                    return (
                      <div key={d} className={cn('flex-1 text-center py-2 rounded-xl text-sm font-medium', isToday ? 'bg-brand-50 text-brand-700' : 'text-surface-600')}>
                        <div className="text-xs text-surface-400">{dt.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className={cn('text-base font-bold', isToday && 'text-brand-600')}>{dt.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Tech rows */}
                {techPool.map(tech => (
                  <div key={tech.id} className="flex gap-2">
                    {/* Tech label */}
                    <div className="w-32 flex-shrink-0 flex items-center gap-2">
                      <Avatar initials={tech.avatarInitials} color={tech.color} size="sm" />
                      <span className="text-xs font-medium text-surface-700 truncate">{tech.name.split(' ')[0]}</span>
                    </div>
                    {/* Day cells */}
                    {weekDates.map(date => (
                      <WeekTechCell
                        key={date}
                        tech={tech}
                        date={date}
                        jobs={catJobs.filter(j => j.technicianId === tech.id && j.scheduledDate === date)}
                        onResize={handleResizeJob}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {showMobilePreview && (
            <div className="w-80 flex-shrink-0 overflow-y-auto border-l border-surface-200/70 bg-surface-50/50">
              <MobilePreviewPanel date={selectedDate} cat={cat} />
            </div>
          )}

          <DragOverlay>
            {activeJob && (
              <div className="bg-white rounded-xl border-2 border-brand-400 shadow-2xl p-3 w-48 rotate-2 opacity-90">
                <div className="font-mono text-xs font-bold text-brand-600">{activeJob.jobNumber}</div>
                <div className="text-xs text-surface-700 truncate">{activeJob.customerName}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </section>
    </div>
  );
};

// ── Mobile Preview Panel ────────────────────────────────────────────────────

const MobilePreviewPanel: React.FC<{ date: string; cat: string }> = ({ date, cat }) => {
  const { jobs } = useJobStore();
  const techJobs = jobs.filter(j => j.scheduledDate === date && j.category === cat && j.technicianName);

  return (
    <div className="p-3">
      <div className="mb-3 text-sm font-semibold text-surface-700">Technician mobile preview</div>
      <div className="rounded-2xl bg-surface-900 p-3 text-white" style={{ minHeight: '500px' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold">FSM</div>
          <div className="text-xs text-white/50">
            {parseDateValue(date)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) || date}
          </div>
        </div>
        <div className="mb-2 text-xs uppercase tracking-wide text-white/50">Today's Jobs</div>
        {techJobs.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-xs">No jobs scheduled</div>
        ) : techJobs.slice(0, 5).map(j => (
          <div key={j.id} className="bg-white/10 rounded-xl p-3 mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-brand-300">{j.jobNumber}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{j.status}</span>
            </div>
            <div className="text-sm font-medium truncate">{j.customerName}</div>
            <div className="text-xs text-white/60 truncate">{j.serviceAddress.city}</div>
            <div className="text-xs text-white/40 mt-1 truncate">{j.description.substring(0, 50)}</div>
            {j.scheduledStart && (
              <div className="mt-1 text-xs text-brand-300">Start {j.scheduledStart}</div>
            )}
          </div>
        ))}
        {techJobs.length > 5 && (
          <div className="text-center text-xs text-white/40">+{techJobs.length - 5} more jobs</div>
        )}
      </div>
    </div>
  );
};

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
import { APP_LANGUAGE_LABELS, type AppLanguage } from '@/lib/app-language';
import type { Job, JobStatus, Technician } from '@/types';

const PRIORITY_FILTER_OPTIONS: Record<AppLanguage, Array<{ value: string; label: string }>> = {
  en: [
    { value: '', label: 'All priorities' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ],
  fr: [
    { value: '', label: 'Toutes les priorites' },
    { value: 'CRITICAL', label: 'Critique' },
    { value: 'HIGH', label: 'Haute' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'LOW', label: 'Basse' },
  ],
};

const DISPATCH_COPY = {
  en: {
    conflict: 'Conflict',
    viewDetails: 'View details →',
    dropJobHere: 'Drop job here',
    unassigned: 'Unassigned',
    filterPlaceholder: 'Filter...',
    useBoardRange: 'Use board range',
    noUnassignedJobs: 'No unassigned jobs',
    liveRouting: 'Live routing',
    dispatchBoard: 'Dispatch board',
    dispatchSubtitle: 'Manage routing, balance field load, and move queued work onto technicians without leaving the board.',
    techPreview: 'Tech preview',
    newJob: 'New job',
    activeJobs: 'Active jobs',
    scheduledInRange: 'Scheduled in range',
    availableTechs: 'Available techs',
    slaRisk: 'SLA risk',
    today: 'Today',
    day: 'Day',
    week: 'Week',
    from: 'From',
    to: 'to',
    mobilePreview: 'Technician mobile preview',
    todaysJobs: "Today's jobs",
    noJobsScheduled: 'No jobs scheduled',
    start: 'Start',
    moreJobs: (count: number) => `+${count} more jobs`,
    jobs: (count: number) => `${count} job${count !== 1 ? 's' : ''}`,
  },
  fr: {
    conflict: 'Conflit',
    viewDetails: 'Voir les details →',
    dropJobHere: 'Deposer ici',
    unassigned: 'Non assignes',
    filterPlaceholder: 'Filtrer...',
    useBoardRange: 'Utiliser la plage du tableau',
    noUnassignedJobs: 'Aucun travail non assigne',
    liveRouting: 'Routage en direct',
    dispatchBoard: 'Tableau de repartition',
    dispatchSubtitle: "Gerez le routage, equilibrez la charge terrain et deplacez le travail en file vers les techniciens sans quitter le tableau.",
    techPreview: 'Apercu tech',
    newJob: 'Nouveau travail',
    activeJobs: 'Travaux actifs',
    scheduledInRange: 'Planifies dans la plage',
    availableTechs: 'Techniciens disponibles',
    slaRisk: 'Risque SLA',
    today: "Aujourd'hui",
    day: 'Jour',
    week: 'Semaine',
    from: 'Du',
    to: 'au',
    mobilePreview: 'Apercu mobile technicien',
    todaysJobs: "Travaux d'aujourd'hui",
    noJobsScheduled: 'Aucun travail planifie',
    start: 'Debut',
    moreJobs: (count: number) => `+${count} autres travaux`,
    jobs: (count: number) => `${count} travail${count !== 1 ? 'x' : ''}`,
  },
} as const;

const STATUS_LABELS_BY_LANGUAGE: Record<AppLanguage, Record<JobStatus, string>> = {
  en: {
    NEW: 'New',
    SCHEDULED: 'Scheduled',
    DISPATCHED: 'Dispatched',
    EN_ROUTE: 'En Route',
    IN_PROGRESS: 'In Progress',
    WAITING_FOR_PARTS: 'Waiting for Parts',
    READY_FOR_SIGNATURE: 'Ready for Signature',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    BILLING_READY: 'Billing Ready',
    INVOICED: 'Invoiced',
  },
  fr: {
    NEW: 'Nouveau',
    SCHEDULED: 'Planifié',
    DISPATCHED: 'Réparti',
    EN_ROUTE: 'En route',
    IN_PROGRESS: 'En exécution',
    WAITING_FOR_PARTS: 'En attente de pièces',
    READY_FOR_SIGNATURE: 'Prêt pour signature',
    ON_HOLD: 'En attente',
    COMPLETED: 'Terminé',
    CANCELLED: 'Annulé',
    BILLING_READY: 'Prêt facturation',
    INVOICED: 'Facturé',
  },
};

const PRIORITY_LABELS_BY_LANGUAGE = {
  en: {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  },
  fr: {
    CRITICAL: 'Critique',
    HIGH: 'Haute',
    MEDIUM: 'Moyenne',
    LOW: 'Basse',
  },
} as const;

const WORKDAY_START_MINUTES = 6 * 60;
const WORKDAY_END_MINUTES = 20 * 60;
const RESIZE_STEP_MINUTES = 15;
const RESIZE_SNAP_PX = 12;
const TIMELINE_HOUR_WIDTH = 80; // px per hour in day-view timeline
const TECH_ROW_HEIGHT = 72;     // px per tech row

type TimeWindow = { start: number; end: number };
type ResizeEdge = 'start' | 'end';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapMinutes(value: number): number {
  return Math.round(value / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES;
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

function getJobDurationMinutes(job: Job): number {
  const existing = getJobTimeWindow(job);
  if (existing) {
    return Math.max(RESIZE_STEP_MINUTES, existing.end - existing.start);
  }

  return Math.max(
    RESIZE_STEP_MINUTES,
    Math.round(((job.estimatedDuration || 1) * 60) / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES,
  );
}

function getDragCenter(event: DragEndEvent): { x: number; y: number } | null {
  const rect = event.active.rect.current.translated ?? event.active.rect.current.initial;
  if (!rect) return null;

  return {
    x: rect.left + (rect.width / 2),
    y: rect.top + (rect.height / 2),
  };
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

function getWindowFromDayDrop(
  event: DragEndEvent,
  job: Job,
  workStartMin: number,
  workEndMin: number,
): TimeWindow | null {
  const center = getDragCenter(event);
  const rowRect = event.over?.rect;

  if (!center || !rowRect || rowRect.width <= 0) {
    return null;
  }

  const durationMinutes = getJobDurationMinutes(job);
  const ratio = clamp((center.x - rowRect.left) / rowRect.width, 0, 1);
  const rawStart = workStartMin + (ratio * (workEndMin - workStartMin));
  const start = snapMinutes(clamp(rawStart, workStartMin, workEndMin - durationMinutes));

  return {
    start,
    end: start + durationMinutes,
  };
}

function getWindowFromWeekDrop(
  event: DragEndEvent,
  job: Job,
  targetJobs: Job[],
  workStartMin: number,
  workEndMin: number,
): TimeWindow {
  const sortedJobs = sortJobsBySchedule(targetJobs);
  if (sortedJobs.length === 0) {
    const start = clamp(8 * 60, workStartMin, workEndMin - getJobDurationMinutes(job));
    return {
      start,
      end: start + getJobDurationMinutes(job),
    };
  }

  const center = getDragCenter(event);
  const cellRect = event.over?.rect;
  const durationMinutes = getJobDurationMinutes(job);

  if (!center || !cellRect || cellRect.height <= 0) {
    return getAutoScheduledWindow(job, sortedJobs);
  }

  const slotCount = sortedJobs.length + 1;
  const ratio = clamp((center.y - cellRect.top) / cellRect.height, 0, 0.9999);
  const slotIndex = Math.min(sortedJobs.length, Math.max(0, Math.floor(ratio * slotCount)));

  if (slotIndex === 0) {
    const nextWindow = getEditableJobTimeWindow(sortedJobs[0]);
    const start = clamp(nextWindow.start - durationMinutes, workStartMin, workEndMin - durationMinutes);
    return {
      start,
      end: start + durationMinutes,
    };
  }

  if (slotIndex >= sortedJobs.length) {
    return getAutoScheduledWindow(job, sortedJobs);
  }

  const previousWindow = getEditableJobTimeWindow(sortedJobs[slotIndex - 1]);
  const nextWindow = getEditableJobTimeWindow(sortedJobs[slotIndex]);
  const gapStart = previousWindow.end;
  const gapEnd = nextWindow.start;

  if (gapEnd - gapStart >= durationMinutes) {
    return {
      start: gapStart,
      end: gapStart + durationMinutes,
    };
  }

  const start = clamp(nextWindow.start - durationMinutes, workStartMin, workEndMin - durationMinutes);
  return {
    start,
    end: start + durationMinutes,
  };
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

function getDispatchLocale(language: AppLanguage) {
  return language === 'fr' ? 'fr-CA' : 'en-US';
}

function getDispatchStatusLabel(language: AppLanguage, status: Job['status']) {
  return STATUS_LABELS_BY_LANGUAGE[language][status] || status;
}

function getDispatchPriorityLabel(language: AppLanguage, priority: Job['priority']) {
  return PRIORITY_LABELS_BY_LANGUAGE[language][priority] || priority;
}

// ── Draggable Job Card ──────────────────────────────────────────────────────

const DraggableJobCard: React.FC<{ job: Job; compact?: boolean }> = ({ job, compact }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const navigate = useNavigate();
  const language = useUIStore((state) => state.language);
  const copy = DISPATCH_COPY[language];

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
            <StatusBadge status={job.status} label={getDispatchStatusLabel(language, job.status)} className="text-[10px] py-0 px-1.5" />
          </div>
          <div className="text-xs font-medium text-surface-800 truncate">{job.customerName}</div>
          {!compact && (
            <div className="text-[10px] text-surface-500 truncate mt-0.5">{job.description.substring(0, 50)}</div>
          )}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <PriorityBadge priority={job.priority} label={getDispatchPriorityLabel(language, job.priority)} className="text-[10px] py-0 px-1.5" />
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
        {copy.viewDetails}
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
  const language = useUIStore((state) => state.language);
  const copy = DISPATCH_COPY[language];
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
        isDragging ? 'opacity-30 shadow-lg' : hasConflict ? 'border-amber-300 shadow-card hover:shadow-card-hover' : 'bg-white border-surface-200 shadow-card hover:shadow-card-hover',
        compact ? 'p-2' : 'p-3',
      )}
    >
      <div {...listeners} className={cn('w-full cursor-grab active:cursor-grabbing', compact && 'pb-1')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold text-brand-600">{job.jobNumber}</span>
          <StatusBadge status={job.status} label={getDispatchStatusLabel(language, job.status)} className="text-[10px] py-0 px-1.5" />
          {hasConflict && (
            <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
              {copy.conflict}
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
                  aria-label={`${copy.start} ${job.jobNumber}`}
                  onPointerDown={(event) => startResize('start', event)}
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-brand-500/40 hover:bg-brand-500/55 transition-colors"
                />
                <button
                  type="button"
                  aria-label={`End ${job.jobNumber}`}
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
        {copy.viewDetails}
      </button>
    </div>
  );
};

// ── Timeline Job Block (horizontal time-row layout) ─────────────────────────

const TimelineJobBlock: React.FC<{
  job: Job;
  workStartMin: number;
  workEndMin: number;
  onResize: (job: Job, window: TimeWindow) => void;
}> = ({ job, workStartMin, workEndMin, onResize }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const language = useUIStore((state) => state.language);
  const [previewWindow, setPreviewWindow] = useState<TimeWindow | null>(null);
  const previewRef = useRef<TimeWindow | null>(null);

  const rangeMin = workEndMin - workStartMin;
  const activeWindow = previewWindow ?? getEditableJobTimeWindow(job);
  const canResize = Boolean(job.technicianId && job.scheduledDate);
  const durationH = Math.round(((activeWindow.end - activeWindow.start) / 60) * 10) / 10;

  const leftPct = Math.max(0, ((activeWindow.start - workStartMin) / rangeMin) * 100);
  const widthPct = Math.max(3, ((activeWindow.end - activeWindow.start) / rangeMin) * 100);

  const startResizeTimeline = (edge: ResizeEdge, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canResize) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const initialWindow = getEditableJobTimeWindow(job);
    previewRef.current = initialWindow;
    setPreviewWindow(initialWindow);
    const pxPerMin = TIMELINE_HOUR_WIDTH / 60;
    const onMove = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - startX) / pxPerMin / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES;
      let ns = initialWindow.start, ne = initialWindow.end;
      if (edge === 'start') ns = clamp(initialWindow.start + delta, workStartMin, initialWindow.end - RESIZE_STEP_MINUTES);
      else ne = clamp(initialWindow.end + delta, initialWindow.start + RESIZE_STEP_MINUTES, workEndMin);
      const nw = { start: ns, end: ne };
      previewRef.current = nw;
      setPreviewWindow(nw);
    };
    const finish = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      const final = previewRef.current ?? initialWindow;
      previewRef.current = null;
      setPreviewWindow(null);
      if (final.start !== initialWindow.start || final.end !== initialWindow.end) onResize(job, final);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: 4,
        bottom: 4,
        ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
      }}
      {...attributes}
      className={cn(
        'rounded-lg border cursor-grab active:cursor-grabbing select-none overflow-hidden',
        isDragging ? 'opacity-30 shadow-lg' : 'bg-brand-50 border-brand-200 shadow-sm hover:shadow-card-hover',
      )}
    >
      <div {...listeners} className="h-full px-2 py-1 overflow-hidden">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] font-bold text-brand-700 truncate">{job.jobNumber}</span>
          <StatusBadge status={job.status} label={STATUS_LABELS_BY_LANGUAGE[language][job.status]} className="text-[9px] py-0 px-1 flex-shrink-0" />
        </div>
        <div className="text-[10px] font-medium text-surface-800 truncate">{job.customerName}</div>
        <div className="text-[9px] text-surface-400">{minutesToTime(activeWindow.start)}–{minutesToTime(activeWindow.end)} · {durationH}h</div>
      </div>
      {canResize && (
        <>
          <button type="button" onPointerDown={(e) => startResizeTimeline('start', e)}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-brand-400/30 hover:bg-brand-400/50 transition-colors" />
          <button type="button" onPointerDown={(e) => startResizeTimeline('end', e)}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-brand-400/30 hover:bg-brand-400/50 transition-colors" />
        </>
      )}
    </div>
  );
};

// ── Tech Timeline Row (techs as rows, hours as columns) ──────────────────────

const TechLabelRow: React.FC<{
  tech: Technician;
  jobs: Job[];
}> = ({ tech, jobs }) => {
  const language = useUIStore((state) => state.language);
  const copy = DISPATCH_COPY[language];

  return (
    <div className="border-b border-surface-200 bg-surface-50 px-3 flex items-center gap-2" style={{ height: TECH_ROW_HEIGHT }}>
      <Avatar initials={tech.avatarInitials} color={tech.color} size="sm" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-surface-800 truncate">{tech.name}</div>
        <div className={cn('text-[10px]',
          tech.status === 'AVAILABLE' ? 'text-emerald-600' :
          tech.status === 'ON_JOB' ? 'text-brand-600' : 'text-amber-600'
        )}>
          {copy.jobs(jobs.length)}
        </div>
      </div>
    </div>
  );
};

const TechTimelineBand: React.FC<{
  tech: Technician;
  jobs: Job[];
  workStartMin: number;
  workEndMin: number;
  onResize: (job: Job, window: TimeWindow) => void;
}> = ({ tech, jobs, workStartMin, workEndMin, onResize }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `day:${tech.id}` });
  const language = useUIStore((state) => state.language);
  const copy = DISPATCH_COPY[language];
  const sortedJobs = useMemo(() => sortJobsBySchedule(jobs), [jobs]);
  const rangeH = (workEndMin - workStartMin) / 60;

  return (
    <div
      ref={setNodeRef}
      className={cn('relative border-b border-surface-200 transition-colors', isOver ? 'bg-brand-50' : 'bg-white')}
      style={{ height: TECH_ROW_HEIGHT, width: rangeH * TIMELINE_HOUR_WIDTH }}
    >
      {Array.from({ length: rangeH + 1 }).map((_, i) => (
        <div key={i} className="absolute top-0 bottom-0 border-l border-surface-100" style={{ left: i * TIMELINE_HOUR_WIDTH }} />
      ))}
      {sortedJobs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-surface-300">{copy.dropJobHere}</span>
        </div>
      )}
      {sortedJobs.map((job) => (
        <TimelineJobBlock key={job.id} job={job} workStartMin={workStartMin} workEndMin={workEndMin} onResize={onResize} />
      ))}
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
  const language = useUIStore((state) => state.language);
  const copy = DISPATCH_COPY[language];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="sticky top-0 z-10 mb-2 bg-surface-50/95 pb-2 backdrop-blur-sm">
        <div className="text-sm font-semibold text-surface-700 mb-1.5">{copy.unassigned} ({jobs.length})</div>
        <input
          className="w-full px-2.5 py-1.5 text-xs bg-surface-100 rounded-lg border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white placeholder-surface-400 transition-all"
          placeholder={copy.filterPlaceholder}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        <select
          className="mt-2 w-full px-2.5 py-1.5 text-xs bg-surface-100 rounded-lg border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white transition-all"
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
        >
          {PRIORITY_FILTER_OPTIONS[language].map((option) => (
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
          {copy.useBoardRange}
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto rounded-xl p-2 pr-1.5 space-y-2 transition-all',
          isOver ? 'bg-brand-50 border-2 border-brand-400 border-dashed' : 'bg-surface-50 border border-surface-200',
        )}
      >
        {jobs.length === 0 ? (
          <div className="h-20 flex items-center justify-center">
            <span className="text-xs text-surface-300">{copy.noUnassignedJobs}</span>
          </div>
        ) : jobs.map(j => <DraggableJobCard key={j.id} job={j} compact />)}
      </div>
    </div>
  );
};

// ── MAIN DISPATCH PAGE ──────────────────────────────────────────────────────

export const Dispatch: React.FC = () => {
  const { user } = useAuthStore();
  const { jobs, updateJob } = useJobStore();
  const technicians = useTechStore(s => s.technicians);
  const { toast, language, setLanguage, workStart, workEnd } = useUIStore();
  const navigate = useNavigate();
  const copy = DISPATCH_COPY[language];

  const today = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [unassignedPriority, setUnassignedPriority] = useState('');
  const [queueDateFrom, setQueueDateFrom] = useState('');
  const [queueDateTo, setQueueDateTo] = useState('');
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const techRailRef = useRef<HTMLDivElement | null>(null);
  const timelineRailRef = useRef<HTMLDivElement | null>(null);
  const dayScrollSourceRef = useRef<'tech' | 'timeline' | null>(null);

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
          j.id !== draggedJob.id &&
          j.technicianId === techId &&
          j.scheduledDate === targetDate &&
          !['CANCELLED', 'INVOICED'].includes(j.status)
        );
        const dropWindow = target[0] === 'day'
          ? getWindowFromDayDrop(event, draggedJob, wsMin, weMin)
          : getWindowFromWeekDrop(event, draggedJob, targetJobs, wsMin, weMin);
        const resolvedWindow = dropWindow ?? getAutoScheduledWindow(draggedJob, targetJobs);
        const scheduledStart = minutesToTime(resolvedWindow.start);
        const scheduledEnd = minutesToTime(resolvedWindow.end);
        const estimatedDuration = Math.round((((resolvedWindow.end - resolvedWindow.start) / 60) * 10)) / 10;

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

        updateJob(jobId, {
          technicianId: techId,
          technicianName: tech.name,
          scheduledDate: targetDate,
          scheduledStart,
          scheduledEnd,
          estimatedDuration,
          status: draggedJob.technicianId ? draggedJob.status : 'SCHEDULED',
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
  const wsMin = timeToMinutes(workStart) ?? WORKDAY_START_MINUTES;
  const weMin = timeToMinutes(workEnd) ?? WORKDAY_END_MINUTES;
  const timelineRangeH = (weMin - wsMin) / 60;
  const timelineHours = Array.from({ length: timelineRangeH + 1 }, (_, i) => wsMin / 60 + i);
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

  const syncDayRailScroll = (source: 'tech' | 'timeline') => (event: React.UIEvent<HTMLDivElement>) => {
    const target = source === 'tech' ? timelineRailRef.current : techRailRef.current;
    if (!target) return;
    if (dayScrollSourceRef.current && dayScrollSourceRef.current !== source) return;

    dayScrollSourceRef.current = source;
    target.scrollTop = event.currentTarget.scrollTop;

    window.requestAnimationFrame(() => {
      if (dayScrollSourceRef.current === source) {
        dayScrollSourceRef.current = null;
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col gap-4 animate-fade-in overflow-hidden">
      <section className="section-shell flex-shrink-0 space-y-4">
        <div className="page-header">
          <div>
            <div className="eyebrow">{copy.liveRouting}</div>
            <h1 className="page-title mt-2">{copy.dispatchBoard}</h1>
            <p className="page-subtitle max-w-2xl">
              {copy.dispatchSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-surface-200 bg-white p-1">
              {(['en', 'fr'] as AppLanguage[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLanguage(value)}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold uppercase leading-none tracking-[0.16em] transition-colors',
                    language === value ? 'bg-brand-50 text-brand-700' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800',
                  )}
                >
                  {APP_LANGUAGE_LABELS[value]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMobilePreview(!showMobilePreview)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase leading-none tracking-[0.16em] transition-colors',
                showMobilePreview ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50',
              )}
            >
              {copy.techPreview}
            </button>
            <Button variant="primary" size="sm" onClick={() => navigate('/jobs/new')}>
              {copy.newJob}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: copy.activeJobs, value: activeBoardJobs.length },
            { label: copy.scheduledInRange, value: scheduledWindowJobs.length },
            { label: copy.availableTechs, value: availableTechCount },
            { label: copy.slaRisk, value: slaRiskJobs },
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
              {copy.today}
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
            tabs={[{ id: 'day', label: copy.day }, { id: 'week', label: copy.week }]}
          />

          <div className="rounded-[22px] border border-surface-200 bg-surface-50/80 px-4 py-3 text-xs text-surface-600">
            {copy.from} <span className="font-semibold text-surface-900">{boardDateFrom}</span> {copy.to} <span className="font-semibold text-surface-900">{boardDateTo}</span>
          </div>
        </div>
      </section>

      <section className="section-shell min-h-0 flex flex-1 overflow-hidden p-0">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="w-72 min-h-0 flex-shrink-0 flex flex-col overflow-hidden border-r border-surface-200/70 bg-surface-50/50 p-3">
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

          <div className="min-w-0 flex-1 overflow-hidden p-4">
            {viewMode === 'day' ? (
                <div className="surface-card flex h-full min-h-0 overflow-hidden">
                  <div className="flex h-full min-h-0 w-44 flex-shrink-0 flex-col border-r border-surface-200 bg-surface-50">
                    <div className="flex h-10 items-center border-b border-surface-200 px-3 text-[10px] font-semibold uppercase tracking-wide text-surface-400">
                      Technician
                    </div>
                    <div
                      ref={techRailRef}
                      onScroll={syncDayRailScroll('tech')}
                      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
                    >
                      {techPool.map((tech) => (
                        <TechLabelRow key={tech.id} tech={tech} jobs={getJobsForTech(tech.id)} />
                      ))}
                    </div>
                  </div>

                  <div
                    ref={timelineRailRef}
                    onScroll={syncDayRailScroll('timeline')}
                    className="min-w-0 flex-1 overflow-auto"
                  >
                    <div className="min-w-max">
                      <div className="sticky top-0 z-20 flex border-b border-surface-200 bg-surface-50">
                        {timelineHours.slice(0, -1).map((h) => (
                          <div key={h} className="border-l border-surface-200 py-2 text-center text-[10px] font-medium text-surface-400" style={{ width: TIMELINE_HOUR_WIDTH }}>
                            {String(Math.floor(h)).padStart(2, '0')}:00
                          </div>
                        ))}
                      </div>

                      {techPool.map((tech) => (
                        <TechTimelineBand
                          key={tech.id}
                          tech={tech}
                          jobs={getJobsForTech(tech.id)}
                          workStartMin={wsMin}
                          workEndMin={weMin}
                          onResize={handleResizeJob}
                        />
                      ))}
                    </div>
                  </div>
                </div>
            ) : (
              // Week view
              <div className="h-full overflow-auto pr-1">
                <div className="space-y-4">
                {/* Week header */}
                <div className="sticky top-0 z-10 flex gap-2 bg-white pb-2">
                  <div className="sticky left-0 z-20 w-32 flex-shrink-0 bg-white" />
                  {weekDates.map(d => {
                    const dt = parseDateValue(d);
                    const isToday = d === today;
                    if (!dt) return null;
                    return (
                      <div key={d} className={cn('flex-1 text-center py-2 rounded-xl text-sm font-medium', isToday ? 'bg-brand-50 text-brand-700' : 'text-surface-600')}>
                        <div className="text-xs text-surface-400">{dt.toLocaleDateString(getDispatchLocale(language), { weekday: 'short' })}</div>
                        <div className={cn('text-base font-bold', isToday && 'text-brand-600')}>{dt.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Tech rows */}
                {techPool.map(tech => (
                  <div key={tech.id} className="flex gap-2">
                    {/* Tech label */}
                    <div className="sticky left-0 z-10 w-32 flex-shrink-0 flex items-center gap-2 bg-white">
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
  const language = useUIStore((state) => state.language);
  const copy = DISPATCH_COPY[language];
  const techJobs = jobs.filter(j => j.scheduledDate === date && j.category === cat && j.technicianName);

  return (
    <div className="p-3">
      <div className="mb-3 text-sm font-semibold text-surface-700">{copy.mobilePreview}</div>
      <div className="rounded-2xl bg-surface-950 p-3 text-white" style={{ minHeight: '500px' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold">FSM</div>
          <div className="text-xs text-white/50">
            {parseDateValue(date)?.toLocaleDateString(getDispatchLocale(language), { weekday: 'short', month: 'short', day: 'numeric' }) || date}
          </div>
        </div>
        <div className="mb-2 text-xs uppercase tracking-wide text-white/50">{copy.todaysJobs}</div>
        {techJobs.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-xs">{copy.noJobsScheduled}</div>
        ) : techJobs.slice(0, 5).map(j => (
          <div key={j.id} className="bg-white/10 rounded-xl p-3 mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-brand-300">{j.jobNumber}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{getDispatchStatusLabel(language, j.status)}</span>
            </div>
            <div className="text-sm font-medium truncate">{j.customerName}</div>
            <div className="text-xs text-white/60 truncate">{j.serviceAddress.city}</div>
            <div className="text-xs text-white/40 mt-1 truncate">{j.description.substring(0, 50)}</div>
            {j.scheduledStart && (
              <div className="mt-1 text-xs text-brand-300">{copy.start} {j.scheduledStart}</div>
            )}
          </div>
        ))}
        {techJobs.length > 5 && (
          <div className="text-center text-xs text-white/40">{copy.moreJobs(techJobs.length - 5)}</div>
        )}
      </div>
    </div>
  );
};

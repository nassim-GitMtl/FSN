import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function parseDateValue(dateStr?: string): Date | null {
  if (!dateStr) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toISODate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function shiftISODate(dateStr: string, days: number): string {
  const date = parseDateValue(dateStr) ?? new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function getWorkWeekDates(dateStr: string, days = 5): string[] {
  const date = parseDateValue(dateStr) ?? new Date();
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return toISODate(current);
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const parsed = parseDateValue(dateStr);
    if (!parsed) return dateStr;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
  } catch { return dateStr; }
}

export function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const parsed = parseDateValue(dateStr);
    if (!parsed) return dateStr;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
  } catch { return dateStr; }
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const parsed = parseDateValue(dateStr);
    if (!parsed) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(parsed);
  } catch { return dateStr; }
}

export function formatRelative(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = parseDateValue(dateStr);
    if (!d) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch { return dateStr; }
}

export function formatDuration(hours?: number): string {
  if (!hours) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const today = toISODate(new Date());
  return dateStr === today;
}

export function isPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr < toISODate(new Date());
}

export function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  SCHEDULED: 'Scheduled',
  DISPATCHED: 'Dispatched',
  EN_ROUTE: 'En Route',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  BILLING_READY: 'Billing Ready',
  INVOICED: 'Invoiced',
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  DISPATCHED: 'bg-cyan-100 text-cyan-700',
  EN_ROUTE: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-brand-100 text-brand-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  BILLING_READY: 'bg-cyan-100 text-cyan-700',
  INVOICED: 'bg-green-100 text-green-700',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  NEW: 'bg-slate-400',
  SCHEDULED: 'bg-blue-500',
  DISPATCHED: 'bg-cyan-500',
  EN_ROUTE: 'bg-amber-500',
  IN_PROGRESS: 'bg-brand-500',
  ON_HOLD: 'bg-orange-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
  BILLING_READY: 'bg-cyan-500',
  INVOICED: 'bg-green-600',
};

export const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-600 bg-red-50',
  HIGH: 'text-orange-600 bg-orange-50',
  MEDIUM: 'text-amber-600 bg-amber-50',
  LOW: 'text-slate-500 bg-slate-50',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  INSTALLATION: 'Installation',
  REPAIR: 'Repair',
  MAINTENANCE: 'Maintenance',
  INSPECTION: 'Inspection',
  WARRANTY_REPAIR: 'Warranty Repair',
  EMERGENCY: 'Emergency',
  PREVENTIVE_MAINTENANCE: 'Preventive Maintenance',
  DECOMMISSION: 'Decommission',
};

export const SERVICE_TYPE_COLORS: Record<string, string> = {
  INSTALLATION: 'bg-cyan-100 text-cyan-700',
  REPAIR: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-teal-100 text-teal-700',
  INSPECTION: 'bg-sky-100 text-sky-700',
  WARRANTY_REPAIR: 'bg-amber-100 text-amber-700',
  EMERGENCY: 'bg-red-100 text-red-700',
  PREVENTIVE_MAINTENANCE: 'bg-green-100 text-green-700',
  DECOMMISSION: 'bg-slate-100 text-slate-700',
};

export const TECH_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  ON_JOB: 'On Job',
  ON_BREAK: 'On Break',
  OFF_DUTY: 'Off Duty',
  UNAVAILABLE: 'Unavailable',
};

export const TECH_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'text-emerald-600',
  ON_JOB: 'text-brand-600',
  ON_BREAK: 'text-amber-600',
  OFF_DUTY: 'text-slate-400',
  UNAVAILABLE: 'text-red-500',
};

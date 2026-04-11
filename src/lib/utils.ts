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
  WAITING_FOR_PARTS: 'Waiting for Parts',
  READY_FOR_SIGNATURE: 'Ready for Signature',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  BILLING_READY: 'Billing Ready',
  INVOICED: 'Invoiced',
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
  SCHEDULED: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
  DISPATCHED: 'bg-[hsl(var(--info)/0.2)] text-[hsl(var(--info))]',
  EN_ROUTE: 'bg-[hsl(var(--info)/0.2)] text-[hsl(var(--info))]',
  IN_PROGRESS: 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]',
  WAITING_FOR_PARTS: 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
  READY_FOR_SIGNATURE: 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
  ON_HOLD: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  COMPLETED: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
  CANCELLED: 'bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]',
  BILLING_READY: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
  INVOICED: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  NEW: 'bg-[hsl(var(--muted-foreground))]',
  SCHEDULED: 'bg-[hsl(var(--secondary-foreground))]',
  DISPATCHED: 'bg-[hsl(var(--info))]',
  EN_ROUTE: 'bg-[hsl(var(--info))]',
  IN_PROGRESS: 'bg-[hsl(var(--primary))]',
  WAITING_FOR_PARTS: 'bg-[hsl(var(--warning))]',
  READY_FOR_SIGNATURE: 'bg-[hsl(var(--warning))]',
  ON_HOLD: 'bg-[hsl(var(--muted-foreground))]',
  COMPLETED: 'bg-[hsl(var(--success))]',
  CANCELLED: 'bg-[hsl(var(--destructive))]',
  BILLING_READY: 'bg-[hsl(var(--success))]',
  INVOICED: 'bg-[hsl(var(--success))]',
};

export const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]',
  HIGH: 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]',
  MEDIUM: 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
  LOW: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
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
  INSTALLATION: 'bg-[hsl(var(--info)/0.2)] text-[hsl(var(--info))]',
  REPAIR: 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]',
  MAINTENANCE: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
  INSPECTION: 'bg-[hsl(var(--info)/0.2)] text-[hsl(var(--info))]',
  WARRANTY_REPAIR: 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
  EMERGENCY: 'bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]',
  PREVENTIVE_MAINTENANCE: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
  DECOMMISSION: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
};

export const TECH_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  ON_JOB: 'On Job',
  ON_BREAK: 'On Break',
  OFF_DUTY: 'Off Duty',
  UNAVAILABLE: 'Unavailable',
};

export const TECH_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'text-[hsl(var(--success))]',
  ON_JOB: 'text-[hsl(var(--primary))]',
  ON_BREAK: 'text-[hsl(var(--warning))]',
  OFF_DUTY: 'text-[hsl(var(--muted-foreground))]',
  UNAVAILABLE: 'text-[hsl(var(--destructive))]',
};

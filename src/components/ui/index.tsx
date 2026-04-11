import React from 'react';
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS } from '@/lib/utils';
import type { JobStatus, Priority, ServiceType } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ children, color, className, dot }) => (
  <span className={cn('badge', color, className)}>
    {dot && <span className={cn('status-dot', color?.replace(/^bg-(\w+)-\d+.*$/, 'bg-$1-500'))} />}
    {children}
  </span>
);

export const StatusBadge: React.FC<{ status: JobStatus; className?: string; label?: string }> = ({ status, className, label }) => (
  <span className={cn('badge', STATUS_COLORS[status], className)}>
    {label || STATUS_LABELS[status] || status}
  </span>
);

export const PriorityBadge: React.FC<{ priority: Priority; className?: string; label?: string }> = ({ priority, className, label }) => (
  <span className={cn('badge', PRIORITY_COLORS[priority], className)}>
    {label || PRIORITY_LABELS[priority] || priority}
  </span>
);

export const ServiceTypeBadge: React.FC<{ type: ServiceType; className?: string; label?: string }> = ({ type, className, label }) => (
  <span className={cn('badge', SERVICE_TYPE_COLORS[type], className)}>
    {label || SERVICE_TYPE_LABELS[type] || type}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary', size = 'md', loading, icon, iconRight,
  children, className, disabled, ...props
}) => (
  <button
    className={cn(
      `btn-${size}`,
      `btn-${variant}`,
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <Spinner size={size === 'sm' ? 12 : 16} /> : icon}
    {children}
    {iconRight}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none">{icon}</span>}
        <input
          ref={ref}
          className={cn('input', icon && 'pl-9', iconRight && 'pr-9', error && 'border-red-400 focus:ring-red-400', className)}
          {...props}
        />
        {iconRight && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">{iconRight}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-surface-400">{hint}</p>}
    </div>
  )
);
Input.displayName = 'Input';

// ─────────────────────────────────────────────────────────────────────────────
// SELECT
// ─────────────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select ref={ref} className={cn('select', error && 'border-red-400', className)} {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';

// ─────────────────────────────────────────────────────────────────────────────
// TEXTAREA
// ─────────────────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <textarea ref={ref} className={cn('input resize-none', error && 'border-red-400', className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';

// ─────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  padding?: boolean;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, title, subtitle, actions, padding = true, hover }) => (
  <div className={cn('surface-card', hover && 'hover:shadow-card-hover transition-shadow cursor-pointer', className)}>
    {(title || subtitle || actions) && (
      <div className="flex items-start justify-between gap-4 border-b border-surface-100 px-5 py-4">
        <div>
          {title && <h3 className="text-base font-semibold text-surface-900">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-surface-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn(padding && 'p-5')}>{children}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const MODAL_SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = 'md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full animate-scale-in flex flex-col max-h-[90vh]', MODAL_SIZES[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
            <button onClick={onClose} className="text-surface-400 hover:text-surface-600 transition-colors p-1 rounded-lg hover:bg-surface-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-surface-100 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'line' | 'pill';
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, className, variant = 'line' }) => {
  if (variant === 'pill') {
    return (
      <div className={cn('flex gap-1 p-1 bg-surface-100 rounded-xl', className)}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              active === t.id
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            {t.icon}
            {t.label}
            {t.badge !== undefined && (
              <span className={cn('badge text-xs ml-0.5', active === t.id ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-600')}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('flex border-b border-surface-200 gap-1', className)}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
            active === t.id
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
          )}
        >
          {t.icon}
          {t.label}
          {t.badge !== undefined && (
            <span className={cn('badge', active === t.id ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-600')}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────────────────────

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg
    className={cn('animate-spin text-current', className)}
    width={size} height={size} viewBox="0 0 24 24" fill="none"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = '📋', title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <span className="text-5xl mb-4">{icon}</span>
    <h3 className="text-base font-semibold text-surface-700 mb-1">{title}</h3>
    {subtitle && <p className="text-sm text-surface-400 max-w-xs">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ALERT
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_STYLES = {
  info:    'bg-blue-50  border-blue-200  text-blue-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  danger:  'bg-red-50   border-red-200   text-red-800',
};

interface AlertProps {
  type?: keyof typeof ALERT_STYLES;
  children: React.ReactNode;
  className?: string;
  icon?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type = 'info', children, className, icon, dismissible, onDismiss }) => (
  <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', ALERT_STYLES[type], className)}>
    {icon && <span className="text-lg leading-none mt-0.5">{icon}</span>}
    <div className="flex-1">{children}</div>
    {dismissible && (
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity ml-2">✕</button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────────────────────

interface AvatarProps {
  initials: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const AVATAR_SIZES = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' };

export const Avatar: React.FC<AvatarProps> = ({ initials, color = 'bg-brand-500', size = 'md', className }) => (
  <div className={cn('flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0', AVATAR_SIZES[size], color, className)}>
    {initials}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse bg-surface-200 rounded-lg', className)} />
);

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const Divider: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <div className={cn('flex items-center gap-3 my-4', className)}>
    <div className="flex-1 border-t border-surface-200" />
    {label && <span className="text-xs text-surface-400 font-medium">{label}</span>}
    {label && <div className="flex-1 border-t border-surface-200" />}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP (simple hover)
// ─────────────────────────────────────────────────────────────────────────────

export const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="relative group inline-flex">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-surface-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
      {text}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ICON BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label?: string;
  variant?: 'ghost' | 'outline';
  size?: 'sm' | 'md';
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, label, variant = 'ghost', size = 'md', className, ...props }) => (
  <button
    className={cn(
      'rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      size === 'sm' ? 'p-1.5' : 'p-2',
      variant === 'ghost' ? 'text-surface-500 hover:text-surface-800 hover:bg-surface-100' : 'border border-surface-200 text-surface-600 hover:bg-surface-50',
      className
    )}
    title={label}
    {...props}
  >
    {icon}
  </button>
);

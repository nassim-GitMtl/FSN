import React from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const TOAST_STYLES = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600 text-white',
  warning: 'bg-brand-500 text-surface-950',
  info:    'bg-surface-950 text-white',
};

export const Toast: React.FC = () => {
  const { toasts, dismissToast } = useUIStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up max-w-sm',
            TOAST_STYLES[t.type]
          )}
        >
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-white/20 rounded-full text-xs font-bold">
            {ICONS[t.type]}
          </span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

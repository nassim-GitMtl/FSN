import React from 'react';
import { APP_THEME_LABELS } from '@/lib/app-theme';
import type { AppLanguage } from '@/lib/app-language';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="4.25" />
    <path d="M12 2.75v2.5M12 18.75v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.75 12h2.5M18.75 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path d="M20 14.2A7.5 7.5 0 1 1 9.8 4a6.75 6.75 0 1 0 10.2 10.2Z" />
  </svg>
);

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
  language?: AppLanguage;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, compact = false, language = 'en' }) => {
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = APP_THEME_LABELS[theme][language];
  const nextLabel = APP_THEME_LABELS[nextTheme][language];
  const Icon = theme === 'dark' ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={language === 'fr' ? `Passer au mode ${nextLabel.toLowerCase()}` : `Switch to ${nextLabel.toLowerCase()} mode`}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-surface-100 text-surface-700 transition-colors hover:bg-surface-50 hover:text-surface-900',
        compact ? 'h-11 px-3' : 'w-full px-4 py-3 text-sm font-semibold',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      <span className={cn('font-semibold', compact && 'hidden sm:inline')}>{label}</span>
    </button>
  );
};

export type AppTheme = 'light' | 'dark';

export const APP_THEME_LABELS: Record<AppTheme, { en: string; fr: string }> = {
  light: {
    en: 'Day',
    fr: 'Jour',
  },
  dark: {
    en: 'Night',
    fr: 'Nuit',
  },
};

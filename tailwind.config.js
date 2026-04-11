/** @type {import('tailwindcss').Config} */
const colorVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: colorVar('--color-brand-50'),
          100: colorVar('--color-brand-100'),
          200: colorVar('--color-brand-200'),
          300: colorVar('--color-brand-300'),
          400: colorVar('--color-brand-400'),
          500: colorVar('--color-brand-500'),
          600: colorVar('--color-brand-600'),
          700: colorVar('--color-brand-700'),
          800: colorVar('--color-brand-800'),
          900: colorVar('--color-brand-900'),
          950: colorVar('--color-brand-950'),
        },
        surface: {
          50: colorVar('--color-surface-50'),
          100: colorVar('--color-surface-100'),
          200: colorVar('--color-surface-200'),
          300: colorVar('--color-surface-300'),
          400: colorVar('--color-surface-400'),
          500: colorVar('--color-surface-500'),
          600: colorVar('--color-surface-600'),
          700: colorVar('--color-surface-700'),
          800: colorVar('--color-surface-800'),
          900: colorVar('--color-surface-900'),
          950: colorVar('--color-surface-950'),
        },
      },
      fontFamily: {
        sans: ['"Avenir Next"', '"IBM Plex Sans"', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 24px 80px -48px rgba(8, 17, 24, 0.45)',
        'glass-sm': '0 20px 50px -42px rgba(8, 17, 24, 0.38)',
        card: '0 20px 45px -34px rgba(12, 24, 32, 0.28), 0 10px 20px -18px rgba(12, 24, 32, 0.16)',
        'card-hover': '0 28px 55px -34px rgba(12, 24, 32, 0.34), 0 14px 26px -20px rgba(12, 24, 32, 0.2)',
        'inner-white': 'inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float-soft': 'floatSoft 7s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: 0, transform: 'translateX(16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
        floatSoft: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};

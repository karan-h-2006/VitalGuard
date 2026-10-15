import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#F8FAFC',
          dark: '#070A11',
          DEFAULT: '#F8FAFC',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#0D131F',
          DEFAULT: '#FFFFFF',
        },
        'surface-elevated': {
          light: '#F1F5F9',
          dark: '#131B2E',
          DEFAULT: '#F1F5F9',
        },
        hairline: {
          light: '#E2E8F0',
          dark: '#1E293B',
          DEFAULT: '#E2E8F0',
        },
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          DEFAULT: '#0284C7',
        },
        teal: {
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          DEFAULT: '#0D9488',
        },
        severity: {
          normal: {
            bg: '#ECFDF5',
            border: '#A7F3D0',
            text: '#065F46',
            dot: '#10B981',
          },
          watch: {
            bg: '#EFF6FF',
            border: '#BFDBFE',
            text: '#1E40AF',
            dot: '#3B82F6',
          },
          warning: {
            bg: '#FFFBEB',
            border: '#FDE68A',
            text: '#92400E',
            dot: '#F59E0B',
          },
          critical: {
            bg: '#FEF2F2',
            border: '#FECACA',
            text: '#991B1B',
            dot: '#EF4444',
          },
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        hairline: '0 0 0 1px rgba(226, 232, 240, 1)',
        'hairline-dark': '0 0 0 1px rgba(30, 41, 59, 1)',
        glow: '0 0 50px -10px rgba(2, 132, 199, 0.2)',
        'glow-teal': '0 0 50px -10px rgba(13, 148, 136, 0.2)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        'card-hover':
          '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0%)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'marquee-reverse': 'marquee-reverse 30s linear infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;

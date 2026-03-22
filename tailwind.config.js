/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-elevated': 'hsl(var(--surface-elevated))',
        'surface-border': 'hsl(var(--surface-border))',
        primary: 'hsl(var(--primary))',
        'primary-muted': 'hsl(var(--primary-muted))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        foreground: 'hsl(var(--foreground))',
        'foreground-muted': 'hsl(var(--foreground-muted))',
        success: 'hsl(var(--success))',
        'success-bg': 'hsl(var(--success-bg))',
        warning: 'hsl(var(--warning))',
        'warning-bg': 'hsl(var(--warning-bg))',
        danger: 'hsl(var(--danger))',
        'danger-bg': 'hsl(var(--danger-bg))',
        info: 'hsl(var(--info))',
        'info-bg': 'hsl(var(--info-bg))',
        border: 'hsl(var(--border))',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-highlight': 'pulseHighlight 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseHighlight: {
          '0%': { backgroundColor: 'hsl(217 90% 65% / 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};

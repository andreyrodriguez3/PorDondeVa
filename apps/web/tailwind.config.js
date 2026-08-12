/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The company's brand color is injected as a CSS var per request (see
        // (public)/layout.tsx); it defaults to TuBus's own indigo everywhere else.
        brand: {
          DEFAULT: 'var(--brand-color, #3d5afe)',
          fg: 'var(--brand-color-fg, #ffffff)',
        },
        ink: {
          DEFAULT: '#0f1115',
          secondary: '#565d6b',
          tertiary: '#8991a0',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f5f6f8',
          tertiary: '#eceef2',
        },
        line: {
          DEFAULT: '#e4e6ea',
          strong: '#d3d6dc',
        },
        live: { DEFAULT: '#1fb15c', bg: '#e7f8ee' },
        stale: { DEFAULT: '#d98c14', bg: '#fdf3e1' },
        offline: { DEFAULT: '#8991a0', bg: '#f0f1f3' },
        danger: { DEFAULT: '#e0483e', bg: '#fdecea' },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing }] — tracking loosens as size shrinks,
        // leading tightens as size grows (apple-design §15).
        display: ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.022em', fontWeight: '650' }],
        'title-lg': [
          '1.375rem',
          { lineHeight: '1.2', letterSpacing: '-0.014em', fontWeight: '650' },
        ],
        title: ['1.0625rem', { lineHeight: '1.3', letterSpacing: '-0.008em', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.45', letterSpacing: '-0.002em' }],
        callout: ['0.875rem', { lineHeight: '1.4', letterSpacing: '0' }],
        caption: ['0.8125rem', { lineHeight: '1.35', letterSpacing: '0.001em' }],
        micro: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '26px',
      },
      boxShadow: {
        'elevate-1': '0 1px 2px rgba(15, 17, 21, 0.04), 0 1px 1px rgba(15, 17, 21, 0.03)',
        'elevate-2': '0 4px 16px rgba(15, 17, 21, 0.08), 0 1px 2px rgba(15, 17, 21, 0.04)',
        'elevate-3': '0 12px 32px rgba(15, 17, 21, 0.14), 0 2px 6px rgba(15, 17, 21, 0.06)',
        glow: '0 0 0 4px var(--brand-glow, rgba(61, 90, 254, 0.16))',
      },
      backdropBlur: {
        chrome: '20px',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.55' },
          '70%': { transform: 'scale(1.9)', opacity: '0' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

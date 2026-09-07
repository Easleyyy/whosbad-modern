/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBF7EF',
        ink: {
          DEFAULT: '#281E16',
          55: 'rgba(40,30,22,.55)',
          45: 'rgba(40,30,22,.45)',
          40: 'rgba(40,30,22,.4)',
          30: 'rgba(40,30,22,.3)',
          rule: 'rgba(40,30,22,.2)',
          dot: 'rgba(40,30,22,.24)',
          hairline: 'rgba(40,30,22,.14)',
        },
        alert: 'oklch(0.55 0.16 28)',
        gold: 'oklch(0.78 0.16 92)',
        mid: 'oklch(0.5 0.12 72)',
        ok: 'oklch(0.4 0.1 145)',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { label: '.12em', kpi: '.1em' },
      boxShadow: { bar: '0 6px 18px rgba(40,30,22,.2)' },
    },
  },
  plugins: [],
};

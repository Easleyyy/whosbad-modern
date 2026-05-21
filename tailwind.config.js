/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50: '#EDEAFF', 100: '#D5CFFF', 500: '#6B62D9', 600: '#534AB7', 700: '#3C3489', 900: '#1A1560' },
        teal: { 400: '#2DD4BF', 500: '#14B8A6', 600: '#0F6E56' },
        success: { 100: '#C0DD97', 500: '#4CAF50', 600: '#3B6D11', 800: '#27500A' },
        warning: { 100: '#FAC775', 500: '#FF9800', 600: '#854F0B', 800: '#633806' },
        danger: { 100: '#F7C1C1', 500: '#EF4444', 600: '#A32D2D', 800: '#791F1F' },
        surface: { 50: '#F8F7FF', 100: '#F0EEFF', 800: '#1A1730', 900: '#0F0F1A', 950: '#080812' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

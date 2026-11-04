/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#14243A',
          hover: '#1E3557',
          container: '#14243A',
          on: '#FFFFFF',
          'on-container': '#7C8BA6',
        },
        secondary: {
          DEFAULT: '#0051D5',
          hover: '#316BF3',
          container: '#DBEAFE',
          fixed: '#DBE1FF',
          'on-fixed': '#00174B',
          on: '#FFFFFF',
        },
        surface: {
          DEFAULT: '#FAF8FF',
          canvas: '#FAF8FF',
          lowest: '#FFFFFF',
          low: '#F2F3FF',
          container: '#EAEDFF',
          high: '#E2E7FF',
          highest: '#DAE2FD',
        },
        'on-surface': {
          DEFAULT: '#131B2E',
          variant: '#44474D',
          muted: '#64748B',
        },
        outline: {
          DEFAULT: '#75777D',
          variant: '#C5C6CD',
          subtle: '#E2E8F0',
        },
        success: {
          DEFAULT: '#16A34A',
          container: '#DCFCE7',
          on: '#FFFFFF',
          border: '#BBF7D0',
        },
        warning: {
          DEFAULT: '#F59E0B',
          container: '#FEF3C7',
          on: '#FFFFFF',
          border: '#FDE68A',
        },
        error: {
          DEFAULT: '#BA1A1A',
          alt: '#DC2626',
          container: '#FFDAD6',
          'container-subtle': '#FEE2E2',
          on: '#FFFFFF',
          border: '#FECACA',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

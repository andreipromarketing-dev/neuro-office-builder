/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MD3 Color Tokens as Tailwind colors
        primary: 'var(--md-sys-color-primary)',
        'on-primary': 'var(--md-sys-color-on-primary)',
        'primary-container': 'var(--md-sys-color-primary-container)',
        'on-primary-container': 'var(--md-sys-color-on-primary-container)',

        secondary: 'var(--md-sys-color-secondary)',
        'on-secondary': 'var(--md-sys-color-on-secondary)',
        'secondary-container': 'var(--md-sys-color-secondary-container)',
        'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',

        tertiary: 'var(--md-sys-color-tertiary)',
        'on-tertiary': 'var(--md-sys-color-on-tertiary)',
        'tertiary-container': 'var(--md-sys-color-tertiary-container)',
        'on-tertiary-container': 'var(--md-sys-color-on-tertiary-container)',

        error: 'var(--md-sys-color-error)',
        'on-error': 'var(--md-sys-color-on-error)',
        'error-container': 'var(--md-sys-color-error-container)',
        'on-error-container': 'var(--md-sys-color-on-error-container)',

        surface: 'var(--md-sys-color-surface)',
        'on-surface': 'var(--md-sys-color-on-surface)',
        'on-surface-variant': 'var(--md-sys-color-on-surface-variant)',

        'surface-container-lowest': 'var(--md-sys-color-surface-container-lowest)',
        'surface-container-low': 'var(--md-sys-color-surface-container-low)',
        'surface-container': 'var(--md-sys-color-surface-container)',
        'surface-container-high': 'var(--md-sys-color-surface-container-high)',
        'surface-container-highest': 'var(--md-sys-color-surface-container-highest)',

        'surface-dim': 'var(--md-sys-color-surface-dim)',
        'surface-bright': 'var(--md-sys-color-surface-bright)',

        outline: 'var(--md-sys-color-outline)',
        'outline-variant': 'var(--md-sys-color-outline-variant)',

        'inverse-surface': 'var(--md-sys-color-inverse-surface)',
        'inverse-on-surface': 'var(--md-sys-color-inverse-on-surface)',
        'inverse-primary': 'var(--md-sys-color-inverse-primary)',

        // Status colors (legacy)
        'status-green': '#3FB950',
        'status-orange': '#D29922',
        'status-red': '#F85149',
      },
      borderRadius: {
        'none': 'var(--md-sys-shape-corner-none)',
        'xs': 'var(--md-sys-shape-corner-extra-small)',
        'sm': 'var(--md-sys-shape-corner-small)',
        'md': 'var(--md-sys-shape-corner-medium)',
        'lg': 'var(--md-sys-shape-corner-large)',
        'xl': 'var(--md-sys-shape-corner-extra-large)',
        'full': 'var(--md-sys-shape-corner-full)',
      },
      transitionDuration: {
        'short-1': 'var(--md-sys-motion-duration-short-1)',
        'short-2': 'var(--md-sys-motion-duration-short-2)',
        'medium-1': 'var(--md-sys-motion-duration-medium-1)',
        'medium-2': 'var(--md-sys-motion-duration-medium-2)',
        'long-1': 'var(--md-sys-motion-duration-long-1)',
        'long-2': 'var(--md-sys-motion-duration-long-2)',
      },
      transitionTimingFunction: {
        'standard': 'var(--md-sys-motion-easing-standard)',
        'emphasized': 'var(--md-sys-motion-easing-emphasized)',
        'emphasized-decelerate': 'var(--md-sys-motion-easing-emphasized-decelerate)',
        'emphasized-accelerate': 'var(--md-sys-motion-easing-emphasized-accelerate)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.2s var(--md-sys-motion-easing-standard)',
        'slideIn': 'slideIn 0.3s var(--md-sys-motion-easing-emphasized-decelerate)',
        'pulse': 'pulse 1.5s var(--md-sys-motion-easing-standard) infinite',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          'from': { transform: 'translateX(-20px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        spin: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
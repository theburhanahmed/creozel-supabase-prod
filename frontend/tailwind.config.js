/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // iOS 18 Color System
        ios: {
          blue: {
            DEFAULT: '#007AFF',
            light: '#64D2FF',
          },
          cyan: '#64D2FF',
          purple: {
            DEFAULT: '#BF5AF2',
            light: '#DA8FFF',
          },
          pink: '#FF2D55',
          green: {
            DEFAULT: '#32D74B',
            light: '#64FFDA',
          },
          teal: '#64FFDA',
          orange: '#FF9F0A',
          red: '#FF3B30',
          gray: {
            50: '#F5F5F7',
            100: '#E5E5EA',
            200: '#D1D1D6',
            300: '#C7C7CC',
            400: '#AEAEB2',
            500: '#8E8E93',
            600: '#636366',
            700: '#48484A',
            800: '#3A3A3C',
            900: '#2C2C2E',
            950: '#1C1C1E',
          },
        },
        primary: {
          50: '#E6FFF5',
          100: '#B3FFE0',
          200: '#80FFCC',
          300: '#4DFFB8',
          400: '#32D74B',
          500: '#30D158',
          600: '#28C148',
          700: '#20A138',
          800: '#188128',
          900: '#106118',
        },
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin-slow 10s linear infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'depth-reveal': 'depth-reveal 0.6s cubic-bezier(0.165, 0.84, 0.44, 1) forwards',
        'glass-shine': 'glass-shine 3s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 0.6s ease-in-out',
        'parallax-float': 'parallax-float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.85, transform: 'scale(0.98)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(1.02)', opacity: 0.95 },
        },
        'depth-reveal': {
          from: { opacity: 0, transform: 'translateY(20px) scale(0.98)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        'glass-shine': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        'parallax-float': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(2px, -2px)' },
          '75%': { transform: 'translate(-2px, 2px)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(63, 224, 165, 0.3)',
        'glow-md': '0 0 20px rgba(63, 224, 165, 0.4)',
        'glow-lg': '0 0 30px rgba(63, 224, 165, 0.5)',
        'ios-sm': '0 1px 3px rgba(0, 0, 0, 0.05)',
        'ios-md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'ios-lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'ios-xl': '0 16px 48px rgba(0, 0, 0, 0.16)',
        'neon-blue': '0 0 20px rgba(0, 122, 255, 0.5)',
        'neon-purple': '0 0 20px rgba(191, 90, 242, 0.5)',
        'neon-green': '0 0 20px rgba(50, 215, 75, 0.5)',
      },
      backdropBlur: {
        'xs': '2px',
        'ios': '40px',
        'ios-heavy': '60px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'out-quart': 'cubic-bezier(0.165, 0.84, 0.44, 1)',
        'in-out-quart': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

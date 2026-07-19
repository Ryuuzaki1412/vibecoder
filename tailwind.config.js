/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ========== Claude-inspired palette ==========
        // Canvas
        parchment: {
          50: "#fafaf6",
          100: "#f5f4ed",   // primary canvas — Claude's signature
          200: "#ede9dd",
          300: "#e0dac9",
          400: "#cfc7af",
        },
        // Terracotta accent (Claude's signature warmth)
        clay: {
          50:  "#fbeee6",
          100: "#f7decf",
          200: "#f1c5a9",
          300: "#e6a47e",
          400: "#d97757",   // mid
          500: "#c96442",   // primary accent
          600: "#b1532f",
          700: "#8b3a1f",
          800: "#5e2614",
        },
        // Warm neutrals (each gray has a yellow-brown undertone)
        ink: {
          50:  "#f5f3ee",
          100: "#ebe7dd",
          200: "#d8d3c5",
          300: "#b8b2a3",
          400: "#8a8478",
          500: "#5e5a51",
          600: "#3d3a32",
          700: "#262420",
          800: "#1a1a1a",
          900: "#0f0f0e",
        },
        // Functional accents (muted, paper-feel)
        sage: {
          400: "#7a9678",
          500: "#5d7e5a",
          600: "#476047",
        },
        rust: {
          500: "#b53333",
          600: "#8e2626",
        },
        sky: {
          500: "#3898ec",
          600: "#2c7bc4",
        },
        amber: {
          500: "#c89b3c",
          600: "#9e7a2c",
        },
      },
      fontFamily: {
        serif: ['Georgia', '"Times New Roman"', 'Times', 'serif'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Courier New"',
          'monospace',
        ],
      },
      fontSize: {
        // typographic scale — generous, like Claude
        'display': ['32px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'h1':      ['24px', { lineHeight: '1.20', letterSpacing: '-0.01em' }],
        'h2':      ['18px', { lineHeight: '1.25', letterSpacing: '-0.005em' }],
        'body':    ['14px', { lineHeight: '1.55' }],
        'small':   ['12px', { lineHeight: '1.45' }],
        'tiny':    ['11px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        'paper': '0 1px 2px rgba(60, 50, 30, 0.04), 0 4px 12px rgba(60, 50, 30, 0.05)',
        'paper-lg': '0 4px 16px rgba(60, 50, 30, 0.08), 0 12px 32px rgba(60, 50, 30, 0.06)',
        'fab': '0 6px 20px rgba(201, 100, 66, 0.30), 0 2px 6px rgba(60, 50, 30, 0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-up': 'slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'thinking': 'thinking 1.4s infinite',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px) scale(0.98)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        thinking: {
          '0%, 20%': { content: '"●○○"' },
          '40%':     { content: '"●●○"' },
          '60%, 100%': { content: '"●●●"' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
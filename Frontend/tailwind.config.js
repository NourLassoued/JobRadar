/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        indigo: { 600: '#4F46E5', 700: '#3C3489' },
        coral: { 500: '#F97066', 600: '#D85A30', 800: '#712B13' },
        emerald: { 500: '#10B981', 700: '#0F6E56', 800: '#085041' },
        amber: { 500: '#F59E0B', 600: '#BA7517', 800: '#633806' },
        ink: '#111827',
        muted: '#6B7280',
        mist: '#F9FAFB',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '10px',
      },
    },
  },
  plugins: [],
};
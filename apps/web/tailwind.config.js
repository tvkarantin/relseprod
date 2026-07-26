/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0c10',
        darkCard: '#13141a',
        darkBorder: '#1f232b',
        accentBlue: '#3b82f6',
      },
    },
  },
  plugins: [],
}

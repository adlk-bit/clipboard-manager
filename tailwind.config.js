/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#edf8f1',
          100: '#d5efdf',
          200: '#b1dfc6',
          300: '#85cda7',
          400: '#59b78a',
          500: '#247955',
          600: '#176448',
          700: '#18563e',
          800: '#194a38',
          900: '#183f31',
        }
      }
    }
  },
  plugins: []
}

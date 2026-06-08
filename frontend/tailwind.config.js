/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cora: {
          50:  '#f0f4ff',
          100: '#dce6ff',
          500: '#3b5fc0',
          600: '#2d4fa8',
          700: '#1e3a8a',
          800: '#162c6d',
          900: '#0f1f50'
        }
      }
    }
  },
  plugins: []
};

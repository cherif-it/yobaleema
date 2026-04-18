/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brown: { DEFAULT:'#8B3A00', mid:'#A34800', light:'#C8630A', pale:'#F0D5B8', ultra:'#FAF0E6' },
        yoba:  { gray:'#E8E6E2', 'gray-mid':'#C8C5BF', 'gray-dark':'#4A4740', charcoal:'#1E1C1A', white:'#FAFAF8' },
      },
      fontFamily: {
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        sans:      ['"Barlow"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brown':   '0 4px 20px rgba(139,58,0,0.25)',
        'brown-lg':'0 8px 32px rgba(139,58,0,0.35)',
        'card':    '0 8px 32px rgba(30,28,26,0.08)',
        'card-lg': '0 20px 60px rgba(30,28,26,0.15)',
        'phone':   '0 32px 80px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}

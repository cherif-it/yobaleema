/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brown: {
          DEFAULT: '#8B3A00',
          mid:    '#A34800',
          light:  '#C8630A',
          pale:   '#F0D5B8',
          ultra:  '#FAF0E6',
        },
        yoba: {
          gray:    '#E8E6E2',
          'gray-mid': '#C8C5BF',
          'gray-dark': '#4A4740',
          charcoal: '#1E1C1A',
          white:   '#FAFAF8',
        },
      },
      fontFamily: {
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['"Barlow"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
      },
      boxShadow: {
        'brown':   '0 4px 20px rgba(139,58,0,0.25)',
        'brown-lg':'0 8px 32px rgba(139,58,0,0.35)',
        'card':    '0 8px 32px rgba(30,28,26,0.08)',
        'card-lg': '0 20px 60px rgba(30,28,26,0.15)',
        'phone':   '0 32px 80px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.05)',
      },
      borderRadius: {
        'xl':  '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      animation: {
        'float-a':  'floatA 6s ease-in-out infinite',
        'float-b':  'floatB 7.5s ease-in-out infinite',
        'blink':    'blink 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards',
      },
      keyframes: {
        floatA: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        floatB: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(8px)'  } },
        blink:  { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
        slideUp:{ '0%': { opacity: 0, transform: 'translateY(20px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

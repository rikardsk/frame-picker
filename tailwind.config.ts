import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#090910',
        surface: {
          DEFAULT: '#12121F',
          card: '#181829',
          elevated: '#212136',
          hover: '#292942',
        },
        border: {
          subtle: '#282842',
          highlight: '#3B3B5C',
        },
        cinema: {
          primary: '#0F0F23',
          secondary: '#1E1B4B',
          accent: '#E11D48',
          accentHover: '#BE123C',
          accentGlow: 'rgba(225, 29, 72, 0.35)',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['"Open Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

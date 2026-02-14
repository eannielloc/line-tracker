import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { 900: '#0a0a0f', 800: '#111118', 700: '#1a1a24' },
      },
    },
  },
  plugins: [],
};
export default config;

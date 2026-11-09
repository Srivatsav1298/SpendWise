/** Scandinavian-minimal palette: warm neutrals, one restrained fjord-teal accent. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F6F3', surface: '#FFFFFF', line: '#E7E4DD', ink: '#1B1B19', muted: '#66655E',
        accent: { DEFAULT: '#0F5C5A', hover: '#0B4745', soft: '#E3F0EF' },
        ok: { DEFAULT: '#1F6B3A', soft: '#E4F1E8' }, warn: { DEFAULT: '#8A5A00', soft: '#FBF0D9' }, bad: { DEFAULT: '#A32A2A', soft: '#F8E4E2' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};

/** Design tokens: warm neutral Scandinavian fintech. 8pt spacing grid. */
export const colors = {
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E7E4DD',
  text: '#1B1B19',
  textMuted: '#6B6A63',
  accent: '#0F5C5A',
  accentText: '#FFFFFF',
  accentSoft: '#E3EFEE',
  danger: '#9B2C2C',
  dangerSoft: '#F8E8E6',
  warning: '#8A5A00',
  warningSoft: '#FBF0D9',
  success: '#2F6B3A',
  successSoft: '#E4F1E6',
  info: '#2F4F7A',
  infoSoft: '#E6ECF5',
  neutralSoft: '#EEECE6',
  overlay: 'rgba(27,27,25,0.4)',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const hairline = 1;

export const type = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
};

/** Minimum touch target (iOS HIG / Material). */
export const MIN_TOUCH = 48;

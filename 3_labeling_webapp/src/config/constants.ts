export const LABELS = ['normal', 'warning', 'critical'] as const;

export const LABEL_COLORS: Record<string, string> = {
  normal: '#4caf50',
  warning: '#ff9800',
  critical: '#f44336',
};

export const REFERENCE_CURVE = [
  { t: 0, flow: 0 },
  { t: 0.55, flow: 2.91 },
  { t: 1.82, flow: 7.45 },
  { t: 3.47, flow: 12 },
  { t: 4.56, flow: 15.82 },
  { t: 5.65, flow: 20.18 },
  { t: 6.38, flow: 23.64 },
  { t: 7.48, flow: 27.27 },
  { t: 9.12, flow: 30.55 },
  { t: 11.85, flow: 31.45 },
  { t: 14.59, flow: 30.91 },
  { t: 16.96, flow: 29.27 },
  { t: 18.42, flow: 25.82 },
  { t: 18.97, flow: 22.36 },
  { t: 19.7, flow: 19.27 },
  { t: 20.24, flow: 16.73 },
  { t: 20.79, flow: 14 },
  { t: 21.52, flow: 11.27 },
  { t: 22.25, flow: 8.36 },
  { t: 23.16, flow: 6 },
  { t: 23.89, flow: 3.64 },
  { t: 24.62, flow: 1.82 },
  { t: 26.08, flow: 0.55 },
  { t: 26.08, flow: 0 },
];

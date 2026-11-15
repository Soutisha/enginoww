/**
 * Recharts draws SVG attributes, which don't reliably resolve CSS variables, so the
 * chart palette is mirrored here as hex. Keep in sync with the tokens in globals.css.
 */
export const chartColors = {
  signal: '#8b7cff',
  cyan: '#3dd6f2',
  positive: '#2fd9a0',
  negative: '#ff6b8a',
  warning: '#f7b955',
  grid: '#1f2433',
  axis: '#6b7390',
} as const;

/** Funnel / categorical ramp, strongest first. */
export const rampColors = ['#8b7cff', '#7a91ff', '#5fb0ff', '#3dd6f2', '#2fd9a0'];

export const axisProps = {
  stroke: chartColors.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: '#171b27',
    border: '1px solid #2a3042',
    borderRadius: 10,
    fontSize: 12,
    color: '#e8ebf2',
    boxShadow: '0 12px 32px -12px rgba(0,0,0,0.7)',
  },
  labelStyle: { color: '#9aa3bb', marginBottom: 4 },
  itemStyle: { color: '#e8ebf2' },
  cursor: { stroke: '#2a3042' },
} as const;

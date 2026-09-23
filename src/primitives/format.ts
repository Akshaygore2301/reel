/** A duration the way the mono counters show it: 4ns, 90µs, 840ms, 4.2s, 3.5min. */
export function formatMs(ms: number): string {
  if (ms === 0) return '0ms';
  if (ms < 0.001) return `${Math.max(1, Math.round(ms * 1e6))}ns`;
  if (ms < 1) return `${Math.round(ms * 1000)}µs`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

export function formatPhaseLabel(major?: string, sub?: string): string {
  const m = major ?? 'unknown';
  const s = sub ?? 'unknown';
  return `${m} / ${s}`;
}

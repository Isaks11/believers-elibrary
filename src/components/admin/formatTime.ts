/**
 * Small relative-time helper for the admin UI (audit trail, revisions).
 * Hand-rolled so the CMS components stay dependency-free and testable.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  const diff = Date.now() - ms;
  if (diff < 0) return 'in the future';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

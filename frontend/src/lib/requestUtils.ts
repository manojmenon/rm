/**
 * Shared helpers for product creation/deletion request lists and pending counts.
 * Used by Nav badge, Dashboard, Admin page, and admin request queue so counts stay consistent.
 */

export type RequestWithStatus = { status?: string; Status?: string };

/** Normalize API response to an array of request-like objects (handles raw array or wrapped shapes). */
export function toRequestList(data: unknown): RequestWithStatus[] {
  if (Array.isArray(data)) return data as RequestWithStatus[];
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as RequestWithStatus[];
    if (Array.isArray(o.data)) return o.data as RequestWithStatus[];
    if (Array.isArray(o.results)) return o.results as RequestWithStatus[];
    if ('status' in o || 'Status' in o) return [o as RequestWithStatus];
  }
  return [];
}

/** True if the request's status is pending (case-insensitive; checks both status and Status). */
export function isPendingStatus(r: RequestWithStatus): boolean {
  const s = (r?.status ?? (r as { Status?: string }).Status ?? '').toString().trim().toLowerCase();
  return s === 'pending';
}

/** Total count of pending creation + deletion requests from raw query data. */
export function getPendingCount(creationData: unknown, deletionData: unknown): number {
  const creationList = toRequestList(creationData);
  const deletionList = toRequestList(deletionData);
  return (
    creationList.filter(isPendingStatus).length + deletionList.filter(isPendingStatus).length
  );
}

// In-memory fixed-window rate limiter. The app runs as a single Node process behind
// Caddy (no horizontal scaling), so an in-process Map is sufficient — no shared store
// (Redis etc.) is needed.

type Entry = { count: number; windowStart: number; windowMs: number };

let store = new Map<string, Entry>();

/**
 * Returns true if the call at `key` within `bucket` is allowed under `limit` calls per
 * `windowMs`, false if the caller is over the limit. Uses a fixed window per key: the
 * window resets `windowMs` after the first call in that window.
 */
export function rateLimit(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  pruneStale(now);

  const mapKey = `${bucket}:${key}`;
  const entry = store.get(mapKey);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(mapKey, { count: 1, windowStart: now, windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}

// Opportunistically drop windows that have definitely expired, so the map doesn't grow
// unbounded across many distinct keys (e.g. many distinct IPs). Cheap relative to the
// cost of a full sweep on every call, and only runs a full scan periodically. Each
// entry is pruned against the window size it was created with, not the current call's,
// since different buckets can use different windowMs.
let callsSincePrune = 0;
function pruneStale(now: number): void {
  callsSincePrune += 1;
  if (callsSincePrune < 100) return;
  callsSincePrune = 0;
  for (const [k, entry] of store) {
    if (now - entry.windowStart >= entry.windowMs) store.delete(k);
  }
}

/** Test-only: clears all rate limit state. */
export function _reset(): void {
  store = new Map();
  callsSincePrune = 0;
}

// Caddy (the reverse proxy in front of this app — see deploy/Caddyfile.snippet) sets
// X-Forwarded-For to the real client IP. Falls back to "local" for direct connections
// (dev server, tests) where there is no proxy in front.
export function requestIp(req: Request): string {
  // Take the LAST hop, not the first: Caddy appends the connecting peer's address as
  // the final entry rather than stripping/overwriting inbound X-Forwarded-For, so any
  // earlier hop (including a fabricated first entry) is attacker-controlled — a client
  // can send "X-Forwarded-For: 1.2.3.4" (or a fresh random value per request) and have
  // it pass straight through as entry #1. Only the value Caddy itself appended can be
  // trusted. An empty header, or an empty value after trimming the last hop, is treated
  // as no IP at all.
  const header = req.headers.get("x-forwarded-for");
  if (!header) return "local";
  const hops = header.split(",");
  const last = hops[hops.length - 1]?.trim();
  return last || "local";
}

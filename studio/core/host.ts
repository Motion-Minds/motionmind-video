// Request guard for the local Studio (no imports: shared by proxy.ts, the CLI and unit tests).
// The Studio has no login; it trusts whoever can reach it. A Host allowlist stops DNS rebinding (a web page whose
// hostname is re-pointed at 127.0.0.1), and mutating requests must come from the Studio's own pages.

const LOOPBACK: Record<string, true> = { localhost: true, "127.0.0.1": true, "::1": true };

/** Host header without its port, lowercased; IPv6 brackets removed. */
export function hostName(host: string): string {
  const v6 = /^\[([^\]]+)\](?::\d+)?$/.exec(host);
  return (v6 ? v6[1] : host.replace(/:\d+$/, "")).toLowerCase();
}

export const isLoopback = (name: string) => Object.hasOwn(LOOPBACK, hostName(name));

/** Loopback names, plus the names in `extra` (the `--host` given to `motionmind ui`). */
export function isAllowedHost(host: string | null, extra: readonly string[] = []): boolean {
  if (!host) return false;
  const name = hostName(host);
  return Object.hasOwn(LOOPBACK, name) || extra.some((h) => hostName(h.trim()) === name);
}

export interface GuardRequest {
  method: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
}

/** null when the request may proceed, else the reason it is refused (sent as a 403). */
export function rejectReason(req: GuardRequest, extra: readonly string[] = []): string | null {
  if (!isAllowedHost(req.host, extra)) return "host not allowed";
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;
  // Browsers always send Origin on POST; after a rebind it would carry the attacker's (refused) host anyway.
  if (req.origin !== `http://${req.host}`) return "origin not allowed";
  if (req.secFetchSite !== null && req.secFetchSite !== "same-origin") return "cross-site request";
  return null;
}

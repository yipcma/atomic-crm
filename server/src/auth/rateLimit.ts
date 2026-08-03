import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { getConnInfo } from "@hono/node-server/conninfo";

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Bucket key for a request. Requests sharing a key share a budget. */
  key: (c: Context) => Promise<string> | string;
}

// Single-process, in-memory fixed-window counter. The API runs as one Railway
// service, so a shared store would be complexity without benefit; revisit if it
// is ever scaled to multiple replicas (each would then enforce its own budget).
const buckets = new Map<string, Window>();

function prune(now: number): void {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

// Caddy sets X-Real-Client-IP with header_up, which REPLACES any client-supplied
// value — unlike X-Forwarded-For, where reverse_proxy appends and an attacker's
// forged value survives as the leftmost entry. Prefer it; fall back to the
// rightmost XFF hop (the one nearest us, so the hardest to forge), then to the
// socket address.
export function clientIp(c: Context): string {
  const real = c.req.header("x-real-client-ip")?.trim();
  if (real) return real;

  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest;
  }

  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // No underlying socket (in-process test requests, or a runtime that does
    // not expose conn info). Falling back to a shared bucket is safe: it is
    // strictly more restrictive, never less.
    return "unknown";
  }
}

export function rateLimit({
  limit,
  windowMs,
  key,
}: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    if (buckets.size > 10_000) prune(now);

    const bucketKey = await key(c);
    const existing = buckets.get(bucketKey);
    const window =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowMs };

    window.count += 1;
    buckets.set(bucketKey, window);

    if (window.count > limit) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      // Thrown before the handler runs, so a correct password is rejected too:
      // the limiter must not double as an oracle for credential validity.
      throw new HTTPException(429, {
        message: "Too many attempts. Please try again later.",
      });
    }

    await next();
  };
}

// Bucket credential attempts per IP *and* per account, so one attacker cannot
// lock out an unrelated user by burning a shared IP budget, and spraying one
// password across many accounts still gets caught by the IP bucket.
export async function ipAndEmailKey(c: Context): Promise<string> {
  let email = "";
  try {
    // Cache the parsed body so the route handler can still read it.
    const body = await c.req.json<{ email?: string }>();
    email = body?.email?.trim().toLowerCase() ?? "";
  } catch {
    // Not JSON, or no body: fall back to the IP bucket alone.
  }
  return `cred:${clientIp(c)}:${email}`;
}

export function ipKey(prefix: string) {
  return (c: Context): string => `${prefix}:${clientIp(c)}`;
}

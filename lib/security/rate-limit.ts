export interface FixedWindowRateLimitOptions {
  namespace: string;
  key: string;
  windowMs: number;
  maxRequests: number;
}

export interface FixedWindowRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RateLimitWindowState {
  count: number;
  windowStart: number;
}

function buildRateLimitKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

function getOrCreateWindowState(
  store: Map<string, RateLimitWindowState>,
  compositeKey: string,
  nowMs: number,
  windowMs: number
): RateLimitWindowState {
  const existingState = store.get(compositeKey);
  const windowExpired = !existingState || nowMs - existingState.windowStart >= windowMs;

  if (windowExpired) {
    const freshState: RateLimitWindowState = {
      count: 0,
      windowStart: nowMs,
    };
    store.set(compositeKey, freshState);
    return freshState;
  }

  return existingState;
}

function checkFixedWindowRateLimitInternal(
  store: Map<string, RateLimitWindowState>,
  options: FixedWindowRateLimitOptions
): FixedWindowRateLimitResult {
  const nowMs = Date.now();
  const compositeKey = buildRateLimitKey(options.namespace, options.key);
  const windowState = getOrCreateWindowState(store, compositeKey, nowMs, options.windowMs);

  windowState.count += 1;

  const limit = options.maxRequests;
  const allowed = windowState.count <= limit;
  const remaining = Math.max(0, limit - windowState.count);
  const resetAt = windowState.windowStart + options.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - nowMs) / 1000));

  return {
    allowed,
    limit,
    remaining,
    resetAt,
    retryAfterSeconds,
  };
}

function cleanupFixedWindowRateLimitStore(
  store: Map<string, RateLimitWindowState>,
  maxAgeMs: number
): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, value] of store.entries()) {
    if (value.windowStart < cutoff) {
      store.delete(key);
    }
  }
}

declare global {
  var __fixedWindowRateLimitStore__: Map<string, RateLimitWindowState> | undefined;
  var __fixedWindowRateLimitCleanupInterval__: NodeJS.Timeout | undefined;
}

const globalRateLimitState = globalThis as unknown as {
  __fixedWindowRateLimitStore__?: Map<string, RateLimitWindowState>;
  __fixedWindowRateLimitCleanupInterval__?: NodeJS.Timeout;
};

const fixedWindowRateLimitStore = globalRateLimitState.__fixedWindowRateLimitStore__
  ? globalRateLimitState.__fixedWindowRateLimitStore__
  : new Map<string, RateLimitWindowState>();

if (!globalRateLimitState.__fixedWindowRateLimitStore__) {
  globalRateLimitState.__fixedWindowRateLimitStore__ = fixedWindowRateLimitStore;
}

if (
  typeof window === "undefined" &&
  !globalRateLimitState.__fixedWindowRateLimitCleanupInterval__
) {
  globalRateLimitState.__fixedWindowRateLimitCleanupInterval__ = setInterval(
    () => {
      // Keep about 6h of historical windows to bound memory growth in long-lived processes.
      cleanupFixedWindowRateLimitStore(fixedWindowRateLimitStore, 6 * 60 * 60 * 1000);
    },
    10 * 60 * 1000
  );
}

export function checkFixedWindowRateLimit(
  options: FixedWindowRateLimitOptions
): FixedWindowRateLimitResult {
  return checkFixedWindowRateLimitInternal(fixedWindowRateLimitStore, options);
}

export function getClientIpAddress(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  const candidateFromForwardedFor = forwardedFor?.split(",")[0]?.trim();
  const fallbackCandidates = [
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("x-vercel-forwarded-for"),
  ];

  const ipCandidate =
    candidateFromForwardedFor ||
    fallbackCandidates.find((value) => value && value.trim().length > 0)?.trim() ||
    null;

  if (!ipCandidate || ipCandidate.toLowerCase() === "unknown") {
    return null;
  }

  return ipCandidate;
}

export function createRateLimitHeaders(result: FixedWindowRateLimitResult): Headers {
  const headers = new Headers();
  headers.set("Retry-After", String(result.retryAfterSeconds));
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return headers;
}

/**
 * Demo quota tracking for /try-it-out.
 *
 * Supports two operations:
 * - `getDemoQuota`: read-only peek (used by the UI badge).
 * - `consumeDemoQuota`: record a run and return updated remaining (used by the POST route).
 *
 * We can't reuse `checkFixedWindowRateLimit` from `lib/security/rate-limit` directly — that
 * helper increments on every call. The UI needs to *peek* at remaining without burning a run.
 * A sliding-hits-per-window approach keeps the semantics clean.
 *
 * In-memory, per-process. Acceptable for the demo: this is already how the POST-side limit
 * works. If we ever need cross-instance quota, swap this to Supabase or Upstash.
 */

export const DEMO_QUOTA_MAX = 3;
export const DEMO_QUOTA_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface DemoQuotaRecord {
  hits: number[];
}

declare global {
  var __demoQuotaStore__: Map<string, DemoQuotaRecord> | undefined;
}

const globalState = globalThis as unknown as {
  __demoQuotaStore__?: Map<string, DemoQuotaRecord>;
};

const store: Map<string, DemoQuotaRecord> =
  globalState.__demoQuotaStore__ ?? new Map<string, DemoQuotaRecord>();

if (!globalState.__demoQuotaStore__) {
  globalState.__demoQuotaStore__ = store;
}

function pruneHits(now: number, hits: number[]): number[] {
  const cutoff = now - DEMO_QUOTA_WINDOW_MS;
  return hits.filter((timestamp) => timestamp > cutoff);
}

function snapshot(ip: string, now: number): DemoQuotaRecord {
  const existing = store.get(ip) ?? { hits: [] };
  const pruned = pruneHits(now, existing.hits);
  const record = { hits: pruned };
  store.set(ip, record);
  return record;
}

export async function getDemoQuota(ip: string): Promise<{ remaining: number; max: number }> {
  const now = Date.now();
  const record = snapshot(ip, now);
  return {
    remaining: Math.max(0, DEMO_QUOTA_MAX - record.hits.length),
    max: DEMO_QUOTA_MAX,
  };
}

export async function consumeDemoQuota(ip: string): Promise<{
  ok: boolean;
  remaining: number;
  max: number;
  retryAfterSeconds: number;
}> {
  const now = Date.now();
  const record = snapshot(ip, now);

  if (record.hits.length >= DEMO_QUOTA_MAX) {
    const oldestHit = record.hits[0] ?? now;
    const resetAt = oldestHit + DEMO_QUOTA_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      ok: false,
      remaining: 0,
      max: DEMO_QUOTA_MAX,
      retryAfterSeconds,
    };
  }

  record.hits.push(now);
  store.set(ip, record);
  return {
    ok: true,
    remaining: Math.max(0, DEMO_QUOTA_MAX - record.hits.length),
    max: DEMO_QUOTA_MAX,
    retryAfterSeconds: 0,
  };
}

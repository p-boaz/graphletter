import { createHash } from "node:crypto";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

/**
 * Durable demo quota tracking for /try-it-out.
 *
 * Supports two operations:
 * - `getDemoQuota`: read-only peek (used by the UI badge).
 * - `consumeDemoQuota`: atomically record a run and return updated remaining.
 *
 * Quota keys are SHA-256 hashes of client identifiers, so the durable table
 * never stores raw IP addresses.
 */

export const DEMO_QUOTA_MAX = 3;
export const DEMO_QUOTA_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type DemoQuotaClient = Pick<SupabaseClient, "from" | "rpc">;

interface DemoQuotaRpcResult {
  ok: boolean;
  remaining: number;
  retry_after_seconds: number;
}

function createDemoQuotaClient(): DemoQuotaClient {
  return createServiceClient(getSupabaseServerUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function quotaKey(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function cutoffIso(now = Date.now()): string {
  return new Date(now - DEMO_QUOTA_WINDOW_MS).toISOString();
}

async function cleanupExpiredQuotaHits(client: DemoQuotaClient, cutoff: string): Promise<void> {
  const { error } = await client.from("demo_quota_hits").delete().lte("consumed_at", cutoff);
  if (error) {
    throw new Error(`Failed to clean up demo quota hits: ${error.message}`);
  }
}

export async function getDemoQuota(
  ip: string,
  client: DemoQuotaClient = createDemoQuotaClient()
): Promise<{ remaining: number; max: number }> {
  const cutoff = cutoffIso();
  await cleanupExpiredQuotaHits(client, cutoff);

  const { data, error } = await client
    .from("demo_quota_hits")
    .select("consumed_at")
    .eq("quota_key", quotaKey(ip))
    .gt("consumed_at", cutoff)
    .order("consumed_at", { ascending: true })
    .limit(DEMO_QUOTA_MAX);

  if (error) {
    throw new Error(`Failed to read demo quota: ${error.message}`);
  }

  const hits = Array.isArray(data) ? data.length : 0;
  return {
    remaining: Math.max(0, DEMO_QUOTA_MAX - hits),
    max: DEMO_QUOTA_MAX,
  };
}

export async function consumeDemoQuota(
  ip: string,
  client: DemoQuotaClient = createDemoQuotaClient()
): Promise<{
  ok: boolean;
  remaining: number;
  max: number;
  retryAfterSeconds: number;
}> {
  const { data, error } = await client
    .rpc("consume_demo_quota", {
      p_quota_key: quotaKey(ip),
      p_max_hits: DEMO_QUOTA_MAX,
      p_window_seconds: Math.floor(DEMO_QUOTA_WINDOW_MS / 1000),
    })
    .single();

  if (error) {
    throw new Error(`Failed to consume demo quota: ${error.message}`);
  }

  const result = data as DemoQuotaRpcResult | null;
  if (!result) {
    throw new Error("Failed to consume demo quota: empty response");
  }

  return {
    ok: result.ok,
    remaining: result.remaining,
    max: DEMO_QUOTA_MAX,
    retryAfterSeconds: result.retry_after_seconds,
  };
}

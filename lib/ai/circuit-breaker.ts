import { createLogger } from "@/lib/logger";
import type { supabaseAdmin as SupabaseAdminType } from "@/lib/database/supabase";

// Lazy import so the module can be loaded without Supabase env vars.
// The supabaseAdmin client is only needed on the real (non-test) code path.
function getSupabaseAdmin(): typeof SupabaseAdminType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load avoids module-load crash with no env
  return (require("@/lib/database/supabase") as { supabaseAdmin: typeof SupabaseAdminType })
    .supabaseAdmin;
}

const log = createLogger("circuit-breaker");

const TRIP_THRESHOLD = 5;
const RESET_AFTER_MS = 60_000;

export class ProviderTrippedError extends Error {
  constructor(provider: string) {
    super(`AI provider "${provider}" is temporarily unavailable (circuit breaker tripped)`);
    this.name = "ProviderTrippedError";
  }
}

/** Test-only: override circuit-breaker result. null = use real logic. */
let testOverride: { allowed: boolean } | null = null;

/** Test-only: set a fixed result for checkCircuitBreaker (null = real logic). */
export function setCircuitBreakerOverrideForTesting(result: { allowed: boolean } | null): void {
  testOverride = result;
}

/**
 * Check if an AI provider is available.
 * Fail-open: if the health table is unreachable, returns { allowed: true }.
 */
export async function checkCircuitBreaker(provider: string): Promise<{ allowed: boolean }> {
  if (testOverride !== null) return testOverride;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("ai_provider_health")
      .select("consecutive_failures, tripped_at")
      .eq("provider", provider)
      .single();

    if (error || !data) {
      log.warn("circuit_breaker.check_failed", {
        provider,
        error: error?.message,
      });
      return { allowed: true }; // fail-open
    }

    // Auto-reset: if tripped but enough time has passed, reset and allow
    if (data.tripped_at) {
      const trippedAtMs = new Date(data.tripped_at).getTime();
      if (Date.now() - trippedAtMs >= RESET_AFTER_MS) {
        log.info("circuit_breaker.auto_reset", { provider });
        await getSupabaseAdmin()
          .from("ai_provider_health")
          .update({ consecutive_failures: 0, tripped_at: null })
          .eq("provider", provider);
        return { allowed: true };
      }
      log.warn("circuit_breaker.tripped", {
        provider,
        trippedAt: data.tripped_at,
      });
      return { allowed: false };
    }

    if (data.consecutive_failures >= TRIP_THRESHOLD) {
      return { allowed: false };
    }

    return { allowed: true };
  } catch (err) {
    log.warn("circuit_breaker.check_exception", {
      provider,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { allowed: true }; // fail-open
  }
}

/**
 * Record a successful AI call. Resets the failure counter.
 */
export async function recordSuccess(provider: string): Promise<void> {
  try {
    await getSupabaseAdmin().from("ai_provider_health").upsert(
      {
        provider,
        consecutive_failures: 0,
        last_failure_at: null,
        tripped_at: null,
      },
      { onConflict: "provider" }
    );
  } catch (err) {
    log.warn("circuit_breaker.record_success_failed", {
      provider,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Record a failed AI call. Increments the counter and trips if threshold reached.
 */
export async function recordFailure(provider: string): Promise<void> {
  try {
    // Fetch current state
    const { data } = await getSupabaseAdmin()
      .from("ai_provider_health")
      .select("consecutive_failures")
      .eq("provider", provider)
      .single();

    const newCount = (data?.consecutive_failures ?? 0) + 1;
    const now = new Date().toISOString();

    await getSupabaseAdmin()
      .from("ai_provider_health")
      .upsert(
        {
          provider,
          consecutive_failures: newCount,
          last_failure_at: now,
          tripped_at: newCount >= TRIP_THRESHOLD ? now : null,
        },
        { onConflict: "provider" }
      );

    if (newCount >= TRIP_THRESHOLD) {
      log.warn("circuit_breaker.tripped_by_failure", {
        provider,
        failures: newCount,
      });
    } else {
      log.info("circuit_breaker.failure_recorded", {
        provider,
        failures: newCount,
      });
    }
  } catch (err) {
    log.warn("circuit_breaker.record_failure_failed", {
      provider,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

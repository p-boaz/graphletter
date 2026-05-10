import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/utils/auth";

const log = createLogger("api/admin/ai-provider-health");

const AUTO_RESET_AFTER_MS = 60_000;

type ProviderHealthRow = {
  provider: string;
  consecutive_failures: number;
  last_failure_at: string | null;
  tripped_at: string | null;
};

type ProviderHealthStatus = "healthy" | "recovering" | "tripped";

function deriveStatus(row: ProviderHealthRow): ProviderHealthStatus {
  if (row.tripped_at) {
    return "tripped";
  }
  if (row.consecutive_failures > 0) {
    return "recovering";
  }
  return "healthy";
}

function secondsUntilAutoReset(trippedAt: string | null): number | null {
  if (!trippedAt) {
    return null;
  }
  const elapsedMs = Date.now() - new Date(trippedAt).getTime();
  const remainingMs = AUTO_RESET_AFTER_MS - elapsedMs;
  if (remainingMs <= 0) {
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export async function GET(_request: NextRequest) {
  try {
    const userSupabase = await createClient();
    let user = null;
    try {
      user = await getCurrentUser(userSupabase);
    } catch (authError) {
      log.warn("ai_provider_health.auth_failed", {
        error: authError instanceof Error ? authError.message : "unknown_auth_error",
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAdminAccess = await isAdminUser(user);
    if (!hasAdminAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("ai_provider_health")
      .select("provider, consecutive_failures, last_failure_at, tripped_at")
      .order("provider");

    if (error) {
      log.error("ai_provider_health.query_failed", {
        error: error.message,
      });
      return NextResponse.json({ error: "Failed to load provider health" }, { status: 500 });
    }

    const rows = (data || []) as ProviderHealthRow[];
    const providers = rows.map((row) => ({
      provider: row.provider,
      status: deriveStatus(row),
      consecutiveFailures: row.consecutive_failures,
      lastFailureAt: row.last_failure_at,
      trippedAt: row.tripped_at,
      secondsUntilAutoReset: secondsUntilAutoReset(row.tripped_at),
    }));

    return NextResponse.json({
      providers,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error("ai_provider_health.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to load provider health" }, { status: 500 });
  }
}

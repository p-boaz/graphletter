/**
 * DB-backed progress session store.
 *
 * All functions accept the caller's SupabaseClient as the first argument so
 * RLS is enforced under the authenticated user's identity.  No service-role
 * client is used here — all writes come from routes that already hold a
 * user-scoped client.
 *
 * TTL/cleanup: rows are small and user-scoped.  A periodic maintenance job
 * can prune old rows; no cleanup timer is introduced here so that serverless
 * functions have no background work to leak.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/progress/progress-store");

// Re-export the shared interface so callers don't need to reach into the
// old websocket module.
export interface ProgressSession {
  sessionId: string;
  userId: string;
  operation: string;
  startTime: string;
  currentStage: string;
  progress: number;
  status: "active" | "completed" | "error";
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Internal DB row type (matches supabase/migrations/20260611210000_*.sql)
// ---------------------------------------------------------------------------

interface ProgressSessionRow {
  id: string;
  user_id: string;
  operation: string;
  current_stage: string;
  progress: number;
  status: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: ProgressSessionRow): ProgressSession {
  return {
    sessionId: row.id,
    userId: row.user_id,
    operation: row.operation,
    startTime: row.created_at,
    currentStage: row.current_stage,
    progress: row.progress,
    status: row.status as ProgressSession["status"],
    message: row.message,
    metadata: row.metadata,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a new progress session row.
 */
export async function createProgressSession(
  supabase: SupabaseClient,
  { sessionId, userId, operation }: { sessionId: string; userId: string; operation: string }
): Promise<ProgressSession> {
  const { data, error } = await supabase
    .from("progress_sessions")
    .insert({
      id: sessionId,
      user_id: userId,
      operation,
      current_stage: "initializing",
      progress: 0,
      status: "active",
      message: `Starting ${operation}...`,
    })
    .select()
    .single<ProgressSessionRow>();

  if (error || !data) {
    throw new Error(`Failed to create progress session: ${error?.message ?? "no data returned"}`);
  }

  return rowToSession(data);
}

/**
 * Update stage/progress/message/metadata for an active session.
 * Progress is clamped to [0, 100].  Missing rows are logged but do not throw
 * (matches old in-memory tracker behaviour).
 */
export async function updateProgress(
  supabase: SupabaseClient,
  sessionId: string,
  stage: string,
  progress: number,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const clamped = Math.min(100, Math.max(0, progress));

  const { data, error } = await supabase
    .from("progress_sessions")
    .update({
      current_stage: stage,
      progress: clamped,
      message,
      ...(metadata !== undefined ? { metadata } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("id");

  if (error) {
    log.warn("progress_store.update_failed", {
      detail: error.message,
      sessionId,
    });
    return;
  }

  if (!data || data.length === 0) {
    log.warn("progress_store.session_not_found", {
      detail: `Progress session ${sessionId} not found on update`,
      sessionId,
    });
  }
}

/**
 * Mark a session as completed (progress → 100).
 */
export async function completeProgressSession(
  supabase: SupabaseClient,
  sessionId: string,
  message?: string
): Promise<void> {
  const { error } = await supabase
    .from("progress_sessions")
    .update({
      status: "completed",
      progress: 100,
      current_stage: "completed",
      message: message ?? "Operation completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    log.warn("progress_store.complete_failed", {
      detail: error.message,
      sessionId,
    });
  }
}

/**
 * Mark a session as error.
 */
export async function errorProgressSession(
  supabase: SupabaseClient,
  sessionId: string,
  errorText: string
): Promise<void> {
  const { error } = await supabase
    .from("progress_sessions")
    .update({
      status: "error",
      current_stage: "error",
      message: `Error: ${errorText}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    log.warn("progress_store.error_failed", {
      detail: error.message,
      sessionId,
    });
  }
}

/**
 * Fetch a single session row mapped to the ProgressSession shape.
 * Returns null if not found.
 */
export async function getProgressSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ProgressSession | null> {
  const { data, error } = await supabase
    .from("progress_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<ProgressSessionRow>();

  if (error) {
    log.warn("progress_store.get_failed", {
      detail: error.message,
      sessionId,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return rowToSession(data);
}

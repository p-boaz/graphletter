import type { NextRequest } from "next/server";
import { getProgressSession } from "@/lib/progress/progress-store";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HARD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Session ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase).catch(() => null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await getProgressSession(supabase, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "Progress session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (session.userId !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Capture supabase client for use inside the stream (already auth'd)
  const streamSupabase = supabase;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      // Track last-emitted state to suppress duplicate events
      let lastProgress = session.progress;
      let lastUpdatedAt = session.updatedAt;

      const enqueue = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        clearTimeout(hardTimeout);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Initial connected event
      enqueue({ type: "connected", sessionId, operation: session.operation });

      // 30s heartbeat
      const heartbeatInterval = setInterval(() => {
        enqueue({ type: "heartbeat", timestamp: new Date().toISOString() });
      }, HEARTBEAT_INTERVAL_MS);

      // 10-minute hard timeout — client EventSource auto-reconnects
      const hardTimeout = setTimeout(close, HARD_TIMEOUT_MS);

      // 1500ms poll
      const pollInterval = setInterval(async () => {
        if (closed) return;
        try {
          const row = await getProgressSession(streamSupabase, sessionId);
          if (!row) {
            // Session deleted; close gracefully
            close();
            return;
          }

          const changed = row.updatedAt !== lastUpdatedAt || row.progress !== lastProgress;
          if (changed) {
            lastUpdatedAt = row.updatedAt;
            lastProgress = row.progress;

            enqueue({
              type: "progressUpdate",
              update: {
                sessionId: row.sessionId,
                stage: row.currentStage,
                progress: row.progress,
                message: row.message ?? "",
                timestamp: row.updatedAt,
                metadata: row.metadata ?? undefined,
              },
            });

            if (row.status === "completed" || row.status === "error") {
              setTimeout(close, 2000);
            }
          }
        } catch {
          // Transient poll failure; keep trying until hard timeout
        }
      }, POLL_INTERVAL_MS);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      // ReadableStream cancel is a secondary cleanup path; close() above
      // handles the primary path via request.signal abort.
    },
  });

  return new Response(stream, { headers });
}

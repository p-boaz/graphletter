import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import {
  completeProgressSession,
  errorProgressSession,
  getProgressSession,
  updateProgress,
} from "@/lib/progress/progress-store";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export const runtime = "nodejs";

async function ensureSessionOwner(sessionId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const session = await getProgressSession(supabase, sessionId);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Session not found" }, { status: 404 }),
    };
  }

  if (session.userId !== user.id) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, session };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { error, session } = await ensureSessionOwner(sessionId);
  if (error) return error;

  return NextResponse.json({ session });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const result = await ensureSessionOwner(sessionId);
    if (result.error || !result.session) return result.error;
    const { supabase, session } = result;

    const body = await request.json().catch(() => ({}));
    const stage =
      typeof body.stage === "string" && body.stage.trim() !== "" ? body.stage.trim() : undefined;
    const message = typeof body.message === "string" ? body.message.trim() : undefined;
    const metadata =
      typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined;
    const status = body.status as "completed" | "error" | "active" | undefined;

    if (status === "completed") {
      await completeProgressSession(supabase, sessionId, message);
    } else if (status === "error") {
      await errorProgressSession(supabase, sessionId, message || "An unexpected error occurred");
    } else if (stage || typeof body.progress === "number" || message || metadata) {
      const progressValue = typeof body.progress === "number" ? body.progress : session.progress;
      await updateProgress(
        supabase,
        sessionId,
        stage || session.currentStage,
        progressValue,
        message || `Progress updated: ${stage || session.currentStage}`,
        metadata
      );
    }

    const updatedSession = await getProgressSession(supabase, sessionId);
    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error) {
    return apiError(
      "progress.session_update_failed",
      "Failed to update progress session",
      500,
      error
    );
  }
}

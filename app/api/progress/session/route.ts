import { NextResponse } from "next/server";
import { progressTracker } from "@/lib/websocket/progress-tracker";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const operation = typeof body.operation === "string" && body.operation.trim() !== ""
      ? body.operation.trim()
      : "Smart evidence workflow";

    const sessionId = crypto.randomUUID();
    const session = progressTracker.createSession(sessionId, user.id, operation);

    return NextResponse.json({
      sessionId,
      session,
    });
  } catch (error) {
    console.error("Failed to create progress session", error);
    return NextResponse.json(
      {
        error: "Failed to create progress session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { parseJsonBody } from "@/lib/api/json-body";
import { createProgressSession } from "@/lib/progress/progress-store";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJsonBody<{ operation?: unknown }>(request, {});
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const operation =
      typeof body.operation === "string" && body.operation.trim() !== ""
        ? body.operation.trim()
        : "Smart evidence workflow";

    const sessionId = crypto.randomUUID();
    const session = await createProgressSession(supabase, {
      sessionId,
      userId: user.id,
      operation,
    });

    return NextResponse.json({
      sessionId,
      session,
    });
  } catch (error) {
    return apiError(
      "progress.session_create_failed",
      "Failed to create progress session",
      500,
      error
    );
  }
}

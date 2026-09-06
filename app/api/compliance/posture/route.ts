import { type NextRequest, NextResponse } from "next/server";
import { calculatePostureScore } from "@/lib/compliance/posture-scorer";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/posture");

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("framework_id") || null;

    const posture = await calculatePostureScore(supabase, user.id, frameworkId);

    return NextResponse.json({ posture });
  } catch (error) {
    log.error("posture.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to calculate posture score" }, { status: 500 });
  }
}

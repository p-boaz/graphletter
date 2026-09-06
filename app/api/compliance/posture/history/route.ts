import { type NextRequest, NextResponse } from "next/server";
import { getPostureHistory } from "@/lib/compliance/posture-scorer";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/posture/history");

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("framework_id") || null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

    const history = await getPostureHistory(supabase, user.id, frameworkId, limit);

    return NextResponse.json({ history });
  } catch (error) {
    log.error("posture_history.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to fetch posture history" }, { status: 500 });
  }
}

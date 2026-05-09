import { type NextRequest, NextResponse } from "next/server";
import { createRequestLogger, getOrCreateRequestId } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const log = createRequestLogger(requestId);

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count, error } = await supabase
    .from("evidence")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) {
    log.error("evidence_count_failed", { error: error.message });
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

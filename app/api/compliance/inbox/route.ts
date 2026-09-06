import { type NextRequest, NextResponse } from "next/server";
import { generateInbox } from "@/lib/compliance/inbox-generator";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/inbox");

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("framework_id") || null;

    const inbox = await generateInbox(supabase, user.id, frameworkId);

    return NextResponse.json({ inbox });
  } catch (error) {
    log.error("inbox.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to generate compliance inbox" }, { status: 500 });
  }
}

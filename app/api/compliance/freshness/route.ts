import { type NextRequest, NextResponse } from "next/server";
import { scanEvidenceFreshness } from "@/lib/compliance/freshness-engine";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/freshness");

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const frameworkId = searchParams.get("framework_id") || null;

		const freshness = await scanEvidenceFreshness(
			supabase,
			user.id,
			frameworkId,
		);

		return NextResponse.json({ freshness });
	} catch (error) {
		log.error("freshness.failed", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ error: "Failed to scan evidence freshness" },
			{ status: 500 },
		);
	}
}

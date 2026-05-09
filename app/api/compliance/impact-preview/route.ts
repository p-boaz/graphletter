import { type NextRequest, NextResponse } from "next/server";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { previewUploadImpact } from "@/lib/compliance/impact-previewer";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/impact-preview");

const IMPACT_RATE_LIMIT = {
	namespace: "compliance_impact_preview",
	user: { windowMs: 60_000, maxRequests: 30 },
	ip: { windowMs: 60_000, maxRequests: 60 },
	message: "Rate limit exceeded for impact preview. Please retry shortly.",
} as const;

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const rateLimitResponse = checkRouteRateLimit(
			IMPACT_RATE_LIMIT,
			user.id,
			request.headers,
		);
		if (rateLimitResponse) return rateLimitResponse;

		const body = await request.json();
		const { controlIds, frameworkId } = body as {
			controlIds?: string[];
			frameworkId?: string;
		};

		if (!controlIds || !Array.isArray(controlIds) || controlIds.length === 0) {
			return NextResponse.json(
				{ error: "controlIds array required" },
				{ status: 400 },
			);
		}

		const preview = await previewUploadImpact(
			supabase,
			user.id,
			controlIds,
			frameworkId || null,
		);

		return NextResponse.json({ preview });
	} catch (error) {
		log.error("impact_preview.failed", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ error: "Failed to compute impact preview" },
			{ status: 500 },
		);
	}
}

import { type NextRequest, NextResponse } from "next/server";
import { readAIAssessmentLogs } from "@/lib/ai/assessment-logging";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const limitParam = searchParams.get("limit");
		const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
		const requestId = searchParams.get("request_id") ?? undefined;
		const controlId = searchParams.get("control_id") ?? undefined;
		const evidenceHash = searchParams.get("evidence_hash") ?? undefined;
		const scope = searchParams.get("scope") ?? undefined;

		const entries = await readAIAssessmentLogs({
			limit: Number.isFinite(limit) ? limit : 100,
			requestId,
			scfControlId: controlId,
			evidenceContentHash: evidenceHash,
			scope:
				scope === "ai_call" ||
				scope === "control_assessment" ||
				scope === "retry" ||
				scope === "timeout"
					? scope
					: undefined,
		});

		return NextResponse.json({
			logs: entries,
			count: entries.length,
			filters: {
				limit: Number.isFinite(limit) ? limit : 100,
				request_id: requestId ?? null,
				control_id: controlId ?? null,
				evidence_hash: evidenceHash ?? null,
				scope: scope ?? null,
			},
		});
	} catch (error) {
		console.error("Failed to fetch AI assessment logs:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Failed to fetch logs",
			},
			{ status: 500 },
		);
	}
}

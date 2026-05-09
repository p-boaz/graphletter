import { type NextRequest, NextResponse } from "next/server";
import { GraphletterAI } from "@/lib/ai-client";
import { validateAIEnvironment } from "@/lib/ai-config";
import {
	enforceUserRateLimit,
	requireAuthenticatedUser,
} from "@/utils/api-guards";

export async function POST(request: NextRequest) {
	try {
		const authResult = await requireAuthenticatedUser();
		if ("response" in authResult) {
			return authResult.response;
		}

		const rateLimited = enforceUserRateLimit({
			scope: "ai",
			userId: authResult.user.id,
			limit: 20,
			windowMs: 60_000,
		});
		if (rateLimited) {
			return rateLimited;
		}

		// Validate AI environment
		if (!validateAIEnvironment()) {
			return NextResponse.json(
				{ error: "AI services not properly configured" },
				{ status: 500 },
			);
		}

		const body = await request.json();
		const { sourceStandard, targetStandard, mappings } = body;

		// Validate input
		if (!sourceStandard || !targetStandard || !mappings) {
			return NextResponse.json(
				{
					error: "Source standard, target standard, and mappings are required",
				},
				{ status: 400 },
			);
		}

		// Perform AI gap analysis
		const gapAnalysis = await GraphletterAI.generateGapAnalysis(
			sourceStandard,
			targetStandard,
			mappings,
		);

		return NextResponse.json({
			success: true,
			data: gapAnalysis,
		});
	} catch (error) {
		console.error("Error in gap analysis API:", error);
		return NextResponse.json(
			{ error: "Failed to generate gap analysis" },
			{ status: 500 },
		);
	}
}

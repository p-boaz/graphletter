import { type NextRequest, NextResponse } from "next/server";
import { GraphletterAI, type IndustryContext, type ParsedStandard } from "@/lib/ai-client";
import { validateAIEnvironment } from "@/lib/ai-config";
import { createLogger } from "@/lib/logger";
import { enforceUserRateLimit, requireAuthenticatedUser } from "@/utils/api-guards";

const log = createLogger("api/ai/cross-standard-mapping");

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

    log.info("Cross-standard mapping API called");

    // Validate AI environment
    if (!validateAIEnvironment()) {
      return NextResponse.json(
        {
          success: false,
          error: "AI services not properly configured. Please check your API keys.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { sourceStandard, targetStandards, industryContext } = body;

    // Validate input
    if (!sourceStandard || !targetStandards || !Array.isArray(targetStandards)) {
      return NextResponse.json(
        {
          success: false,
          error: "Source standard and target standards array are required",
        },
        { status: 400 }
      );
    }

    if (!industryContext) {
      return NextResponse.json(
        {
          success: false,
          error: "Industry context is required for enhanced analysis",
        },
        { status: 400 }
      );
    }

    log.info("Analyzing cross-standard mapping", {
      source: sourceStandard.name,
      targets: targetStandards.map((s: ParsedStandard) => s.name),
      industry: industryContext.industry,
    });

    // Perform cross-standard analysis
    const analysis = await GraphletterAI.analyzeCrossStandardMapping(
      sourceStandard,
      targetStandards,
      industryContext as IndustryContext
    );

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Error in cross-standard mapping API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze cross-standard mapping",
      },
      { status: 500 }
    );
  }
}

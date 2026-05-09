import { type NextRequest, NextResponse } from "next/server";
import { GraphletterAI } from "@/lib/ai-client";
import { validateAIEnvironment } from "@/lib/ai-config";
import { createLogger } from "@/lib/logger";
import { enforceUserRateLimit, requireAuthenticatedUser } from "@/utils/api-guards";

const log = createLogger("api/ai/control-mapping");

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

    log.info("Control mapping API called");

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
    const { sourceControl, targetControl } = body;

    // Validate input
    if (!sourceControl || !targetControl) {
      return NextResponse.json(
        {
          success: false,
          error: "Source and target controls are required",
        },
        { status: 400 }
      );
    }

    log.info("Analyzing control mapping", {
      source: sourceControl.id,
      target: targetControl.id,
    });

    // Perform AI analysis
    const analysis = await GraphletterAI.analyzeControlMapping(sourceControl, targetControl);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Error in control mapping API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze control mapping",
      },
      { status: 500 }
    );
  }
}

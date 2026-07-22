import { type NextRequest, NextResponse } from "next/server";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { calculatePostureScore } from "@/lib/compliance/posture-scorer";
import { createLogger } from "@/lib/logger";
import {
  gatherReportData,
  generateCSVReport,
  generateJSONReport,
} from "@/lib/reports/compliance-report-generator";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/reports/compliance");

const REPORT_RATE_LIMIT = {
  namespace: "reports_compliance",
  user: { windowMs: 3_600_000, maxRequests: 5 },
  ip: { windowMs: 3_600_000, maxRequests: 20 },
  message: "Report generation rate limit exceeded (5/hour). Please try again later.",
} as const;

export async function GET(request: NextRequest) {
  const startMs = Date.now();

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = checkRouteRateLimit(REPORT_RATE_LIMIT, user.id, request.headers);
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "json" ? "json" : "csv";
    const frameworkId = searchParams.get("framework_id") || null;

    // Calculate current posture score
    const posture = await calculatePostureScore(supabase, user.id, frameworkId);

    // Gather report data
    const reportData = await gatherReportData(supabase, user.id, posture);

    const durationMs = Date.now() - startMs;
    log.info("report.generated", {
      userId: user.id,
      format,
      frameworkId,
      controlCount: reportData.controlDetails.length,
      durationMs,
    });

    if (format === "json") {
      const jsonContent = generateJSONReport(reportData);
      return new NextResponse(jsonContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="compliance-report-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // Default: CSV
    const csvContent = generateCSVReport(reportData);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="compliance-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    log.error("report.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    // CSV fallback on error (Decision 7 in plan — PDF error falls back to CSV)
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}

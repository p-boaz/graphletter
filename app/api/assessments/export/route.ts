import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { assessmentsToCsv, assessmentsToJson } from "@/lib/assessments/export";
import { loadAssessmentExportRecords } from "@/lib/assessments/load-export-records";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const FORMATS = {
  csv: { serialize: assessmentsToCsv, contentType: "text/csv; charset=utf-8", extension: "csv" },
  json: { serialize: assessmentsToJson, contentType: "application/json", extension: "json" },
} as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formatParam = request.nextUrl.searchParams.get("format") || "csv";
    const format = FORMATS[formatParam as keyof typeof FORMATS];
    if (!format) {
      return NextResponse.json({ error: "Invalid format; expected csv or json" }, { status: 400 });
    }

    const records = await loadAssessmentExportRecords(supabase, user.id);
    const body = format.serialize(records);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": format.contentType,
        "Content-Disposition": `attachment; filename="graphletter-assessments-${date}.${format.extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError("assessments.export_failed", "Failed to export assessments", 500, error);
  }
}

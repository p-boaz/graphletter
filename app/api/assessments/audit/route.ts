import { type NextRequest, NextResponse } from "next/server";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/assessments/audit");

const AUDIT_RATE_LIMIT = {
  namespace: "assessments_audit",
  user: { windowMs: 60_000, maxRequests: 20 },
  ip: { windowMs: 60_000, maxRequests: 60 },
  message: "Rate limit exceeded for audit endpoint. Please retry shortly.",
} as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = checkRouteRateLimit(AUDIT_RATE_LIMIT, user.id, request.headers);
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get("control_id");
    const evidenceId = searchParams.get("evidence_id");
    const since = searchParams.get("since");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = supabase
      .from("assessments")
      .select(
        `
				id,
				scf_control_id,
				evidence_id,
				assessment_result,
				assessment_status,
				confidence_level,
				assessment_summary,
				assessment_notes,
				completed_at,
				created_at,
				metadata
			`
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (controlId) {
      query = query.eq("scf_control_id", controlId);
    }

    if (evidenceId) {
      query = query.eq("evidence_id", evidenceId);
    }

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data: assessments, error: queryError } = await query;

    if (queryError) {
      log.error("audit.query_failed", { error: queryError.message });
      return NextResponse.json({ error: "Failed to fetch audit data" }, { status: 500 });
    }

    // Strip sensitive metadata fields; keep audit-relevant fields only
    const auditRecords = (assessments || []).map((a) => {
      const meta =
        a.metadata && typeof a.metadata === "object" ? (a.metadata as Record<string, unknown>) : {};

      return {
        id: a.id,
        scf_control_id: a.scf_control_id,
        evidence_id: a.evidence_id,
        result: a.assessment_result,
        status: a.assessment_status,
        confidence: a.confidence_level,
        summary: a.assessment_summary,
        notes: a.assessment_notes,
        completed_at: a.completed_at,
        created_at: a.created_at,
        model_provider: meta.model_provider ?? null,
        model_name: meta.model_name ?? null,
        assessment_run_key: meta.assessment_run_key ?? null,
        reused: meta.reusedExistingAssessment ?? false,
      };
    });

    log.info("audit.fetched", {
      userId: user.id,
      recordCount: auditRecords.length,
      controlId,
      evidenceId,
    });

    return NextResponse.json({
      audit: auditRecords,
      total: auditRecords.length,
      limit,
      offset,
    });
  } catch (error) {
    log.error("audit.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to fetch audit data" }, { status: 500 });
  }
}

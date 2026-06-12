import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/assessments/history");

interface AssessmentStatsRow {
  assessment_result: string | null;
  assessment_status: string;
  scf_control_id: string;
  completed_at: string | null;
}

interface EvidenceLookupRow {
  id: string;
  file_name: string;
  evidence_type: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const controlId = searchParams.get("control_id");
    const result = searchParams.get("result");

    let query = supabase
      .from("assessments")
      .select(
        `
        id,
        scf_control_id,
        assessment_type,
        assessment_status,
        assessment_result,
        assessment_notes,
        evidence_id,
        completed_at,
        created_at,
        updated_at,
        metadata,
        scf_controls (
          id,
          title,
          description
        )
      `
      )
      .eq("user_id", user.id)
      .eq("assessment_status", "completed")
      .order("completed_at", { ascending: false });

    // Only apply pagination if we have specific filters, otherwise return all for dashboard stats
    if (controlId || result || searchParams.get("paginate") === "true") {
      query = query.range(offset, offset + limit - 1);
    }

    // Apply filters
    if (controlId) {
      query = query.eq("scf_control_id", controlId);
    }
    if (result) {
      query = query.eq("assessment_result", result);
    }

    const { data: assessments, error } = await query;

    if (error) {
      log.error("assessments.history.get.fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch assessment history" }, { status: 500 });
    }

    const evidenceIds = [
      ...new Set(
        (assessments || [])
          .map((assessment) => assessment.evidence_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const evidenceById = new Map<string, EvidenceLookupRow>();
    if (evidenceIds.length > 0) {
      const { data: evidenceRows, error: evidenceLookupError } = await supabase
        .from("evidence")
        .select("id, file_name, evidence_type")
        .eq("user_id", user.id)
        .in("id", evidenceIds);

      if (evidenceLookupError) {
        log.warn("assessments.history.get.evidence_lookup_failed", {
          detail: evidenceLookupError.message,
        });
      } else {
        for (const row of (evidenceRows || []) as EvidenceLookupRow[]) {
          evidenceById.set(row.id, row);
        }
      }
    }

    // Enhance assessments with linked evidence details from evidence_id
    const enhancedAssessments = assessments?.map((assessment) => {
      const linkedEvidence = assessment.evidence_id
        ? evidenceById.get(assessment.evidence_id)
        : null;
      return {
        ...assessment,
        linked_evidence: linkedEvidence
          ? [
              {
                id: linkedEvidence.id,
                file_name: linkedEvidence.file_name,
                evidence_type: linkedEvidence.evidence_type || "uploaded",
              },
            ]
          : [],
      };
    });

    // Get summary statistics
    const { data: statsData } = await supabase
      .from("assessments")
      .select("assessment_result, assessment_status, scf_control_id, completed_at")
      .eq("user_id", user.id);

    const stats = {
      total: statsData?.length || 0,
      by_result:
        (statsData as AssessmentStatsRow[] | null)?.reduce((acc: Record<string, number>, item) => {
          if (item.assessment_result) {
            acc[item.assessment_result] = (acc[item.assessment_result] || 0) + 1;
          }
          return acc;
        }, {}) || {},
      by_status:
        (statsData as AssessmentStatsRow[] | null)?.reduce((acc: Record<string, number>, item) => {
          acc[item.assessment_status] = (acc[item.assessment_status] || 0) + 1;
          return acc;
        }, {}) || {},
      unique_controls: new Set(statsData?.map((item) => item.scf_control_id)).size || 0,
      recent_count:
        statsData?.filter((item) => {
          if (!item.completed_at) return false;
          const completedDate = new Date(item.completed_at);
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return completedDate > oneWeekAgo;
        }).length || 0,
    };

    return NextResponse.json({
      success: true,
      assessments: enhancedAssessments || [],
      stats,
      pagination: {
        total: enhancedAssessments?.length || 0,
        limit,
        offset,
        hasMore: offset + limit < (enhancedAssessments?.length || 0),
      },
    });
  } catch (error) {
    log.error("assessments.history.get.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

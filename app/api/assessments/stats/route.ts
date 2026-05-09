import { type NextRequest, NextResponse } from "next/server";
import type { UserAssessment } from "@/lib/types/assessment";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

interface ObjectiveSummaryRow {
  scf_ao_id: string;
  assessment_objective: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get("control_id");
    const timeframe = searchParams.get("timeframe") || "30"; // days

    // Base query for user's assessments
    let assessmentQuery = supabase
      .from("assessments")
      .select(
        `
        assessment_status,
        assessment_result,
        assessment_type,
        scf_control_id,
        scf_ao_id,
        confidence_level,
        implementation_status,
        risk_rating,
        created_at,
        completed_at,
        next_assessment_due
      `
      )
      .eq("user_id", user.id);

    if (controlId) {
      assessmentQuery = assessmentQuery.eq("scf_control_id", controlId);
    }

    const { data: assessments, error: assessmentError } = await assessmentQuery;

    if (assessmentError) {
      console.error("Error fetching assessment stats:", assessmentError);
      return NextResponse.json({ error: "Failed to fetch assessment statistics" }, { status: 500 });
    }

    const typedAssessments = (assessments || []) as unknown as UserAssessment[];

    // Calculate date thresholds
    const now = new Date();
    const timeframeStart = new Date();
    timeframeStart.setDate(timeframeStart.getDate() - parseInt(timeframe));

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Initialize statistics
    const stats = {
      total_assessments: typedAssessments.length,
      by_status: {
        not_started: 0,
        in_progress: 0,
        completed: 0,
        under_review: 0,
        approved: 0,
        requires_remediation: 0,
      },
      by_result: {
        met: 0,
        not_met: 0,
        not_tested: 0,
        not_applicable: 0,
        partially_met: 0,
      },
      by_type: {} as Record<string, number>,
      by_confidence: {
        low: 0,
        medium: 0,
        high: 0,
      },
      by_implementation: {
        not_implemented: 0,
        planned: 0,
        in_progress: 0,
        implemented: 0,
        needs_review: 0,
      },
      by_risk: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      by_control: {} as Record<string, number>,
      by_objective: {} as Record<string, number>,
      recent_completions: 0, // Within timeframe
      pending_assessments: 0,
      overdue_assessments: 0,
      due_soon: 0, // Due within 30 days
      compliance_rate: 0, // Percentage of met assessments
      implementation_rate: 0, // Percentage of implemented controls
      average_confidence: 0,
    };

    let totalWithResults = 0;
    let metCount = 0;
    let implementedCount = 0;
    let totalWithImplementation = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    typedAssessments.forEach((assessment) => {
      // Status counts
      stats.by_status[assessment.assessment_status as keyof typeof stats.by_status]++;

      // Result counts
      if (assessment.assessment_result) {
        stats.by_result[assessment.assessment_result as keyof typeof stats.by_result]++;
        totalWithResults++;
        if (assessment.assessment_result === "met") {
          metCount++;
        }
      }

      // Type counts
      stats.by_type[assessment.assessment_type] =
        (stats.by_type[assessment.assessment_type] || 0) + 1;

      // Confidence counts
      if (assessment.confidence_level) {
        stats.by_confidence[assessment.confidence_level as keyof typeof stats.by_confidence]++;

        // Calculate average confidence (convert to numeric)
        const confidenceValue =
          assessment.confidence_level === "high"
            ? 3
            : assessment.confidence_level === "medium"
              ? 2
              : 1;
        confidenceSum += confidenceValue;
        confidenceCount++;
      }

      // Implementation counts
      if (assessment.implementation_status) {
        stats.by_implementation[
          assessment.implementation_status as keyof typeof stats.by_implementation
        ]++;
        totalWithImplementation++;
        if (assessment.implementation_status === "implemented") {
          implementedCount++;
        }
      }

      // Risk counts
      if (assessment.risk_rating) {
        stats.by_risk[assessment.risk_rating as keyof typeof stats.by_risk]++;
      }

      // Control counts
      stats.by_control[assessment.scf_control_id] =
        (stats.by_control[assessment.scf_control_id] || 0) + 1;

      // Objective counts
      if (assessment.scf_ao_id) {
        stats.by_objective[assessment.scf_ao_id] =
          (stats.by_objective[assessment.scf_ao_id] || 0) + 1;
      }

      // Recent completions
      if (assessment.completed_at && new Date(assessment.completed_at) >= timeframeStart) {
        stats.recent_completions++;
      }

      // Pending assessments
      if (["not_started", "in_progress"].includes(assessment.assessment_status)) {
        stats.pending_assessments++;
      }

      // Overdue and due soon assessments
      if (assessment.next_assessment_due) {
        const dueDate = new Date(assessment.next_assessment_due);
        if (dueDate < now) {
          stats.overdue_assessments++;
        } else if (dueDate <= thirtyDaysFromNow) {
          stats.due_soon++;
        }
      }
    });

    // Calculate rates and averages
    stats.compliance_rate =
      totalWithResults > 0 ? Math.round((metCount / totalWithResults) * 100) : 0;
    stats.implementation_rate =
      totalWithImplementation > 0
        ? Math.round((implementedCount / totalWithImplementation) * 100)
        : 0;
    stats.average_confidence =
      confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 100) / 100 : 0;

    // Get control-specific statistics if control_id provided
    let controlStats = null;
    if (controlId) {
      // Get assessment objectives for this control
      const { data: objectives, error: objError } = await supabase
        .from("scf_assessment_objectives")
        .select("scf_ao_id, assessment_objective")
        .eq("scf_control_id", controlId);

      if (!objError && objectives) {
        const typedObjectives = objectives as ObjectiveSummaryRow[];
        const totalObjectives = objectives.length;
        const assessedObjectives = new Set(
          typedAssessments.filter((a) => a.scf_ao_id).map((a) => a.scf_ao_id)
        ).size;

        controlStats = {
          total_objectives: totalObjectives,
          assessed_objectives: assessedObjectives,
          objective_coverage:
            totalObjectives > 0 ? Math.round((assessedObjectives / totalObjectives) * 100) : 0,
          objectives: typedObjectives.map((obj) => ({
            scf_ao_id: obj.scf_ao_id,
            assessment_objective: obj.assessment_objective,
            assessed: typedAssessments.some((a) => a.scf_ao_id === obj.scf_ao_id),
            latest_result:
              typedAssessments
                .filter((a) => a.scf_ao_id === obj.scf_ao_id)
                .sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0]?.assessment_result || null,
          })),
        };
      }
    }

    // Calculate trends (compare with previous period)
    const previousPeriodStart = new Date(timeframeStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(timeframe));

    const recentAssessments = typedAssessments.filter(
      (a) => a.completed_at && new Date(a.completed_at) >= timeframeStart
    );

    const previousAssessments = typedAssessments.filter(
      (a) =>
        a.completed_at &&
        new Date(a.completed_at) >= previousPeriodStart &&
        new Date(a.completed_at) < timeframeStart
    );

    const trends = {
      completion_trend: recentAssessments.length - previousAssessments.length,
      compliance_trend: 0, // Will calculate based on met vs not_met
      implementation_trend: 0, // Will calculate based on implementation status changes
    };

    // Calculate compliance trend
    const recentCompliance = recentAssessments.filter((a) => a.assessment_result === "met").length;
    const previousCompliance = previousAssessments.filter(
      (a) => a.assessment_result === "met"
    ).length;
    trends.compliance_trend = recentCompliance - previousCompliance;

    // Calculate implementation trend
    const recentImplemented = recentAssessments.filter(
      (a) => a.implementation_status === "implemented"
    ).length;
    const previousImplemented = previousAssessments.filter(
      (a) => a.implementation_status === "implemented"
    ).length;
    trends.implementation_trend = recentImplemented - previousImplemented;

    return NextResponse.json({
      stats,
      controlStats,
      trends,
      timeframe: parseInt(timeframe),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in assessment stats GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

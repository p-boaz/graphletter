import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/assessment-objectives");

interface AssessmentObjectiveRow {
  scf_control_id: string;
  scf_ao_id: string;
  assessment_objective?: string | null;
  assessment_procedure?: string | null;
  expected_results?: string | null;
  origin?: string | null;
  scf_baseline_aos?: boolean | null;
  dhs_ztcf_aos?: boolean | null;
  nist_800_53_r5_aos?: boolean | null;
  nist_800_171_r2_aos?: boolean | null;
  nist_800_171_r3_aos?: boolean | null;
  nist_800_172_aos?: boolean | null;
  assessment_status?: string | null;
}

type FrameworkCoverageCounts = {
  scf_baseline: number;
  dhs_ztcf: number;
  nist_800_53_r5: number;
  nist_800_171_r2: number;
  nist_800_171_r3: number;
  nist_800_172: number;
};

type StatusCounts = {
  met: number;
  not_met: number;
  not_tested: number;
  not_applicable: number;
};

function isStatusCountKey(value: string): value is keyof StatusCounts {
  return (
    value === "met" || value === "not_met" || value === "not_tested" || value === "not_applicable"
  );
}

interface ControlStats {
  total_objectives: number;
  framework_coverage: FrameworkCoverageCounts;
  assessment_status_counts: StatusCounts;
  origins: Set<string>;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const controlId = searchParams.get("control_id");
    const frameworkFilter = searchParams.get("framework");
    const limit = searchParams.get("limit");

    let query = supabase.from("scf_assessment_objectives").select(`
        scf_ao_id,
        assessment_objective,
        origin,
        notes_errata,
        scf_baseline_aos,
        dhs_ztcf_aos,
        nist_800_53_r5_aos,
        nist_800_171_r2_aos,
        nist_800_171_r3_aos,
        nist_800_172_aos,
        asset_type,
        assessment_procedure,
        expected_results,
        assessment_status,
        inherited,
        assessment_frequency,
        scf_version,
        created_at
      `);

    // Filter by specific control ID
    if (controlId) {
      query = query.eq("scf_control_id", controlId);
    }

    // Framework-specific filtering
    if (frameworkFilter) {
      switch (frameworkFilter.toLowerCase()) {
        case "scf_baseline":
          query = query.eq("scf_baseline_aos", true);
          break;
        case "nist_800_53":
          query = query.eq("nist_800_53_r5_aos", true);
          break;
        case "nist_800_171_r2":
          query = query.eq("nist_800_171_r2_aos", true);
          break;
        case "nist_800_171_r3":
          query = query.eq("nist_800_171_r3_aos", true);
          break;
        case "nist_800_172":
          query = query.eq("nist_800_172_aos", true);
          break;
        case "dhs_ztcf":
          query = query.eq("dhs_ztcf_aos", true);
          break;
      }
    }

    // Apply limit
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    // Order by AO ID
    query = query.order("scf_ao_id");

    const { data: assessmentObjectives, error } = await query;

    if (error) {
      log.error("assessment_objectives.fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch assessment objectives" }, { status: 500 });
    }

    return NextResponse.json(assessmentObjectives || []);
  } catch (error) {
    log.error("assessment_objectives.unhandled_error", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Get assessment objective details by batch of IDs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { objective_ids, control_ids } = body;

    // Handle batch fetching by objective IDs
    if (objective_ids && Array.isArray(objective_ids)) {
      const { data: objectives, error } = await supabase
        .from("scf_assessment_objectives")
        .select(
          `
          id,
          scf_control_id,
          scf_ao_id,
          assessment_objective,
          assessment_procedure,
          expected_results,
          origin,
          notes_errata,
          scf_baseline_aos,
          dhs_ztcf_aos,
          nist_800_53_r5_aos,
          nist_800_171_r2_aos,
          nist_800_171_r3_aos,
          nist_800_172_aos,
          asset_type,
          assessment_status,
          inherited,
          assessment_frequency,
          last_date_assessed,
          assessment_performed_by,
          scf_version,
          created_at,
          updated_at
        `
        )
        .in("scf_ao_id", objective_ids);

      if (error) {
        log.error("assessment_objectives.batch_fetch_failed", {
          detail: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
          { error: "Failed to fetch assessment objectives" },
          { status: 500 }
        );
      }

      // Return as a map for easy lookup
      const objectiveMap =
        objectives?.reduce(
          (acc, obj) => {
            acc[obj.scf_ao_id] = obj;
            return acc;
          },
          {} as Record<string, AssessmentObjectiveRow>
        ) || {};

      return NextResponse.json(objectiveMap);
    }

    // Handle control_ids for statistics (existing functionality)
    if (!control_ids || !Array.isArray(control_ids)) {
      return NextResponse.json(
        { error: "objective_ids or control_ids array is required" },
        { status: 400 }
      );
    }

    // Get assessment objectives for the specified controls
    const { data: objectives, error } = await supabase
      .from("scf_assessment_objectives")
      .select(
        `
        scf_control_id,
        scf_ao_id,
        scf_baseline_aos,
        dhs_ztcf_aos,
        nist_800_53_r5_aos,
        nist_800_171_r2_aos,
        nist_800_171_r3_aos,
        nist_800_172_aos,
        assessment_status,
        origin
      `
      )
      .in("scf_control_id", control_ids);

    if (error) {
      log.error("assessment_objectives.stats_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch assessment statistics" }, { status: 500 });
    }

    // Calculate statistics per control
    const statsByControl =
      objectives?.reduce(
        (acc, obj) => {
          const controlId = obj.scf_control_id;
          if (!acc[controlId]) {
            acc[controlId] = {
              total_objectives: 0,
              framework_coverage: {
                scf_baseline: 0,
                dhs_ztcf: 0,
                nist_800_53_r5: 0,
                nist_800_171_r2: 0,
                nist_800_171_r3: 0,
                nist_800_172: 0,
              },
              assessment_status_counts: {
                met: 0,
                not_met: 0,
                not_tested: 0,
                not_applicable: 0,
              },
              origins: new Set(),
            };
          }

          acc[controlId].total_objectives++;

          // Count framework coverage
          if (obj.scf_baseline_aos) acc[controlId].framework_coverage.scf_baseline++;
          if (obj.dhs_ztcf_aos) acc[controlId].framework_coverage.dhs_ztcf++;
          if (obj.nist_800_53_r5_aos) acc[controlId].framework_coverage.nist_800_53_r5++;
          if (obj.nist_800_171_r2_aos) acc[controlId].framework_coverage.nist_800_171_r2++;
          if (obj.nist_800_171_r3_aos) acc[controlId].framework_coverage.nist_800_171_r3++;
          if (obj.nist_800_172_aos) acc[controlId].framework_coverage.nist_800_172++;

          // Count assessment status
          if (obj.assessment_status) {
            const status = obj.assessment_status.toLowerCase();
            if (isStatusCountKey(status)) {
              acc[controlId].assessment_status_counts[status]++;
            }
          }

          // Track origins
          if (obj.origin) {
            acc[controlId].origins.add(obj.origin);
          }

          return acc;
        },
        {} as Record<string, ControlStats>
      ) || {};

    // Convert sets to arrays and calculate percentages
    const formattedStats = Object.keys(statsByControl).reduce(
      (acc, controlId) => {
        const stats = statsByControl[controlId];
        const total = stats.total_objectives;

        acc[controlId] = {
          total_objectives: total,
          framework_coverage: stats.framework_coverage,
          assessment_status_counts: stats.assessment_status_counts,
          assessment_completion_rate:
            total > 0
              ? Math.round(
                  ((stats.assessment_status_counts.met +
                    stats.assessment_status_counts.not_applicable) /
                    total) *
                    100
                )
              : 0,
          origins: Array.from(stats.origins),
          coverage_summary: {
            frameworks_covered: Object.values(stats.framework_coverage).filter(
              (count) => (count as number) > 0
            ).length,
            most_covered_framework: Object.entries(stats.framework_coverage).reduce(
              (max, [framework, count]) => {
                const countNum = count as number;
                return countNum > max.count ? { framework, count: countNum } : max;
              },
              { framework: "", count: 0 }
            ),
          },
        };
        return acc;
      },
      {} as Record<string, unknown>
    );

    return NextResponse.json(formattedStats);
  } catch (error) {
    log.error("assessment_objectives.statistics_unhandled_error", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

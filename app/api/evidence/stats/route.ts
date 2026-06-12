import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/evidence/stats");

interface ControlMappedERLRow {
  scf_evidence_request_list: { erl_id: string };
}

interface ERLRequirementRow {
  erl_id: string;
  scf_control_evidence_mappings?: Array<{ scf_control_id: string }>;
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

    // Base query for user's evidence
    let evidenceQuery = supabase
      .from("evidence")
      .select(
        "id, evidence_status, evidence_type, scf_control_id, erl_id, erl_global_id, evidence_group_id, created_at"
      )
      .eq("user_id", user.id);

    if (controlId) {
      evidenceQuery = evidenceQuery.eq("scf_control_id", controlId);
    }

    const { data: evidence, error: evidenceError } = await evidenceQuery;

    if (evidenceError) {
      log.error("evidence.stats.get.fetch_failed", {
        detail: evidenceError instanceof Error ? evidenceError.message : String(evidenceError),
      });
      return NextResponse.json({ error: "Failed to fetch evidence statistics" }, { status: 500 });
    }

    // Calculate statistics
    const uniqueEvidenceGroups = [...new Set(evidence.map((e) => e.evidence_group_id || e.id))];
    const stats = {
      total_evidence_files: uniqueEvidenceGroups.length, // Count unique files
      total_evidence_records: evidence.length, // Count all evidence-control mappings
      by_status: {
        pending: 0,
        submitted: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        outdated: 0,
      },
      by_type: {} as Record<string, number>,
      by_control: {} as Record<string, number>,
      by_erl: {} as Record<string, number>,
      recent_uploads: 0, // Last 7 days (files)
      recent_records: 0, // Last 7 days (records)
      pending_review: 0,
      approval_rate: 0,
    };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let submittedCount = 0;
    let approvedCount = 0;
    const recentGroupIds = new Set<string>();

    evidence.forEach((item) => {
      // Status counts
      stats.by_status[item.evidence_status as keyof typeof stats.by_status]++;

      // Type counts
      stats.by_type[item.evidence_type] = (stats.by_type[item.evidence_type] || 0) + 1;

      // Control counts
      stats.by_control[item.scf_control_id] = (stats.by_control[item.scf_control_id] || 0) + 1;

      // ERL counts
      stats.by_erl[item.erl_id] = (stats.by_erl[item.erl_id] || 0) + 1;

      // Recent uploads (both files and records)
      if (new Date(item.created_at) >= sevenDaysAgo) {
        stats.recent_records++; // Count all recent records
        recentGroupIds.add(item.evidence_group_id || item.id); // Track unique files
      }

      // Approval rate calculation
      if (["submitted", "under_review", "approved", "rejected"].includes(item.evidence_status)) {
        submittedCount++;
        if (item.evidence_status === "approved") {
          approvedCount++;
        }
      }
    });

    // Set recent file uploads count
    stats.recent_uploads = recentGroupIds.size;

    stats.pending_review = stats.by_status.submitted + stats.by_status.under_review;
    stats.approval_rate =
      submittedCount > 0 ? Math.round((approvedCount / submittedCount) * 100) : 0;

    // Get ERL requirements for coverage calculation using the new junction table
    let erlRequirements;
    let erlError;

    if (controlId) {
      // Get evidence requests for specific control using junction table
      const { data, error } = await supabase
        .from("scf_control_evidence_mappings")
        .select(
          `
          scf_evidence_request_list!inner(
            erl_id
          )
        `
        )
        .eq("scf_control_id", controlId)
        .eq("is_active", true);

      erlRequirements = (data as ControlMappedERLRow[] | null)?.map((item) => ({
        erl_id: item.scf_evidence_request_list.erl_id,
      }));
      erlError = error;
    } else {
      // Get all evidence requests that have control mappings
      const { data, error } = await supabase.from("scf_evidence_request_list").select(`
          erl_id,
          scf_control_evidence_mappings!inner(
            scf_control_id
          )
        `);

      erlRequirements = data;
      erlError = error;
    }

    if (erlError) {
      log.warn("evidence.stats.get.erl_fetch_failed", {
        detail: erlError instanceof Error ? erlError.message : String(erlError),
      });
    }

    // Calculate coverage statistics
    const coverage = {
      total_requirements: 0,
      covered_requirements: 0,
      coverage_percentage: 0,
    };

    if (erlRequirements) {
      const requiredErls = new Set<string>();
      const coveredErls = new Set<string>();

      (erlRequirements as ERLRequirementRow[]).forEach((req) => {
        if (controlId) {
          // For specific control, all returned ERLs are relevant
          requiredErls.add(req.erl_id);
          if (stats.by_erl[req.erl_id] > 0) {
            coveredErls.add(req.erl_id);
          }
        } else {
          // For all controls, check if any control mapping exists
          if (req.scf_control_evidence_mappings && req.scf_control_evidence_mappings.length > 0) {
            requiredErls.add(req.erl_id);
            if (stats.by_erl[req.erl_id] > 0) {
              coveredErls.add(req.erl_id);
            }
          }
        }
      });

      coverage.total_requirements = requiredErls.size;
      coverage.covered_requirements = coveredErls.size;
      coverage.coverage_percentage =
        coverage.total_requirements > 0
          ? Math.round((coverage.covered_requirements / coverage.total_requirements) * 100)
          : 0;
    }

    return NextResponse.json({
      stats,
      coverage,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    log.error("evidence.stats.get.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

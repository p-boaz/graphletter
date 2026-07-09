import { calculateOverallResult } from "@/lib/assessment-transformer";
import { selectAllRows } from "@/lib/database/paged-select";
import type { AssessmentVerdict } from "@/lib/graph/gap-analysis";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface AssessmentVerdictRow {
  scf_control_id: string;
  assessment_result: string | null;
  evidence_id: string | null;
  completed_at: string | null;
}

interface EvidenceStatusRow {
  id: string;
}

const VERDICTS: ReadonlySet<string> = new Set(["pass", "partial", "fail"]);

async function fetchApprovedEvidenceIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const rows = await selectAllRows<EvidenceStatusRow>(() =>
    supabase
      .from("evidence")
      .select("id")
      .eq("user_id", userId)
      .eq("evidence_status", "approved")
      .order("id")
  );
  return new Set(rows.map((row) => row.id));
}

/**
 * Latest reviewed verdict per control. Assessment rows are per-objective, so
 * the control verdict aggregates the newest reviewed run's rows with the same
 * rule the review UI uses (calculateOverallResult). Only assessments whose
 * evidence has been approved count — review is the gate that moves coverage.
 * Reads drain past the PostgREST 1000-row cap via selectAllRows.
 */
export async function fetchReviewedVerdicts(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, AssessmentVerdict>> {
  const approvedEvidenceIds = await fetchApprovedEvidenceIds(supabase, userId);
  if (approvedEvidenceIds.size === 0) {
    return new Map();
  }

  const rows = await selectAllRows<AssessmentVerdictRow>(() =>
    supabase
      .from("assessments")
      .select("scf_control_id, assessment_result, evidence_id, completed_at")
      .eq("user_id", userId)
      .eq("assessment_status", "completed")
      .order("completed_at", { ascending: false })
      .order("id")
  );

  // Rows arrive newest-first; keep only the latest approved run per control.
  const latestRunEvidence = new Map<string, string>();
  const resultsByControl = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.evidence_id || !approvedEvidenceIds.has(row.evidence_id)) continue;
    if (!row.assessment_result || !VERDICTS.has(row.assessment_result)) continue;

    const runEvidence = latestRunEvidence.get(row.scf_control_id);
    if (runEvidence === undefined) {
      latestRunEvidence.set(row.scf_control_id, row.evidence_id);
      resultsByControl.set(row.scf_control_id, [row.assessment_result]);
    } else if (runEvidence === row.evidence_id) {
      resultsByControl.get(row.scf_control_id)?.push(row.assessment_result);
    }
  }

  const verdictByControl = new Map<string, AssessmentVerdict>();
  for (const [controlId, results] of resultsByControl) {
    const overall = calculateOverallResult(results);
    if (overall === "pass" || overall === "partial" || overall === "fail") {
      verdictByControl.set(controlId, overall);
    }
  }

  return verdictByControl;
}

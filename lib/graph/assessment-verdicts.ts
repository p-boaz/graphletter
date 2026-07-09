import type { AssessmentVerdict } from "@/lib/graph/gap-analysis";
import { calculateOverallResult } from "@/lib/assessment-transformer";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface AssessmentVerdictRow {
  scf_control_id: string;
  assessment_result: string | null;
  evidence_id: string | null;
}

interface EvidenceStatusRow {
  id: string;
}

const PAGE_SIZE = 1000;
const VERDICTS: ReadonlySet<string> = new Set(["pass", "partial", "fail"]);

async function fetchApprovedEvidenceIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const approvedIds = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("evidence")
      .select("id")
      .eq("user_id", userId)
      .eq("evidence_status", "approved")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as EvidenceStatusRow[];
    for (const row of rows) {
      approvedIds.add(row.id);
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return approvedIds;
}

/**
 * Latest reviewed verdict per control. Assessment rows are per-objective, so
 * the control verdict aggregates the newest reviewed run's rows with the same
 * rule the review UI uses (calculateOverallResult). Only assessments whose
 * evidence has been approved count — review is the gate that moves coverage.
 * Paginated so the PostgREST 1000-row default cap cannot silently truncate.
 */
export async function fetchReviewedVerdicts(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, AssessmentVerdict>> {
  const approvedEvidenceIds = await fetchApprovedEvidenceIds(supabase, userId);
  if (approvedEvidenceIds.size === 0) {
    return new Map();
  }

  // Newest-first objective rows, keyed to the latest approved run per control.
  const latestRunEvidence = new Map<string, string>();
  const resultsByControl = new Map<string, string[]>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("assessments")
      .select("scf_control_id, assessment_result, evidence_id")
      .eq("user_id", userId)
      .eq("assessment_status", "completed")
      .order("completed_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as AssessmentVerdictRow[];
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

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
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

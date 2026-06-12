import type { SupabaseClient } from "@supabase/supabase-js";
import { confidenceLevelToScore } from "@/lib/ai/assess-evidence/utils";
import type { AssessmentExportObjective, AssessmentExportRecord } from "@/lib/assessments/export";
import type { OverallVerdict } from "@/lib/assessments/summary";
import { chunkArray, IN_CHUNK_SIZE, selectAllRows } from "@/lib/database/paged-select";

/**
 * Loads a user's completed assessments in the shape the export serializers
 * expect. Only summary rows count — the per-objective child rows the
 * assessment pipeline also writes would duplicate every control.
 */

interface AssessmentRow {
  scf_control_id: string;
  assessment_result: string | null;
  confidence_level: string | null;
  assessment_summary: string | null;
  metadata: Record<string, unknown> | null;
  scf_controls?: { title?: string | null } | { title?: string | null }[] | null;
}

interface MappingRow {
  control_id: string;
  scf_frameworks?: { framework_name?: string | null } | { framework_name?: string | null }[] | null;
}

const VERDICTS: readonly OverallVerdict[] = ["pass", "fail", "partial", "not_applicable"];

function toVerdict(value: string | null): OverallVerdict {
  return VERDICTS.includes(value as OverallVerdict) ? (value as OverallVerdict) : "not_applicable";
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toObjectives(metadata: Record<string, unknown> | null): AssessmentExportObjective[] {
  const raw = metadata?.objective_results;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const o = entry as Record<string, unknown>;
    return [
      {
        objective_id: typeof o.objective_id === "string" ? o.objective_id : "",
        result: toVerdict(typeof o.result === "string" ? o.result : null),
        confidence:
          typeof o.confidence === "number" && Number.isFinite(o.confidence) ? o.confidence : 0,
        reasoning: typeof o.reasoning === "string" ? o.reasoning : "",
        ...(Array.isArray(o.gaps) ? { gaps: o.gaps.filter((g) => typeof g === "string") } : {}),
        ...(Array.isArray(o.recommendations)
          ? { recommendations: o.recommendations.filter((r) => typeof r === "string") }
          : {}),
      },
    ];
  });
}

function overallConfidence(objectives: AssessmentExportObjective[], level: string | null): number {
  if (objectives.length > 0) {
    const sum = objectives.reduce((acc, o) => acc + o.confidence, 0);
    return sum / objectives.length;
  }
  return confidenceLevelToScore(level);
}

async function loadFrameworksByControl(
  supabase: SupabaseClient,
  controlIds: string[]
): Promise<Map<string, string[]>> {
  const byControl = new Map<string, Set<string>>();

  for (const chunk of chunkArray(controlIds, IN_CHUNK_SIZE)) {
    const rows = await selectAllRows<MappingRow>(() =>
      supabase
        .from("scf_control_mappings")
        .select("control_id, scf_frameworks(framework_name)")
        .in("control_id", chunk)
        .order("control_id")
    );

    for (const row of rows) {
      const name = firstOf(row.scf_frameworks)?.framework_name?.trim();
      if (!name) continue;
      const existing = byControl.get(row.control_id);
      if (existing) {
        existing.add(name);
      } else {
        byControl.set(row.control_id, new Set([name]));
      }
    }
  }

  return new Map([...byControl].map(([id, names]) => [id, [...names].sort()]));
}

/**
 * Load all completed summary assessments for a user as export records,
 * sorted by control id. Throws on query errors — callers (the export route)
 * translate that into a 500 via apiError.
 */
export async function loadAssessmentExportRecords(
  supabase: SupabaseClient,
  userId: string
): Promise<AssessmentExportRecord[]> {
  const rows = await selectAllRows<AssessmentRow>(() =>
    supabase
      .from("assessments")
      .select(
        "scf_control_id, assessment_result, confidence_level, assessment_summary, metadata, scf_controls(title)"
      )
      .eq("user_id", userId)
      .eq("assessment_status", "completed")
      .or("metadata->>is_summary.eq.true,metadata->>basic_assessment.eq.true")
      .order("scf_control_id")
  );

  if (rows.length === 0) return [];

  const controlIds = [...new Set(rows.map((r) => r.scf_control_id))];
  const frameworksByControl = await loadFrameworksByControl(supabase, controlIds);

  return rows.map((row) => {
    const objectives = toObjectives(row.metadata);
    const title = firstOf(row.scf_controls)?.title?.trim();
    const frameworks = frameworksByControl.get(row.scf_control_id);

    return {
      scf_control_id: row.scf_control_id,
      ...(title ? { control_title: title } : {}),
      ...(frameworks?.length ? { frameworks } : {}),
      overall_result: toVerdict(row.assessment_result),
      overall_confidence: overallConfidence(objectives, row.confidence_level),
      ...(row.assessment_summary ? { summary: row.assessment_summary } : {}),
      objective_results: objectives,
    };
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import { selectAllRows } from "@/lib/database/paged-select";

const log = createLogger("impact-previewer");

const DEFAULT_WEIGHT = 1.0;

export interface ImpactPreview {
  currentScore: number;
  projectedScore: number;
  improvementPct: number;
  frameworkImpacts: Array<{
    frameworkName: string;
    currentScore: number;
    projectedScore: number;
    improvementPct: number;
  }>;
}

interface TierWeightRow {
  domain_id: string;
  tier: string;
  weight: number;
}

interface GapRow {
  scf_control_id: string;
  status: string;
}

interface ControlCatalogRow {
  id: string;
  domain_id: string;
}

/**
 * Calculate a posture score from gap data + weights.
 * Pure function — no DB writes. Reuses the posture-scorer aggregation logic.
 */
function computeScore(
  gaps: GapRow[],
  controlDomainMap: Map<string, string>,
  weightMap: Map<string, number>
): number {
  // Aggregate by domain
  const domainAgg = new Map<string, { total: number; compliant: number; partial: number }>();

  for (const gap of gaps) {
    const domainId = controlDomainMap.get(gap.scf_control_id) || "Unknown";
    if (!domainAgg.has(domainId)) {
      domainAgg.set(domainId, { total: 0, compliant: 0, partial: 0 });
    }
    const agg = domainAgg.get(domainId)!;
    agg.total += 1;
    if (gap.status === "compliant") agg.compliant += 1;
    else if (gap.status === "partial") agg.partial += 1;
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [domainId, agg] of domainAgg) {
    const weight = weightMap.get(domainId) ?? DEFAULT_WEIGHT;
    const rawScore = agg.total > 0 ? (agg.compliant + agg.partial * 0.5) / agg.total : 0;
    totalWeightedScore += rawScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10000) / 100 : 0;
}

/**
 * Simulate the posture impact of uploading evidence for given controls.
 * Does NOT write to DB — pure read + calculation.
 */
export async function previewUploadImpact(
  supabase: SupabaseClient,
  userId: string,
  controlIds: string[],
  frameworkId?: string | null
): Promise<ImpactPreview | null> {
  if (controlIds.length === 0) return null;

  const startMs = Date.now();

  // Fetch current gap data (paginated — control_gap_analysis can exceed 1000 rows)
  let gaps: GapRow[];
  let tiers: TierWeightRow[];
  let catalog: ControlCatalogRow[];

  try {
    [gaps, tiers, catalog] = await Promise.all([
      selectAllRows<GapRow>(() => {
        let q = supabase
          .from("control_gap_analysis")
          .select("scf_control_id, status")
          .eq("user_id", userId)
          .order("scf_control_id");
        if (frameworkId) {
          q = q.eq("framework_id", frameworkId);
        }
        return q;
      }),
      // domain_tier_weights is small (per-domain) — no pagination needed
      supabase
        .from("domain_tier_weights")
        .select("domain_id, tier, weight")
        .then((r) => {
          if (r.error) throw new Error(r.error.message);
          return (r.data as TierWeightRow[]) ?? [];
        }),
      // scf_controls full-catalog read — SCF 2026 has >1000 controls
      selectAllRows<ControlCatalogRow>(() =>
        supabase.from("scf_controls").select("id, domain_id").order("id")
      ),
    ]);
  } catch (_err) {
    log.info("impact_previewer.no_gap_data", { userId, frameworkId });
    return null;
  }

  if (!gaps.length) {
    log.info("impact_previewer.no_gap_data", { userId, frameworkId });
    return null;
  }

  const weightMap = new Map(tiers.map((t) => [t.domain_id, t.weight]));
  const controlDomainMap = new Map(catalog.map((c) => [c.id, c.domain_id]));

  // Current score
  const currentScore = computeScore(gaps, controlDomainMap, weightMap);

  // Projected score: simulate controlIds as "compliant"
  const simulatedControlIds = new Set(controlIds);
  const projectedGaps = gaps.map((g) => {
    if (simulatedControlIds.has(g.scf_control_id)) {
      return { ...g, status: "compliant" };
    }
    return g;
  });

  const projectedScore = computeScore(projectedGaps, controlDomainMap, weightMap);

  const improvementPct = Math.round((projectedScore - currentScore) * 100) / 100;

  const durationMs = Date.now() - startMs;
  log.info("impact_previewer.calculated", {
    userId,
    frameworkId,
    controlCount: controlIds.length,
    currentScore,
    projectedScore,
    improvementPct,
    durationMs,
  });

  return {
    currentScore,
    projectedScore,
    improvementPct,
    frameworkImpacts: [], // TODO: multi-framework breakdown in future
  };
}

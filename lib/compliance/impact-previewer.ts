import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import { chunkArray, IN_CHUNK_SIZE, selectAllRows } from "@/lib/database/paged-select";

const log = createLogger("impact-previewer");

const DEFAULT_WEIGHT = 1.0;

export interface ImpactPreview {
  currentScore: number;
  projectedScore: number;
  improvementPct: number;
  /**
   * Per-framework projection for frameworks affected by the submitted controls.
   * Each entry uses the same score scale as the top-level preview: 0-100 with
   * `improvementPct` expressed as projected minus current percentage points.
   */
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
  framework_id?: string | null;
}

interface ControlCatalogRow {
  id: string;
  domain_id: string;
}

interface ControlMappingRow {
  control_id: string | null;
  framework_id: string | null;
}

interface FrameworkRow {
  id: string;
  framework_name: string | null;
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

async function loadControlMappings(
  supabase: SupabaseClient,
  controlIds: string[],
  frameworkId?: string | null
): Promise<ControlMappingRow[]> {
  const mappings: ControlMappingRow[] = [];

  for (const chunk of chunkArray(controlIds, IN_CHUNK_SIZE)) {
    const chunkRows = await selectAllRows<ControlMappingRow>(() => {
      let q = supabase
        .from("scf_control_mappings")
        .select("control_id, framework_id")
        .in("control_id", chunk)
        .order("control_id")
        .order("framework_id");

      if (frameworkId) {
        q = q.eq("framework_id", frameworkId);
      }

      return q;
    });

    mappings.push(...chunkRows);
  }

  return mappings.filter((row) => row.control_id && row.framework_id);
}

async function loadFrameworks(
  supabase: SupabaseClient,
  frameworkIds: string[]
): Promise<FrameworkRow[]> {
  if (frameworkIds.length === 0) return [];

  return selectAllRows<FrameworkRow>(() =>
    supabase
      .from("scf_frameworks")
      .select("id, framework_name")
      .in("id", frameworkIds)
      .order("framework_name")
  );
}

function buildFrameworkImpacts(
  gaps: GapRow[],
  projectedGaps: GapRow[],
  mappings: ControlMappingRow[],
  frameworks: FrameworkRow[],
  simulatedControlIds: Set<string>,
  controlDomainMap: Map<string, string>,
  weightMap: Map<string, number>
): ImpactPreview["frameworkImpacts"] {
  const frameworkNames = new Map(
    frameworks
      .filter((framework): framework is FrameworkRow & { framework_name: string } =>
        Boolean(framework.framework_name)
      )
      .map((framework) => [framework.id, framework.framework_name])
  );
  const controlsByFramework = new Map<string, Set<string>>();
  const affectedFrameworkIds = new Set<string>();

  for (const mapping of mappings) {
    if (!mapping.control_id || !mapping.framework_id) continue;

    const controls = controlsByFramework.get(mapping.framework_id) ?? new Set<string>();
    controls.add(mapping.control_id);
    controlsByFramework.set(mapping.framework_id, controls);

    if (simulatedControlIds.has(mapping.control_id)) {
      affectedFrameworkIds.add(mapping.framework_id);
    }
  }

  const impacts = Array.from(affectedFrameworkIds).flatMap((frameworkId) => {
    const frameworkName = frameworkNames.get(frameworkId);
    const mappedControls = controlsByFramework.get(frameworkId);
    if (!frameworkName || !mappedControls) return [];

    const frameworkScopedGaps = gaps.filter((gap) => gap.framework_id === frameworkId);
    const frameworkScopedProjectedGaps = projectedGaps.filter(
      (gap) => gap.framework_id === frameworkId
    );
    const currentGaps = frameworkScopedGaps.length
      ? frameworkScopedGaps
      : gaps.filter((gap) => mappedControls.has(gap.scf_control_id));
    const currentProjectedGaps = frameworkScopedProjectedGaps.length
      ? frameworkScopedProjectedGaps
      : projectedGaps.filter((gap) => mappedControls.has(gap.scf_control_id));

    if (currentGaps.length === 0) return [];

    const currentScore = computeScore(currentGaps, controlDomainMap, weightMap);
    const projectedScore = computeScore(currentProjectedGaps, controlDomainMap, weightMap);

    return [
      {
        frameworkName,
        currentScore,
        projectedScore,
        improvementPct: Math.round((projectedScore - currentScore) * 100) / 100,
      },
    ];
  });

  return impacts.sort((a, b) => a.frameworkName.localeCompare(b.frameworkName));
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
          .select("scf_control_id, status, framework_id")
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
  } catch {
    log.info("impact_previewer.no_gap_data", { userId, frameworkId });
    return null;
  }

  if (!gaps.length) {
    log.info("impact_previewer.no_gap_data", { userId, frameworkId });
    return null;
  }

  const weightMap = new Map(tiers.map((t) => [t.domain_id, t.weight]));
  const controlDomainMap = new Map(catalog.map((c) => [c.id, c.domain_id]));
  const gapControlIds = Array.from(new Set(gaps.map((gap) => gap.scf_control_id)));

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
  let frameworkImpacts: ImpactPreview["frameworkImpacts"] = [];
  try {
    const mappings = await loadControlMappings(supabase, gapControlIds, frameworkId);
    const frameworks = await loadFrameworks(
      supabase,
      Array.from(
        new Set(mappings.flatMap((mapping) => (mapping.framework_id ? [mapping.framework_id] : [])))
      )
    );
    frameworkImpacts = buildFrameworkImpacts(
      gaps,
      projectedGaps,
      mappings,
      frameworks,
      simulatedControlIds,
      controlDomainMap,
      weightMap
    );
  } catch (err) {
    log.warn("impact_previewer.framework_impacts_failed", {
      userId,
      frameworkId,
      detail: err instanceof Error ? err.message : "unknown",
    });
  }

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
    frameworkImpacts,
  };
}

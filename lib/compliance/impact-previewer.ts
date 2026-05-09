import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";

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
	weightMap: Map<string, number>,
): number {
	// Aggregate by domain
	const domainAgg = new Map<
		string,
		{ total: number; compliant: number; partial: number }
	>();

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
		const rawScore =
			agg.total > 0 ? (agg.compliant + agg.partial * 0.5) / agg.total : 0;
		totalWeightedScore += rawScore * weight;
		totalWeight += weight;
	}

	return totalWeight > 0
		? Math.round((totalWeightedScore / totalWeight) * 10000) / 100
		: 0;
}

/**
 * Simulate the posture impact of uploading evidence for given controls.
 * Does NOT write to DB — pure read + calculation.
 */
export async function previewUploadImpact(
	supabase: SupabaseClient,
	userId: string,
	controlIds: string[],
	frameworkId?: string | null,
): Promise<ImpactPreview | null> {
	if (controlIds.length === 0) return null;

	const startMs = Date.now();

	// Fetch current gap data
	let gapQuery = supabase
		.from("control_gap_analysis")
		.select("scf_control_id, status")
		.eq("user_id", userId);

	if (frameworkId) {
		gapQuery = gapQuery.eq("framework_id", frameworkId);
	}

	const [gapResult, tierResult, catalogResult] = await Promise.all([
		gapQuery,
		supabase.from("domain_tier_weights").select("domain_id, tier, weight"),
		supabase.from("scf_controls").select("id, domain_id"),
	]);

	if (gapResult.error || !gapResult.data?.length) {
		log.info("impact_previewer.no_gap_data", { userId, frameworkId });
		return null;
	}

	const gaps = gapResult.data as GapRow[];
	const tiers = (tierResult.data as TierWeightRow[] | null) || [];
	const catalog = (catalogResult.data as ControlCatalogRow[] | null) || [];

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

	const projectedScore = computeScore(
		projectedGaps,
		controlDomainMap,
		weightMap,
	);

	const improvementPct =
		Math.round((projectedScore - currentScore) * 100) / 100;

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

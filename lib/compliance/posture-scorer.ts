import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";

const log = createLogger("posture-scorer");

const DEFAULT_WEIGHT = 1.0;
const DEBOUNCE_MS = 30_000;

// In-memory debounce timers per user (serverless-safe: best-effort coalescing)
const pendingRecalcs = new Map<string, NodeJS.Timeout>();

export interface DomainPosture {
	domainId: string;
	domainName: string;
	tier: "critical" | "high" | "standard";
	weight: number;
	totalControls: number;
	compliantControls: number;
	partialControls: number;
	missingControls: number;
	conflictingControls: number;
	rawScore: number;
	weightedScore: number;
}

export interface PostureScore {
	overallScore: number;
	totalControls: number;
	compliantControls: number;
	partialControls: number;
	missingControls: number;
	conflictingControls: number;
	domains: DomainPosture[];
	frameworkId: string | null;
	calculatedAt: string;
	weightFallback: boolean;
}

interface TierWeightRow {
	domain_id: string;
	tier: string;
	weight: number;
}

interface ControlGapRow {
	scf_control_id: string;
	status: string;
}

interface ControlCatalogRow {
	id: string;
	domain_id: string;
	scf_domains?: { name?: string | null } | { name?: string | null }[] | null;
}

function normalizeDomainName(
	raw: ControlCatalogRow["scf_domains"],
): string | null {
	if (!raw) return null;
	const single = Array.isArray(raw) ? raw[0] : raw;
	return single?.name?.trim() || null;
}

/**
 * Calculate compliance posture score with risk-weighted domain tiers.
 * Falls back to equal weights (1.0) if tier data is unavailable.
 */
export async function calculatePostureScore(
	supabase: SupabaseClient,
	userId: string,
	frameworkId?: string | null,
): Promise<PostureScore | null> {
	const startMs = Date.now();

	// 1. Fetch domain tier weights
	let weightMap = new Map<string, { tier: string; weight: number }>();
	let weightFallback = false;

	const { data: tierRows, error: tierError } = await supabase
		.from("domain_tier_weights")
		.select("domain_id, tier, weight");

	if (tierError || !tierRows?.length) {
		log.warn("posture_scorer.weight_fallback", {
			error: tierError?.message,
			reason: tierRows?.length ? "error" : "no_data",
		});
		weightFallback = true;
	} else {
		weightMap = new Map(
			(tierRows as TierWeightRow[]).map((r) => [
				r.domain_id,
				{ tier: r.tier, weight: r.weight },
			]),
		);
	}

	// 2. Fetch gap analysis data for user
	let gapQuery = supabase
		.from("control_gap_analysis")
		.select("scf_control_id, status")
		.eq("user_id", userId);

	if (frameworkId) {
		gapQuery = gapQuery.eq("framework_id", frameworkId);
	}

	const { data: gapRows, error: gapError } = await gapQuery;

	if (gapError) {
		log.error("posture_scorer.gap_data_error", { error: gapError.message });
		return null;
	}

	if (!gapRows?.length) {
		log.info("posture_scorer.no_gap_data", { userId, frameworkId });
		return null;
	}

	// 3. Fetch control catalog for domain mapping
	const controlIds = [
		...new Set((gapRows as ControlGapRow[]).map((r) => r.scf_control_id)),
	];
	const { data: catalogRows, error: catalogError } = await supabase
		.from("scf_controls")
		.select("id, domain_id, scf_domains(name)")
		.in("id", controlIds);

	if (catalogError) {
		log.error("posture_scorer.catalog_error", {
			error: catalogError.message,
		});
		return null;
	}

	const controlDomainMap = new Map(
		(catalogRows as ControlCatalogRow[]).map((r) => [r.id, r]),
	);

	// 4. Aggregate by domain
	const domainAgg = new Map<
		string,
		{
			domainName: string;
			total: number;
			compliant: number;
			partial: number;
			missing: number;
			conflicting: number;
		}
	>();

	for (const gap of gapRows as ControlGapRow[]) {
		const catalog = controlDomainMap.get(gap.scf_control_id);
		const domainId = catalog?.domain_id || "Unknown";
		const domainName = normalizeDomainName(catalog?.scf_domains) || domainId;

		if (!domainAgg.has(domainId)) {
			domainAgg.set(domainId, {
				domainName,
				total: 0,
				compliant: 0,
				partial: 0,
				missing: 0,
				conflicting: 0,
			});
		}

		const agg = domainAgg.get(domainId)!;
		agg.total += 1;
		if (gap.status === "compliant") agg.compliant += 1;
		else if (gap.status === "partial") agg.partial += 1;
		else if (gap.status === "conflicting") agg.conflicting += 1;
		else agg.missing += 1;
	}

	// 5. Calculate weighted scores
	let totalWeightedScore = 0;
	let totalWeight = 0;
	let overallTotalControls = 0;
	let overallCompliant = 0;
	let overallPartial = 0;
	let overallMissing = 0;
	let overallConflicting = 0;

	const domains: DomainPosture[] = [];

	for (const [domainId, agg] of domainAgg) {
		const tierInfo = weightMap.get(domainId);
		const weight = tierInfo?.weight ?? DEFAULT_WEIGHT;
		const tier =
			(tierInfo?.tier as "critical" | "high" | "standard") ?? "standard";

		// Raw score: compliant=1.0, partial=0.5, missing/conflicting=0.0
		const rawScore =
			agg.total > 0 ? (agg.compliant + agg.partial * 0.5) / agg.total : 0;

		const weightedScore = rawScore * weight;
		totalWeightedScore += weightedScore;
		totalWeight += weight;

		overallTotalControls += agg.total;
		overallCompliant += agg.compliant;
		overallPartial += agg.partial;
		overallMissing += agg.missing;
		overallConflicting += agg.conflicting;

		domains.push({
			domainId,
			domainName: agg.domainName,
			tier,
			weight,
			totalControls: agg.total,
			compliantControls: agg.compliant,
			partialControls: agg.partial,
			missingControls: agg.missing,
			conflictingControls: agg.conflicting,
			rawScore: Math.round(rawScore * 10000) / 100,
			weightedScore: Math.round(weightedScore * 100) / 100,
		});
	}

	// Overall = weighted average across domains
	const overallScore =
		totalWeight > 0
			? Math.round((totalWeightedScore / totalWeight) * 10000) / 100
			: 0;

	// Sort domains: critical first, then by coverage ascending (worst first)
	const tierOrder = { critical: 0, high: 1, standard: 2 };
	domains.sort((a, b) => {
		const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
		if (tierDiff !== 0) return tierDiff;
		return a.rawScore - b.rawScore;
	});

	const durationMs = Date.now() - startMs;
	log.info("posture_scorer.calculated", {
		userId,
		frameworkId,
		overallScore,
		totalControls: overallTotalControls,
		domainCount: domains.length,
		weightFallback,
		durationMs,
	});

	return {
		overallScore,
		totalControls: overallTotalControls,
		compliantControls: overallCompliant,
		partialControls: overallPartial,
		missingControls: overallMissing,
		conflictingControls: overallConflicting,
		domains,
		frameworkId: frameworkId ?? null,
		calculatedAt: new Date().toISOString(),
		weightFallback,
	};
}

/**
 * Save a posture score as a compliance snapshot for trend tracking.
 */
export async function savePostureSnapshot(
	supabase: SupabaseClient,
	userId: string,
	score: PostureScore,
): Promise<void> {
	const { error } = await supabase.from("compliance_snapshots").insert({
		user_id: userId,
		framework_id: score.frameworkId,
		score: score.overallScore,
		total_controls: score.totalControls,
		compliant_controls: score.compliantControls,
		partial_controls: score.partialControls,
		missing_controls: score.missingControls,
		domain_breakdown: score.domains,
		metadata: {
			weight_fallback: score.weightFallback,
			conflicting_controls: score.conflictingControls,
		},
	});

	if (error) {
		log.warn("posture_scorer.snapshot_failed", { error: error.message });
	} else {
		log.info("posture_scorer.snapshot_saved", {
			userId,
			frameworkId: score.frameworkId,
			score: score.overallScore,
		});
	}
}

/**
 * Recalculate posture score and save snapshot.
 */
export async function recalculateAndSnapshot(
	supabase: SupabaseClient,
	userId: string,
	frameworkId?: string | null,
): Promise<PostureScore | null> {
	const score = await calculatePostureScore(supabase, userId, frameworkId);
	if (score) {
		await savePostureSnapshot(supabase, userId, score);
	}
	return score;
}

/**
 * Enqueue a debounced posture recalculation.
 * Multiple calls within 30s for the same user coalesce into one recalc.
 */
export function enqueuePostureRecalc(
	supabase: SupabaseClient,
	userId: string,
): void {
	const existing = pendingRecalcs.get(userId);
	if (existing) {
		clearTimeout(existing);
	}

	const timer = setTimeout(() => {
		pendingRecalcs.delete(userId);
		recalculateAndSnapshot(supabase, userId).catch((err) => {
			log.error("posture_scorer.debounced_recalc_failed", {
				userId,
				error: err instanceof Error ? err.message : "unknown",
			});
		});
	}, DEBOUNCE_MS);

	pendingRecalcs.set(userId, timer);
	log.debug("posture_scorer.recalc_enqueued", {
		userId,
		debounceMs: DEBOUNCE_MS,
	});
}

/**
 * Fetch recent compliance snapshots for trend display.
 */
export async function getPostureHistory(
	supabase: SupabaseClient,
	userId: string,
	frameworkId?: string | null,
	limit = 30,
): Promise<
	Array<{
		score: number;
		createdAt: string;
		totalControls: number;
		compliantControls: number;
	}>
> {
	let query = supabase
		.from("compliance_snapshots")
		.select("score, created_at, total_controls, compliant_controls")
		.eq("user_id", userId)
		.order("created_at", { ascending: true })
		.limit(limit);

	if (frameworkId) {
		query = query.eq("framework_id", frameworkId);
	} else {
		query = query.is("framework_id", null);
	}

	const { data, error } = await query;

	if (error) {
		log.warn("posture_scorer.history_error", { error: error.message });
		return [];
	}

	return (data || []).map((row) => ({
		score: Number(row.score),
		createdAt: row.created_at,
		totalControls: row.total_controls,
		compliantControls: row.compliant_controls,
	}));
}

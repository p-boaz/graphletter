import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";

const log = createLogger("freshness-engine");

const GLOBAL_DEFAULT_MAX_AGE_DAYS = 365;
const EXPIRING_THRESHOLD_DAYS = 30;

export type FreshnessStatus = "fresh" | "expiring" | "stale";

export interface EvidenceFreshness {
	evidenceId: string;
	fileName: string;
	evidenceType: string;
	scfControlId: string | null;
	submittedAt: string;
	expiresAt: string;
	daysUntilExpiry: number;
	status: FreshnessStatus;
	ruleSource:
		| "user_override"
		| "framework_rule"
		| "type_default"
		| "global_default";
}

export interface FreshnessScanResult {
	items: EvidenceFreshness[];
	summary: {
		fresh: number;
		expiring: number;
		stale: number;
	};
	scannedAt: string;
}

interface FreshnessRule {
	evidence_type: string | null;
	framework_id: string | null;
	max_age_days: number;
}

interface ExpiryOverride {
	evidence_id: string;
	expires_at: string;
}

interface EvidenceRow {
	id: string;
	file_name: string;
	evidence_type: string;
	scf_control_id: string | null;
	submitted_at: string;
	evidence_status: string;
}

function classifyFreshness(daysUntilExpiry: number): FreshnessStatus {
	if (daysUntilExpiry < 0) return "stale";
	if (daysUntilExpiry <= EXPIRING_THRESHOLD_DAYS) return "expiring";
	return "fresh";
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/**
 * Resolve the max age in days for a given evidence type and optional framework.
 * Layered resolution: framework+type > framework-wide > type default > global default.
 */
function resolveMaxAgeDays(
	rules: FreshnessRule[],
	evidenceType: string,
	frameworkId?: string | null,
): { maxAgeDays: number; ruleSource: EvidenceFreshness["ruleSource"] } {
	// Layer 1: framework + specific type
	if (frameworkId) {
		const frameworkTypeRule = rules.find(
			(r) => r.framework_id === frameworkId && r.evidence_type === evidenceType,
		);
		if (frameworkTypeRule) {
			return {
				maxAgeDays: frameworkTypeRule.max_age_days,
				ruleSource: "framework_rule",
			};
		}

		// Layer 2: framework-wide default (evidence_type IS NULL)
		const frameworkDefault = rules.find(
			(r) => r.framework_id === frameworkId && r.evidence_type === null,
		);
		if (frameworkDefault) {
			return {
				maxAgeDays: frameworkDefault.max_age_days,
				ruleSource: "framework_rule",
			};
		}
	}

	// Layer 3: type default (framework_id IS NULL)
	const typeDefault = rules.find(
		(r) => r.framework_id === null && r.evidence_type === evidenceType,
	);
	if (typeDefault) {
		return {
			maxAgeDays: typeDefault.max_age_days,
			ruleSource: "type_default",
		};
	}

	// Layer 4: global default
	return {
		maxAgeDays: GLOBAL_DEFAULT_MAX_AGE_DAYS,
		ruleSource: "global_default",
	};
}

/**
 * Scan all evidence for a user and compute freshness status.
 * Applies layered rules: user override > framework rule > type default > global default.
 */
export async function scanEvidenceFreshness(
	supabase: SupabaseClient,
	userId: string,
	frameworkId?: string | null,
): Promise<FreshnessScanResult> {
	const startMs = Date.now();
	const now = new Date();

	// Fetch active evidence for user
	const { data: evidenceRows, error: evidenceError } = await supabase
		.from("evidence")
		.select(
			"id, file_name, evidence_type, scf_control_id, submitted_at, evidence_status",
		)
		.eq("user_id", userId)
		.in("evidence_status", [
			"approved",
			"completed",
			"submitted",
			"under_review",
		]);

	if (evidenceError) {
		log.warn("freshness_engine.evidence_fetch_error", {
			error: evidenceError.message,
		});
		return {
			items: [],
			summary: { fresh: 0, expiring: 0, stale: 0 },
			scannedAt: now.toISOString(),
		};
	}

	if (!evidenceRows?.length) {
		return {
			items: [],
			summary: { fresh: 0, expiring: 0, stale: 0 },
			scannedAt: now.toISOString(),
		};
	}

	// Batch-fetch freshness rules and user overrides in parallel
	const [rulesResult, overridesResult] = await Promise.all([
		supabase
			.from("evidence_freshness_rules")
			.select("evidence_type, framework_id, max_age_days"),
		supabase
			.from("evidence_expiry_overrides")
			.select("evidence_id, expires_at")
			.eq("user_id", userId),
	]);

	const rules = (rulesResult.data as FreshnessRule[] | null) || [];
	const overrides = (overridesResult.data as ExpiryOverride[] | null) || [];

	if (rulesResult.error) {
		log.warn("freshness_engine.rules_fetch_error", {
			error: rulesResult.error.message,
		});
	}
	if (overridesResult.error) {
		log.warn("freshness_engine.overrides_fetch_error", {
			error: overridesResult.error.message,
		});
	}

	const overrideMap = new Map(
		overrides.map((o) => [o.evidence_id, o.expires_at]),
	);

	// Deduplicate by evidence_group: keep one entry per unique file+artifact
	const seen = new Map<string, EvidenceRow>();
	for (const row of evidenceRows as EvidenceRow[]) {
		const key = `${row.file_name}::${row.evidence_type}`;
		const existing = seen.get(key);
		if (
			!existing ||
			new Date(row.submitted_at) > new Date(existing.submitted_at)
		) {
			seen.set(key, row);
		}
	}

	const items: EvidenceFreshness[] = [];

	for (const row of seen.values()) {
		let expiresAt: Date;
		let ruleSource: EvidenceFreshness["ruleSource"];

		// Check user override first
		const userOverride = overrideMap.get(row.id);
		if (userOverride) {
			expiresAt = new Date(userOverride);
			ruleSource = "user_override";
		} else {
			const resolved = resolveMaxAgeDays(rules, row.evidence_type, frameworkId);
			expiresAt = addDays(new Date(row.submitted_at), resolved.maxAgeDays);
			ruleSource = resolved.ruleSource;
		}

		const daysUntilExpiry = Math.ceil(
			(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);

		items.push({
			evidenceId: row.id,
			fileName: row.file_name,
			evidenceType: row.evidence_type,
			scfControlId: row.scf_control_id,
			submittedAt: row.submitted_at,
			expiresAt: expiresAt.toISOString(),
			daysUntilExpiry,
			status: classifyFreshness(daysUntilExpiry),
			ruleSource,
		});
	}

	// Sort by most urgent first
	items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

	const summary = {
		fresh: items.filter((i) => i.status === "fresh").length,
		expiring: items.filter((i) => i.status === "expiring").length,
		stale: items.filter((i) => i.status === "stale").length,
	};

	const durationMs = Date.now() - startMs;
	log.info("freshness_engine.scan_completed", {
		userId,
		frameworkId,
		totalItems: items.length,
		...summary,
		durationMs,
	});

	return { items, summary, scannedAt: now.toISOString() };
}

/**
 * Get freshness status for a single evidence item (for the health dot).
 * Lightweight — only queries the specific evidence item's rules.
 */
export async function getEvidenceFreshnessStatus(
	supabase: SupabaseClient,
	evidenceId: string,
	evidenceType: string,
	submittedAt: string,
	userId: string,
): Promise<FreshnessStatus> {
	const now = new Date();

	// Check user override first
	const { data: override } = await supabase
		.from("evidence_expiry_overrides")
		.select("expires_at")
		.eq("evidence_id", evidenceId)
		.eq("user_id", userId)
		.maybeSingle();

	if (override) {
		const days = Math.ceil(
			(new Date(override.expires_at).getTime() - now.getTime()) /
				(1000 * 60 * 60 * 24),
		);
		return classifyFreshness(days);
	}

	// Fetch all rules (small table, ok to load all)
	const { data: rules } = await supabase
		.from("evidence_freshness_rules")
		.select("evidence_type, framework_id, max_age_days");

	const resolved = resolveMaxAgeDays(
		(rules as FreshnessRule[] | null) || [],
		evidenceType,
	);
	const expiresAt = addDays(new Date(submittedAt), resolved.maxAgeDays);
	const daysUntilExpiry = Math.ceil(
		(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
	);

	return classifyFreshness(daysUntilExpiry);
}

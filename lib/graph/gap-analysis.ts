import { coverageStrengthRank } from "@/lib/graph/service";

export type MappingPolarity = "supports" | "contradicts";

export type GraphGapStatus =
	| "compliant"
	| "partial"
	| "missing"
	| "conflicting";

export interface ControlMappingRecord {
	scf_control_id: string;
	coverage_strength?: string | null;
	atom_id?: string | null;
	mapping_polarity?: string | null;
}

export interface ControlGapComputation {
	scfControlId: string;
	status: GraphGapStatus;
	gapType: string;
	summary: string;
	supportingAtomIds: string[];
	strongestSupportRank: number;
	strongestContradictionRank: number;
}

interface ControlAccumulator {
	strongestSupportRank: number;
	strongestContradictionRank: number;
	supportingAtomIds: Set<string>;
	contradictingAtomIds: Set<string>;
}

function normalizePolarity(rawPolarity?: string | null): MappingPolarity {
	return rawPolarity === "contradicts" ? "contradicts" : "supports";
}

function statusToGapType(
	status: GraphGapStatus,
	strongestSupportRank: number,
): string {
	if (status === "conflicting") return "conflicting_evidence";
	if (status === "compliant") return "covered_by_strong_or_moderate_evidence";
	if (status === "partial") return "covered_by_weak_evidence";
	if (strongestSupportRank === 1) return "explicit_no_coverage_mapping";
	return "no_evidence_mapping";
}

function buildGapSummary(
	controlId: string,
	status: GraphGapStatus,
	strongestSupportRank: number,
	strongestContradictionRank: number,
): string {
	if (status === "conflicting") {
		return `Control ${controlId} has conflicting mapped evidence (support rank ${strongestSupportRank}, contradiction rank ${strongestContradictionRank}).`;
	}

	if (status === "compliant") {
		return `Control ${controlId} has moderate/strong supporting mapped evidence.`;
	}

	if (status === "partial") {
		return `Control ${controlId} is only weakly covered by supporting mapped evidence.`;
	}

	return `Control ${controlId} has no supporting mapped evidence atoms.`;
}

function resolveStatus(
	strongestSupportRank: number,
	strongestContradictionRank: number,
): GraphGapStatus {
	if (strongestContradictionRank > 0) return "conflicting";
	if (strongestSupportRank >= 3) return "compliant";
	if (strongestSupportRank >= 2) return "partial";
	return "missing";
}

export function computeControlGaps(
	controlIds: string[],
	mappings: ControlMappingRecord[],
): ControlGapComputation[] {
	const controlMap = new Map<string, ControlAccumulator>();

	for (const controlId of controlIds) {
		controlMap.set(controlId, {
			strongestSupportRank: 0,
			strongestContradictionRank: 0,
			supportingAtomIds: new Set<string>(),
			contradictingAtomIds: new Set<string>(),
		});
	}

	for (const mapping of mappings) {
		const control = controlMap.get(mapping.scf_control_id);
		if (!control) continue;

		const polarity = normalizePolarity(mapping.mapping_polarity);
		const rank = coverageStrengthRank(mapping.coverage_strength || "none");
		const atomId = mapping.atom_id || undefined;

		if (polarity === "contradicts") {
			if (rank > control.strongestContradictionRank) {
				control.strongestContradictionRank = rank;
			}
			if (atomId) {
				control.contradictingAtomIds.add(atomId);
			}
			continue;
		}

		if (rank > control.strongestSupportRank) {
			control.strongestSupportRank = rank;
		}
		if (atomId) {
			control.supportingAtomIds.add(atomId);
		}
	}

	return controlIds.map((controlId) => {
		const current = controlMap.get(controlId);
		const strongestSupportRank = current?.strongestSupportRank ?? 0;
		const strongestContradictionRank = current?.strongestContradictionRank ?? 0;
		const status = resolveStatus(
			strongestSupportRank,
			strongestContradictionRank,
		);
		const gapType = statusToGapType(status, strongestSupportRank);

		return {
			scfControlId: controlId,
			status,
			gapType,
			summary: buildGapSummary(
				controlId,
				status,
				strongestSupportRank,
				strongestContradictionRank,
			),
			supportingAtomIds: [
				...(current?.supportingAtomIds || new Set<string>()),
				...(current?.contradictingAtomIds || new Set<string>()),
			],
			strongestSupportRank,
			strongestContradictionRank,
		};
	});
}

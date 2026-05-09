import type { LiveAssessmentProgress, LiveAssessmentResult } from "./types";

export function createInitialAssessmentProgress(
	totalControls = 0,
): LiveAssessmentProgress {
	return {
		totalControls,
		completedControls: 0,
		currentControlId: null,
		currentControlNumber: 0,
		averageControlDurationMs: null,
		estimatedRemainingMs: null,
		results: [],
	};
}

export function toAssessmentResult(
	value: unknown,
): LiveAssessmentResult | null {
	if (
		value === "pass" ||
		value === "fail" ||
		value === "partial" ||
		value === "not_applicable" ||
		value === "error"
	) {
		return value;
	}
	return null;
}

export function formatResultLabel(result: LiveAssessmentResult): string {
	if (result === "not_applicable") return "N/A";
	if (result === "error") return "Error";
	return result.replace("_", " ").toUpperCase();
}

export function getResultBadgeClasses(result: LiveAssessmentResult): string {
	if (result === "pass") return "border-green-300 bg-green-100 text-green-800";
	if (result === "fail") return "border-red-300 bg-red-100 text-red-800";
	if (result === "partial")
		return "border-yellow-300 bg-yellow-100 text-yellow-800";
	if (result === "not_applicable")
		return "border-gray-300 bg-gray-100 text-gray-700";
	return "border-red-300 bg-red-100 text-red-800";
}

export function formatEta(estimatedRemainingMs: number | null): string {
	if (estimatedRemainingMs === null) return "ETA calculating...";
	if (estimatedRemainingMs <= 0) return "ETA < 1 min";

	const totalSeconds = Math.ceil(estimatedRemainingMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes >= 60) {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `ETA ${hours}h ${remainingMinutes}m`;
	}

	if (minutes > 0) {
		return `ETA ${minutes}m ${seconds}s`;
	}

	return `ETA ${seconds}s`;
}

import type { LiveAssessmentProgress, LiveAssessmentResult } from "./types";

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function createInitialAssessmentProgress(totalControls = 0): LiveAssessmentProgress {
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

export function toAssessmentResult(value: unknown): LiveAssessmentResult | null {
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

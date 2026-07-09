export interface ObjectiveAssessmentQualityInput {
  objective_id: string;
  result?: string;
  confidence: number;
  evidence_quotes?: unknown[];
}

const MIN_OBJECTIVE_COVERAGE = 0.6;
const MIN_AVERAGE_CONFIDENCE = 0.35;

export function validateObjectiveAssessmentQuality(
  objectiveResults: ObjectiveAssessmentQualityInput[],
  totalObjectives: number
): { isValid: boolean; reason?: string } {
  if (!objectiveResults.length) {
    return {
      isValid: false,
      reason: "No objective assessments were generated",
    };
  }

  if (totalObjectives <= 0) {
    return { isValid: true };
  }

  const uniqueObjectiveIds = new Set(objectiveResults.map((result) => result.objective_id));
  const coverage = uniqueObjectiveIds.size / totalObjectives;
  if (coverage < MIN_OBJECTIVE_COVERAGE) {
    return {
      isValid: false,
      reason: `Objective coverage too low (${Math.round(coverage * 100)}%)`,
    };
  }

  const averageConfidence =
    objectiveResults.reduce((sum, result) => sum + result.confidence, 0) / objectiveResults.length;
  if (averageConfidence < MIN_AVERAGE_CONFIDENCE) {
    return {
      isValid: false,
      reason: `Average confidence too low (${Math.round(averageConfidence * 100)}%)`,
    };
  }

  const unsupportedPositiveResults = objectiveResults.filter(
    (result) =>
      (result.result === "pass" || result.result === "partial") &&
      (!Array.isArray(result.evidence_quotes) || result.evidence_quotes.length === 0)
  );
  if (unsupportedPositiveResults.length > 0) {
    return {
      isValid: false,
      reason: `${unsupportedPositiveResults.length} pass/partial objective(s) lack verified evidence spans`,
    };
  }

  return { isValid: true };
}

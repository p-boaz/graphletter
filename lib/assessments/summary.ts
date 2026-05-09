export type ObjectiveStatus = "pass" | "fail" | "partial" | "not_applicable";
export type OverallVerdict = "pass" | "fail" | "partial" | "not_applicable";

export interface AssessmentHeadline {
  passed: number;
  total: number;
  passRatePercent: number | null;
  verdict: string;
  confidencePercent: number;
}

export function assessmentHeadline(input: {
  objectives: { status: ObjectiveStatus }[];
  overall: OverallVerdict;
  confidence: number;
}): AssessmentHeadline {
  const total = input.objectives.length;
  const passed = input.objectives.filter((o) => o.status === "pass").length;
  return {
    passed,
    total,
    passRatePercent: total === 0 ? null : Math.round((passed / total) * 100),
    verdict: input.overall.toUpperCase().replace("_", " "),
    confidencePercent: Math.round(input.confidence * 100),
  };
}

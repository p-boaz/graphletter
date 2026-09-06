import type { AssessmentResult, AssessmentReviewResult } from "./types";

export function getResultWeight(resultValue?: string | null) {
  if (resultValue === "pass") return 1;
  if (resultValue === "partial") return 0.5;
  if (resultValue === "fail") return 0;
  return null;
}

export function getOverallScore(result: AssessmentReviewResult) {
  let weightedScore = 0;
  let scoredItems = 0;

  for (const assessment of result.assessments) {
    const objectiveResults = assessment.objective_results || [];
    if (objectiveResults.length > 0) {
      for (const objective of objectiveResults) {
        const weight = getResultWeight(objective.result);
        if (weight !== null) {
          weightedScore += weight;
          scoredItems += 1;
        }
      }
      continue;
    }

    const fallbackWeight = getResultWeight(assessment?.overall_result);
    if (fallbackWeight !== null) {
      weightedScore += fallbackWeight;
      scoredItems += 1;
    }
  }

  if (scoredItems === 0) {
    return 0;
  }

  return Math.round((weightedScore / scoredItems) * 100);
}

export function getAssessmentResultDisplay(assessment: AssessmentResult) {
  return assessment?.overall_result?.toUpperCase() ?? "UNKNOWN";
}

export function getAssessmentConfidence(assessment: AssessmentResult) {
  return Math.round((assessment?.overall_confidence ?? 0) * 100);
}

export function getObjectiveResultGuidance(result: string) {
  if (result === "pass") return "Evidence supports this objective.";
  if (result === "partial") return "Evidence supports part of this objective.";
  if (result === "fail") return "Evidence does not currently demonstrate this objective.";
  return "Objective applicability depends on context.";
}

export function getTopGapAndRecommendation(assessment: AssessmentResult) {
  if (!assessment.objective_results?.length) {
    return {
      topGap: null as string | null,
      topRecommendation: null as string | null,
    };
  }

  let topGap: string | null = null;
  let topRecommendation: string | null = null;

  for (const objective of assessment.objective_results) {
    if (!topGap && objective.gaps?.length) {
      topGap = objective.gaps.find((gap) => gap.trim().length > 0) ?? null;
    }

    if (!topRecommendation && objective.recommendations?.length) {
      topRecommendation = objective.recommendations.find((rec) => rec.trim().length > 0) ?? null;
    }

    if (topGap && topRecommendation) {
      break;
    }
  }

  return { topGap, topRecommendation };
}

export interface DistributionSegment {
  key: string;
  label: string;
  count: number;
  barClass: string;
  textClass: string;
}

export function buildDistributionSegments(result: AssessmentReviewResult): DistributionSegment[] {
  const assessmentCounts = result.assessments.reduce(
    (counts, assessment) => {
      if (assessment.overall_result === "pass") counts.pass += 1;
      else if (assessment.overall_result === "fail") counts.fail += 1;
      else if (assessment.overall_result === "partial") counts.partial += 1;
      else counts.notApplicable += 1;
      return counts;
    },
    { pass: 0, fail: 0, partial: 0, notApplicable: 0 }
  );

  return [
    {
      key: "pass",
      label: "Pass",
      count: assessmentCounts.pass,
      barClass: "bg-green-500",
      textClass: "text-green-700",
    },
    {
      key: "partial",
      label: "Partial",
      count: assessmentCounts.partial,
      barClass: "bg-yellow-500",
      textClass: "text-yellow-700",
    },
    {
      key: "fail",
      label: "Fail",
      count: assessmentCounts.fail,
      barClass: "bg-red-500",
      textClass: "text-red-700",
    },
    {
      key: "not_applicable",
      label: "N/A",
      count: assessmentCounts.notApplicable,
      barClass: "bg-gray-400",
      textClass: "text-gray-700",
    },
  ].filter((segment) => segment.count > 0);
}

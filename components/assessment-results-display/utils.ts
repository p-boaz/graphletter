import type { ControlGroup, ControlObjective, UnifiedAssessmentResult } from "./types";

export function getControlOverallResult(objectives: ControlObjective[]) {
  if (objectives.length === 0) return "not_applicable";

  const results = objectives.map((obj) => obj.result);
  if (results.every((r) => r === "pass")) return "pass";
  if (results.every((r) => r === "fail")) return "fail";
  if (results.some((r) => r === "pass")) return "partial";
  return "fail";
}

export function getControlOverallConfidence(objectives: ControlObjective[]) {
  if (objectives.length === 0) return 0;
  return objectives.reduce((sum, obj) => sum + obj.confidence, 0) / objectives.length;
}

export function getTopGapAndRecommendation(objectives: ControlObjective[]) {
  let topGap: string | null = null;
  let topRecommendation: string | null = null;

  for (const objective of objectives) {
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

export function getObjectiveResultGuidance(result: string) {
  if (result === "pass") {
    return "Evidence supports this objective.";
  }
  if (result === "partial") {
    return "Evidence is incomplete for this objective.";
  }
  if (result === "fail") {
    return "Evidence does not demonstrate this objective.";
  }
  return "Objective applicability depends on context.";
}

export function buildControlGroups(assessments: UnifiedAssessmentResult[]) {
  return assessments.reduce(
    (groups, assessment) => {
      const controlId = assessment.scf_control_id;
      if (!groups[controlId]) {
        groups[controlId] = {
          control_id: controlId,
          control_title: assessment.control_title,
          control_description: assessment.control_description,
          control_guidance: assessment.control_guidance,
          domain_name: assessment.domain_name,
          completed_at: assessment.completed_at,
          assessment_status: assessment.assessment_status,
          ai_generated: assessment.ai_generated,
          linked_evidence: assessment.linked_evidence || [],
          evidenceByAssessmentId: {},
          completedAtByAssessmentId: {},
          objectives: [],
          maturity_assessment: assessment.maturity_assessment || null,
          maturity_levels: assessment.maturity_levels || null,
        };
      }

      if (assessment.objective_results) {
        groups[controlId].objectives.push(
          ...assessment.objective_results.map((obj) => ({
            ...obj,
            assessment_id: assessment.id,
          }))
        );
      }

      if (assessment.maturity_assessment) {
        groups[controlId].maturity_assessment = assessment.maturity_assessment;
      }

      if (assessment.maturity_levels) {
        groups[controlId].maturity_levels = assessment.maturity_levels;
      }

      if (assessment.completed_at) {
        groups[controlId].completedAtByAssessmentId[assessment.id] = assessment.completed_at;
      }

      if (assessment.assessment_status === "approved") {
        groups[controlId].assessment_status = "approved";
      } else if (groups[controlId].assessment_status !== "approved") {
        groups[controlId].assessment_status =
          assessment.assessment_status || groups[controlId].assessment_status;
      }

      if (assessment.linked_evidence && assessment.linked_evidence.length > 0) {
        groups[controlId].evidenceByAssessmentId[assessment.id] = assessment.linked_evidence;
      }

      return groups;
    },
    {} as Record<string, ControlGroup>
  );
}

/**
 * Assessment Transformer
 *
 * Converts automated assessment records from the database into the format
 * expected by the AssessmentReviewDialog component.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaturityAssessment } from "@/lib/client/smart-evidence-workflow";

export interface AssessmentResult {
	id: string;
	scf_control_id: string;
	overall_result: "pass" | "fail" | "partial" | "not_applicable";
	overall_confidence: number;
	summary: string;
	control_title?: string;
	control_description?: string;
	objective_results?: Array<{
		scf_ao_id?: string;
		assessment_objective?: string;
		assessment_procedure?: string;
		expected_results?: string;
		result: string;
		confidence: number;
		reasoning: string;
	}>;
	maturity_assessment?: MaturityAssessment | null;
}

export interface AssessmentReviewResult {
	assessments: AssessmentResult[];
	source: {
		type: "evidence" | "automated";
		name: string;
		id: string;
	};
}

interface RawAssessmentRecord {
	id: string;
	user_id: string;
	evidence_id?: string;
	scf_control_id: string;
	scf_ao_id: string;
	assessment_result: "pass" | "fail" | "partial" | "not_applicable";
	confidence_score: number;
	ai_reasoning: string;
	metadata?: Record<string, unknown>;
	created_at: string;
}

interface ControlInfo {
	id: string;
	title: string;
	description: string;
}

interface AssessmentObjectiveInfo {
	scf_ao_id: string;
	assessment_objective: string;
	assessment_procedure?: string;
	expected_results?: string;
}

/**
 * Transform raw automated assessment records into AssessmentReviewResult format
 */
export async function transformAssessmentsForReview(
	rawAssessments: RawAssessmentRecord[],
	supabase: SupabaseClient,
	sourceType: "evidence" | "automated",
	sourceName: string,
	sourceId: string,
): Promise<AssessmentReviewResult> {
	if (!rawAssessments.length) {
		return {
			assessments: [],
			source: { type: sourceType, name: sourceName, id: sourceId },
		};
	}

	// Get unique control IDs and AO IDs
	const controlIds = Array.from(
		new Set(rawAssessments.map((a) => a.scf_control_id)),
	);
	const aoIds = Array.from(new Set(rawAssessments.map((a) => a.scf_ao_id)));

	// Fetch control information
	const { data: controlsData, error: controlsError } = await supabase
		.from("scf_controls")
		.select("id, title, description")
		.in("id", controlIds);

	if (controlsError) {
		console.error("Error fetching control data:", controlsError);
	}

	// Fetch assessment objective information
	const { data: aoData, error: aoError } = await supabase
		.from("scf_assessment_objectives")
		.select(
			"scf_ao_id, assessment_objective, assessment_procedure, expected_results",
		)
		.in("scf_ao_id", aoIds);

	if (aoError) {
		console.error("Error fetching AO data:", aoError);
	}

	// Create lookup maps
	const controlMap = new Map<string, ControlInfo>();
	((controlsData || []) as ControlInfo[]).forEach((control) => {
		controlMap.set(control.id, control);
	});

	const aoMap = new Map<string, AssessmentObjectiveInfo>();
	((aoData || []) as AssessmentObjectiveInfo[]).forEach((ao) => {
		aoMap.set(ao.scf_ao_id, ao);
	});

	// Group assessments by control
	const controlGroups = new Map<string, RawAssessmentRecord[]>();
	rawAssessments.forEach((assessment) => {
		const controlId = assessment.scf_control_id;
		if (!controlGroups.has(controlId)) {
			controlGroups.set(controlId, []);
		}
		controlGroups.get(controlId)!.push(assessment);
	});

	// Transform each control group into an AssessmentResult
	const transformedAssessments: AssessmentResult[] = [];

	controlGroups.forEach((assessments, controlId) => {
		const controlInfo = controlMap.get(controlId);

		// Calculate overall result for this control
		const results = assessments.map((a) => a.assessment_result);
		const overallResult = calculateOverallResult(results);

		// Calculate overall confidence (average of all assessments for this control)
		const overallConfidence =
			assessments.reduce((sum, a) => sum + a.confidence_score, 0) /
			assessments.length;

		// Generate summary
		const summary = generateControlSummary(controlId, assessments, controlInfo);

		// Transform objective results
		const objectiveResults = assessments.map((assessment) => {
			const aoInfo = aoMap.get(assessment.scf_ao_id);
			return {
				scf_ao_id: assessment.scf_ao_id,
				assessment_objective:
					aoInfo?.assessment_objective || "Assessment objective not found",
				assessment_procedure: aoInfo?.assessment_procedure,
				expected_results: aoInfo?.expected_results,
				result: assessment.assessment_result,
				confidence: assessment.confidence_score,
				reasoning: assessment.ai_reasoning || "No reasoning provided",
			};
		});

		transformedAssessments.push({
			id: assessments[0].id, // Use first assessment ID as primary
			scf_control_id: controlId,
			overall_result: overallResult,
			overall_confidence: overallConfidence,
			summary,
			control_title: controlInfo?.title,
			control_description: controlInfo?.description,
			objective_results: objectiveResults,
			maturity_assessment: null,
		});
	});

	return {
		assessments: transformedAssessments,
		source: {
			type: sourceType,
			name: sourceName,
			id: sourceId,
		},
	};
}

/**
 * Calculate overall result for a control based on individual assessment results
 */
function calculateOverallResult(
	results: string[],
): "pass" | "fail" | "partial" | "not_applicable" {
	if (results.length === 0) return "not_applicable";

	const uniqueResults = Array.from(new Set(results));

	// If all results are the same, return that result
	if (uniqueResults.length === 1) {
		return uniqueResults[0] as "pass" | "fail" | "partial" | "not_applicable";
	}

	// If we have mixed results, determine overall status
	const hasPass = results.includes("pass");
	const hasFail = results.includes("fail");
	const hasPartial = results.includes("partial");

	// If any fail, overall is fail
	if (hasFail) return "fail";

	// If mixed pass/partial, overall is partial
	if (hasPass && hasPartial) return "partial";

	// If only partial results, overall is partial
	if (hasPartial) return "partial";

	// Default to the first result
	return results[0] as "pass" | "fail" | "partial" | "not_applicable";
}

/**
 * Generate a summary for the control based on its assessments
 */
function generateControlSummary(
	controlId: string,
	assessments: RawAssessmentRecord[],
	controlInfo?: ControlInfo,
): string {
	const objectiveCount = assessments.length;
	const passCount = assessments.filter(
		(a) => a.assessment_result === "pass",
	).length;
	const failCount = assessments.filter(
		(a) => a.assessment_result === "fail",
	).length;
	const partialCount = assessments.filter(
		(a) => a.assessment_result === "partial",
	).length;

	const avgConfidence = Math.round(
		(assessments.reduce((sum, a) => sum + a.confidence_score, 0) /
			assessments.length) *
			100,
	);

	let summary = `Automated assessment of ${controlId}`;
	if (controlInfo?.title) {
		summary += ` (${controlInfo.title})`;
	}

	summary += ` completed with ${objectiveCount} assessment objective${objectiveCount !== 1 ? "s" : ""}.`;

	// Add results breakdown
	const resultParts = [];
	if (passCount > 0) resultParts.push(`${passCount} passed`);
	if (partialCount > 0) resultParts.push(`${partialCount} partially met`);
	if (failCount > 0) resultParts.push(`${failCount} failed`);

	if (resultParts.length > 0) {
		summary += ` Results: ${resultParts.join(", ")}.`;
	}

	summary += ` Average confidence: ${avgConfidence}%.`;

	// Add any metadata insights
	const firstAssessment = assessments[0];
	const coverageRatio = firstAssessment.metadata?.coverage_ratio;
	if (typeof coverageRatio === "number") {
		const coverage = Math.round(coverageRatio * 100);
		summary += ` Coverage: ${coverage}% of resources comply.`;
	}

	return summary;
}

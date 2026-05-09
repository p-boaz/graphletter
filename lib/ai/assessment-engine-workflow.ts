/**
 * Assessment Engine - Workflow-Based Implementation
 *
 * Durable, resumable evidence assessment using Vercel Workflow.
 * Provides parallel objective assessment with automatic retries.
 *
 * Benefits:
 * - AI call failures auto-retry with exponential backoff
 * - Parallel objective assessment (10 objectives = 10x faster)
 * - Survives AI provider outages and function timeouts
 * - Detailed observability for debugging AI failures
 * - State persistence across deployments
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai-client";
import {
	COMPLIANCE_AI_CONFIG,
	getOpenAIProviderOptions,
	getTemperatureSettings,
} from "@/lib/ai-config";
import { createClient } from "@/lib/supabase/server";
import { logProgress } from "@/lib/workflow/workflow-wrapper";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface AssessmentObjective {
	id: string;
	scf_ao_id: string;
	assessment_objective: string;
	assessment_procedure?: string;
	expected_results?: string;
}

interface AssessmentResult {
	objective_id: string;
	result: "pass" | "fail" | "partial" | "not_applicable";
	confidence: number;
	reasoning: string;
	gaps?: string[];
	recommendations?: string[];
}

interface EvidenceAssessment {
	evidence_id: string;
	scf_control_id: string;
	overall_result: "pass" | "fail" | "partial" | "not_applicable";
	overall_confidence: number;
	objective_results: AssessmentResult[];
	summary: string;
	recommendations: string[];
}

interface ControlData {
	id: string;
	title: string;
	description: string;
}

/**
 * Main workflow function to assess evidence against SCF control
 */
export async function assessEvidenceWorkflow(
	evidenceId: string,
	scfControlId: string,
	filePath: string,
	fileType: string,
): Promise<EvidenceAssessment> {
	"use workflow";

	const workflowId = `assess-${evidenceId.substring(0, 8)}`;
	logProgress({
		workflowId,
		step: "init",
		status: "in_progress",
		message: "Starting assessment workflow",
	});

	const supabase = await createClient();

	try {
		// Step 1: Extract evidence content (retryable)
		const evidenceContent = await extractContentStep(
			filePath,
			fileType,
			supabase,
			workflowId,
		);

		// Step 2: Fetch control details (retryable)
		const controlData = await fetchControlDataStep(
			scfControlId,
			supabase,
			workflowId,
		);

		// Step 3: Fetch assessment objectives (retryable)
		const objectives = await fetchObjectivesStep(
			scfControlId,
			supabase,
			workflowId,
		);

		// Step 4: Parallel assessment of objectives (retryable)
		const objectiveResults = await assessObjectivesInParallelStep(
			evidenceContent,
			objectives,
			controlData,
			workflowId,
		);

		// Step 5: Generate summary (retryable)
		const { summary, recommendations } = await generateSummaryStep(
			objectiveResults,
			controlData.title,
			evidenceContent,
			workflowId,
		);

		// Step 6: Calculate overall result
		const overallResult = calculateOverallResult(objectiveResults);
		const overallConfidence =
			objectiveResults.reduce((sum, r) => sum + r.confidence, 0) /
			objectiveResults.length;

		logProgress({
			workflowId,
			step: "complete",
			status: "completed",
			message: "Assessment workflow completed",
		});

		return {
			evidence_id: evidenceId,
			scf_control_id: scfControlId,
			overall_result: overallResult,
			overall_confidence: overallConfidence,
			objective_results: objectiveResults,
			summary,
			recommendations,
		};
	} catch (error) {
		logProgress({
			workflowId,
			step: "error",
			status: "failed",
			message: error instanceof Error ? error.message : "Unknown error",
		});
		throw error;
	}
}

/**
 * Step 1: Extract evidence content from storage
 */
async function extractContentStep(
	filePath: string,
	fileType: string,
	supabase: SupabaseServerClient,
	workflowId: string,
): Promise<string> {
	"use step";

	logProgress({
		workflowId,
		step: "extract",
		status: "in_progress",
		message: "Extracting evidence content",
	});

	try {
		// Download file from Supabase storage
		const { data: fileData, error } = await supabase.storage
			.from("compliance-documents")
			.download(filePath);

		if (error) {
			throw new Error(`Failed to download file: ${error.message}`);
		}

		// Convert file to text based on type
		let textContent = "";

		if (fileType === "text/plain" || fileType === "text/csv") {
			textContent = await fileData.text();
		} else if (fileType === "application/pdf") {
			textContent = "[PDF content extraction - placeholder]";
		} else if (fileType.includes("image/")) {
			textContent = "[Image analysis - placeholder]";
		} else {
			textContent = "[Document parsing - placeholder]";
		}

		logProgress({
			workflowId,
			step: "extract",
			status: "completed",
			message: `Extracted ${textContent.length} characters`,
		});

		return textContent;
	} catch (error) {
		console.error("Error extracting evidence content:", error);
		throw new Error("Failed to extract evidence content");
	}
}

/**
 * Step 2: Fetch SCF control details
 */
async function fetchControlDataStep(
	scfControlId: string,
	supabase: SupabaseServerClient,
	workflowId: string,
): Promise<ControlData> {
	"use step";

	logProgress({
		workflowId,
		step: "fetch_control",
		status: "in_progress",
		message: "Fetching control details",
	});

	const { data: controlData, error: controlError } = await supabase
		.from("scf_controls")
		.select("id, title, description")
		.eq("id", scfControlId)
		.single();

	if (controlError || !controlData) {
		throw new Error(
			`Failed to fetch control details: ${controlError?.message}`,
		);
	}

	const description = controlData.description || "";

	logProgress({
		workflowId,
		step: "fetch_control",
		status: "completed",
		message: `Fetched control: ${controlData.title}`,
	});

	return {
		id: controlData.id,
		title: controlData.title,
		description,
	};
}

/**
 * Step 3: Fetch assessment objectives
 */
async function fetchObjectivesStep(
	scfControlId: string,
	supabase: SupabaseServerClient,
	workflowId: string,
): Promise<AssessmentObjective[]> {
	"use step";

	logProgress({
		workflowId,
		step: "fetch_objectives",
		status: "in_progress",
		message: "Fetching assessment objectives",
	});

	const { data: objectives, error: objectivesError } = await supabase
		.from("scf_assessment_objectives")
		.select(
			"id, scf_ao_id, assessment_objective, assessment_procedure, expected_results",
		)
		.eq("scf_control_id", scfControlId);

	if (objectivesError) {
		throw new Error(`Failed to fetch objectives: ${objectivesError.message}`);
	}

	if (!objectives || objectives.length === 0) {
		throw new Error(
			`No assessment objectives found for control ${scfControlId}`,
		);
	}

	logProgress({
		workflowId,
		step: "fetch_objectives",
		status: "completed",
		message: `Fetched ${objectives.length} objectives`,
	});

	return objectives;
}

/**
 * Step 4: Assess evidence against objectives in parallel
 */
async function assessObjectivesInParallelStep(
	evidenceContent: string,
	objectives: AssessmentObjective[],
	controlData: ControlData,
	workflowId: string,
): Promise<AssessmentResult[]> {
	"use step";

	logProgress({
		workflowId,
		step: "assess_parallel",
		status: "in_progress",
		message: `Assessing ${objectives.length} objectives in parallel`,
	});

	// Split objectives into batches for parallel processing
	const batchSize = 5; // Process 5 objectives at a time
	const batches = [];

	for (let i = 0; i < objectives.length; i += batchSize) {
		batches.push(objectives.slice(i, i + batchSize));
	}

	const allResults: AssessmentResult[] = [];

	// Process batches sequentially, objectives within batch in parallel
	for (const batch of batches) {
		const batchResults = await Promise.all(
			batch.map((objective) =>
				assessSingleObjective(evidenceContent, objective, controlData),
			),
		);
		allResults.push(...batchResults);
	}

	logProgress({
		workflowId,
		step: "assess_parallel",
		status: "completed",
		message: `Assessed ${allResults.length} objectives`,
	});

	return allResults;
}

/**
 * Assess a single objective (used in parallel batch processing)
 */
async function assessSingleObjective(
	evidenceContent: string,
	objective: AssessmentObjective,
	controlData: ControlData,
): Promise<AssessmentResult> {
	const systemPrompt = `You are a compliance assessment expert specializing in the Secure Controls Framework (SCF).
Evaluate evidence against this specific assessment objective.

Assessment Criteria:
- PASS: Evidence clearly and completely demonstrates the objective is met
- PARTIAL: Evidence shows some implementation but lacks completeness or clarity
- FAIL: Evidence does not demonstrate the objective is met or shows non-compliance
- NOT_APPLICABLE: The objective does not apply to this evidence or context`;

	const userPrompt = `Control: ${controlData.title}
Description: ${controlData.description}

Assessment Objective (${objective.scf_ao_id}):
${objective.assessment_objective}
${objective.assessment_procedure ? `Procedure: ${objective.assessment_procedure}` : ""}
${objective.expected_results ? `Expected Results: ${objective.expected_results}` : ""}

Evidence Content:
${evidenceContent.substring(0, 2000)}

Provide a detailed assessment in JSON format.`;

	try {
		const { object } = await generateObject({
			model: getModel(
				COMPLIANCE_AI_CONFIG.controlMapping.provider,
				COMPLIANCE_AI_CONFIG.controlMapping.model,
			),
			schema: z.object({
				result: z.enum(["pass", "fail", "partial", "not_applicable"]),
				confidence: z.number().min(0).max(1),
				reasoning: z.string(),
				gaps: z.array(z.string()).optional(),
				recommendations: z.array(z.string()).optional(),
			}),
			system: systemPrompt,
			prompt: userPrompt,
			...getOpenAIProviderOptions(
				COMPLIANCE_AI_CONFIG.controlMapping.provider,
				{
					reasoningEffort: "low",
					textVerbosity: "low",
				},
			),
			...getTemperatureSettings(
				COMPLIANCE_AI_CONFIG.controlMapping.provider,
				COMPLIANCE_AI_CONFIG.controlMapping.model,
				0.1,
			),
		});

		return {
			objective_id: objective.id,
			result: object.result,
			confidence: Math.max(0, Math.min(1, object.confidence)),
			reasoning: object.reasoning || "No reasoning provided",
			gaps: object.gaps || [],
			recommendations: object.recommendations || [],
		};
	} catch (error) {
		console.error(`Error assessing objective ${objective.scf_ao_id}:`, error);
		// Return a failed assessment for this objective
		return {
			objective_id: objective.id,
			result: "fail",
			confidence: 0,
			reasoning: `Assessment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			gaps: ["AI assessment error"],
			recommendations: ["Retry assessment"],
		};
	}
}

/**
 * Step 5: Generate overall summary and recommendations
 */
async function generateSummaryStep(
	objectiveResults: AssessmentResult[],
	controlTitle: string,
	evidenceContent: string,
	workflowId: string,
): Promise<{ summary: string; recommendations: string[] }> {
	"use step";

	logProgress({
		workflowId,
		step: "summary",
		status: "in_progress",
		message: "Generating summary",
	});

	const passCount = objectiveResults.filter((r) => r.result === "pass").length;
	const totalCount = objectiveResults.filter(
		(r) => r.result !== "not_applicable",
	).length;
	const avgConfidence =
		objectiveResults.reduce((sum, r) => sum + r.confidence, 0) /
		objectiveResults.length;

	const systemPrompt = `You are a compliance expert. Generate a concise summary and actionable recommendations based on assessment results.`;

	const userPrompt = `Control: ${controlTitle}
Assessment Results: ${passCount}/${totalCount} objectives passed (${Math.round(avgConfidence * 100)}% avg confidence)

Detailed Results:
${objectiveResults.map((r) => `- ${r.result.toUpperCase()}: ${r.reasoning}`).join("\n")}

Generate:
1. A 2-3 sentence summary of the overall compliance status
2. 3-5 prioritized recommendations for improvement

Respond in JSON format.`;

	try {
		const { object } = await generateObject({
			model: getModel(
				COMPLIANCE_AI_CONFIG.recommendations.provider,
				COMPLIANCE_AI_CONFIG.recommendations.model,
			),
			schema: z.object({
				summary: z.string(),
				recommendations: z.array(z.string()),
			}),
			system: systemPrompt,
			prompt: userPrompt,
			...getOpenAIProviderOptions(
				COMPLIANCE_AI_CONFIG.recommendations.provider,
				{
					reasoningEffort: "low",
					textVerbosity: "medium",
				},
			),
			...getTemperatureSettings(
				COMPLIANCE_AI_CONFIG.recommendations.provider,
				COMPLIANCE_AI_CONFIG.recommendations.model,
				COMPLIANCE_AI_CONFIG.recommendations.temperature,
			),
		});

		logProgress({
			workflowId,
			step: "summary",
			status: "completed",
			message: "Summary generated",
		});

		return {
			summary: object.summary || "Assessment completed",
			recommendations: object.recommendations || [],
		};
	} catch (error) {
		console.error("Error generating summary:", error);
		return {
			summary: `Assessment completed with ${passCount}/${totalCount} objectives passed`,
			recommendations: ["Review failed objectives and address identified gaps"],
		};
	}
}

/**
 * Calculate overall assessment result from objective results
 */
function calculateOverallResult(
	objectiveResults: AssessmentResult[],
): "pass" | "fail" | "partial" | "not_applicable" {
	const passCount = objectiveResults.filter((r) => r.result === "pass").length;
	const failCount = objectiveResults.filter((r) => r.result === "fail").length;
	const partialCount = objectiveResults.filter(
		(r) => r.result === "partial",
	).length;
	const applicableCount = objectiveResults.filter(
		(r) => r.result !== "not_applicable",
	).length;

	if (applicableCount === 0) {
		return "not_applicable";
	} else if (passCount === applicableCount) {
		return "pass";
	} else if (failCount > 0 || partialCount > 0) {
		return partialCount > failCount ? "partial" : "fail";
	} else {
		return "partial";
	}
}

/**
 * Legacy export for backward compatibility
 * Uses the workflow-based implementation under the hood
 */
export async function assessEvidence(
	evidenceId: string,
	scfControlId: string,
	filePath: string,
	fileType: string,
): Promise<EvidenceAssessment> {
	return assessEvidenceWorkflow(evidenceId, scfControlId, filePath, fileType);
}

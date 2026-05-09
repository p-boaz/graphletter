import { z } from "zod";
import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import {
	COMPLIANCE_AI_CONFIG,
	getOpenAIProviderOptions,
	getTemperatureSettings,
} from "@/lib/ai-config";
import type {
	AssessmentLogContext,
	AssessmentObjective,
	ObjectiveAssessmentResult,
} from "./types";
import {
	buildEvidenceText,
	buildGenerateObjectImageParams,
	generateObjectWithRetry,
	getAssessmentModel,
} from "./utils";

export async function assessAgainstObjectives(
	content: string,
	imageData: { base64: string; mimeType: string } | null,
	objectives: AssessmentObjective[],
	controlTitle: string,
	controlDescription: string,
	logContext: AssessmentLogContext & { objectiveIds?: string[] },
): Promise<ObjectiveAssessmentResult[]> {
	const systemPrompt = `You are a compliance assessment expert. Assess evidence against SCF assessment objectives and return structured JSON results. You can analyze both text content and visual elements from images/screenshots to make comprehensive compliance assessments.`;

	const evidenceText = buildEvidenceText(content, imageData);

	const userPrompt = `Assess this evidence against SCF assessment objectives:

Control: ${controlTitle}
Description: ${controlDescription}
${evidenceText}

Assessment Objectives:
${objectives
	.map(
		(obj, i) =>
			`${i + 1}. ${obj.scf_ao_id} (ID: ${obj.id}): ${obj.assessment_objective}`,
	)
	.join("\n")}

For each objective, determine:
- result: "pass", "fail", "partial", or "not_applicable"
- confidence: number between 0.0 and 1.0
- reasoning: brief explanation of your assessment${imageData ? " (consider both text and visual elements)" : ""}

Return a JSON object with an "assessments" array containing one assessment per objective.`;

	try {
		const aiCallStartedAt = Date.now();
		const generateObjectParams: Record<string, unknown> = {
			model: getAssessmentModel(),
			schema: z.object({
				assessments: z.array(
					z.object({
						objective_id: z.string(),
						result: z.enum(["pass", "fail", "partial", "not_applicable"]),
						confidence: z.number().min(0).max(1),
						reasoning: z.string(),
					}),
				),
			}),
			system: systemPrompt,
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
		};

		if (imageData) {
			Object.assign(
				generateObjectParams,
				buildGenerateObjectImageParams(imageData, userPrompt),
			);
		} else {
			generateObjectParams.prompt = userPrompt;
		}

		const aiResponse = await generateObjectWithRetry(
			generateObjectParams as Parameters<typeof import("ai").generateObject>[0],
			logContext,
			"assessAgainstObjectives",
		);
		const typedObject = aiResponse.object as {
			assessments: Array<{
				objective_id: string;
				result: "pass" | "fail" | "partial" | "not_applicable";
				confidence: number;
				reasoning: string;
			}>;
		};

		const mappedAssessments = (typedObject.assessments || []).map(
			(assessment) => ({
				objective_id: assessment.objective_id,
				result: assessment.result,
				confidence: Math.max(0, Math.min(1, assessment.confidence)),
				reasoning: assessment.reasoning || "No reasoning provided",
			}),
		);

		await appendAIAssessmentLog({
			requestId: logContext.requestId,
			sessionId: logContext.sessionId,
			scope: "ai_call",
			status: "success",
			evidenceId: logContext.evidenceId,
			evidenceContentHash: logContext.evidenceContentHash,
			scfControlId: logContext.scfControlId,
			objectiveIds: logContext.objectiveIds,
			modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
			modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
			latencyMs: Date.now() - aiCallStartedAt,
			prompt: { system: systemPrompt, user: userPrompt },
			response: {
				object: aiResponse.object,
				rawResponse: aiResponse.response.body ?? null,
				usage: aiResponse.usage,
				finishReason: aiResponse.finishReason,
				reasoning: aiResponse.reasoning,
				providerMetadata: aiResponse.providerMetadata,
				warnings: aiResponse.warnings,
			},
			metadata: {
				call: "assessAgainstObjectives",
				objectiveCount: objectives.length,
				includesImage: Boolean(imageData),
				modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
				mappedAssessments,
			},
		});

		return mappedAssessments;
	} catch (error) {
		console.error("Objective assessment failed:", error);
		await appendAIAssessmentLog({
			requestId: logContext.requestId,
			sessionId: logContext.sessionId,
			scope: "ai_call",
			status: "error",
			evidenceId: logContext.evidenceId,
			evidenceContentHash: logContext.evidenceContentHash,
			scfControlId: logContext.scfControlId,
			objectiveIds: logContext.objectiveIds,
			modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
			modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
			prompt: { system: systemPrompt, user: userPrompt },
			error:
				error instanceof Error
					? error.message
					: "Objective AI assessment failed",
			metadata: {
				call: "assessAgainstObjectives",
				objectiveCount: objectives.length,
				includesImage: Boolean(imageData),
				modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
			},
		});
		throw error;
	}
}

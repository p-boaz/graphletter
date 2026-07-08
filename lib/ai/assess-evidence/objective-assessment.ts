import { z } from "zod";
import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/ai/assess-evidence/objective");
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
} from "@/lib/ai-config";
import type { AssessmentLogContext, AssessmentObjective, ObjectiveAssessmentResult } from "./types";
import {
  assessmentContractMetadata,
  assessmentTruncationKillSwitchEnabled,
  buildAssessmentPromptCacheKey,
  verifiedEvidenceSpans,
  EvidenceSpanSchema,
} from "./contract";
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
  logContext: AssessmentLogContext & { objectiveIds?: string[] }
): Promise<ObjectiveAssessmentResult[]> {
  const systemPrompt = `You are a compliance assessment expert. Assess SCF objectives against the supplied evidence and return structured JSON. Use only the supplied document and visual evidence. Evidence quote offsets must exactly match DOCUMENT TEXT character offsets. Do not provide analysis outside the JSON object.`;

  const evidenceText = buildEvidenceText(content, imageData);
  const legacyMode = assessmentTruncationKillSwitchEnabled();
  const promptCacheKey = legacyMode
    ? null
    : buildAssessmentPromptCacheKey({
        evidenceContentHash: logContext.evidenceContentHash,
      });
  const userPrompt = legacyMode
    ? `Assess this evidence against SCF assessment objectives:

Control: ${controlTitle}
Description: ${controlDescription}
Evidence: ${content.substring(0, imageData ? 1500 : 2000)}

Assessment Objectives:
${objectives
  .map((obj, i) => `${i + 1}. ${obj.scf_ao_id} (ID: ${obj.id}): ${obj.assessment_objective}`)
  .join("\n")}

For each objective, determine result, confidence, and brief reasoning. Return a JSON object with an "assessments" array containing one assessment per objective.`
    : `${evidenceText}

Control: ${controlTitle}
Description: ${controlDescription}

Assessment Objectives:
${objectives
  .map(
    (obj, i) => `${i + 1}. ${obj.scf_ao_id} (ID: ${obj.id})
assessment_objective: ${obj.assessment_objective}
assessment_procedure: ${obj.assessment_procedure || "[not supplied]"}
expected_results: ${obj.expected_results || "[not supplied]"}`
  )
  .join("\n")}

For each objective, determine:
- result: "pass", "fail", "partial", or "not_applicable"
- confidence: number between 0.0 and 1.0
- reasoning: one concise sentence tied to the objective, procedure, and expected results${imageData ? " (consider both text and visual elements)" : ""}
- evidence_quotes: 1-2 supporting quotes for pass or partial results. Each quote must include start, end, text, and supports. start/end are character offsets into DOCUMENT TEXT and must satisfy DOCUMENT_TEXT.slice(start,end) === text. Use an empty array only for fail or not_applicable.

Scoping rule: use not_applicable only when this artifact class could never evidence the objective. Use fail when this artifact class should evidence the objective but this document does not.

Use the full document as the source of truth. Return a JSON object with an "assessments" array containing one assessment per objective.`;

  try {
    const aiCallStartedAt = Date.now();
    const generateObjectParams: Record<string, unknown> = {
      model: getAssessmentModel(),
      // Quote-bearing assessments emit ~11k output tokens (incl. ~10k reasoning)
      // for an 8-objective control at reasoningEffort "low" (measured 2026-07-08).
      // 6k starved the response and surfaced as AI_NoObjectGeneratedError.
      maxOutputTokens: 16_000,
      schema: z.object({
        assessments: z.array(
          legacyMode
            ? z.object({
                objective_id: z.string(),
                result: z.enum(["pass", "fail", "partial", "not_applicable"]),
                confidence: z.number().min(0).max(1),
                reasoning: z.string(),
              })
            : z.object({
                objective_id: z.string(),
                result: z.enum(["pass", "fail", "partial", "not_applicable"]),
                confidence: z.number().min(0).max(1),
                reasoning: z.string(),
                evidence_quotes: z.array(EvidenceSpanSchema).default([]),
              })
        ),
      }),
      system: systemPrompt,
      ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
        // "medium" is measured-and-rejected for contract_v1 (2026-07-08): it needs
        // ~23k reasoning tokens (empty response below that budget) and 165s wall
        // clock vs the 90s control timeout. ADR-001 bundled-fix #3 delta: measured.
        reasoningEffort: "low",
        textVerbosity: legacyMode ? "low" : "medium",
        ...(promptCacheKey
          ? {
              promptCacheKey,
              promptCacheRetention: "24h" as const,
            }
          : {}),
      }),
      ...getTemperatureSettings(
        COMPLIANCE_AI_CONFIG.controlMapping.provider,
        COMPLIANCE_AI_CONFIG.controlMapping.model,
        0.1
      ),
    };

    if (imageData) {
      Object.assign(generateObjectParams, buildGenerateObjectImageParams(imageData, userPrompt));
    } else {
      generateObjectParams.prompt = userPrompt;
    }

    const aiResponse = await generateObjectWithRetry(
      generateObjectParams as Parameters<typeof import("ai").generateObject>[0],
      { ...logContext, objectiveIds: objectives.map((objective) => objective.id) },
      "assessAgainstObjectives"
    );
    const typedObject = aiResponse.object as {
      assessments: Array<{
        objective_id: string;
        result: "pass" | "fail" | "partial" | "not_applicable";
        confidence: number;
        reasoning: string;
        evidence_quotes?: Array<{
          start: number;
          end: number;
          text: string;
          supports?: string;
        }>;
      }>;
    };

    const mappedAssessments = (typedObject.assessments || []).map((assessment) => {
      const evidenceQuotes = legacyMode
        ? []
        : (assessment.evidence_quotes ?? []).map((span) => ({
            start: span.start,
            end: span.end,
            text: span.text,
            supports: span.supports ?? "",
          }));
      const verifiedQuotes = verifiedEvidenceSpans(content, evidenceQuotes);
      return {
        objective_id: assessment.objective_id,
        result: assessment.result,
        confidence: Math.max(0, Math.min(1, assessment.confidence)),
        reasoning: assessment.reasoning || "No reasoning provided",
        evidence_quotes: verifiedQuotes,
        rejected_evidence_quotes: evidenceQuotes.filter(
          (span) => !verifiedEvidenceSpans(content, [span]).length
        ),
      };
    });

    await appendAIAssessmentLog({
      requestId: logContext.requestId,
      sessionId: logContext.sessionId,
      scope: "ai_call",
      status: "success",
      evidenceId: logContext.evidenceId,
      evidenceContentHash: logContext.evidenceContentHash,
      scfControlId: logContext.scfControlId,
      objectiveIds: objectives.map((objective) => objective.id),
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
        ...assessmentContractMetadata(),
        call: "assessAgainstObjectives",
        objectiveCount: objectives.length,
        objectiveBatchIndex: 0,
        objectiveBatchCount: 1,
        objectiveBatchSize: objectives.length,
        objectiveBatchConcurrency: 1,
        legacyMode,
        includesImage: Boolean(imageData),
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
        mappedAssessments,
        promptCacheKey,
        promptTokens: aiResponse.usage?.inputTokens ?? null,
        cachedPromptTokens: aiResponse.usage?.cachedInputTokens ?? null,
        outputTokens: aiResponse.usage?.outputTokens ?? null,
      },
    });

    return mappedAssessments;
  } catch (error) {
    log.error("objective_assessment.failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
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
      error: error instanceof Error ? error.message : "Objective AI assessment failed",
      metadata: {
        ...assessmentContractMetadata(),
        call: "assessAgainstObjectives",
        objectiveCount: objectives.length,
        objectiveBatchSize: objectives.length,
        objectiveBatchConcurrency: 1,
        legacyMode,
        includesImage: Boolean(imageData),
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
      },
    });
    throw error;
  }
}

import { z } from "zod";
import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/ai/assess-evidence/basic");
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
} from "@/lib/ai-config";
import {
  assessmentContractMetadata,
  assessmentTruncationKillSwitchEnabled,
  buildAssessmentPromptCacheKey,
} from "./contract";
import { assessMaturityLevel } from "./maturity-assessment";
import type {
  AssessmentLogContext,
  ImagePayload,
  MaturityAssessmentResult,
  MaturityLevels,
  ServiceSupabaseClient,
} from "./types";
import {
  buildEvidenceText,
  buildGenerateObjectImageParams,
  generateObjectWithRetry,
  getAssessmentModel,
} from "./utils";

export async function createBasicAssessment(
  content: string,
  imageData: ImagePayload,
  controlData: {
    id: string;
    title: string;
    description: string;
    guidance_micro?: string | null;
    guidance_small?: string | null;
    guidance_medium?: string | null;
    target_maturity_level?: number | null;
    scf_domains?: { name?: string | null } | Array<{ name?: string | null }> | null;
  },
  serviceSupabase: ServiceSupabaseClient,
  userId: string,
  evidenceId: string,
  maturityLevels: MaturityLevels | null,
  controlRunKey: string,
  logContext: AssessmentLogContext
) {
  const systemPrompt = `You are a compliance assessment expert. Assess evidence against SCF controls and return structured results. You can analyze both text content and visual elements from images/screenshots to make comprehensive compliance assessments.`;

  const legacyMode = assessmentTruncationKillSwitchEnabled();
  const evidenceText = legacyMode
    ? `Evidence: ${content.substring(0, imageData ? 1500 : 2000)}`
    : buildEvidenceText(content, imageData);

  const userPrompt = `${evidenceText}

Assess this evidence against the SCF control:

Control: ${controlData.title}
Description: ${controlData.description}

Determine:
- result: "pass", "partial", "fail", or "not_applicable"
- confidence: number between 0.0 and 1.0
- reasoning: explain the assessment against the control${imageData ? " (consider both text and visual elements)" : ""}

Scoping rule: use not_applicable only when this artifact class could never evidence the control. Use fail when this artifact class should evidence the control but this document does not.`;

  try {
    const aiCallStartedAt = Date.now();
    const promptCacheKey = legacyMode
      ? null
      : buildAssessmentPromptCacheKey({
          evidenceContentHash: logContext.evidenceContentHash,
        });
    const generateObjectParams: Record<string, unknown> = {
      model: getAssessmentModel(),
      maxOutputTokens: 3_000,
      schema: z.object({
        result: z.enum(["pass", "partial", "fail", "not_applicable"]),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
      }),
      system: systemPrompt,
      ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
        reasoningEffort: legacyMode ? "low" : "medium",
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
        0.2
      ),
    };

    if (imageData) {
      Object.assign(generateObjectParams, buildGenerateObjectImageParams(imageData, userPrompt));
    } else {
      generateObjectParams.prompt = userPrompt;
    }

    const aiResponse = await generateObjectWithRetry(
      generateObjectParams as Parameters<typeof import("ai").generateObject>[0],
      logContext,
      "createBasicAssessment"
    );

    const result = aiResponse.object as {
      result: "pass" | "partial" | "fail" | "not_applicable";
      confidence: number;
      reasoning: string;
    };

    await appendAIAssessmentLog({
      requestId: logContext.requestId,
      sessionId: logContext.sessionId,
      scope: "ai_call",
      status: "success",
      evidenceId,
      evidenceContentHash: logContext.evidenceContentHash,
      scfControlId: logContext.scfControlId,
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
        call: "createBasicAssessment",
        includesImage: Boolean(imageData),
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
        controlRunKey,
        promptCacheKey,
        promptTokens: aiResponse.usage?.inputTokens ?? null,
        cachedPromptTokens: aiResponse.usage?.cachedInputTokens ?? null,
        outputTokens: aiResponse.usage?.outputTokens ?? null,
      },
    });

    const maturityAssessment: MaturityAssessmentResult | null = maturityLevels
      ? await assessMaturityLevel(
          content,
          imageData,
          controlData.id,
          controlData.title,
          controlData.description,
          maturityLevels,
          typeof controlData.target_maturity_level === "number"
            ? controlData.target_maturity_level
            : null,
          logContext
        )
      : null;

    const { data: assessmentData, error: assessmentError } = await serviceSupabase
      .from("assessments")
      .insert({
        user_id: userId,
        scf_control_id: controlData.id,
        scf_ao_id: null,
        assessment_type: "manual",
        assessment_method: "ai_assisted",
        assessment_status: "completed",
        assessment_result: result.result,
        confidence_level:
          result.confidence >= 0.8 ? "high" : result.confidence >= 0.5 ? "medium" : "low",
        assessment_notes: result.reasoning,
        assessment_summary: result.reasoning,
        evidence_id: evidenceId,
        ai_reasoning: result.reasoning,
        metadata: {
          ...assessmentContractMetadata(),
          ai_generated: true,
          manual_assessment: true,
          assessment_run_key: controlRunKey,
          assessment_request_id: logContext.requestId,
          basic_assessment: true,
          no_objectives_found: true,
          maturity_assessment: maturityAssessment,
          maturity_benchmark_snapshot: maturityLevels,
          assessment_timestamp: new Date().toISOString(),
        },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (assessmentError) {
      throw new Error(`Failed to create basic assessment: ${assessmentError.message}`);
    }

    return {
      id: assessmentData.id,
      scf_control_id: controlData.id,
      control_title: controlData.title,
      control_description: controlData.description,
      control_guidance:
        controlData.guidance_micro || controlData.guidance_small || controlData.guidance_medium,
      domain_name: Array.isArray(controlData.scf_domains)
        ? controlData.scf_domains[0]?.name
        : controlData.scf_domains?.name,
      overall_result: result.result,
      overall_confidence: result.confidence,
      summary: result.reasoning,
      maturity_assessment: maturityAssessment,
      maturity_levels: maturityLevels,
    };
  } catch (error) {
    log.error("basic_assessment.failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    await appendAIAssessmentLog({
      requestId: logContext.requestId,
      sessionId: logContext.sessionId,
      scope: "ai_call",
      status: "error",
      evidenceId,
      evidenceContentHash: logContext.evidenceContentHash,
      scfControlId: logContext.scfControlId,
      modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
      modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
      prompt: { system: systemPrompt, user: userPrompt },
      error: error instanceof Error ? error.message : "Basic assessment AI call failed",
      metadata: {
        ...assessmentContractMetadata(),
        call: "createBasicAssessment",
        includesImage: Boolean(imageData),
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
        controlRunKey,
      },
    });
    throw error;
  }
}

import { z } from "zod";
import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/ai/assess-evidence/maturity");
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
import type { AssessmentLogContext, MaturityAssessmentResult, MaturityLevels } from "./types";
import {
  buildGenerateObjectImageParams,
  buildEvidenceText,
  generateObjectWithRetry,
  getAssessmentModel,
} from "./utils";

export async function assessMaturityLevel(
  content: string,
  imageData: { base64: string; mimeType: string } | null,
  controlId: string,
  controlTitle: string,
  controlDescription: string,
  maturityLevels: MaturityLevels,
  targetLevel: number | null,
  logContext: AssessmentLogContext
): Promise<MaturityAssessmentResult | null> {
  const levelEntries = [
    { level: 0, description: maturityLevels.level_0_description },
    { level: 1, description: maturityLevels.level_1_description },
    { level: 2, description: maturityLevels.level_2_description },
    { level: 3, description: maturityLevels.level_3_description },
    { level: 4, description: maturityLevels.level_4_description },
    { level: 5, description: maturityLevels.level_5_description },
  ].filter((entry) => typeof entry.description === "string" && entry.description.trim().length > 0);

  if (levelEntries.length === 0) {
    return null;
  }

  const benchmarkSummary = levelEntries
    .map((entry) => `Level ${entry.level}: ${entry.description?.trim()}`)
    .join("\n\n");

  const legacyMode = assessmentTruncationKillSwitchEnabled();
  const evidenceText = legacyMode
    ? `Evidence: ${content.substring(0, imageData ? 1500 : 2000)}`
    : buildEvidenceText(content, imageData);

  const targetText =
    typeof targetLevel === "number" && targetLevel >= 0 && targetLevel <= 5
      ? `Target maturity level for this control: ${targetLevel}. Determine if current evidence meets, exceeds, or falls short of this target.`
      : legacyMode
        ? "No explicit target maturity level provided; determine the most appropriate level based on benchmarks."
        : "No explicit target maturity level is configured for this control. Do not return target_level, target_met, or target_gap.";

  const systemPrompt = `You are a compliance maturity assessment expert. Evaluate evidence against capability maturity benchmarks.`;

  const userPrompt = `${evidenceText}

Assess the maturity level for control ${controlId} - ${controlTitle}.

Control description: ${controlDescription}

Maturity benchmarks:
${benchmarkSummary}

${targetText}

Return JSON with:
- assessed_level (integer 0-5)
- confidence (0.0-1.0)
- rationale (explanation referencing benchmarks and document evidence)
- recommended_actions (optional array of up to 5 specific next steps if improvement is needed)
- referenced_level_description (optional excerpt from the benchmark that best matches the evidence)
${
  typeof targetLevel === "number" && targetLevel >= 0 && targetLevel <= 5
    ? "- target_level (must equal the provided target)\n- target_met (boolean)\n- target_gap (integer assessed_level minus target_level)"
    : legacyMode
      ? "- target_level (optional)\n- target_met (optional)\n- target_gap (optional)"
      : "- omit target_level, target_met, and target_gap"
}`;

  const maturitySchema = z.object({
    assessed_level: z.number().int().min(0).max(5),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    recommended_actions: z.array(z.string()).optional(),
    referenced_level_description: z.string().optional(),
    target_level: z.number().int().min(0).max(5).nullable().optional(),
    target_met: z.boolean().nullable().optional(),
    target_gap: z.number().min(-5).max(5).nullable().optional(),
  });

  try {
    const aiCallStartedAt = Date.now();
    const promptCacheKey = legacyMode
      ? null
      : buildAssessmentPromptCacheKey({
          evidenceContentHash: logContext.evidenceContentHash,
        });
    const generateObjectParams: Record<string, unknown> = {
      model: getAssessmentModel(),
      maxOutputTokens: 6_000,
      schema: maturitySchema,
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
      logContext,
      "assessMaturityLevel"
    );
    const typedObject = aiResponse.object as z.infer<typeof maturitySchema>;

    const assessedLevel = Math.max(0, Math.min(5, Math.round(typedObject.assessed_level)));
    const confidence = Math.max(0, Math.min(1, typedObject.confidence));

    const normalizedTargetLevel =
      typeof targetLevel === "number" && targetLevel >= 0 && targetLevel <= 5 ? targetLevel : null;

    let targetGap: number | undefined;
    let targetMet: boolean | undefined;

    if (normalizedTargetLevel !== null) {
      targetGap = assessedLevel - normalizedTargetLevel;
      targetMet = assessedLevel >= normalizedTargetLevel;
    }

    const maturityResult: MaturityAssessmentResult = {
      assessed_level: assessedLevel,
      confidence,
      rationale: typedObject.rationale,
      referenced_level_description: typedObject.referenced_level_description || null,
      recommended_actions: typedObject.recommended_actions
        ?.filter((action: string) => action?.trim())
        ?.slice(0, 5),
    };
    if (normalizedTargetLevel !== null) {
      maturityResult.target_level = normalizedTargetLevel;
      maturityResult.target_met = targetMet;
      maturityResult.target_gap = targetGap;
    }

    await appendAIAssessmentLog({
      requestId: logContext.requestId,
      sessionId: logContext.sessionId,
      scope: "ai_call",
      status: "success",
      evidenceId: logContext.evidenceId,
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
        call: "assessMaturityLevel",
        includesImage: Boolean(imageData),
        legacyMode,
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
        promptCacheKey,
        promptTokens: aiResponse.usage?.inputTokens ?? null,
        cachedPromptTokens: aiResponse.usage?.cachedInputTokens ?? null,
        outputTokens: aiResponse.usage?.outputTokens ?? null,
      },
    });

    return maturityResult;
  } catch (error) {
    log.error("maturity_assessment.failed", {
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
      modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
      modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
      prompt: { system: systemPrompt, user: userPrompt },
      error: error instanceof Error ? error.message : "Maturity assessment AI call failed",
      metadata: {
        ...assessmentContractMetadata(),
        call: "assessMaturityLevel",
        includesImage: Boolean(imageData),
        legacyMode,
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
      },
    });
    return null;
  }
}

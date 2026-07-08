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
  buildAssessmentPromptCacheKey,
  verifiedEvidenceSpans,
} from "./contract";
import {
  buildEvidenceText,
  buildGenerateObjectImageParams,
  generateObjectWithRetry,
  getAssessmentModel,
} from "./utils";

const DEFAULT_OBJECTIVE_BATCH_SIZE = 1;
const DEFAULT_OBJECTIVE_BATCH_CONCURRENCY = 1;
const MAX_CANDIDATE_SPANS = 12;
const MAX_CANDIDATE_PROMPT_CHARS = 700;
const TERM_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "shall",
  "must",
  "are",
  "from",
  "into",
  "each",
  "when",
  "will",
  "all",
  "have",
  "has",
  "not",
  "but",
  "their",
  "they",
  "them",
  "system",
  "systems",
  "organization",
  "organizational",
]);
const SECURITY_CITATION_TERMS = [
  "access",
  "account",
  "approval",
  "auth",
  "authentication",
  "authenticated",
  "authorization",
  "confidential",
  "control",
  "data",
  "identity",
  "mfa",
  "okta",
  "password",
  "policy",
  "procedure",
  "review",
  "risk",
  "saml",
  "security",
  "sso",
  "user",
  "users",
  "2fa",
];

export type CandidateEvidenceSpan = {
  id: string;
  start: number;
  end: number;
  text: string;
  score: number;
};

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function chunkObjectives(
  objectives: AssessmentObjective[],
  batchSize: number
): AssessmentObjective[][] {
  const chunks: AssessmentObjective[][] = [];
  for (let index = 0; index < objectives.length; index += batchSize) {
    chunks.push(objectives.slice(index, index + batchSize));
  }
  return chunks;
}

function extractCitationTerms(value: string): string[] {
  const terms = value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(terms.filter((term) => !TERM_STOP_WORDS.has(term)))];
}

function extractTextBlocks(document: string): Array<{ start: number; end: number; text: string }> {
  const blocks: Array<{ start: number; end: number; text: string }> = [];
  let searchStart = 0;

  for (const rawBlock of document.split(/\n{2,}/)) {
    const rawStart = document.indexOf(rawBlock, searchStart);
    if (rawStart === -1) continue;
    searchStart = rawStart + rawBlock.length;

    const leadingWhitespace = rawBlock.match(/^\s*/)?.[0].length ?? 0;
    const text = rawBlock.trim();
    if (text.length < 20) continue;

    const start = rawStart + leadingWhitespace;
    blocks.push({
      start,
      end: start + text.length,
      text,
    });
  }

  return blocks;
}

export function buildCandidateEvidenceSpans(
  document: string,
  controlTitle: string,
  controlDescription: string,
  objectives: AssessmentObjective[]
): CandidateEvidenceSpan[] {
  const objectiveText = objectives
    .map(
      (objective) =>
        `${objective.scf_ao_id} ${objective.assessment_objective} ${objective.assessment_procedure ?? ""} ${objective.expected_results ?? ""}`
    )
    .join(" ");
  const terms = [
    ...new Set([
      ...extractCitationTerms(`${controlTitle} ${controlDescription} ${objectiveText}`),
      ...SECURITY_CITATION_TERMS,
    ]),
  ];

  return extractTextBlocks(document)
    .map((block) => {
      const lowerText = block.text.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (lowerText.includes(term) ? 1 : 0), 0);
      return { ...block, id: "", score };
    })
    .filter((block) => block.score > 0)
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, MAX_CANDIDATE_SPANS)
    .map((block, index) => ({
      ...block,
      id: `E${index + 1}`,
    }));
}

export function candidateSpanPrompt(candidateSpans: CandidateEvidenceSpan[]): string {
  if (candidateSpans.length === 0) {
    return "No candidate spans were precomputed. Return empty evidence_quotes unless the objective is fail or not_applicable.";
  }

  return candidateSpans
    .map((span) => {
      const preview =
        span.text.length > MAX_CANDIDATE_PROMPT_CHARS
          ? `${span.text.slice(0, MAX_CANDIDATE_PROMPT_CHARS)}...`
          : span.text;
      return `${span.id} [${span.start}-${span.end}]: ${preview}`;
    })
    .join("\n\n");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

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
  const objectiveBatchSize = readPositiveIntegerEnv(
    "ASSESSMENT_OBJECTIVE_BATCH_SIZE",
    DEFAULT_OBJECTIVE_BATCH_SIZE
  );
  const objectiveBatchConcurrency = readPositiveIntegerEnv(
    "ASSESSMENT_OBJECTIVE_BATCH_CONCURRENCY",
    DEFAULT_OBJECTIVE_BATCH_CONCURRENCY
  );
  const objectiveBatches = chunkObjectives(objectives, objectiveBatchSize);
  const promptCacheKey = buildAssessmentPromptCacheKey({
    evidenceContentHash: logContext.evidenceContentHash,
    scfControlId: logContext.scfControlId,
    role: "objectiveAssessor",
    systemPrompt,
  });

  const assessBatch = async (
    objectiveBatch: AssessmentObjective[],
    batchIndex: number
  ): Promise<ObjectiveAssessmentResult[]> => {
    const candidateSpans = buildCandidateEvidenceSpans(
      content,
      controlTitle,
      controlDescription,
      objectiveBatch
    );
    const candidatesById = new Map(candidateSpans.map((span) => [span.id, span]));
    const userPrompt = `${evidenceText}

Control: ${controlTitle}
Description: ${controlDescription}

Assessment Objectives:
${objectiveBatch
  .map(
    (obj, i) => `${i + 1}. ${obj.scf_ao_id} (ID: ${obj.id})
assessment_objective: ${obj.assessment_objective}
assessment_procedure: ${obj.assessment_procedure || "[not supplied]"}
expected_results: ${obj.expected_results || "[not supplied]"}`
  )
  .join("\n")}

Candidate Evidence Spans:
${candidateSpanPrompt(candidateSpans)}

For each objective, determine:
- result: "pass", "fail", "partial", or "not_applicable"
- confidence: number between 0.0 and 1.0
- reasoning: one concise sentence tied to the objective, procedure, and expected results${imageData ? " (consider both text and visual elements)" : ""}
- evidence_quotes: 1-2 supporting candidate span references for pass or partial results. Each item must include candidate_id and supports. Use an empty array only for fail or not_applicable.

Scoping rule: use not_applicable only when this artifact class could never evidence the objective. Use fail when this artifact class should evidence the objective but this document does not.

Use the full document as the source of truth. Candidate spans are offset-verified helpers; cite their candidate_id instead of calculating offsets. Return a JSON object with an "assessments" array containing one assessment per objective.`;

    const aiCallStartedAt = Date.now();
    const generateObjectParams: Record<string, unknown> = {
      model: getAssessmentModel(),
      maxOutputTokens: 6_000,
      schema: z.object({
        assessments: z.array(
          z.object({
            objective_id: z.string(),
            result: z.enum(["pass", "fail", "partial", "not_applicable"]),
            confidence: z.number().min(0).max(1),
            reasoning: z.string(),
            evidence_quotes: z
              .array(
                z.object({
                  candidate_id: z.string(),
                  supports: z.string().default(""),
                })
              )
              .default([]),
          })
        ),
      }),
      system: systemPrompt,
      ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
        reasoningEffort: "medium",
        textVerbosity: "medium",
        promptCacheKey,
        promptCacheRetention: "24h",
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
      { ...logContext, objectiveIds: objectiveBatch.map((objective) => objective.id) },
      "assessAgainstObjectives"
    );
    const typedObject = aiResponse.object as {
      assessments: Array<{
        objective_id: string;
        result: "pass" | "fail" | "partial" | "not_applicable";
        confidence: number;
        reasoning: string;
        evidence_quotes?: Array<{ candidate_id: string; supports?: string }>;
      }>;
    };

    const mappedAssessments = (typedObject.assessments || []).map((assessment) => {
      const evidenceQuotes = (assessment.evidence_quotes ?? []).flatMap((quote) => {
        const candidate = candidatesById.get(quote.candidate_id);
        if (!candidate) return [];
        return [
          {
            start: candidate.start,
            end: candidate.end,
            text: candidate.text,
            supports: quote.supports ?? "",
          },
        ];
      });
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
      objectiveIds: objectiveBatch.map((objective) => objective.id),
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
        objectiveCount: objectiveBatch.length,
        objectiveBatchIndex: batchIndex,
        objectiveBatchCount: objectiveBatches.length,
        objectiveBatchSize,
        objectiveBatchConcurrency,
        candidateSpanCount: candidateSpans.length,
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
  };

  try {
    const batchResults = await mapWithConcurrency(
      objectiveBatches,
      objectiveBatchConcurrency,
      assessBatch
    );
    return batchResults.flat();
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
      prompt: { system: systemPrompt, user: "[batched objective assessment prompts]" },
      error: error instanceof Error ? error.message : "Objective AI assessment failed",
      metadata: {
        ...assessmentContractMetadata(),
        call: "assessAgainstObjectives",
        objectiveCount: objectives.length,
        objectiveBatchSize,
        objectiveBatchConcurrency,
        includesImage: Boolean(imageData),
        modelVersion: COMPLIANCE_AI_CONFIG.controlMapping.model,
      },
    });
    throw error;
  }
}

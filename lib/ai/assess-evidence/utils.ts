import { generateObject } from "ai";
import { createHash } from "crypto";
import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import {
  checkCircuitBreaker,
  ProviderTrippedError,
  recordFailure,
  recordSuccess,
} from "@/lib/ai/circuit-breaker";
import { getModel } from "@/lib/ai-client";
import { COMPLIANCE_AI_CONFIG } from "@/lib/ai-config";
import { ASSESSMENT_CONTRACT_VERSION, assessmentTruncationKillSwitchEnabled } from "./contract";
import type { AssessmentLogContext } from "./types";

export { ProviderTrippedError } from "@/lib/ai/circuit-breaker";

export const AI_CALL_TIMEOUT_MS = 90_000;
export const MAX_AI_CALL_ATTEMPTS = 3;
const BACKOFF_DELAYS_MS = [1_000, 2_000, 4_000];
export const CONTROL_REUSE_LOOKBACK_LIMIT = 50;

export function getAssessmentModel() {
  return getModel(
    COMPLIANCE_AI_CONFIG.controlMapping.provider,
    COMPLIANCE_AI_CONFIG.controlMapping.model
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export function createControlRunKey(
  evidenceId: string,
  scfControlId: string,
  evidenceContentHash: string
): string {
  return createHash("sha256")
    .update(`${ASSESSMENT_CONTRACT_VERSION}:${evidenceId}:${scfControlId}:${evidenceContentHash}`)
    .digest("hex");
}

export function confidenceLevelToScore(level: string | null | undefined): number {
  if (level === "high") return 0.9;
  if (level === "medium") return 0.6;
  return 0.3;
}

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("timed out");
}

export function buildEvidenceText(
  content: string,
  imageData: { base64: string; mimeType: string } | null
): string {
  const textContent = assessmentTruncationKillSwitchEnabled()
    ? content.substring(0, imageData ? 1500 : 2000)
    : content;

  return imageData
    ? `DOCUMENT TEXT (character offsets start at 0):
${textContent}

Additionally, analyze the visual content of the provided image/screenshot for compliance evidence. Evidence quote offsets must refer to DOCUMENT TEXT only.`
    : `DOCUMENT TEXT (character offsets start at 0):
${textContent}`;
}

export function buildGenerateObjectImageParams(
  imageData: { base64: string; mimeType: string },
  userPrompt: string
): {
  messages: Array<{
    role: "user";
    content: Array<{ type: "text"; text: string } | { type: "image"; image: string }>;
  }>;
} {
  return {
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userPrompt },
          {
            type: "image" as const,
            image: `data:${imageData.mimeType};base64,${imageData.base64}`,
          },
        ],
      },
    ],
  };
}

export async function generateObjectWithRetry(
  params: Parameters<typeof generateObject>[0],
  logContext: AssessmentLogContext & { objectiveIds?: string[] },
  call: "createBasicAssessment" | "assessAgainstObjectives" | "assessMaturityLevel"
): Promise<Awaited<ReturnType<typeof generateObject>>> {
  const provider = COMPLIANCE_AI_CONFIG.controlMapping.provider;

  // Circuit breaker check — fail-open if health table unreachable
  const { allowed } = await checkCircuitBreaker(provider);
  if (!allowed) {
    throw new ProviderTrippedError(provider);
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_AI_CALL_ATTEMPTS; attempt += 1) {
    const startedAtMs = Date.now();

    try {
      const result = await withTimeout(
        generateObject(params),
        AI_CALL_TIMEOUT_MS,
        `AI call timed out in ${call}`
      );
      await recordSuccess(provider);
      return result;
    } catch (error) {
      lastError = error;
      const timeoutError = isTimeoutError(error);
      const errorMessage = error instanceof Error ? error.message : "Unknown AI call failure";

      await recordFailure(provider);

      await appendAIAssessmentLog({
        requestId: logContext.requestId,
        sessionId: logContext.sessionId,
        scope: timeoutError ? "timeout" : "retry",
        status: attempt < MAX_AI_CALL_ATTEMPTS ? "warning" : "error",
        evidenceId: logContext.evidenceId,
        evidenceContentHash: logContext.evidenceContentHash,
        scfControlId: logContext.scfControlId,
        objectiveIds: logContext.objectiveIds,
        modelProvider: provider,
        modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
        latencyMs: Date.now() - startedAtMs,
        error: errorMessage,
        metadata: {
          call,
          attempt,
          maxAttempts: MAX_AI_CALL_ATTEMPTS,
          reason: timeoutError ? "timeout" : "ai_call_error",
          timeoutMs: AI_CALL_TIMEOUT_MS,
        },
      });

      if (attempt >= MAX_AI_CALL_ATTEMPTS) {
        throw error;
      }

      // Exponential backoff before next attempt
      const delayMs =
        BACKOFF_DELAYS_MS[attempt - 1] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`AI call failed in ${call}`);
}

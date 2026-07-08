import { createHash } from "crypto";
import { z } from "zod";
import { COMPLIANCE_AI_CONFIG } from "@/lib/ai-config";

export const ASSESSMENT_CONTRACT_VERSION = "assessment-evidence.v1";

export const ASSESSMENT_PROMPT_VERSIONS = {
  objectiveAssessor: "objective-assessor.v1",
  maturityAssessor: "maturity-assessor.v1",
  basicAssessor: "basic-assessor.v1",
} as const;

export const EvidenceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  text: z.string(),
  supports: z.string().default(""),
});

export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

export function assessmentTruncationKillSwitchEnabled(): boolean {
  return process.env.ASSESSMENT_EVIDENCE_TRUNCATION_MODE === "legacy";
}

export function stableAssessmentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function buildAssessmentPromptCacheKey(input: {
  evidenceContentHash: string;
  scfControlId: string;
  role: keyof typeof ASSESSMENT_PROMPT_VERSIONS;
  systemPrompt: string;
}): string {
  const rawKey = [
    "graphletter-assessment",
    ASSESSMENT_CONTRACT_VERSION,
    input.evidenceContentHash,
    input.scfControlId,
    input.role,
    ASSESSMENT_PROMPT_VERSIONS[input.role],
    COMPLIANCE_AI_CONFIG.controlMapping.model,
    stableAssessmentHash(input.systemPrompt),
  ].join(":");

  return `gl:${stableAssessmentHash(rawKey)}`;
}

export function verifiedEvidenceSpans(document: string, spans: EvidenceSpan[]): EvidenceSpan[] {
  return spans.filter(
    (span) =>
      span.start < span.end &&
      span.end <= document.length &&
      document.slice(span.start, span.end) === span.text
  );
}

export function assessmentContractMetadata() {
  return {
    assessment_contract_version: ASSESSMENT_CONTRACT_VERSION,
    assessment_prompt_versions: ASSESSMENT_PROMPT_VERSIONS,
  };
}

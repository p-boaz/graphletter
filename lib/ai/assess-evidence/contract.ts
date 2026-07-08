import { createHash } from "crypto";
import { z } from "zod";

export const ASSESSMENT_CONTRACT_VERSION = "assessment-evidence.v1";

export const ASSESSMENT_PROMPT_VERSIONS = {
  objectiveAssessor: "objective-assessor.v1",
  maturityAssessor: "maturity-assessor.v1",
  basicAssessor: "basic-assessor.v1",
} as const;

export type AssessmentEvidenceMode = "contract_v1" | "legacy";

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

export function assessmentEvidenceMode(): AssessmentEvidenceMode {
  return assessmentTruncationKillSwitchEnabled() ? "legacy" : "contract_v1";
}

export function stableAssessmentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function buildAssessmentPromptCacheKey(input: { evidenceContentHash: string }): string {
  const rawKey = [
    "graphletter-assessment",
    ASSESSMENT_CONTRACT_VERSION,
    input.evidenceContentHash,
  ].join(":");

  return `gl:${stableAssessmentHash(rawKey)}`;
}

export function verifiedEvidenceSpans(document: string, spans: EvidenceSpan[]): EvidenceSpan[] {
  return spans.flatMap((span) => {
    if (
      span.start < span.end &&
      span.end <= document.length &&
      document.slice(span.start, span.end) === span.text
    ) {
      return [span];
    }

    const relocated = relocateWhitespaceNormalizedSpan(document, span);
    return relocated ? [relocated] : [];
  });
}

export function assessmentContractMetadata() {
  return {
    assessment_contract_version: ASSESSMENT_CONTRACT_VERSION,
    assessment_prompt_versions: ASSESSMENT_PROMPT_VERSIONS,
    assessment_evidence_mode: assessmentEvidenceMode(),
  };
}

function normalizeForSearch(value: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let inWhitespace = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (/\s/.test(char)) {
      if (!inWhitespace && text.length > 0) {
        text += " ";
        map.push(index);
      }
      inWhitespace = true;
      continue;
    }

    text += char;
    map.push(index);
    inWhitespace = false;
  }

  return { text: text.trim(), map };
}

function relocateWhitespaceNormalizedSpan(
  document: string,
  span: EvidenceSpan
): EvidenceSpan | null {
  const normalizedDocument = normalizeForSearch(document);
  const normalizedQuote = normalizeForSearch(span.text);
  if (!normalizedQuote.text) return null;

  const matches: number[] = [];
  let searchFrom = 0;
  while (searchFrom <= normalizedDocument.text.length) {
    const foundAt = normalizedDocument.text.indexOf(normalizedQuote.text, searchFrom);
    if (foundAt === -1) break;
    matches.push(foundAt);
    searchFrom = foundAt + Math.max(1, normalizedQuote.text.length);
  }
  if (matches.length === 0) return null;

  const closest = matches.sort((left, right) => {
    const leftDistance = Math.abs((normalizedDocument.map[left] ?? 0) - span.start);
    const rightDistance = Math.abs((normalizedDocument.map[right] ?? 0) - span.start);
    return leftDistance - rightDistance;
  })[0];
  const start = normalizedDocument.map[closest];
  const endMapIndex = closest + normalizedQuote.text.length - 1;
  const lastMappedChar = normalizedDocument.map[endMapIndex];
  if (start == null || lastMappedChar == null) return null;

  let end = lastMappedChar + 1;
  while (end < document.length && /\s/.test(document[end]) && /\s$/.test(span.text)) {
    end += 1;
  }

  return {
    start,
    end,
    text: document.slice(start, end),
    supports: span.supports,
  };
}

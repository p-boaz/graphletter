import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { generateObject } from "ai";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import {
  ASSESSMENT_CONTRACT_VERSION,
  EvidenceSpanSchema,
  buildAssessmentPromptCacheKey,
  verifiedEvidenceSpans,
} from "@/lib/ai/assess-evidence/contract";
import type { AssessmentObjective, MaturityLevels } from "@/lib/ai/assess-evidence/types";
import { buildEvidenceText } from "@/lib/ai/assess-evidence/utils";
import { getModel } from "@/lib/ai-client";
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
} from "@/lib/ai-config";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

loadDotenv({ path: ".env.local" });

type ProbeRow = {
  slug: string;
  title: string;
  raw_url: string;
  control_id: string;
  required: string;
};

type ProbeCell = "legacy_truncated" | "contract_v1" | "contract_v1_verify_lane";

const MATRIX: ProbeCell[] = ["legacy_truncated", "contract_v1", "contract_v1_verify_lane"];
const OUT_DIR = join(process.cwd(), "scripts", "out");
const COST_INPUT_PER_1M = Number(process.env.ASSESSMENT_PROBE_INPUT_USD_PER_1M ?? "0");
const COST_CACHED_INPUT_PER_1M = Number(
  process.env.ASSESSMENT_PROBE_CACHED_INPUT_USD_PER_1M ?? "0"
);
const COST_OUTPUT_PER_1M = Number(process.env.ASSESSMENT_PROBE_OUTPUT_USD_PER_1M ?? "0");

const LegacyObjectiveSchema = z.object({
  assessments: z.array(
    z.object({
      objective_id: z.string(),
      result: z.enum(["pass", "fail", "partial", "not_applicable"]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    })
  ),
});

const ContractObjectiveSchema = z.object({
  objective_id: z.string(),
  result: z.enum(["pass", "fail", "partial", "not_applicable"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evidence_quotes: z.array(EvidenceSpanSchema).default([]),
});

const MaturitySchema = z.object({
  assessed_level: z.number().int().min(0).max(5),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  recommended_actions: z.array(z.string()).optional(),
  referenced_level_description: z.string().optional(),
  target_level: z.number().int().min(0).max(5).nullable().optional(),
  target_met: z.boolean().nullable().optional(),
  target_gap: z.number().min(-5).max(5).nullable().optional(),
});

const VerifierSchema = z.object({
  verdict: z.enum(["confirmed", "dissent"]),
  rationale: z.string(),
  missing_or_conflicting_evidence_ids: z.array(z.string()).default([]),
});

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

async function readProbeRows(): Promise<ProbeRow[]> {
  const csv = await readFile(
    join(process.cwd(), "fixtures", "assessment-probe-manifest.csv"),
    "utf8"
  );
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    ) as ProbeRow;
  });
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function estimateCost(usage: {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}): number {
  const input = usage.inputTokens ?? 0;
  const cached = usage.cachedInputTokens ?? 0;
  const uncached = Math.max(0, input - cached);
  const output = usage.outputTokens ?? 0;
  return (
    (uncached / 1_000_000) * COST_INPUT_PER_1M +
    (cached / 1_000_000) * COST_CACHED_INPUT_PER_1M +
    (output / 1_000_000) * COST_OUTPUT_PER_1M
  );
}

function usageFrom(response: Awaited<ReturnType<typeof generateObject>>) {
  return {
    inputTokens: response.usage?.inputTokens ?? 0,
    cachedInputTokens: response.usage?.cachedInputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
    totalTokens: response.usage?.totalTokens ?? 0,
  };
}

function addUsage(
  left: ReturnType<typeof usageFrom>,
  right: ReturnType<typeof usageFrom>
): ReturnType<typeof usageFrom> {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

async function runLegacyObjective(input: {
  document: string;
  objectives: AssessmentObjective[];
  controlTitle: string;
  controlDescription: string;
}) {
  const system =
    "You are a compliance assessment expert. Assess evidence against SCF assessment objectives and return structured JSON results.";
  const prompt = `Assess this evidence against SCF assessment objectives:

Control: ${input.controlTitle}
Description: ${input.controlDescription}
Evidence: ${input.document.substring(0, 2000)}

Assessment Objectives:
${input.objectives
  .map(
    (objective, index) =>
      `${index + 1}. ${objective.scf_ao_id} (ID: ${objective.id}): ${objective.assessment_objective}`
  )
  .join("\n")}

For each objective, determine result, confidence, and brief reasoning.`;
  const startedAt = Date.now();
  const response = await generateObject({
    model: getModel(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model
    ),
    maxOutputTokens: 6_000,
    schema: LegacyObjectiveSchema,
    system,
    prompt,
    ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
      reasoningEffort: "low",
      textVerbosity: "low",
    }),
    ...getTemperatureSettings(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model,
      0.1
    ),
  });
  return {
    object: response.object,
    usage: usageFrom(response),
    latencyMs: Date.now() - startedAt,
  };
}

async function runContractObjective(input: {
  document: string;
  evidenceContentHash: string;
  objectives: AssessmentObjective[];
  controlId: string;
  controlTitle: string;
  controlDescription: string;
}) {
  const system =
    "You are a compliance assessment expert. Assess SCF objectives against the supplied evidence and return structured JSON. Use only the supplied document and visual evidence. Evidence quote offsets must exactly match DOCUMENT TEXT character offsets. Do not provide analysis outside the JSON object.";
  const evidenceText = buildEvidenceText(input.document, null);
  const startedAt = Date.now();
  const promptCacheKey = buildAssessmentPromptCacheKey({
    evidenceContentHash: input.evidenceContentHash,
  });

  const prompt = `${evidenceText}

Control: ${input.controlTitle}
Description: ${input.controlDescription}

Assessment Objectives:
${input.objectives
  .map(
    (objective, index) => `${index + 1}. ${objective.scf_ao_id} (ID: ${objective.id})
assessment_objective: ${objective.assessment_objective}
assessment_procedure: ${objective.assessment_procedure || "[not supplied]"}
expected_results: ${objective.expected_results || "[not supplied]"}`
  )
  .join("\n")}

For each objective, determine result, confidence, one concise reasoning sentence, and 1-2 supporting quotes for pass or partial results. Each evidence_quotes item must include start, end, text, and supports. Use an empty evidence_quotes array only for fail or not_applicable.

Scoping rule: use not_applicable only when this artifact class could never evidence the objective. Use fail when this artifact class should evidence the objective but this document does not.

Use the full document as the source of truth. Return a JSON object with an "assessments" array containing one assessment per objective.`;

  const response = await generateObject({
    model: getModel(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model
    ),
    maxOutputTokens: 6_000,
    schema: z.object({ assessments: z.array(ContractObjectiveSchema) }),
    system,
    prompt,
    ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
      reasoningEffort: "medium",
      textVerbosity: "medium",
      promptCacheKey,
      promptCacheRetention: "24h",
    }),
  });

  return {
    object: {
      assessments: response.object.assessments.map((assessment) => ({
        ...assessment,
        evidence_quotes: verifiedEvidenceSpans(input.document, assessment.evidence_quotes),
      })),
    },
    usage: usageFrom(response),
    latencyMs: Date.now() - startedAt,
  };
}

async function runMaturity(input: {
  document: string;
  evidenceContentHash: string;
  controlId: string;
  controlTitle: string;
  controlDescription: string;
  maturityLevels: MaturityLevels;
  targetLevel: number | null;
  legacy: boolean;
}) {
  const levelEntries = [
    { level: 0, description: input.maturityLevels.level_0_description },
    { level: 1, description: input.maturityLevels.level_1_description },
    { level: 2, description: input.maturityLevels.level_2_description },
    { level: 3, description: input.maturityLevels.level_3_description },
    { level: 4, description: input.maturityLevels.level_4_description },
    { level: 5, description: input.maturityLevels.level_5_description },
  ].filter((entry) => typeof entry.description === "string" && entry.description.trim());
  const benchmarkSummary = levelEntries
    .map((entry) => `Level ${entry.level}: ${entry.description?.trim()}`)
    .join("\n\n");
  const system =
    "You are a compliance maturity assessment expert. Evaluate evidence against capability maturity benchmarks.";
  const targetText =
    typeof input.targetLevel === "number"
      ? `Target maturity level for this control: ${input.targetLevel}. Determine if current evidence meets, exceeds, or falls short of this target.`
      : input.legacy
        ? "No explicit target maturity level provided; determine the most appropriate level based on benchmarks."
        : "No explicit target maturity level is configured for this control. Do not return target_level, target_met, or target_gap.";
  const prompt = `Assess the maturity level for control ${input.controlId} - ${input.controlTitle}.

Control description: ${input.controlDescription}

${input.legacy ? `Evidence: ${input.document.substring(0, 2000)}` : buildEvidenceText(input.document, null)}

Maturity benchmarks:
${benchmarkSummary}

${targetText}

Return JSON with assessed_level, confidence, rationale, recommended_actions, referenced_level_description${
    typeof input.targetLevel === "number"
      ? ", target_level, target_met, and target_gap"
      : input.legacy
        ? ", optional target_level, optional target_met, and optional target_gap"
        : "; omit target_level, target_met, and target_gap"
  }.`;
  const startedAt = Date.now();
  const response = await generateObject({
    model: getModel(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model
    ),
    maxOutputTokens: 6_000,
    schema: MaturitySchema,
    system,
    prompt,
    ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
      reasoningEffort: input.legacy ? "low" : "medium",
      textVerbosity: input.legacy ? "low" : "medium",
      ...(input.legacy
        ? {}
        : {
            promptCacheKey: buildAssessmentPromptCacheKey({
              evidenceContentHash: input.evidenceContentHash,
            }),
            promptCacheRetention: "24h" as const,
          }),
    }),
    ...getTemperatureSettings(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model,
      0.1
    ),
  });

  const assessedLevel = Math.max(0, Math.min(5, Math.round(response.object.assessed_level)));
  const result: Record<string, unknown> = {
    assessed_level: assessedLevel,
    confidence: Math.max(0, Math.min(1, response.object.confidence)),
    rationale: response.object.rationale,
    referenced_level_description: response.object.referenced_level_description ?? null,
    recommended_actions: response.object.recommended_actions
      ?.filter((action) => action.trim())
      .slice(0, 5),
  };
  if (typeof input.targetLevel === "number") {
    result.target_level = input.targetLevel;
    result.target_met = assessedLevel >= input.targetLevel;
    result.target_gap = assessedLevel - input.targetLevel;
  } else if (input.legacy) {
    result.target_level = response.object.target_level ?? null;
    result.target_met = response.object.target_met ?? null;
    result.target_gap = response.object.target_gap ?? null;
  }

  return {
    object: result,
    usage: usageFrom(response),
    latencyMs: Date.now() - startedAt,
  };
}

async function runVerifier(input: {
  document: string;
  controlId: string;
  controlTitle: string;
  controlDescription: string;
  objectives: AssessmentObjective[];
  objectiveResults: unknown;
}) {
  const startedAt = Date.now();
  const response = await generateObject({
    model: getModel(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model
    ),
    maxOutputTokens: 6_000,
    schema: VerifierSchema,
    system:
      "You are an adversarial compliance verifier. Preserve dissent when the assessment overclaims or misses material evidence. Return missing or conflicting evidence as direct document offsets.",
    prompt: `DOCUMENT TEXT (character offsets start at 0):
${input.document}

Control ${input.controlId}: ${input.controlTitle}

ASSESSMENT TO VERIFY:
${JSON.stringify(input.objectiveResults, null, 2)}

Return whether the assessment is confirmed or dissent is required.`,
    ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
      reasoningEffort: "medium",
      textVerbosity: "medium",
    }),
    ...getTemperatureSettings(
      COMPLIANCE_AI_CONFIG.controlMapping.provider,
      COMPLIANCE_AI_CONFIG.controlMapping.model,
      0.1
    ),
  });

  return {
    object: {
      verdict: response.object.verdict,
      rationale: response.object.rationale,
      missing_or_conflicting_evidence: [],
    },
    usage: usageFrom(response),
    latencyMs: Date.now() - startedAt,
  };
}

async function main() {
  const rowLimit = Math.max(1, Math.min(5, Number(process.env.ASSESSMENT_PROBE_ROW_LIMIT ?? "5")));
  const rows = (await readProbeRows()).slice(0, rowLimit);
  if (!rows.some((row) => row.slug === "password-standard" && row.control_id === "IAC-02")) {
    throw new Error("Probe fixture must include password-standard x IAC-02");
  }

  const supabase = createServiceClient(getSupabaseServerUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await mkdir(OUT_DIR, { recursive: true });
  const revision = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonlPath = join(OUT_DIR, `assessment-probe-${revision}.jsonl`);
  const markdownPath = join(OUT_DIR, `assessment-probe-${revision}.md`);
  const jsonLines: string[] = [];
  const mdRows: string[] = [
    `# Assessment Probe ${revision}`,
    "",
    `Contract version: ${ASSESSMENT_CONTRACT_VERSION}`,
    "",
    "| Document | Control | Cell | Maturity | Tokens in/cached/out | Latency ms | Estimated cost USD | Evidence check |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- |",
  ];

  for (const row of rows) {
    const document = await fetchText(row.raw_url);
    const evidenceContentHash = createHash("sha256").update(document).digest("hex");
    const [controlResult, objectivesResult, maturityResult] = await Promise.all([
      supabase
        .from("scf_controls")
        .select("id, title, description, target_maturity_level")
        .eq("id", row.control_id)
        .single(),
      supabase
        .from("scf_assessment_objectives")
        .select("id, scf_ao_id, assessment_objective, assessment_procedure, expected_results")
        .eq("scf_control_id", row.control_id),
      supabase
        .from("scf_maturity_levels")
        .select(
          "level_0_description, level_1_description, level_2_description, level_3_description, level_4_description, level_5_description"
        )
        .eq("scf_control_id", row.control_id)
        .limit(1),
    ]);

    if (controlResult.error || !controlResult.data) {
      throw new Error(
        `Missing control ${row.control_id}: ${controlResult.error?.message ?? "no row"}`
      );
    }
    if (objectivesResult.error) {
      throw new Error(
        `Missing objectives for ${row.control_id}: ${objectivesResult.error.message}`
      );
    }

    const control = controlResult.data;
    const objectives = (objectivesResult.data ?? []) as AssessmentObjective[];
    const maturityLevels = (maturityResult.data?.[0] ?? null) as MaturityLevels | null;
    for (const cell of MATRIX) {
      console.error(`Running probe cell: ${row.slug} ${row.control_id} ${cell}`);
      const startedAt = Date.now();
      const legacy = cell === "legacy_truncated";
      const objectiveRun = legacy
        ? await runLegacyObjective({
            document,
            objectives,
            controlTitle: control.title,
            controlDescription: control.description,
          })
        : {
            ...(await runContractObjective({
              document,
              evidenceContentHash,
              objectives,
              controlId: row.control_id,
              controlTitle: control.title,
              controlDescription: control.description,
            })),
          };

      const maturityRun = maturityLevels
        ? await runMaturity({
            document,
            evidenceContentHash,
            controlId: row.control_id,
            controlTitle: control.title,
            controlDescription: control.description,
            maturityLevels,
            targetLevel:
              typeof control.target_maturity_level === "number"
                ? control.target_maturity_level
                : null,
            legacy,
          })
        : null;
      const maturity = maturityRun?.object ?? null;

      const verifier =
        cell === "contract_v1_verify_lane"
          ? await runVerifier({
              document,
              controlId: row.control_id,
              controlTitle: control.title,
              controlDescription: control.description,
              objectives,
              objectiveResults: objectiveRun.object,
            })
          : null;

      const usage = verifier
        ? {
            inputTokens:
              objectiveRun.usage.inputTokens +
              (maturityRun?.usage.inputTokens ?? 0) +
              verifier.usage.inputTokens,
            cachedInputTokens:
              objectiveRun.usage.cachedInputTokens +
              (maturityRun?.usage.cachedInputTokens ?? 0) +
              verifier.usage.cachedInputTokens,
            outputTokens:
              objectiveRun.usage.outputTokens +
              (maturityRun?.usage.outputTokens ?? 0) +
              verifier.usage.outputTokens,
            totalTokens:
              objectiveRun.usage.totalTokens +
              (maturityRun?.usage.totalTokens ?? 0) +
              verifier.usage.totalTokens,
          }
        : addUsage(
            objectiveRun.usage,
            maturityRun?.usage ?? {
              inputTokens: 0,
              cachedInputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            }
          );
      const latencyMs = Date.now() - startedAt;
      const evidenceText = JSON.stringify({
        objectiveRun: objectiveRun.object,
        maturity,
        verifier,
      });
      const evidenceCheck =
        row.slug === "password-standard" && row.control_id === "IAC-02"
          ? ["okta", "saml", "2fa"]
              .filter((needle) => evidenceText.toLowerCase().includes(needle))
              .join("+") || "missing-okta-saml-2fa"
          : "";

      const record = {
        revision,
        contractVersion: ASSESSMENT_CONTRACT_VERSION,
        document: row.slug,
        title: row.title,
        controlId: row.control_id,
        cell,
        charCount: document.length,
        latencyMs,
        usage,
        estimatedCostUsd: estimateCost(usage),
        objectiveAssessment: objectiveRun.object,
        maturityAssessment: maturity,
        verifier,
        evidenceCheck,
      };
      jsonLines.push(JSON.stringify(record));
      mdRows.push(
        `| ${row.slug} | ${row.control_id} | ${cell} | ${maturity?.assessed_level ?? "n/a"} | ${usage.inputTokens}/${usage.cachedInputTokens}/${usage.outputTokens} | ${latencyMs} | ${record.estimatedCostUsd.toFixed(6)} | ${evidenceCheck} |`
      );
    }
  }

  await writeFile(jsonlPath, `${jsonLines.join("\n")}\n`);
  await writeFile(markdownPath, `${mdRows.join("\n")}\n`);
  await writeFile(
    join(dirname(markdownPath), "assessment-probe-latest.md"),
    `${mdRows.join("\n")}\n`
  );
  console.log(JSON.stringify({ jsonlPath, markdownPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

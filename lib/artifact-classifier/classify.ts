import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai-client";
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
} from "@/lib/ai-config";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

import type { ArtifactCatalogEntry, ClassifyResponse } from "./types";

const log = createLogger("artifact-classifier");

const NO_MATCH = "__NO_MATCH__";

// Sentinel returned when the LLM cannot find a good match in the catalog.
// Kept as a module constant so callers (eval harness, tests) can import it.
export { NO_MATCH };

export async function loadArtifactCatalog(): Promise<ArtifactCatalogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("scf_evidence_request_list")
    .select("erl_id, documentation_artifact")
    .not("documentation_artifact", "is", null)
    .neq("documentation_artifact", "")
    .order("documentation_artifact");

  if (error) {
    throw new Error(`Failed to load artifact catalog: ${error.message}`);
  }

  const seen = new Set<string>();
  const entries: ArtifactCatalogEntry[] = [];
  for (const row of data ?? []) {
    const name = String(row.documentation_artifact ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    entries.push({ artifact: name, erlId: String(row.erl_id) });
  }
  return entries;
}

export interface ClassifyOptions {
  mimeType?: string;
  catalog?: ArtifactCatalogEntry[];
}

export async function classifyArtifactFromFilename(
  filename: string,
  options: ClassifyOptions = {}
): Promise<ClassifyResponse> {
  const catalog = options.catalog ?? (await loadArtifactCatalog());

  if (catalog.length === 0) {
    log.warn("Classifier invoked with empty catalog", { filename });
    return {
      artifact: null,
      erlId: null,
      confidence: "low",
      reasoning: "Empty artifact catalog",
    };
  }

  const enumValues = [...catalog.map((e) => e.artifact), NO_MATCH] as unknown as [
    string,
    ...string[],
  ];
  const schema = z.object({
    artifact: z
      .enum(enumValues)
      .describe(`One of the catalog artifact names, or "${NO_MATCH}" if nothing fits.`),
    confidence: z
      .enum(["high", "medium", "low"])
      .describe("How confident the match is given only the filename."),
    reasoning: z
      .string()
      .max(500)
      .describe("Brief explanation: which filename tokens drove the pick."),
  });

  const { provider, model, temperature } = COMPLIANCE_AI_CONFIG.controlMapping;
  const modelInstance = getModel(provider, model);

  const prompt = [
    "You classify evidence filenames for a cybersecurity compliance platform (Graphletter, backed by the Secure Controls Framework / SCF).",
    "",
    `Pick the single documentation-artifact category this file most likely contains evidence for. Filenames often include document-type prefixes (SOP, POL, IT, WI, FRM), company-internal serial numbers, and a short human title. Ignore serial numbers and prefix codes; focus on the human-readable title tokens.`,
    `Prefer the most specific matching artifact over a generic category like "Cybersecurity & Data Protection Policies" or "Cybersecurity & Data Protection Procedures". Only fall back to a generic policy/procedure bucket when no narrower artifact fits.`,
    `Decision guardrails (important):`,
    `  - Treat "Cybersecurity & Data Protection Policies" and "Cybersecurity & Data Protection Procedures" as last-resort generic classes.`,
    `  - If a filename includes HIPAA/PHI plus a specific topic, choose the corresponding privacy/incident/third-party artifact instead of a generic policy/procedure bucket.`,
    `  - "acceptable use policy", "rules of behavior" → "Rules of Behavior"`,
    `  - "authorized use", "permitted use" → "Authorized Use"`,
    `  - "business associate", "third-party contract", "vendor agreement" → "Third-Party Contracts"`,
    `  - "data sharing", "research disclosure", "research purposes", "sharing agreement" → "Data Sharing Agreement"`,
    `  - "complaint", "incident reporting", "breach notification" → "Incident Reporting Capability"`,
    `  - "accounting of disclosures", "disclosure tracking/log" → "Accounting of Disclosures"`,
    `  - "use/disclosure of PHI" usually → "Accounting of Disclosures"; if it is explicitly a sharing agreement/contract, choose "Data Sharing Agreement"`,
    `  - "personal data categories", "types of PHI/PII", "PHI safeguards" → "Personal Data Categories"`,
    `  - "roles and responsibilities" for PHI/PII/sensitive data → "Role Assignment - Sensitive / Regulated Data"`,
    `  - "backup", "cloud backup", "remote backup" → "Backups - Remote"`,
    `  - "asset acceptance", "asset intake", "asset receiving" → "Asset Inventories - Hardware"`,
    `  - "onboarding" with access lifecycle terms can map to "Provisioning Checklist (Onboarding)"`,
    `  - "former employee", "terminated employee", "offboarding access", "deprovision" → "Deprovisioning Checklist (Offboarding)"`,
    `  - "signature authority", "delegation of authority" → "Assigned Responsibilities"`,
    `  - "change control" (without explicit CCB charter/minutes) → "Evidence of Cybersecurity / Data Privacy Reviews"`,
    `  - "supplier management", "vendor management" → "Third-Party Service Reviews"`,
    `  - "design control" → "Secure Engineering Principles (SEP)"`,
    `  - "risk management report" can map to "Cybersecurity Risk Assessment (RA)" when assessment/reporting language is present`,
    `  - "software maintenance" leans "Patch Management" unless the filename explicitly says maintenance plan`,
    `  - "CAPA", "corrective and preventive action" → "Root Cause Analysis (RCA)"`,
    `Examples:`,
    `  "IT-1-100001_FAQ for Video Conferencing.docx" → "Cybersecurity & Data Protection Procedures"`,
    `  "IT-2-100003_IT Asset Management.docx" → "IT Asset Management (ITAM)"`,
    `  "IT-2-100006_Acceptable Use Policy.docx" → "Rules of Behavior"`,
    `  "IT-2-100007_Data Storage Device and Cloud Backup Usage.docx" → "Backups - Remote"`,
    `  "IT-2-100008_IT Asset Acceptance Procedure.docx" → "Asset Inventories - Hardware"`,
    `  "IT-2-100010_Onboarding and Termination Access Policy.docx" → "Provisioning Checklist (Onboarding)"`,
    `  "POL-1-100002_HIPAA Compliance Security Policy.docx" → "Cybersecurity & Data Protection Policies"`,
    `  "POL-1-100003_HIPAA Compliance-Authorized Use of PHI.docx" → "Authorized Use"`,
    `  "POL-1-100004_HIPAA Compliance-PHI Safeguards.docx" → "Personal Data Categories"`,
    `  "POL-1-100005_HIPAA Compliance-PHI Roles and Responsibilities.docx" → "Role Assignment - Sensitive / Regulated Data"`,
    `  "POL-1-100006_HIPAA Compliance-Business Associate Policy.docx" → "Third-Party Contracts"`,
    `  "POL-1-100007_HIPAA Compliance-Privacy Complaint Procedure.docx" → "Incident Reporting Capability"`,
    `  "POL-1-100009_HIPAA Compliance-Routine Use and Disclosure of PHI.docx" → "Accounting of Disclosures"`,
    `  "POL-1-100010_HIPAA Compliance-Extraordinary Disclosure of PHI.docx" → "Accounting of Disclosures"`,
    `  "POL-1-100011_HIPAA Compliance-Use and Disclosure of PHI for Research Purposes.docx" → "Data Sharing Agreement"`,
    `  "POL-1-100015_Signature Authority.docx" → "Assigned Responsibilities"`,
    `  "POL-1-100063_Guidelines for Former Employee Data Access.docx" → "Deprovisioning Checklist (Offboarding)"`,
    `  "SOP-1-110002_Change Control.docx" → "Evidence of Cybersecurity / Data Privacy Reviews"`,
    `  "SOP-1-110006_Supplier Management.docx" → "Third-Party Service Reviews"`,
    `  "SOP-1-110012_CAPA Procedure.docx" → "Root Cause Analysis (RCA)"`,
    `  "SOP-1-110014_Internal Audit.docx" → "Internal Audit (IA)"`,
    `  "SOP-1-110025_Design Control.docx" → "Secure Engineering Principles (SEP)"`,
    `  "POL-1-100066_Generative AI Use Policy.docx" → "Artificial Intelligence and Autonomous Technologies (AAT) Governance Program"`,
    `  "POL-1-100062_Physical Security Policy.docx" → "Physical Security Operations"`,
    `  "RSK-1-128006_Annual Risk Management Report.docx" → "Cybersecurity Risk Assessment (RA)"`,
    `  "SWD-2-185020-1_Production Software Maintenance.docx" → "Patch Management"`,
    "",
    `If no artifact is a reasonable match, return "${NO_MATCH}" and set confidence to "low". Prefer "${NO_MATCH}" over a weak guess.`,
    "",
    `Filename: ${filename}`,
    options.mimeType ? `MIME type: ${options.mimeType}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema,
      prompt,
      ...getTemperatureSettings(provider, model, temperature),
      // NOTE: Some OpenAI models reject enum values that TypeScript accepts.
      // e.g. gpt-5.4 rejects reasoningEffort: "minimal" at runtime even though
      // the OpenAIReasoningEffort union includes it. If this call starts
      // failing with "Unsupported value", check textVerbosity: "low" first.
      ...getOpenAIProviderOptions(provider, {
        reasoningEffort: "low",
        textVerbosity: "low",
      }),
    });

    if (object.artifact === NO_MATCH) {
      return {
        artifact: null,
        erlId: null,
        confidence: object.confidence,
        reasoning: object.reasoning,
      };
    }

    const match = catalog.find((entry) => entry.artifact === object.artifact);
    return {
      artifact: object.artifact,
      erlId: match?.erlId ?? null,
      confidence: object.confidence,
      reasoning: object.reasoning,
    };
  } catch (error) {
    log.error("Classifier call failed", {
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

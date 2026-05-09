import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai-client";
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
} from "@/lib/ai-config";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("lib/ai/assessment-engine");

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface AssessmentObjective {
  id: string;
  scf_ao_id: string;
  assessment_objective: string;
  assessment_procedure?: string;
  expected_results?: string;
}

interface AssessmentResult {
  objective_id: string;
  result: "pass" | "fail" | "partial" | "not_applicable";
  confidence: number;
  reasoning: string;
  gaps?: string[];
  recommendations?: string[];
}

interface EvidenceAssessment {
  evidence_id: string;
  scf_control_id: string;
  overall_result: "pass" | "fail" | "partial" | "not_applicable";
  overall_confidence: number;
  objective_results: AssessmentResult[];
  summary: string;
  recommendations: string[];
}

/**
 * Extract text content from uploaded evidence files
 */
export async function extractEvidenceContent(
  filePath: string,
  fileType: string,
  supabase: SupabaseServerClient
): Promise<string> {
  try {
    // Download file from Supabase storage
    const { data: fileData, error } = await supabase.storage
      .from("compliance-documents")
      .download(filePath);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    // Convert file to text based on type
    let textContent = "";

    if (fileType === "text/plain" || fileType === "text/csv") {
      textContent = await fileData.text();
    } else if (fileType === "application/pdf") {
      // For PDF files, we'd use a PDF parsing library
      // For now, we'll return a placeholder
      textContent = "[PDF content extraction not yet implemented]";
    } else if (fileType.includes("image/")) {
      // For images, we could use OCR or image analysis
      textContent = "[Image analysis not yet implemented]";
    } else {
      // For Word/Excel files, we'd use appropriate parsers
      textContent = "[Document parsing not yet implemented]";
    }

    return textContent;
  } catch (error) {
    console.error("Error extracting evidence content:", error);
    throw new Error("Failed to extract evidence content");
  }
}

/**
 * Assess evidence content against SCF assessment objectives
 */
export async function assessEvidenceAgainstObjectives(
  evidenceContent: string,
  objectives: AssessmentObjective[],
  controlTitle: string,
  controlDescription: string
): Promise<EvidenceAssessment["objective_results"]> {
  const systemPrompt = `You are a compliance assessment expert specializing in the Secure Controls Framework (SCF). Your task is to evaluate evidence documents against specific SCF assessment objectives.

For each assessment objective provided, you must:
1. Determine if the evidence demonstrates compliance (pass/fail/partial/not_applicable)
2. Provide a confidence score (0.0-1.0) for your assessment
3. Explain your reasoning clearly and objectively
4. Identify specific gaps or missing elements for failed/partial assessments
5. Provide actionable recommendations for improvement

Assessment Criteria:
- PASS: Evidence clearly and completely demonstrates the objective is met
- PARTIAL: Evidence shows some implementation but lacks completeness or clarity
- FAIL: Evidence does not demonstrate the objective is met or shows non-compliance
- NOT_APPLICABLE: The objective does not apply to this evidence or context

Be thorough, objective, and provide specific references to the evidence content when possible.`;

  const userPrompt = `Please assess the following evidence document against the SCF assessment objectives:

**Control Information:**
- Control: ${controlTitle}
- Description: ${controlDescription}

**Evidence Content:**
${evidenceContent}

**Assessment Objectives:**
${objectives
  .map(
    (obj, index) => `
${index + 1}. Objective ID: ${obj.scf_ao_id}
   Objective: ${obj.assessment_objective}
   ${obj.assessment_procedure ? `Procedure: ${obj.assessment_procedure}` : ""}
   ${obj.expected_results ? `Expected Results: ${obj.expected_results}` : ""}
`
  )
  .join("\n")}

Please provide a detailed assessment for each objective in the following JSON format:
{
  "assessments": [
    {
      "objective_id": "uuid",
      "result": "pass|fail|partial|not_applicable",
      "confidence": 0.85,
      "reasoning": "Detailed explanation of your assessment...",
      "gaps": ["Specific gap 1", "Specific gap 2"],
      "recommendations": ["Recommendation 1", "Recommendation 2"]
    }
  ]
}`;

  try {
    const { object } = await generateObject({
      model: getModel(
        COMPLIANCE_AI_CONFIG.controlMapping.provider,
        COMPLIANCE_AI_CONFIG.controlMapping.model
      ),
      schema: z.object({
        assessments: z.array(
          z.object({
            objective_id: z.string(),
            result: z.enum(["pass", "fail", "partial", "not_applicable"]),
            confidence: z.number().min(0).max(1),
            reasoning: z.string(),
            gaps: z.array(z.string()).optional(),
            recommendations: z.array(z.string()).optional(),
          })
        ),
      }),
      system: systemPrompt,
      prompt: userPrompt,
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

    // Map the AI results to our format
    return object.assessments.map((assessment) => ({
      objective_id: assessment.objective_id,
      result: assessment.result,
      confidence: Math.max(0, Math.min(1, assessment.confidence)), // Clamp to 0-1
      reasoning: assessment.reasoning || "No reasoning provided",
      gaps: assessment.gaps || [],
      recommendations: assessment.recommendations || [],
    }));
  } catch (error) {
    console.error("Error in AI assessment:", error);
    throw new Error("Failed to complete AI assessment");
  }
}

/**
 * Generate overall assessment summary and recommendations
 */
export async function generateAssessmentSummary(
  objectiveResults: AssessmentResult[],
  controlTitle: string,
  evidenceContent: string
): Promise<{ summary: string; recommendations: string[] }> {
  void evidenceContent;
  const passCount = objectiveResults.filter((r) => r.result === "pass").length;
  const totalCount = objectiveResults.filter((r) => r.result !== "not_applicable").length;
  const avgConfidence =
    objectiveResults.reduce((sum, r) => sum + r.confidence, 0) / objectiveResults.length;

  const systemPrompt = `You are a compliance expert. Generate a concise summary and actionable recommendations based on assessment results.`;

  const userPrompt = `Control: ${controlTitle}
Assessment Results: ${passCount}/${totalCount} objectives passed (${Math.round(
    avgConfidence * 100
  )}% avg confidence)

Detailed Results:
${objectiveResults.map((r) => `- ${r.result.toUpperCase()}: ${r.reasoning}`).join("\n")}

Generate:
1. A 2-3 sentence summary of the overall compliance status
2. 3-5 prioritized recommendations for improvement

Respond in JSON format:
{
  "summary": "Brief summary...",
  "recommendations": ["Recommendation 1", "Recommendation 2", ...]
}`;

  try {
    const { object } = await generateObject({
      model: getModel(
        COMPLIANCE_AI_CONFIG.recommendations.provider,
        COMPLIANCE_AI_CONFIG.recommendations.model
      ),
      schema: z.object({
        summary: z.string(),
        recommendations: z.array(z.string()),
      }),
      system: systemPrompt,
      prompt: userPrompt,
      ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.recommendations.provider, {
        reasoningEffort: "low",
        textVerbosity: "medium",
      }),
      ...getTemperatureSettings(
        COMPLIANCE_AI_CONFIG.recommendations.provider,
        COMPLIANCE_AI_CONFIG.recommendations.model,
        COMPLIANCE_AI_CONFIG.recommendations.temperature
      ),
    });

    return {
      summary: object.summary || "Assessment completed",
      recommendations: object.recommendations || [],
    };
  } catch (error) {
    console.error("Error generating summary:", error);
    return {
      summary: `Assessment completed with ${passCount}/${totalCount} objectives passed`,
      recommendations: ["Review failed objectives and address identified gaps"],
    };
  }
}

/**
 * Main function to assess evidence against SCF control
 */
export async function assessEvidence(
  evidenceId: string,
  scfControlId: string,
  filePath: string,
  fileType: string
): Promise<EvidenceAssessment> {
  const supabase = await createClient();

  try {
    // 1. Extract evidence content
    log.info("Extracting evidence content");
    const evidenceContent = await extractEvidenceContent(filePath, fileType, supabase);

    // 2. Get SCF control details
    log.info("Fetching SCF control details");
    const { data: controlData, error: controlError } = await supabase
      .from("scf_controls")
      .select("id, title, description")
      .eq("id", scfControlId)
      .single();

    if (controlError || !controlData) {
      throw new Error(`Failed to fetch control details: ${controlError?.message}`);
    }

    // 3. Get assessment objectives for this control
    log.info("Fetching assessment objectives");
    const { data: objectives, error: objectivesError } = await supabase
      .from("scf_assessment_objectives")
      .select("id, scf_ao_id, assessment_objective, assessment_procedure, expected_results")
      .eq("scf_control_id", scfControlId);

    if (objectivesError) {
      throw new Error(`Failed to fetch objectives: ${objectivesError.message}`);
    }

    if (!objectives || objectives.length === 0) {
      throw new Error(`No assessment objectives found for control ${scfControlId}`);
    }

    // 4. Assess evidence against objectives
    log.info("Running AI assessment");
    const objectiveResults = await assessEvidenceAgainstObjectives(
      evidenceContent,
      objectives,
      controlData.title,
      controlData.description
    );

    // 5. Generate overall summary and recommendations
    log.info("Generating summary");
    const { summary, recommendations } = await generateAssessmentSummary(
      objectiveResults,
      controlData.title,
      evidenceContent
    );

    // 6. Determine overall result
    const passCount = objectiveResults.filter((r) => r.result === "pass").length;
    const failCount = objectiveResults.filter((r) => r.result === "fail").length;
    const partialCount = objectiveResults.filter((r) => r.result === "partial").length;
    const applicableCount = objectiveResults.filter((r) => r.result !== "not_applicable").length;

    let overallResult: "pass" | "fail" | "partial" | "not_applicable";
    if (applicableCount === 0) {
      overallResult = "not_applicable";
    } else if (passCount === applicableCount) {
      overallResult = "pass";
    } else if (failCount > 0 || partialCount > 0) {
      overallResult = partialCount > failCount ? "partial" : "fail";
    } else {
      overallResult = "partial";
    }

    const overallConfidence =
      objectiveResults.reduce((sum, r) => sum + r.confidence, 0) / objectiveResults.length;

    return {
      evidence_id: evidenceId,
      scf_control_id: scfControlId,
      overall_result: overallResult,
      overall_confidence: overallConfidence,
      objective_results: objectiveResults,
      summary,
      recommendations,
    };
  } catch (error) {
    console.error("Error in evidence assessment:", error);
    throw error;
  }
}

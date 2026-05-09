import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { assessMaturityLevel } from "@/lib/ai/assess-evidence/maturity-assessment";
import { assessAgainstObjectives } from "@/lib/ai/assess-evidence/objective-assessment";
import type {
  AssessmentLogContext,
  AssessmentObjective,
  MaturityAssessmentResult,
  MaturityLevels,
} from "@/lib/ai/assess-evidence/types";
import { validateObjectiveAssessmentQuality } from "@/lib/ai/assessment-quality";
import { consumeDemoQuota } from "@/lib/demo/demo-quota";
import { getDemoSampleById } from "@/lib/demo/demo-registry";
import { createLogger } from "@/lib/logger";
import { getClientIpAddress } from "@/lib/security/rate-limit";

const log = createLogger("api/try-it-out/demo");

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIpAddress(request.headers);
    if (clientIp) {
      const quota = await consumeDemoQuota(clientIp);
      if (!quota.ok) {
        const headers = new Headers();
        headers.set("Retry-After", String(quota.retryAfterSeconds));
        headers.set("X-RateLimit-Limit", String(quota.max));
        headers.set("X-RateLimit-Remaining", String(quota.remaining));
        return NextResponse.json(
          {
            error: "Demo rate limit reached. Sign up for unlimited access, or try again later.",
            retryAfterSeconds: quota.retryAfterSeconds,
          },
          { status: 429, headers }
        );
      }
    }

    const { sampleId } = await request.json();
    if (!sampleId || typeof sampleId !== "string") {
      return NextResponse.json({ error: "sampleId is required" }, { status: 400 });
    }

    const sample = getDemoSampleById(sampleId);
    if (!sample) {
      return NextResponse.json({ error: "Unknown demo sample" }, { status: 400 });
    }

    log.info("Demo assessment started", {
      sampleId,
      controlId: sample.scfControlId,
    });

    // Read sample file from disk
    const samplePath = join(process.cwd(), "public", "samples", sample.sampleFileName);
    const fileContent = await readFile(samplePath, "utf-8");

    // Query SCF data (read-only) via service client
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const [controlResult, maturityResult, objectivesResult] = await Promise.all([
      serviceSupabase
        .from("scf_controls")
        .select(
          `id, title, description, guidance_micro, guidance_small, guidance_medium,
					domain_id, scf_domains!domain_id (id, name)`
        )
        .eq("id", sample.scfControlId)
        .single(),
      serviceSupabase
        .from("scf_maturity_levels")
        .select(
          "level_0_description, level_1_description, level_2_description, level_3_description, level_4_description, level_5_description"
        )
        .eq("scf_control_id", sample.scfControlId)
        .limit(1),
      serviceSupabase
        .from("scf_assessment_objectives")
        .select("id, scf_ao_id, assessment_objective, assessment_procedure, expected_results")
        .eq("scf_control_id", sample.scfControlId),
    ]);

    const { data: controlData, error: controlError } = controlResult;
    if (controlError || !controlData) {
      log.error("Control not found", { controlId: sample.scfControlId });
      return NextResponse.json({ error: "Control data not available" }, { status: 500 });
    }

    const maturityLevels: MaturityLevels | null =
      maturityResult.data && maturityResult.data.length > 0 ? maturityResult.data[0] : null;

    const objectives: AssessmentObjective[] = objectivesResult.data ?? [];

    const demoEvidenceId = `demo-${randomUUID()}`;
    const evidenceContentHash = createHash("sha256").update(fileContent).digest("hex");

    const logContext: AssessmentLogContext = {
      requestId: `demo-${randomUUID()}`,
      sessionId: null,
      evidenceId: demoEvidenceId,
      scfControlId: sample.scfControlId,
      evidenceContentHash,
    };

    let assessmentResult;

    if (objectives.length > 0) {
      // Full objective-based assessment (no DB writes)
      const objectiveResults = await assessAgainstObjectives(
        fileContent,
        null,
        objectives,
        controlData.title,
        controlData.description,
        { ...logContext, objectiveIds: objectives.map((o) => o.id) }
      );

      const qualityCheck = validateObjectiveAssessmentQuality(objectiveResults, objectives.length);
      if (!qualityCheck.isValid) {
        log.error("Quality gate failed", { reason: qualityCheck.reason });
        return NextResponse.json(
          { error: "Assessment quality check failed. Please try again." },
          { status: 500 }
        );
      }

      const maturityAssessment: MaturityAssessmentResult | null = maturityLevels
        ? await assessMaturityLevel(
            fileContent,
            null,
            sample.scfControlId,
            controlData.title,
            controlData.description,
            maturityLevels,
            null,
            logContext
          )
        : null;

      const passCount = objectiveResults.filter((r) => r.result === "pass").length;
      const totalCount = objectiveResults.filter((r) => r.result !== "not_applicable").length;
      const avgConfidence =
        objectiveResults.reduce((sum, r) => sum + r.confidence, 0) / objectiveResults.length;

      let overallResult: "pass" | "fail" | "partial" | "not_applicable";
      if (totalCount === 0) {
        overallResult = "not_applicable";
      } else if (passCount === totalCount) {
        overallResult = "pass";
      } else if (passCount > 0) {
        overallResult = "partial";
      } else {
        overallResult = "fail";
      }

      const enhancedObjectiveResults = objectiveResults.map((result) => {
        const objectiveData = objectives.find((obj) => obj.id === result.objective_id);
        return {
          scf_ao_id: objectiveData?.scf_ao_id,
          assessment_objective: objectiveData?.assessment_objective,
          assessment_procedure: objectiveData?.assessment_procedure,
          expected_results: objectiveData?.expected_results,
          result: result.result,
          confidence: result.confidence,
          reasoning: result.reasoning,
        };
      });

      assessmentResult = {
        id: demoEvidenceId,
        scf_control_id: sample.scfControlId,
        control_title: controlData.title,
        control_description: controlData.description,
        control_guidance:
          controlData.guidance_micro || controlData.guidance_small || controlData.guidance_medium,
        domain_name: Array.isArray(controlData.scf_domains)
          ? controlData.scf_domains[0]?.name
          : undefined,
        overall_result: overallResult,
        overall_confidence: avgConfidence,
        summary: `Assessment completed: ${passCount}/${totalCount} objectives passed with ${Math.round(avgConfidence * 100)}% average confidence`,
        objective_results: enhancedObjectiveResults,
        maturity_assessment: maturityAssessment,
        maturity_levels: maturityLevels,
      };
    } else {
      // Basic assessment (no objectives found) — run AI directly, skip DB
      const { generateObjectWithRetry, getAssessmentModel, buildEvidenceText } = await import(
        "@/lib/ai/assess-evidence/utils"
      );
      const { COMPLIANCE_AI_CONFIG, getOpenAIProviderOptions, getTemperatureSettings } =
        await import("@/lib/ai-config");
      const { z } = await import("zod");

      const evidenceText = buildEvidenceText(fileContent, null);
      const systemPrompt =
        "You are a compliance assessment expert. Assess evidence against SCF controls and return structured results.";
      const userPrompt = `Assess this evidence against the SCF control:\n\nControl: ${controlData.title}\nDescription: ${controlData.description}\n${evidenceText}\n\nDetermine:\n- result: "pass", "partial", "fail", or "not_applicable"\n- confidence: number between 0.0 and 1.0\n- reasoning: brief explanation of your assessment`;

      const generateObjectParams: Record<string, unknown> = {
        model: getAssessmentModel(),
        schema: z.object({
          result: z.enum(["pass", "partial", "fail", "not_applicable"]),
          confidence: z.number().min(0).max(1),
          reasoning: z.string(),
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
          0.2
        ),
      };

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

      const maturityAssessment: MaturityAssessmentResult | null = maturityLevels
        ? await assessMaturityLevel(
            fileContent,
            null,
            sample.scfControlId,
            controlData.title,
            controlData.description,
            maturityLevels,
            null,
            logContext
          )
        : null;

      assessmentResult = {
        id: demoEvidenceId,
        scf_control_id: sample.scfControlId,
        control_title: controlData.title,
        control_description: controlData.description,
        control_guidance:
          controlData.guidance_micro || controlData.guidance_small || controlData.guidance_medium,
        domain_name: Array.isArray(controlData.scf_domains)
          ? controlData.scf_domains[0]?.name
          : undefined,
        overall_result: result.result,
        overall_confidence: result.confidence,
        summary: result.reasoning,
        maturity_assessment: maturityAssessment,
        maturity_levels: maturityLevels,
      };
    }

    log.info("Demo assessment completed", {
      sampleId,
      controlId: sample.scfControlId,
      result: assessmentResult.overall_result,
    });

    return NextResponse.json({
      success: true,
      sample: {
        id: sample.id,
        label: sample.label,
        // `artifactName` is kept as an alias of `label` for one release.
        // New callers should use `label`; existing callers continue to work.
        artifactName: sample.label,
        scfControlId: sample.scfControlId,
      },
      assessment: assessmentResult,
    });
  } catch (error) {
    log.error("Demo assessment failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Demo assessment failed",
      },
      { status: 500 }
    );
  }
}

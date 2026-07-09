import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import { validateObjectiveAssessmentQuality } from "@/lib/ai/assessment-quality";
import { COMPLIANCE_AI_CONFIG } from "@/lib/ai-config";
import { createLogger } from "@/lib/logger";
import { createBasicAssessment } from "./basic-assessment";
import { assessmentContractMetadata, assessmentTruncationKillSwitchEnabled } from "./contract";
import { assessMaturityLevel } from "./maturity-assessment";
import { assessAgainstObjectives } from "./objective-assessment";
import type {
  AssessmentLogContext,
  AssessmentObjective,
  ImagePayload,
  MaturityAssessmentResult,
  MaturityLevels,
  ServiceSupabaseClient,
  UserSupabaseClient,
} from "./types";
import { CONTROL_REUSE_LOOKBACK_LIMIT, confidenceLevelToScore, createControlRunKey } from "./utils";

const log = createLogger("assess-evidence/control");

export async function runControlAssessment(
  evidenceId: string,
  scfControlId: string,
  fileContent: string,
  imageData: ImagePayload,
  supabase: UserSupabaseClient,
  serviceSupabase: ServiceSupabaseClient,
  userId: string,
  logContext: AssessmentLogContext
) {
  try {
    const controlRunKey = createControlRunKey(
      evidenceId,
      scfControlId,
      logContext.evidenceContentHash
    );

    // Fetch control details, maturity levels, and objectives in parallel
    const [controlResult, maturityResult, objectivesResult] = await Promise.all([
      supabase
        .from("scf_controls")
        .select(
          `
          id,
          title,
          description,
          guidance_micro,
          guidance_small,
          guidance_medium,
          target_maturity_level,
          domain_id,
          scf_domains!domain_id (
            id,
            name
          )
        `
        )
        .eq("id", scfControlId)
        .single(),
      supabase
        .from("scf_maturity_levels")
        .select(
          `
          level_0_description,
          level_1_description,
          level_2_description,
          level_3_description,
          level_4_description,
          level_5_description
        `
        )
        .eq("scf_control_id", scfControlId)
        .limit(1),
      supabase
        .from("scf_assessment_objectives")
        .select("id, scf_ao_id, assessment_objective, assessment_procedure, expected_results")
        .eq("scf_control_id", scfControlId),
    ]);

    const { data: controlData, error: controlError } = controlResult;
    if (controlError || !controlData) {
      log.error("control_assessment.control_query_failed", {
        detail: controlError instanceof Error ? controlError.message : String(controlError),
      });
      throw new Error(
        `Control ${scfControlId} not found: ${controlError?.message || "Unknown error"}`
      );
    }

    const { data: maturityRows, error: maturityError } = maturityResult;
    if (maturityError) {
      log.warn("control_assessment.maturity_fetch_failed", {
        detail: maturityError instanceof Error ? maturityError.message : String(maturityError),
      });
    }

    const maturityLevels: MaturityLevels | null =
      maturityRows && maturityRows.length > 0 ? maturityRows[0] : null;

    const { data: objectives, error: objectivesError } = objectivesResult;
    if (objectivesError) {
      throw new Error(`Failed to fetch objectives for ${scfControlId}`);
    }

    // Check for reusable summary assessment
    const { data: summaryCandidates, error: summaryCandidateError } = await serviceSupabase
      .from("assessments")
      .select(
        "id, scf_control_id, assessment_result, confidence_level, assessment_summary, metadata"
      )
      .eq("user_id", userId)
      .eq("evidence_id", evidenceId)
      .eq("scf_control_id", scfControlId)
      .is("scf_ao_id", null)
      .eq("assessment_method", "ai_assisted")
      .order("created_at", { ascending: false })
      .limit(CONTROL_REUSE_LOOKBACK_LIMIT);

    if (summaryCandidateError) {
      log.warn("control_assessment.summary_candidate_query_failed", {
        detail:
          summaryCandidateError instanceof Error
            ? summaryCandidateError.message
            : String(summaryCandidateError),
      });
    }

    const existingSummary = (summaryCandidates ?? []).find((candidate) => {
      const metadata =
        candidate.metadata && typeof candidate.metadata === "object"
          ? (candidate.metadata as Record<string, unknown>)
          : null;

      return (
        metadata?.assessment_run_key === controlRunKey &&
        (metadata.is_summary === true || metadata.basic_assessment === true)
      );
    });

    if (existingSummary) {
      const metadata =
        existingSummary.metadata && typeof existingSummary.metadata === "object"
          ? (existingSummary.metadata as Record<string, unknown>)
          : null;
      const existingObjectiveResults =
        metadata?.objective_results && Array.isArray(metadata.objective_results)
          ? metadata.objective_results
          : [];
      const existingMaturityAssessment =
        metadata?.maturity_assessment && typeof metadata.maturity_assessment === "object"
          ? (metadata.maturity_assessment as MaturityAssessmentResult)
          : null;

      await appendAIAssessmentLog({
        requestId: logContext.requestId,
        sessionId: logContext.sessionId,
        scope: "control_assessment",
        status: "success",
        evidenceId,
        evidenceContentHash: logContext.evidenceContentHash,
        scfControlId,
        objectiveIds: objectives?.map((objective: AssessmentObjective) => objective.id),
        modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
        modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
        metadata: {
          controlTitle: controlData.title,
          objectiveCount: objectives?.length ?? 0,
          reusedExistingAssessment: true,
          controlRunKey,
          overallResult: existingSummary.assessment_result,
          overallConfidence: confidenceLevelToScore(existingSummary.confidence_level),
          maturityAssessment: existingMaturityAssessment,
        },
      });

      return {
        id: existingSummary.id,
        scf_control_id: existingSummary.scf_control_id,
        control_title: controlData.title,
        control_description: controlData.description,
        control_guidance:
          controlData.guidance_micro || controlData.guidance_small || controlData.guidance_medium,
        domain_name: Array.isArray(controlData.scf_domains)
          ? controlData.scf_domains[0]?.name
          : undefined,
        overall_result: existingSummary.assessment_result,
        overall_confidence: confidenceLevelToScore(existingSummary.confidence_level),
        summary: existingSummary.assessment_summary || "Assessment already completed",
        objective_results: existingObjectiveResults,
        maturity_assessment: existingMaturityAssessment,
        maturity_levels: maturityLevels,
        reused: true,
      };
    }

    // If no objectives, create a basic assessment
    if (!objectives || objectives.length === 0) {
      log.warn("No objectives found, creating basic assessment", {
        scfControlId,
      });

      const basicAssessment = await createBasicAssessment(
        fileContent,
        imageData,
        controlData,
        serviceSupabase,
        userId,
        evidenceId,
        maturityLevels,
        controlRunKey,
        logContext
      );

      if (basicAssessment) {
        await appendAIAssessmentLog({
          requestId: logContext.requestId,
          sessionId: logContext.sessionId,
          scope: "control_assessment",
          status: "success",
          evidenceId,
          evidenceContentHash: logContext.evidenceContentHash,
          scfControlId,
          objectiveIds: [],
          modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
          modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
          metadata: {
            controlTitle: controlData.title,
            objectiveCount: 0,
            controlRunKey,
            overallResult: basicAssessment.overall_result,
            overallConfidence: basicAssessment.overall_confidence,
            summary: basicAssessment.summary,
            maturityAssessment: basicAssessment.maturity_assessment ?? null,
          },
        });
      }

      return basicAssessment;
    }

    const legacyMode = assessmentTruncationKillSwitchEnabled();
    const objectiveAssessmentPromise = assessAgainstObjectives(
      fileContent,
      imageData,
      objectives,
      controlData.title,
      controlData.description,
      {
        ...logContext,
        objectiveIds: objectives.map((objective: AssessmentObjective) => objective.id),
      }
    );
    const maturityAssessmentPromise: Promise<MaturityAssessmentResult | null> = maturityLevels
      ? assessMaturityLevel(
          fileContent,
          imageData,
          scfControlId,
          controlData.title,
          controlData.description,
          maturityLevels,
          typeof controlData.target_maturity_level === "number"
            ? controlData.target_maturity_level
            : null,
          logContext
        )
      : Promise.resolve(null);

    const [objectiveResults, maturityAssessment] = await Promise.all([
      objectiveAssessmentPromise,
      maturityAssessmentPromise,
    ]);

    if (!legacyMode) {
      const qualityCheck = validateObjectiveAssessmentQuality(objectiveResults, objectives.length);
      if (!qualityCheck.isValid) {
        throw new Error(`Quality gate failed for control ${scfControlId}: ${qualityCheck.reason}`);
      }
    }

    // Calculate overall result
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

    const { data: existingObjectiveCandidates, error: existingObjectiveError } =
      await serviceSupabase
        .from("assessments")
        .select("id, scf_ao_id, metadata")
        .eq("user_id", userId)
        .eq("evidence_id", evidenceId)
        .eq("scf_control_id", scfControlId)
        .eq("assessment_method", "ai_assisted")
        .not("scf_ao_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(Math.max(25, objectives.length * 3));

    if (existingObjectiveError) {
      log.warn("control_assessment.objective_candidate_query_failed", {
        detail:
          existingObjectiveError instanceof Error
            ? existingObjectiveError.message
            : String(existingObjectiveError),
      });
    }

    const existingObjectiveByAoId = new Map<string, { id: string; scf_ao_id: string | null }>();

    for (const candidate of existingObjectiveCandidates ?? []) {
      const metadata =
        candidate.metadata && typeof candidate.metadata === "object"
          ? (candidate.metadata as Record<string, unknown>)
          : null;
      if (metadata?.assessment_run_key !== controlRunKey) continue;
      if (!candidate.scf_ao_id) continue;
      if (!existingObjectiveByAoId.has(candidate.scf_ao_id)) {
        existingObjectiveByAoId.set(candidate.scf_ao_id, candidate);
      }
    }

    // Create individual assessment records for each objective
    const createdAssessments: Array<{ id: string }> = [];
    for (const result of objectiveResults) {
      const objective = objectives.find(
        (obj: AssessmentObjective) => obj.id === result.objective_id
      );
      if (!objective) continue;

      const existingObjective = existingObjectiveByAoId.get(objective.scf_ao_id);
      if (existingObjective?.id) {
        createdAssessments.push({ id: existingObjective.id });
        continue;
      }

      const { data: assessmentData, error: assessmentError } = await serviceSupabase
        .from("assessments")
        .insert({
          user_id: userId,
          scf_control_id: scfControlId,
          scf_ao_id: objective.scf_ao_id,
          assessment_type: "manual",
          assessment_method: "ai_assisted",
          assessment_status: "completed",
          assessment_result: result.result,
          confidence_level:
            result.confidence >= 0.8 ? "high" : result.confidence >= 0.5 ? "medium" : "low",
          assessment_notes: result.reasoning,
          evidence_id: evidenceId,
          ai_reasoning: result.reasoning,
          metadata: {
            ...assessmentContractMetadata(),
            ai_generated: true,
            manual_assessment: true,
            assessment_run_key: controlRunKey,
            assessment_request_id: logContext.requestId,
            objective_id: result.objective_id,
            assessment_objective: objective.assessment_objective,
            assessment_procedure: objective.assessment_procedure,
            expected_results: objective.expected_results,
            evidence_quotes: result.evidence_quotes,
            rejected_evidence_quotes: result.rejected_evidence_quotes,
            overall_summary: `Assessment: ${passCount}/${totalCount} objectives passed`,
            assessment_timestamp: new Date().toISOString(),
          },
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (assessmentError) {
        log.error("control_assessment.objective_insert_failed", {
          detail:
            assessmentError instanceof Error ? assessmentError.message : String(assessmentError),
        });
        continue;
      }

      if (assessmentData?.id) {
        createdAssessments.push({ id: assessmentData.id });
      }
    }

    // Prepare enhanced objective results with AO details
    const enhancedObjectiveResults = objectiveResults.map((result) => {
      const objectiveData = objectives.find(
        (obj: AssessmentObjective) => obj.id === result.objective_id
      );
      return {
        scf_ao_id: objectiveData?.scf_ao_id,
        assessment_objective: objectiveData?.assessment_objective,
        assessment_procedure: objectiveData?.assessment_procedure,
        expected_results: objectiveData?.expected_results,
        result: result.result,
        confidence: result.confidence,
        reasoning: result.reasoning,
        evidence_quotes: result.evidence_quotes,
      };
    });

    // Create or reuse summary assessment
    let summaryAssessmentData: { id: string } | null = null;
    const existingSummaryForRun = (summaryCandidates ?? []).find((candidate) => {
      const metadata =
        candidate.metadata && typeof candidate.metadata === "object"
          ? (candidate.metadata as Record<string, unknown>)
          : null;
      return metadata?.assessment_run_key === controlRunKey && metadata.is_summary === true;
    });

    if (existingSummaryForRun?.id) {
      summaryAssessmentData = { id: existingSummaryForRun.id };
    } else {
      const { data: createdSummaryData, error: summaryError } = await serviceSupabase
        .from("assessments")
        .insert({
          user_id: userId,
          scf_control_id: scfControlId,
          assessment_type: "manual",
          assessment_method: "ai_assisted",
          assessment_status: "completed",
          assessment_result: overallResult,
          confidence_level: avgConfidence >= 0.8 ? "high" : avgConfidence >= 0.5 ? "medium" : "low",
          assessment_notes: `Manual assessment: ${passCount}/${totalCount} objectives passed`,
          assessment_summary: `Assessment completed: ${passCount}/${totalCount} objectives passed`,
          evidence_id: evidenceId,
          ai_reasoning: `Overall assessment based on ${objectives.length} objectives`,
          metadata: {
            ...assessmentContractMetadata(),
            ai_generated: true,
            manual_assessment: true,
            assessment_run_key: controlRunKey,
            assessment_request_id: logContext.requestId,
            is_summary: true,
            objective_results: enhancedObjectiveResults,
            objective_count: objectives.length,
            passed_count: passCount,
            maturity_assessment: maturityAssessment,
            maturity_benchmark_snapshot: maturityLevels,
            assessment_timestamp: new Date().toISOString(),
          },
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (summaryError) {
        log.error("control_assessment.summary_insert_failed", {
          detail: summaryError instanceof Error ? summaryError.message : String(summaryError),
        });
      } else if (createdSummaryData?.id) {
        summaryAssessmentData = { id: createdSummaryData.id };
      }
    }

    await appendAIAssessmentLog({
      requestId: logContext.requestId,
      sessionId: logContext.sessionId,
      scope: "control_assessment",
      status: "success",
      evidenceId,
      evidenceContentHash: logContext.evidenceContentHash,
      scfControlId,
      objectiveIds: objectives.map((objective: AssessmentObjective) => objective.id),
      modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
      modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
      metadata: {
        ...assessmentContractMetadata(),
        controlTitle: controlData.title,
        objectiveCount: objectives.length,
        controlRunKey,
        objectiveDecisions: objectiveResults.map((result) => ({
          objectiveId: result.objective_id,
          result: result.result,
          confidence: result.confidence,
          reasoning: result.reasoning,
        })),
        overallResult,
        overallConfidence: avgConfidence,
        maturityAssessment,
      },
    });

    return {
      id: summaryAssessmentData?.id || createdAssessments[0]?.id,
      scf_control_id: scfControlId,
      control_title: controlData.title,
      control_description: controlData.description,
      control_guidance:
        controlData.guidance_micro || controlData.guidance_small || controlData.guidance_medium,
      domain_name: Array.isArray(controlData.scf_domains)
        ? controlData.scf_domains[0]?.name
        : undefined,
      overall_result: overallResult,
      overall_confidence: avgConfidence,
      summary: `Assessment completed: ${passCount}/${totalCount} objectives passed with ${Math.round(
        avgConfidence * 100
      )}% average confidence`,
      objective_results: enhancedObjectiveResults,
      maturity_assessment: maturityAssessment,
      maturity_levels: maturityLevels,
      individual_assessments: createdAssessments.length,
      summary_assessment_id: summaryAssessmentData?.id,
    };
  } catch (error) {
    log.error("control_assessment.failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    await appendAIAssessmentLog({
      requestId: logContext.requestId,
      sessionId: logContext.sessionId,
      scope: "control_assessment",
      status: "error",
      evidenceId,
      evidenceContentHash: logContext.evidenceContentHash,
      scfControlId,
      modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
      modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
      error: error instanceof Error ? error.message : "Unknown control assessment error",
    });
    throw error;
  }
}

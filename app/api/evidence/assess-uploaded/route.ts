import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { runControlAssessment } from "@/lib/ai/assess-evidence/control-assessment";
import { confidenceLevelToScore, withTimeout } from "@/lib/ai/assess-evidence/utils";

const CONTROL_ASSESSMENT_TIMEOUT_MS = 90_000;

import { appendAIAssessmentLog } from "@/lib/ai/assessment-logging";
import { COMPLIANCE_AI_CONFIG } from "@/lib/ai-config";
import { apiError } from "@/lib/api/error-response";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { invalidateInboxCache } from "@/lib/compliance/inbox-generator";
import { enqueuePostureRecalc } from "@/lib/compliance/posture-scorer";
import { createLogger } from "@/lib/logger";
import { createRequestLogger, getOrCreateRequestId } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { progressTracker } from "@/lib/websocket/progress-tracker";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/evidence/assess-uploaded");
const ASSESS_RATE_LIMIT = {
  namespace: "evidence_assess_uploaded",
  user: { windowMs: 60_000, maxRequests: 5 },
  ip: { windowMs: 60_000, maxRequests: 20 },
  message: "Rate limit exceeded for assessment. Please retry shortly.",
} as const;

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createRequestLogger(requestId);
  logger.info("assess_uploaded.started");

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      logger.warn("assess_uploaded.unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = checkRouteRateLimit(ASSESS_RATE_LIMIT, user.id, request.headers);
    if (rateLimitResponse) return rateLimitResponse;

    const sessionId = request.headers.get("x-progress-session");
    const { evidenceIds, fileContent, imageData } = await request.json();

    if (!evidenceIds || !Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      return NextResponse.json({ error: "Evidence IDs required" }, { status: 400 });
    }

    if (!fileContent) {
      return NextResponse.json({ error: "File content required for assessment" }, { status: 400 });
    }

    log.info("Starting assessment", { evidenceCount: evidenceIds.length });

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get evidence records to assess
    const { data: evidenceRecords, error: evidenceError } = await supabase
      .from("evidence")
      .select("*")
      .in("id", evidenceIds)
      .eq("user_id", user.id);

    if (evidenceError || !evidenceRecords?.length) {
      return NextResponse.json({ error: "Evidence records not found" }, { status: 404 });
    }

    const assessmentResults = [];
    const failedControls: Array<{ control_id: string; error: string }> = [];
    const uniqueControlIds = [...new Set(evidenceRecords.map((e) => e.scf_control_id))];
    const evidenceContentHash = createHash("sha256").update(fileContent).digest("hex");
    const totalControls = uniqueControlIds.length;
    let completedControls = 0;
    const assessmentStartedAtMs = Date.now();

    const getAssessmentProgressValue = () =>
      Math.min(95, 65 + Math.round((completedControls / Math.max(totalControls, 1)) * 30));

    const buildTimingMetadata = () => {
      if (completedControls <= 0) {
        return { averageControlDurationMs: null, estimatedRemainingMs: null };
      }

      const averageControlDurationMs = Math.max(
        1,
        Math.round((Date.now() - assessmentStartedAtMs) / completedControls)
      );
      const estimatedRemainingMs = Math.max(
        0,
        (totalControls - completedControls) * averageControlDurationMs
      );

      return { averageControlDurationMs, estimatedRemainingMs };
    };

    const emitAssessmentProgress = (
      stage: string,
      message: string,
      metadata: Record<string, unknown> = {}
    ) => {
      if (!sessionId) return;
      progressTracker.updateProgress(sessionId, stage, getAssessmentProgressValue(), message, {
        totalControls,
        completedControls,
        ...buildTimingMetadata(),
        ...metadata,
      });
    };

    if (sessionId) {
      progressTracker.updateProgress(
        sessionId,
        "assessment-started",
        65,
        "Preparing AI assessment",
        {
          controlCount: uniqueControlIds.length,
          totalControls,
          completedControls,
          phase: "assessment-started",
          ...buildTimingMetadata(),
        }
      );
    }

    for (const [index, controlId] of uniqueControlIds.entries()) {
      const controlNumber = index + 1;
      const controlEvidenceRecords = evidenceRecords.filter((e) => e.scf_control_id === controlId);
      const primaryEvidence = controlEvidenceRecords[0];

      emitAssessmentProgress(
        "assessing-control",
        `Assessing ${controlId}... (${controlNumber}/${totalControls})`,
        {
          phase: "control-started",
          currentControlId: controlId,
          currentControlNumber: controlNumber,
        }
      );

      // Check for pre-completed assessment on evidence metadata
      if (
        primaryEvidence?.metadata?.assessment_completed &&
        primaryEvidence?.metadata?.assessment_id
      ) {
        const { data: existingAssessment } = await supabase
          .from("assessments")
          .select(
            "id, scf_control_id, assessment_result, confidence_level, assessment_summary, metadata"
          )
          .eq("id", primaryEvidence.metadata.assessment_id)
          .maybeSingle();

        if (existingAssessment) {
          const reusedConfidence = confidenceLevelToScore(existingAssessment.confidence_level);

          assessmentResults.push({
            id: existingAssessment.id,
            scf_control_id: existingAssessment.scf_control_id,
            overall_result: existingAssessment.assessment_result,
            overall_confidence: reusedConfidence,
            summary: existingAssessment.assessment_summary || "Assessment already completed",
            reused: true,
          });

          const existingMetadata =
            existingAssessment.metadata && typeof existingAssessment.metadata === "object"
              ? (existingAssessment.metadata as Record<string, unknown>)
              : null;

          await appendAIAssessmentLog({
            requestId,
            sessionId,
            scope: "control_assessment",
            status: "success",
            evidenceId: primaryEvidence.id,
            evidenceContentHash,
            scfControlId: controlId,
            modelProvider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
            modelName: COMPLIANCE_AI_CONFIG.controlMapping.model,
            metadata: {
              reusedExistingAssessment: true,
              reusedFromEvidenceMetadata: true,
              sourceAssessmentId: existingAssessment.id,
              controlRunKey: existingMetadata?.assessment_run_key ?? null,
              overallResult: existingAssessment.assessment_result,
              overallConfidence: reusedConfidence,
            },
          });

          const assessedAt = new Date().toISOString();
          await Promise.all(
            controlEvidenceRecords.map((evidenceRecord) =>
              serviceSupabase
                .from("evidence")
                .update({
                  evidence_status: "under_review",
                  metadata: {
                    ...evidenceRecord.metadata,
                    assessment_completed: true,
                    assessment_id: existingAssessment.id,
                    assessment_result: existingAssessment.assessment_result,
                    assessed_at: assessedAt,
                  },
                })
                .eq("id", evidenceRecord.id)
            )
          );

          completedControls += 1;
          emitAssessmentProgress(
            "assessing-control",
            `Completed ${controlId} (${completedControls}/${totalControls})`,
            {
              phase: "control-completed",
              currentControlId: controlId,
              currentControlNumber: controlNumber,
              controlResult: existingAssessment.assessment_result,
              controlConfidence: reusedConfidence,
              controlStatus: "reused",
            }
          );
          continue;
        }
      }

      log.info("Running assessment for control", { controlId });

      try {
        const assessment = await withTimeout(
          runControlAssessment(
            primaryEvidence.id,
            controlId,
            fileContent,
            imageData,
            supabase,
            serviceSupabase,
            user.id,
            {
              requestId,
              sessionId,
              evidenceId: primaryEvidence.id,
              scfControlId: controlId,
              evidenceContentHash,
            }
          ),
          CONTROL_ASSESSMENT_TIMEOUT_MS,
          `Assessment timed out for control ${controlId}`
        );

        if (!assessment) {
          throw new Error(`Assessment produced no result for control ${controlId}`);
        }

        assessmentResults.push(assessment);
        const assessedAt = new Date().toISOString();

        await Promise.all(
          controlEvidenceRecords.map((evidenceRecord) =>
            serviceSupabase
              .from("evidence")
              .update({
                evidence_status: "under_review",
                metadata: {
                  ...evidenceRecord.metadata,
                  assessment_completed: true,
                  assessment_id: assessment.id,
                  assessment_result: assessment.overall_result,
                  assessed_at: assessedAt,
                },
              })
              .eq("id", evidenceRecord.id)
          )
        );

        completedControls += 1;
        emitAssessmentProgress(
          "assessing-control",
          `Completed ${controlId} (${completedControls}/${totalControls})`,
          {
            phase: "control-completed",
            currentControlId: controlId,
            currentControlNumber: controlNumber,
            controlResult: assessment?.overall_result ?? "not_applicable",
            controlConfidence: assessment?.overall_confidence ?? null,
            controlStatus: "completed",
          }
        );
      } catch (assessmentError) {
        log.error("evidence.assess_uploaded.control_assessment_failed", {
          controlId,
          detail:
            assessmentError instanceof Error ? assessmentError.message : String(assessmentError),
        });
        failedControls.push({
          control_id: controlId,
          error: assessmentError instanceof Error ? assessmentError.message : "Assessment failed",
        });
        completedControls += 1;
        emitAssessmentProgress(
          "assessing-control",
          `Unable to assess ${controlId} (${completedControls}/${totalControls})`,
          {
            phase: "control-completed",
            currentControlId: controlId,
            currentControlNumber: controlNumber,
            controlResult: "error",
            controlStatus: "error",
            error: assessmentError instanceof Error ? assessmentError.message : "Assessment failed",
          }
        );
      }
    }

    if (assessmentResults.length === 0) {
      throw new Error(
        `Assessment failed for all requested controls (${uniqueControlIds.length}). ${
          failedControls.length > 0
            ? failedControls[0].error
            : "No successful assessments were produced."
        }`
      );
    }

    log.info("Assessment completed successfully", {
      completedCount: assessmentResults.length,
    });

    emitAssessmentProgress(
      "assessment-finalizing",
      `Finalizing results (${assessmentResults.length}/${uniqueControlIds.length} controls assessed)`,
      { phase: "assessment-finalizing" }
    );

    if (sessionId) {
      progressTracker.completeSession(
        sessionId,
        `Evidence assessment completed (${assessmentResults.length}/${uniqueControlIds.length})`
      );
    }

    // Refresh framework crosswalk materialized view (fire-and-forget)
    serviceSupabase.rpc("refresh_framework_crosswalk").then(
      () => log.info("Crosswalk materialized view refreshed"),
      (err: { message?: string }) =>
        log.warn("Crosswalk refresh failed (non-blocking)", {
          error: err?.message ?? "unknown",
        })
    );

    // Enqueue debounced posture recalculation (30s coalescing window)
    enqueuePostureRecalc(serviceSupabase, user.id);

    // Invalidate inbox cache so next load reflects new assessments
    invalidateInboxCache(user.id);

    return NextResponse.json({
      success: true,
      assessments: assessmentResults,
      assessed_controls: assessmentResults.length,
      requested_controls: uniqueControlIds.length,
      failed_controls: failedControls,
      message:
        failedControls.length > 0
          ? `Assessment completed with warnings: ${assessmentResults.length}/${uniqueControlIds.length} controls assessed`
          : `Assessment completed: ${assessmentResults.length} controls assessed`,
    });
  } catch (error) {
    logger.error("assess_uploaded.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    const sessionId = request.headers.get("x-progress-session");
    if (sessionId) {
      progressTracker.errorSession(
        sessionId,
        error instanceof Error ? error.message : "Assessment failed"
      );
    }
    return apiError("evidence.assess_uploaded_failed", "Assessment failed", 500, error);
  }
}

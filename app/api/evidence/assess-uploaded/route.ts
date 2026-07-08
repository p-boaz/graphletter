import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  ASSESSMENT_CONTRACT_VERSION,
  assessmentEvidenceMode,
} from "@/lib/ai/assess-evidence/contract";
import { runControlAssessment } from "@/lib/ai/assess-evidence/control-assessment";
import {
  confidenceLevelToScore,
  prepareAssessmentContent,
  withTimeout,
} from "@/lib/ai/assess-evidence/utils";
import { normalizeCanonicalText } from "@/lib/evidence/content-extraction";
import { resolveEvidenceContent } from "@/lib/graph/service";

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
import {
  completeProgressSession,
  errorProgressSession,
  updateProgress,
} from "@/lib/progress/progress-store";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/evidence/assess-uploaded");
const ASSESS_RATE_LIMIT = {
  namespace: "evidence_assess_uploaded",
  user: { windowMs: 60_000, maxRequests: 5 },
  ip: { windowMs: 60_000, maxRequests: 20 },
  message: "Rate limit exceeded for assessment. Please retry shortly.",
} as const;

type EvidenceAssessmentRecord = {
  id: string;
  user_id: string;
  scf_control_id: string;
  metadata?: Record<string, unknown> | null;
  extracted_content?: string | null;
  processed_content?: string | null;
  evidence_data?: unknown;
  file_type?: string | null;
  file_path?: string | null;
  storage_path?: string | null;
};

function metadataContentHash(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.content_hash;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataExtractedContentHash(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.extracted_content_hash;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveStoredAssessmentContent(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  records: EvidenceAssessmentRecord[];
  primaryEvidence: EvidenceAssessmentRecord;
}): Promise<{
  content: string;
  contentHash: string;
  source: string;
  truncated: boolean;
  originalLength: number;
  maxChars: number;
}> {
  const primaryExtractedContentHash =
    metadataExtractedContentHash(input.primaryEvidence.metadata) ??
    metadataContentHash(input.primaryEvidence.metadata);
  const hashMatchedRecords = primaryExtractedContentHash
    ? input.records.filter(
        (record) =>
          (metadataExtractedContentHash(record.metadata) ??
            metadataContentHash(record.metadata)) === primaryExtractedContentHash
      )
    : [input.primaryEvidence];
  const candidateRecords =
    hashMatchedRecords.length > 0 ? hashMatchedRecords : [input.primaryEvidence];

  for (const record of candidateRecords) {
    const content = normalizeCanonicalText(resolveEvidenceContent(record)).trim();
    if (content) {
      const prepared = prepareAssessmentContent(content);
      return {
        ...prepared,
        contentHash: createHash("sha256").update(prepared.content).digest("hex"),
        source: "evidence",
      };
    }
  }

  const sourceEvidenceIds = candidateRecords.map((record) => record.id);
  const { data: documents, error: documentsError } = await input.supabase
    .from("documents")
    .select("id, source_hash, source_evidence_id")
    .in("source_evidence_id", sourceEvidenceIds)
    .limit(1);

  if (documentsError) {
    throw new Error(`Failed to read stored assessment document: ${documentsError.message}`);
  }

  const document = documents?.[0];
  if (!document?.id) {
    throw new Error("Stored assessment content not found for evidence");
  }

  const { data: chunks, error: chunksError } = await input.supabase
    .from("document_chunks")
    .select("content, char_start, char_end")
    .eq("document_id", document.id)
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to read stored assessment document chunks: ${chunksError.message}`);
  }

  const content = normalizeCanonicalText(rebuildDocumentFromChunks(chunks ?? [])).trim();
  if (!content) {
    throw new Error("Stored assessment document has no extractable text");
  }
  const prepared = prepareAssessmentContent(content);

  return {
    ...prepared,
    contentHash: createHash("sha256").update(prepared.content).digest("hex"),
    source: "document_chunks",
  };
}

function rebuildDocumentFromChunks(
  chunks: Array<{ content?: string | null; char_start?: number | null; char_end?: number | null }>
): string {
  const ordered = chunks
    .filter((chunk) => typeof chunk.content === "string" && chunk.content.length > 0)
    .sort((left, right) => (left.char_start ?? 0) - (right.char_start ?? 0));
  if (
    ordered.every((chunk) => Number.isInteger(chunk.char_start) && Number.isInteger(chunk.char_end))
  ) {
    let content = "";
    for (const chunk of ordered) {
      const chunkStart = chunk.char_start ?? content.length;
      const chunkEnd = chunk.char_end ?? chunkStart + (chunk.content?.length ?? 0);
      const expectedLength = Math.max(0, chunkEnd - chunkStart);
      const chunkContent = normalizeCanonicalText(chunk.content ?? "").slice(0, expectedLength);
      if (chunkStart > content.length) {
        content += " ".repeat(chunkStart - content.length);
      }
      const appendFrom = Math.max(0, content.length - chunkStart);
      content += chunkContent.slice(appendFrom);
    }
    return content;
  }
  return ordered.map((chunk) => normalizeCanonicalText(chunk.content ?? "")).join("");
}

async function resolveStoredImageData(input: {
  serviceSupabase: {
    storage: {
      from(bucket: string): {
        download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }>;
      };
    };
  };
  evidence: EvidenceAssessmentRecord;
}): Promise<{ base64: string; mimeType: string } | null> {
  if (!input.evidence.file_type?.includes("image/")) return null;
  const storagePath =
    input.evidence.storage_path ||
    input.evidence.file_path ||
    (typeof input.evidence.metadata?.storage_path === "string"
      ? input.evidence.metadata.storage_path
      : null);
  if (!storagePath) return null;

  const { data, error } = await input.serviceSupabase.storage
    .from("compliance-documents")
    .download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to load stored image evidence: ${error?.message ?? "no data"}`);
  }
  return {
    base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
    mimeType: input.evidence.file_type,
  };
}

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
    const { evidenceIds } = await request.json();

    if (!evidenceIds || !Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      return NextResponse.json({ error: "Evidence IDs required" }, { status: 400 });
    }

    log.info("Starting assessment", { evidenceCount: evidenceIds.length });

    const serviceSupabase = createServiceClient(
      getSupabaseServerUrl(),
      getSupabaseServiceRoleKey(),
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

    const emitAssessmentProgress = async (
      stage: string,
      message: string,
      metadata: Record<string, unknown> = {}
    ) => {
      if (!sessionId) return;
      await updateProgress(supabase, sessionId, stage, getAssessmentProgressValue(), message, {
        totalControls,
        completedControls,
        ...buildTimingMetadata(),
        ...metadata,
      });
    };

    if (sessionId) {
      await updateProgress(
        supabase,
        sessionId,
        "assessment-started",
        65,
        "Preparing AI assessment",
        {
          controlCount: uniqueControlIds.length,
          totalControls,
          phase: "assessment-started",
          ...buildTimingMetadata(),
        }
      );
    }

    for (const [index, controlId] of uniqueControlIds.entries()) {
      const controlNumber = index + 1;
      const controlEvidenceRecords = evidenceRecords.filter((e) => e.scf_control_id === controlId);
      const primaryEvidence = controlEvidenceRecords[0] as EvidenceAssessmentRecord | undefined;
      if (!primaryEvidence) {
        failedControls.push({
          control_id: controlId,
          error: "Evidence record not found for control",
        });
        completedControls += 1;
        continue;
      }
      await emitAssessmentProgress(
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

        const existingMetadata =
          existingAssessment?.metadata && typeof existingAssessment.metadata === "object"
            ? (existingAssessment.metadata as Record<string, unknown>)
            : null;
        const existingContractVersion =
          typeof existingMetadata?.assessment_contract_version === "string"
            ? existingMetadata.assessment_contract_version
            : null;
        const existingEvidenceMode =
          typeof existingMetadata?.assessment_evidence_mode === "string"
            ? existingMetadata.assessment_evidence_mode
            : null;

        if (
          existingAssessment &&
          existingContractVersion === ASSESSMENT_CONTRACT_VERSION &&
          existingEvidenceMode === assessmentEvidenceMode()
        ) {
          const reusedConfidence = confidenceLevelToScore(existingAssessment.confidence_level);

          assessmentResults.push({
            id: existingAssessment.id,
            scf_control_id: existingAssessment.scf_control_id,
            overall_result: existingAssessment.assessment_result,
            overall_confidence: reusedConfidence,
            summary: existingAssessment.assessment_summary || "Assessment already completed",
            reused: true,
          });

          await appendAIAssessmentLog({
            requestId,
            sessionId,
            scope: "control_assessment",
            status: "success",
            evidenceId: primaryEvidence.id,
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
          await emitAssessmentProgress(
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
        const storedAssessmentContent = await resolveStoredAssessmentContent({
          supabase,
          records: evidenceRecords as EvidenceAssessmentRecord[],
          primaryEvidence,
        });
        if (storedAssessmentContent.truncated) {
          log.warn("evidence.assess_uploaded.content_truncated", {
            controlId,
            source: storedAssessmentContent.source,
            originalLength: storedAssessmentContent.originalLength,
            maxChars: storedAssessmentContent.maxChars,
            assessedLength: storedAssessmentContent.content.length,
          });
        }
        const serverImageData = await resolveStoredImageData({
          serviceSupabase,
          evidence: primaryEvidence,
        });
        const assessment = await withTimeout(
          runControlAssessment(
            primaryEvidence.id,
            controlId,
            storedAssessmentContent.content,
            serverImageData,
            supabase,
            serviceSupabase,
            user.id,
            {
              requestId,
              sessionId,
              evidenceId: primaryEvidence.id,
              scfControlId: controlId,
              evidenceContentHash: storedAssessmentContent.contentHash,
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
        await emitAssessmentProgress(
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
        await emitAssessmentProgress(
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

    await emitAssessmentProgress(
      "assessment-finalizing",
      `Finalizing results (${assessmentResults.length}/${uniqueControlIds.length} controls assessed)`,
      { phase: "assessment-finalizing" }
    );

    if (sessionId) {
      await completeProgressSession(
        supabase,
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
      detail: error instanceof Error ? error.message : "unknown",
    });
    const sessionId = request.headers.get("x-progress-session");
    if (sessionId) {
      const supabase2 = await createClient().catch(() => null);
      if (supabase2) {
        await errorProgressSession(
          supabase2,
          sessionId,
          error instanceof Error ? error.message : "Assessment failed"
        );
      }
    }
    return apiError("evidence.assess_uploaded_failed", "Assessment failed", 500, error);
  }
}

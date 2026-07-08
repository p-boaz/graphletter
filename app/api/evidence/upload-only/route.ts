import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { supabaseAdmin } from "@/lib/database/supabase";
import { extractFileContent, normalizeCanonicalText } from "@/lib/evidence/content-extraction";
import { createRequestLogger, getOrCreateRequestId } from "@/lib/observability/logger";
import {
  createEvidenceServiceClient,
  validateEvidenceUploadFile,
} from "@/lib/services/evidence/upload-utils";
import { createClient } from "@/lib/supabase/server";
import { errorProgressSession, updateProgress } from "@/lib/progress/progress-store";
import { getCurrentUser } from "@/utils/auth";

const ALLOWED_EVIDENCE_TYPES = new Set([
  "policy",
  "procedure",
  "document",
  "screenshot",
  "log",
  "certificate",
  "configuration",
  "other",
]);
const UPLOAD_RATE_LIMIT = {
  namespace: "evidence_upload_only",
  user: { windowMs: 60_000, maxRequests: 10 },
  ip: { windowMs: 60_000, maxRequests: 30 },
  message: "Rate limit exceeded for evidence upload. Please retry shortly.",
} as const;

interface ArtifactRow {
  id: string;
  erl_id: string;
  documentation_artifact: string;
}

interface ControlMappingRow {
  scf_control_id: string;
  priority: number | null;
  evidence_request_id: string;
}

interface SCFControlRow {
  id: string;
  title: string | null;
  description: string | null;
}

interface UploadControlDetail {
  scf_control_id: string;
  erl_id: string;
  erl_global_id: string;
  title: string;
  description: string;
  priority: number;
}

function normalizeEvidenceType(rawEvidenceType: string | null): string {
  if (!rawEvidenceType) {
    return "";
  }

  const normalizedEvidenceType = rawEvidenceType.trim().toLowerCase();
  if (normalizedEvidenceType === "general_document") {
    return "document";
  }

  return normalizedEvidenceType;
}

async function getControlsForDocumentationArtifact(
  documentationArtifact: string
): Promise<UploadControlDetail[]> {
  const supabase = supabaseAdmin;
  const requestedArtifact = documentationArtifact.trim();
  const candidateNames = [documentationArtifact, requestedArtifact, `${requestedArtifact} `].filter(
    Boolean
  );

  let artifactRows: ArtifactRow[] = [];
  for (const candidate of candidateNames) {
    const { data, error } = await supabase
      .from("scf_evidence_request_list")
      .select("id, erl_id, documentation_artifact")
      .eq("documentation_artifact", candidate);

    if (error) {
      throw new Error(`Failed to fetch documentation artifact mappings: ${error.message}`);
    }

    if (data && data.length > 0) {
      artifactRows = data as ArtifactRow[];
      break;
    }
  }

  if (artifactRows.length === 0 && requestedArtifact) {
    const { data, error } = await supabase
      .from("scf_evidence_request_list")
      .select("id, erl_id, documentation_artifact")
      .ilike("documentation_artifact", requestedArtifact);

    if (error) {
      throw new Error(`Failed to fetch documentation artifact mappings: ${error.message}`);
    }

    artifactRows = (data || []) as ArtifactRow[];
  }

  if (artifactRows.length === 0) {
    throw new Error("Documentation artifact not found");
  }

  const artifactById = new Map(artifactRows.map((row) => [row.id, row]));
  const artifactIds = [...artifactById.keys()];

  const { data: mappingRows, error: mappingError } = await supabase
    .from("scf_control_evidence_mappings")
    .select("scf_control_id, priority, evidence_request_id")
    .in("evidence_request_id", artifactIds)
    .or("is_active.is.null,is_active.eq.true")
    .order("priority", { ascending: true });

  if (mappingError) {
    throw new Error(`Failed to fetch control mappings for artifact: ${mappingError.message}`);
  }

  const controlIds = [
    ...new Set(
      ((mappingRows || []) as ControlMappingRow[]).map((mapping) => mapping.scf_control_id)
    ),
  ];
  const controlById = new Map<string, SCFControlRow>();

  if (controlIds.length > 0) {
    const { data: controlRows, error: controlError } = await supabase
      .from("scf_controls")
      .select("id, title, description")
      .in("id", controlIds);

    if (controlError) {
      throw new Error(`Failed to fetch control metadata for artifact: ${controlError.message}`);
    }

    for (const control of (controlRows || []) as SCFControlRow[]) {
      controlById.set(control.id, control);
    }
  }

  const uniqueControls = new Map<string, UploadControlDetail>();
  for (const mapping of (mappingRows || []) as ControlMappingRow[]) {
    if (uniqueControls.has(mapping.scf_control_id)) {
      continue;
    }

    const artifact = artifactById.get(mapping.evidence_request_id);
    const control = controlById.get(mapping.scf_control_id);
    if (!artifact) {
      continue;
    }

    uniqueControls.set(mapping.scf_control_id, {
      scf_control_id: mapping.scf_control_id,
      erl_id: artifact.id,
      erl_global_id: artifact.erl_id,
      title: control?.title || mapping.scf_control_id,
      description: control?.description || "",
      priority: mapping.priority ?? 999,
    });
  }

  const controls = [...uniqueControls.values()].sort((a, b) => a.priority - b.priority);

  if (controls.length === 0) {
    throw new Error("No controls found for the selected documentation artifact");
  }

  return controls;
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createRequestLogger(requestId);
  logger.info("upload_only.started");

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      logger.warn("upload_only.unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = checkRouteRateLimit(UPLOAD_RATE_LIMIT, user.id, request.headers);
    if (rateLimitResponse) return rateLimitResponse;

    logger.info("upload_only.parsing_form");
    const sessionId = request.headers.get("x-progress-session");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawEvidenceType = formData.get("evidence_type") as string;
    const evidenceType = normalizeEvidenceType(rawEvidenceType);
    const description = formData.get("description") as string;
    const documentationArtifact = formData.get("documentation_artifact") as string;
    const idempotencyKey =
      request.headers.get("x-idempotency-key") ||
      (formData.get("idempotency_key") as string | null);

    // Versioning parameters
    const isVersionReplacement = formData.get("is_version_replacement") === "true";
    const replacesEvidenceId = formData.get("replaces_evidence_id") as string;
    const newVersionStr = formData.get("new_version") as string;
    const newVersion = newVersionStr ? parseInt(newVersionStr, 10) : 1;

    logger.info("upload_only.form_parsed", {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      evidenceType,
      documentationArtifact: documentationArtifact?.substring(0, 100),
      isVersionReplacement,
      newVersion,
    });

    if (!file || !evidenceType || !documentationArtifact) {
      return NextResponse.json(
        {
          error: "Missing required fields: file, evidence_type, and documentation_artifact",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_EVIDENCE_TYPES.has(evidenceType)) {
      return NextResponse.json(
        {
          error: `Invalid evidence_type "${rawEvidenceType}". Expected one of: ${Array.from(
            ALLOWED_EVIDENCE_TYPES
          ).join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (idempotencyKey) {
      const { data: existingEvidenceRecords, error: existingError } = await supabase
        .from("evidence")
        .select("*")
        .eq("user_id", user.id)
        .eq("metadata->>idempotency_key", idempotencyKey)
        .order("created_at", { ascending: true });

      if (existingError) {
        logger.warn("upload_only.idempotency_lookup_failed", {
          message: existingError.message,
        });
      } else if (existingEvidenceRecords && existingEvidenceRecords.length > 0) {
        return NextResponse.json({
          success: true,
          deduplicated: true,
          evidence: existingEvidenceRecords[0],
          evidence_records: existingEvidenceRecords,
          discovered_controls: [
            ...new Set(existingEvidenceRecords.map((record) => record.scf_control_id)),
          ],
          documentation_artifact: existingEvidenceRecords[0]?.metadata?.documentation_artifact,
          message: "Upload request already processed for this idempotency key",
          awaiting_assessment: true,
        });
      }
    }

    // SHA-256 content hash dedup: check if identical file already uploaded
    let contentHash: string | null = null;
    try {
      const fileArrayBuffer = await file.arrayBuffer();
      contentHash = createHash("sha256").update(new Uint8Array(fileArrayBuffer)).digest("hex");

      const { data: duplicateSeedRecords, error: duplicateLookupError } = await supabase
        .from("evidence")
        .select("id, file_name, scf_control_id, evidence_group_id, created_at, metadata")
        .eq("user_id", user.id)
        .eq("metadata->>content_hash", contentHash)
        .neq("evidence_status", "outdated")
        .order("created_at", { ascending: true })
        .limit(1);

      if (duplicateLookupError) {
        logger.warn("upload_only.content_hash_lookup_failed", {
          message: duplicateLookupError.message,
        });
      }

      if (duplicateSeedRecords && duplicateSeedRecords.length > 0) {
        const duplicateSeed = duplicateSeedRecords[0];
        let duplicateEvidenceRecords = duplicateSeedRecords;

        if (duplicateSeed.evidence_group_id) {
          const GROUP_LOOKUP_LIMIT = 200;
          const { data: groupedDuplicateRecords, error: groupedDuplicateError } = await supabase
            .from("evidence")
            .select("id, file_name, scf_control_id, evidence_group_id, created_at, metadata")
            .eq("user_id", user.id)
            .eq("evidence_group_id", duplicateSeed.evidence_group_id)
            .neq("evidence_status", "outdated")
            .order("created_at", { ascending: true })
            .limit(GROUP_LOOKUP_LIMIT);

          if (groupedDuplicateError) {
            logger.warn("upload_only.content_hash_group_lookup_failed", {
              message: groupedDuplicateError.message,
              evidenceGroupId: duplicateSeed.evidence_group_id,
            });
          } else if (groupedDuplicateRecords && groupedDuplicateRecords.length > 0) {
            if (groupedDuplicateRecords.length === GROUP_LOOKUP_LIMIT) {
              logger.warn("upload_only.group_lookup_truncated", {
                evidenceGroupId: duplicateSeed.evidence_group_id,
                limit: GROUP_LOOKUP_LIMIT,
              });
            }
            duplicateEvidenceRecords = groupedDuplicateRecords;
          }
        }

        logger.info("upload_only.duplicate_detected", {
          contentHash,
          existingEvidenceId: duplicateSeed.id,
        });
        return NextResponse.json({
          success: true,
          deduplicated: true,
          duplicate_of: duplicateSeed.id,
          evidence: duplicateEvidenceRecords[0],
          evidence_records: duplicateEvidenceRecords,
          discovered_controls: [
            ...new Set(duplicateEvidenceRecords.map((record) => record.scf_control_id)),
          ],
          documentation_artifact: duplicateEvidenceRecords[0]?.metadata?.documentation_artifact,
          message: "Identical file already uploaded. Use version replacement to update.",
          awaiting_assessment: true,
        });
      }
    } catch (hashError) {
      // Skip dedup on hash failure (Decision: never block upload due to hash failure)
      logger.warn("upload_only.content_hash_failed", {
        error: hashError instanceof Error ? hashError.message : "unknown",
      });
    }

    const fileValidationResult = await validateEvidenceUploadFile(file);
    if (!fileValidationResult.isValid) {
      return NextResponse.json(
        { error: fileValidationResult.error || "Invalid file upload request" },
        { status: 400 }
      );
    }

    try {
      if (sessionId) {
        await updateProgress(
          supabase,
          sessionId,
          "upload-validating",
          35,
          "Validating evidence upload",
          {
            fileName: file.name,
            evidenceType,
            documentationArtifact,
          }
        );
      }

      // Get SCF controls for the selected documentation artifact using shared service
      logger.info("upload_only.fetching_controls");

      const uniqueControls = await getControlsForDocumentationArtifact(documentationArtifact);

      logger.info("upload_only.controls_discovered", {
        controlCount: uniqueControls.length,
        documentationArtifact,
      });

      if (sessionId) {
        await updateProgress(
          supabase,
          sessionId,
          "upload-analyzing",
          40,
          "Identified relevant controls",
          {
            controlCount: uniqueControls.length,
          }
        );
      }

      // Handle version replacement if applicable
      if (isVersionReplacement && replacesEvidenceId) {
        logger.info("upload_only.version_replacement", {
          replacesEvidenceId,
        });

        // Mark all existing evidence for this documentation artifact as outdated
        const { error: updateError } = await supabase
          .from("evidence")
          .update({
            evidence_status: "outdated",
            outdated_at: new Date().toISOString(),
            outdated_by: newVersion,
          })
          .eq("user_id", user.id)
          .eq("metadata->>documentation_artifact", documentationArtifact)
          .neq("evidence_status", "outdated"); // Don't update already outdated records

        if (updateError) {
          logger.warn("upload_only.version_replacement_update_failed", {
            message: updateError.message,
          });
          // Continue anyway - this is not critical for the upload to succeed
        } else {
          logger.info("upload_only.version_replacement_updated");
        }
      }

      // Upload evidence file to storage
      logger.info("upload_only.uploading_file");
      const serviceSupabase = createEvidenceServiceClient();
      const extractedContent = normalizeCanonicalText(await extractFileContent(file));
      const contentExtractedAt = new Date().toISOString();

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileExtension = file.name.split(".").pop();
      const normalizedIdempotencyKey = idempotencyKey
        ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_")
        : null;
      const finalFilename = normalizedIdempotencyKey
        ? `evidence_${normalizedIdempotencyKey}.${fileExtension}`
        : `evidence_${timestamp}.${fileExtension}`;
      const filePath = `${user.id}/evidence/${finalFilename}`;

      const { data: uploadData, error: uploadError } = await serviceSupabase.storage
        .from("compliance-documents")
        .upload(filePath, file, {
          upsert: Boolean(normalizedIdempotencyKey),
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      if (sessionId) {
        await updateProgress(
          supabase,
          sessionId,
          "uploading-evidence",
          48,
          "Evidence stored successfully",
          {
            storagePath: uploadData.path,
          }
        );
      }

      // Create evidence records for each control (without assessments)
      logger.info("upload_only.creating_evidence_records");
      const evidenceRecords = [];

      // Generate a shared evidence group ID for all records from this file
      const evidenceGroupId = crypto.randomUUID();

      for (const control of uniqueControls) {
        const evidenceRecord = {
          user_id: user.id,
          erl_id: control.erl_id, // UUID for DB performance
          erl_global_id: control.erl_global_id, // Text ID for frontend convenience
          scf_control_id: control.scf_control_id,
          evidence_group_id: evidenceGroupId,
          evidence_type: evidenceType,
          file_name: file.name,
          file_path: uploadData.path, // Keep for backwards compatibility
          storage_path: uploadData.path, // New dedicated storage path field
          file_size: file.size,
          file_type: file.type,
          version: newVersion,
          description: description || `Evidence for ${documentationArtifact}`,
          submitted_by: user.id,
          evidence_status: "submitted",
          submitted_at: new Date().toISOString(),
          replaces_evidence_id: isVersionReplacement ? replacesEvidenceId : null,
          extracted_content: extractedContent,
          content_extracted_at: contentExtractedAt,
          content_extraction_status: extractedContent.trim() ? "completed" : "failed",
          metadata: {
            original_filename: file.name,
            upload_only: true,
            documentation_artifact: documentationArtifact,
            evidence_group_id: evidenceGroupId,
            user_agent: request.headers.get("user-agent"),
            awaiting_assessment: true,
            idempotency_key: idempotencyKey,
            content_hash: contentHash,
            extracted_content_hash: createHash("sha256").update(extractedContent).digest("hex"),
            extracted_content_normalization: "lf",
            storage_path: uploadData.path, // Add storage path to metadata
            storage_bucket: "compliance-documents",
            version: newVersion,
            is_version_replacement: isVersionReplacement,
            replaces_evidence_id: isVersionReplacement ? replacesEvidenceId : null,
          },
        };

        const { data: evidenceData, error: evidenceError } = await serviceSupabase
          .from("evidence")
          .insert(evidenceRecord)
          .select("*")
          .single();

        if (evidenceError) {
          logger.warn("upload_only.evidence_record_create_failed", {
            scfControlId: control.scf_control_id,
            message: evidenceError.message,
          });
          continue;
        }

        evidenceRecords.push(evidenceData);
      }

      if (evidenceRecords.length === 0) {
        await serviceSupabase.storage.from("compliance-documents").remove([uploadData.path]);
        throw new Error("Failed to create any evidence records");
      }

      if (evidenceRecords.length !== uniqueControls.length) {
        throw new Error(
          `Created ${evidenceRecords.length} evidence records for ${uniqueControls.length} controls. Please retry.`
        );
      }

      if (sessionId) {
        await updateProgress(
          supabase,
          sessionId,
          "evidence-records-created",
          55,
          "Evidence records created",
          {
            recordCount: evidenceRecords.length,
            controlCount: uniqueControls.length,
          }
        );
      }

      logger.info("upload_only.completed", {
        createdRecords: evidenceRecords.length,
        isVersionReplacement,
        newVersion,
        replacesEvidenceId,
      });

      if (sessionId) {
        await updateProgress(
          supabase,
          sessionId,
          "upload-complete",
          60,
          "Evidence ready for assessment",
          {
            recordCount: evidenceRecords.length,
          }
        );
      }

      return NextResponse.json({
        success: true,
        evidence: evidenceRecords[0], // Return primary evidence record
        evidence_records: evidenceRecords,
        discovered_controls: uniqueControls.map((c) => c.scf_control_id),
        controls_details: uniqueControls,
        documentation_artifact: documentationArtifact,
        message: isVersionReplacement
          ? `Version ${newVersion} uploaded: ${uniqueControls.length} controls identified, ready for assessment`
          : `Upload completed: ${uniqueControls.length} controls identified, ready for assessment`,
        awaiting_assessment: true,
        version_info: {
          version: newVersion,
          is_replacement: isVersionReplacement,
          replaces_evidence_id: isVersionReplacement ? replacesEvidenceId : null,
        },
      });
    } catch (error) {
      logger.error("upload_only.processing_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  } catch (error) {
    logger.error("upload_only.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    const sessionId = request.headers.get("x-progress-session");
    if (sessionId) {
      const supabase2 = await createClient().catch(() => null);
      if (supabase2) {
        await errorProgressSession(
          supabase2,
          sessionId,
          error instanceof Error ? error.message : "Evidence upload failed"
        );
      }
    }
    return apiError("evidence.upload_only_failed", "Upload failed", 500, error);
  }
}

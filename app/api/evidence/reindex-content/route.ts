import { type NextRequest, NextResponse } from "next/server";
import { extractFileContent } from "@/app/api/evidence/extract-content/route";
import { createRequestLogger, getOrCreateRequestId } from "@/lib/observability/logger";
import { createEvidenceServiceClient } from "@/lib/services/evidence/upload-utils";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/utils/auth";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createRequestLogger(requestId);
  logger.info("reindex_content.started");

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      logger.warn("reindex_content.unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { evidence_ids = [], force_reindex = false, batch_size = 10 } = body;

    logger.info("reindex_content.request_parsed", {
      evidence_ids,
      force_reindex,
      batch_size,
    });

    const hasAdminAccess = await isAdminUser(user);

    // Use service role client to bypass RLS for content operations
    const serviceSupabase = createEvidenceServiceClient();

    // Determine which evidence records to process
    let query = serviceSupabase
      .from("evidence")
      .select(
        "id, user_id, file_path, file_type, file_name, content_extraction_status, extracted_content"
      );

    // If specific evidence IDs are provided, process only those
    if (evidence_ids.length > 0) {
      query = query.in("id", evidence_ids);
    } else {
      // Otherwise, process evidence for the current user
      query = query.eq("user_id", user.id);

      // Only process evidence that hasn't been indexed or failed indexing, unless force reindex
      if (!force_reindex) {
        if (!hasAdminAccess && evidence_ids.length > 0) {
          query = query.eq("user_id", user.id);
        }

        query = query.or(
          "content_extraction_status.is.null,content_extraction_status.eq.pending,content_extraction_status.eq.failed"
        );
      }
    }

    // Apply batch size limit
    query = query.limit(batch_size);

    const { data: evidenceRecords, error: fetchError } = await query;

    if (fetchError) {
      logger.error("reindex_content.fetch_failed", {
        message: fetchError.message,
      });
      return NextResponse.json({ error: "Failed to fetch evidence records" }, { status: 500 });
    }

    if (!evidenceRecords || evidenceRecords.length === 0) {
      logger.info("reindex_content.no_records");
      return NextResponse.json({
        success: true,
        message: "No evidence records found to process",
        processed: 0,
        errors: 0,
        results: [],
      });
    }

    logger.info("reindex_content.processing_records", {
      recordCount: evidenceRecords.length,
    });

    const results = [];
    let processed = 0;
    let errors = 0;

    // Process each evidence record
    for (const record of evidenceRecords) {
      logger.info("reindex_content.processing_record", {
        evidenceId: record.id,
        fileName: record.file_name,
      });

      try {
        // Update status to processing
        await serviceSupabase
          .from("evidence")
          .update({ content_extraction_status: "processing" })
          .eq("id", record.id);

        // Download file from storage
        const { data: fileData, error: downloadError } = await serviceSupabase.storage
          .from("compliance-documents")
          .download(record.file_path);

        if (downloadError || !fileData) {
          logger.warn("reindex_content.download_failed", {
            evidenceId: record.id,
            message: downloadError?.message || "unknown",
          });

          // Update status to failed
          await serviceSupabase
            .from("evidence")
            .update({
              content_extraction_status: "failed",
              content_extracted_at: new Date().toISOString(),
            })
            .eq("id", record.id);

          results.push({
            evidence_id: record.id,
            file_name: record.file_name,
            status: "failed",
            error: `File download failed: ${downloadError?.message || "Unknown error"}`,
          });
          errors++;
          continue;
        }

        // Convert blob to File object for content extraction
        const file = new File([fileData], record.file_name, {
          type: record.file_type,
        });

        // Extract content using existing function
        const extractedContent = await extractFileContent(file);

        logger.info("reindex_content.extracted", {
          evidenceId: record.id,
          characterCount: extractedContent.length,
        });

        // Update evidence record with extracted content
        const { error: updateError } = await serviceSupabase
          .from("evidence")
          .update({
            extracted_content: extractedContent,
            content_extraction_status: "completed",
            content_extracted_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        if (updateError) {
          logger.warn("reindex_content.update_failed", {
            evidenceId: record.id,
            message: updateError.message,
          });

          // Update status to failed
          await serviceSupabase
            .from("evidence")
            .update({
              content_extraction_status: "failed",
              content_extracted_at: new Date().toISOString(),
            })
            .eq("id", record.id);

          results.push({
            evidence_id: record.id,
            file_name: record.file_name,
            status: "failed",
            error: `Database update failed: ${updateError.message}`,
          });
          errors++;
          continue;
        }

        results.push({
          evidence_id: record.id,
          file_name: record.file_name,
          status: "completed",
          content_length: extractedContent.length,
        });
        processed++;

        logger.info("reindex_content.record_completed", {
          evidenceId: record.id,
        });
      } catch (error) {
        logger.warn("reindex_content.record_failed", {
          evidenceId: record.id,
          message: error instanceof Error ? error.message : "unknown",
        });

        // Update status to failed
        await serviceSupabase
          .from("evidence")
          .update({
            content_extraction_status: "failed",
            content_extracted_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        results.push({
          evidence_id: record.id,
          file_name: record.file_name,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        errors++;
      }
    }

    logger.info("reindex_content.completed", {
      processed,
      errors,
      totalFound: evidenceRecords.length,
    });

    return NextResponse.json({
      success: true,
      message: `Content reindexing completed. Processed ${processed} records, ${errors} errors.`,
      processed,
      errors,
      total_found: evidenceRecords.length,
      results,
    });
  } catch (error) {
    logger.error("reindex_content.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Content reindexing failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createRequestLogger(requestId);

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user_id_filter = user.id;

    // Get content extraction status summary
    const { data: statusSummary, error } = await supabase
      .from("evidence")
      .select("content_extraction_status")
      .eq("user_id", user_id_filter);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch status summary" }, { status: 500 });
    }

    const summary = {
      total: statusSummary.length,
      pending: statusSummary.filter(
        (s) => !s.content_extraction_status || s.content_extraction_status === "pending"
      ).length,
      processing: statusSummary.filter((s) => s.content_extraction_status === "processing").length,
      completed: statusSummary.filter((s) => s.content_extraction_status === "completed").length,
      failed: statusSummary.filter((s) => s.content_extraction_status === "failed").length,
      skipped: statusSummary.filter((s) => s.content_extraction_status === "skipped").length,
    };

    return NextResponse.json({
      success: true,
      user_id: user_id_filter,
      content_extraction_summary: summary,
      needs_reindexing: summary.pending + summary.failed > 0,
      completion_percentage:
        summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0,
    });
  } catch (error) {
    logger.error("reindex_content.get.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get reindexing status",
      },
      { status: 500 }
    );
  }
}

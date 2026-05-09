import { type NextRequest, NextResponse } from "next/server";
import { assessEvidence } from "@/lib/ai/assessment-engine";
import {
	createRequestLogger,
	getOrCreateRequestId,
} from "@/lib/observability/logger";
import {
	createEvidenceServiceClient,
	validateEvidenceUploadFile,
} from "@/lib/services/evidence/upload-utils";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export async function GET(request: NextRequest) {
	const requestId = getOrCreateRequestId(request);
	const logger = createRequestLogger(requestId);

	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const controlId = searchParams.get("control_id");
		const erlId = searchParams.get("erl_id");
		const status = searchParams.get("status");
		const limit = parseInt(searchParams.get("limit") || "50", 10);
		const offset = parseInt(searchParams.get("offset") || "0", 10);

		let query = supabase
			.from("evidence")
			.select(
				`
        *,
        submitted_by,
        reviewed_by,
        approved_by,
        scf_control:scf_controls(id, title, description),
        evidence_assessment_links(
          id,
          assessment_id,
          link_type,
          relevance_score,
          assessments!evidence_id(id, assessment_status, assessment_result)
        )
      `,
			)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);

		if (controlId) {
			query = query.eq("scf_control_id", controlId);
		}

		if (erlId) {
			query = query.eq("erl_id", erlId);
		}

		if (status) {
			query = query.eq("evidence_status", status);
		}

		const { data: evidence, error } = await query;

		if (error) {
			logger.error("evidence.get.fetch_failed", { message: error.message });
			return NextResponse.json(
				{ error: "Failed to fetch evidence" },
				{ status: 500 },
			);
		}

		// Get total count for pagination
		let countQuery = supabase
			.from("evidence")
			.select("*", { count: "exact", head: true })
			.eq("user_id", user.id);

		if (controlId) {
			countQuery = countQuery.eq("scf_control_id", controlId);
		}

		if (erlId) {
			countQuery = countQuery.eq("erl_id", erlId);
		}

		if (status) {
			countQuery = countQuery.eq("evidence_status", status);
		}

		const { count } = await countQuery;

		return NextResponse.json({
			evidence,
			total: count,
			limit,
			offset,
			hasMore: offset + limit < (count || 0),
		});
	} catch (error) {
		logger.error("evidence.get.failed", {
			message: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	const requestId = getOrCreateRequestId(request);
	const logger = createRequestLogger(requestId);
	logger.info("evidence.post.started");

	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		logger.info("evidence.post.auth", {
			authenticated: !!user,
			userId: user?.id,
		});

		if (!user) {
			logger.warn("evidence.post.unauthorized");
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		logger.info("evidence.post.parsing_form");
		const formData = await request.formData();
		const file = formData.get("file") as File;
		const scfControlId = formData.get("scf_control_id") as string;
		const erlId = formData.get("erl_id") as string;
		const evidenceType = formData.get("evidence_type") as string;
		const description = formData.get("description") as string;
		const documentId = formData.get("document_id") as string;
		const skipContentExtraction =
			formData.get("skip_content_extraction") === "true";

		logger.info("evidence.post.form_parsed", {
			hasFile: !!file,
			fileName: file?.name,
			fileSize: file?.size,
			fileType: file?.type,
			scfControlId,
			erlId,
			evidenceType,
			description,
			documentId,
		});

		if (!file || !scfControlId || !erlId || !evidenceType) {
			logger.warn("evidence.post.validation_failed", {
				hasFile: !!file,
				hasScfControlId: !!scfControlId,
				hasErlId: !!erlId,
				hasEvidenceType: !!evidenceType,
			});
			return NextResponse.json(
				{
					error:
						"Missing required fields: file, scf_control_id, erl_id, evidence_type",
				},
				{ status: 400 },
			);
		}

		const fileValidationResult = validateEvidenceUploadFile(file);
		if (!fileValidationResult.isValid) {
			return NextResponse.json(
				{
					error: fileValidationResult.error || "Invalid evidence upload file",
				},
				{ status: 400 },
			);
		}
		logger.info("evidence.post.file_validated");

		try {
			const serviceSupabase = createEvidenceServiceClient();

			logger.info("evidence.post.upload_start");

			// Upload file directly using service role client to avoid auth issues
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const fileExtension = file.name.split(".").pop();
			const finalFilename = `evidence_${timestamp}.${fileExtension}`;
			const filePath = `${user.id}/evidence/${finalFilename}`;

			logger.info("evidence.post.uploading_path", { filePath });

			const { data: uploadData, error: uploadError } =
				await serviceSupabase.storage
					.from("compliance-documents")
					.upload(filePath, file, {
						upsert: false,
						contentType: file.type,
					});

			if (uploadError) {
				throw new Error(`File upload failed: ${uploadError.message}`);
			}

			const finalFilePath = uploadData.path;
			logger.info("evidence.post.upload_complete", { finalFilePath });

			// Check for existing evidence with same ERL ID and control to determine version
			const { data: existingEvidence } = await supabase
				.from("evidence")
				.select("version")
				.eq("user_id", user.id)
				.eq("scf_control_id", scfControlId)
				.eq("erl_id", erlId)
				.order("version", { ascending: false })
				.limit(1);

			const version =
				existingEvidence && existingEvidence.length > 0
					? existingEvidence[0].version + 1
					: 1;

			logger.info("evidence.post.version_determined", {
				existingCount: existingEvidence?.length || 0,
				newVersion: version,
			});

			// Fetch the ERL record to get the global ID
			const { data: erlRecord, error: erlError } = await serviceSupabase
				.from("scf_evidence_request_list")
				.select("erl_id")
				.eq("id", erlId)
				.single();

			if (erlError) {
				logger.warn("evidence.post.invalid_erl", { message: erlError.message });
				return NextResponse.json({ error: "Invalid ERL ID" }, { status: 400 });
			}

			// Extract content from file for search functionality if extraction is not skipped
			let extractedContent = null;
			let contentExtractionStatus = "pending";

			if (!skipContentExtraction) {
				logger.info("evidence.post.extracting_content");
				try {
					// Import and use the extractFileContent function from the extract-content API
					const { extractFileContent } = await import(
						"@/app/api/evidence/extract-content/route"
					);
					extractedContent = await extractFileContent(file);
					contentExtractionStatus = "completed";

					logger.info("evidence.post.content_extracted", {
						characterCount: extractedContent.length,
					});
				} catch (extractionError) {
					logger.warn("evidence.post.content_extraction_failed", {
						message:
							extractionError instanceof Error
								? extractionError.message
								: "unknown",
					});
					contentExtractionStatus = "failed";
					extractedContent = null;
				}
			} else {
				logger.info("evidence.post.content_extraction_skipped");
				contentExtractionStatus = "skipped";
			}

			const evidenceRecord = {
				user_id: user.id,
				document_id: documentId || null,
				erl_id: erlId, // UUID for DB performance
				erl_global_id: erlRecord.erl_id, // Text ID for frontend convenience
				scf_control_id: scfControlId,
				evidence_type: evidenceType,
				file_name: file.name,
				file_path: finalFilePath,
				file_size: file.size,
				file_type: file.type,
				version,
				description: description || null,
				submitted_by: user.id,
				evidence_status: "submitted",
				submitted_at: new Date().toISOString(),
				// New fields for content search
				extracted_content: extractedContent,
				content_extraction_status: contentExtractionStatus,
				content_extracted_at:
					contentExtractionStatus === "completed"
						? new Date().toISOString()
						: null,
				metadata: {
					original_filename: file.name,
					user_agent: request.headers.get("user-agent"),
					ip_address:
						request.headers.get("x-forwarded-for") ||
						request.headers.get("x-real-ip"),
					content_extraction: {
						status: contentExtractionStatus,
						extracted_at:
							contentExtractionStatus === "completed"
								? new Date().toISOString()
								: null,
						characters: extractedContent ? extractedContent.length : 0,
					},
				},
			};

			// Create evidence record
			const { data: evidenceData, error: evidenceError } = await serviceSupabase
				.from("evidence")
				.insert(evidenceRecord)
				.select(
					`
          *,
          scf_control:scf_controls(id, title, description)
        `,
				)
				.single();

			if (evidenceError) {
				logger.error("evidence.post.db_insert_failed", {
					message: evidenceError.message,
				});
				// Cleanup uploaded file if database insert fails
				await serviceSupabase.storage
					.from("compliance-documents")
					.remove([finalFilePath]);

				return NextResponse.json(
					{
						error: `Failed to create evidence record: ${evidenceError.message}`,
					},
					{ status: 500 },
				);
			}

			logger.info("evidence.post.evidence_created", {
				evidenceId: evidenceData.id,
			});

			// Trigger AI assessment directly
			logger.info("evidence.post.assessment_started");
			let assessmentResult = null;

			try {
				// Run AI assessment
				const aiAssessment = await assessEvidence(
					evidenceData.id,
					evidenceData.scf_control_id,
					evidenceData.file_path,
					evidenceData.file_type,
				);

				logger.info("evidence.post.assessment_completed");

				// Create user_assessment record using service client to bypass RLS
				const { data: assessmentData, error: assessmentError } =
					await serviceSupabase
						.from("assessments")
						.insert({
							user_id: user.id,
							scf_control_id: evidenceData.scf_control_id,
							assessment_type: "manual",
							assessment_method: "ai_assisted",
							assessment_status: "completed",
							assessment_result: aiAssessment.overall_result,
							confidence_level:
								aiAssessment.overall_confidence >= 0.8
									? "high"
									: aiAssessment.overall_confidence >= 0.5
										? "medium"
										: "low",
							assessment_notes: aiAssessment.summary,
							assessment_summary: aiAssessment.summary,
							evidence_id: evidenceData.id,
							ai_reasoning: aiAssessment.summary,
							recommendations: aiAssessment.recommendations,
							metadata: {
								ai_generated: true,
								confidence: aiAssessment.overall_confidence,
								objective_results: aiAssessment.objective_results,
								recommendations: aiAssessment.recommendations,
								assessment_timestamp: new Date().toISOString(),
							},
							completed_at: new Date().toISOString(),
						})
						.select()
						.single();

				if (assessmentError) {
					logger.warn("evidence.post.assessment_persist_failed", {
						message: assessmentError.message,
					});
				} else {
					// Create evidence-assessment link
					await serviceSupabase.from("evidence_assessment_links").insert({
						evidence_id: evidenceData.id,
						assessment_id: assessmentData.id,
						link_type: "primary",
						relevance_score: aiAssessment.overall_confidence * 10,
						created_by: user.id,
						metadata: {
							ai_generated: true,
							assessment_type: "automated",
						},
					});

					// Update evidence status
					await serviceSupabase
						.from("evidence")
						.update({
							evidence_status: "under_review",
							metadata: {
								...evidenceData.metadata,
								ai_assessed: true,
								last_assessment: new Date().toISOString(),
							},
						})
						.eq("id", evidenceData.id);

					assessmentResult = {
						id: assessmentData.id,
						overall_result: aiAssessment.overall_result,
						overall_confidence: aiAssessment.overall_confidence,
						summary: aiAssessment.summary,
					};

					logger.info("evidence.post.assessment_saved");
				}
			} catch (assessmentError) {
				logger.warn("evidence.post.assessment_failed", {
					message:
						assessmentError instanceof Error
							? assessmentError.message
							: "unknown",
				});
				// Don't fail the upload if assessment fails
			}

			return NextResponse.json({
				success: true,
				evidence: evidenceData,
				assessment: assessmentResult,
				message: assessmentResult
					? "Evidence uploaded and assessed successfully"
					: "Evidence uploaded successfully (assessment failed)",
			});
		} catch (error) {
			logger.error("evidence.post.unexpected", {
				message: error instanceof Error ? error.message : "unknown",
			});
			throw error;
		}
	} catch (error) {
		logger.error("evidence.post.failed", {
			message: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to upload evidence",
			},
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	const requestId = getOrCreateRequestId(request);
	const logger = createRequestLogger(requestId);

	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const evidenceId = searchParams.get("id");

		if (!evidenceId) {
			return NextResponse.json(
				{ error: "Evidence ID is required" },
				{ status: 400 },
			);
		}

		const body = await request.json();
		const { evidence_status, description, rejection_reason } = body;

		// Validate the user owns this evidence or has review permissions
		const { data: evidenceCheck, error: checkError } = await supabase
			.from("evidence")
			.select("user_id, evidence_status")
			.eq("id", evidenceId)
			.single();

		if (checkError || !evidenceCheck) {
			return NextResponse.json(
				{ error: "Evidence not found" },
				{ status: 404 },
			);
		}

		if (evidenceCheck.user_id !== user.id) {
			return NextResponse.json(
				{ error: "Unauthorized to update this evidence" },
				{ status: 403 },
			);
		}

		// Prepare update data
		const updateData: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};

		if (evidence_status) {
			updateData.evidence_status = evidence_status;

			if (evidence_status === "under_review") {
				updateData.reviewed_by = user.id;
				updateData.reviewed_at = new Date().toISOString();
			} else if (evidence_status === "approved") {
				updateData.approved_by = user.id;
				updateData.approved_at = new Date().toISOString();
			} else if (evidence_status === "rejected") {
				updateData.rejection_reason = rejection_reason;
				updateData.reviewed_by = user.id;
				updateData.reviewed_at = new Date().toISOString();
			}
		}

		if (description !== undefined) {
			updateData.description = description;
		}

		// Update evidence record
		const { data: updatedEvidence, error: updateError } = await supabase
			.from("evidence")
			.update(updateData)
			.eq("id", evidenceId)
			.select(
				`
        *,
        submitted_by,
        reviewed_by,
        approved_by,
        scf_control:scf_controls(id, title, description)
      `,
			)
			.single();

		if (updateError) {
			logger.error("evidence.put.update_failed", {
				message: updateError.message,
			});
			return NextResponse.json(
				{ error: "Failed to update evidence" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			evidence: updatedEvidence,
			message: "Evidence updated successfully",
		});
	} catch (error) {
		logger.error("evidence.put.failed", {
			message: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	const requestId = getOrCreateRequestId(request);
	const logger = createRequestLogger(requestId);

	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const evidenceId = searchParams.get("id");

		if (!evidenceId) {
			return NextResponse.json(
				{ error: "Evidence ID is required" },
				{ status: 400 },
			);
		}

		// Get evidence details including file path
		const { data: evidence, error: fetchError } = await supabase
			.from("evidence")
			.select("user_id, file_path, evidence_status")
			.eq("id", evidenceId)
			.single();

		if (fetchError || !evidence) {
			return NextResponse.json(
				{ error: "Evidence not found" },
				{ status: 404 },
			);
		}

		if (evidence.user_id !== user.id) {
			return NextResponse.json(
				{ error: "Unauthorized to delete this evidence" },
				{ status: 403 },
			);
		}

		// Prevent deletion of approved evidence
		if (evidence.evidence_status === "approved") {
			return NextResponse.json(
				{
					error:
						"Cannot delete approved evidence. Please contact an administrator.",
				},
				{ status: 400 },
			);
		}

		// Delete file from storage
		if (evidence.file_path) {
			const { error: storageError } = await supabase.storage
				.from("compliance-documents")
				.remove([evidence.file_path]);

			if (storageError) {
				logger.warn("evidence.delete.storage_delete_failed", {
					message: storageError.message,
				});
				// Continue with database deletion even if file deletion fails
			}
		}

		// Delete evidence record (this will cascade to evidence_assessment_links)
		const { error: deleteError } = await supabase
			.from("evidence")
			.delete()
			.eq("id", evidenceId);

		if (deleteError) {
			logger.error("evidence.delete.db_delete_failed", {
				message: deleteError.message,
			});
			return NextResponse.json(
				{ error: "Failed to delete evidence" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Evidence deleted successfully",
		});
	} catch (error) {
		logger.error("evidence.delete.failed", {
			message: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

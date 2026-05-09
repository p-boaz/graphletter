export interface AssessmentObjectiveResult {
	scf_ao_id?: string;
	assessment_objective?: string;
	assessment_procedure?: string;
	expected_results?: string;
	result: string;
	confidence: number;
	reasoning: string;
	gaps?: string[];
	recommendations?: string[];
}

export interface MaturityAssessment {
	assessed_level: number;
	confidence: number;
	rationale: string;
	target_level?: number | null;
	target_met?: boolean | null;
	target_gap?: number | null;
	referenced_level_description?: string | null;
	recommended_actions?: string[];
}

export interface MaturityLevels {
	level_0_description?: string | null;
	level_1_description?: string | null;
	level_2_description?: string | null;
	level_3_description?: string | null;
	level_4_description?: string | null;
	level_5_description?: string | null;
}

export interface AssessmentResult {
	id: string;
	scf_control_id: string;
	overall_result: "pass" | "fail" | "partial" | "not_applicable";
	overall_confidence: number;
	summary: string;
	control_title?: string;
	control_description?: string;
	control_guidance?: string;
	domain_name?: string;
	objective_results?: AssessmentObjectiveResult[];
	maturity_assessment?: MaturityAssessment | null;
	maturity_levels?: MaturityLevels | null;
}

export interface SmartUploadResult {
	evidence: {
		id: string;
		file_name: string;
		evidence_status: string;
	};
	discovered_controls: string[];
	assessments: AssessmentResult[];
	documentation_artifact: string;
}

export interface UploadOnlyResult {
	success?: boolean;
	message?: string;
	evidence: {
		id: string;
		file_name: string;
		evidence_status: string;
	};
	evidence_records: Array<{
		id: string;
		scf_control_id: string;
		file_name: string;
	}>;
	discovered_controls: string[];
	controls_details: Array<{
		scf_control_id: string;
		erl_id: string;
		title: string;
		description: string;
	}>;
	documentation_artifact: string;
	awaiting_assessment: boolean;
	version_info?: Record<string, unknown>;
	graph_document?: {
		id: string;
	};
	graph_extraction?: {
		chunkCount: number;
		createdAtomCount: number;
		mappedCount: number;
		atomIds: string[];
		quality?: "ready" | "limited";
		content_length?: number;
		requested_extraction?: boolean;
		executed_extraction?: boolean;
		limited_reason?: string | null;
	};
	graph_mapping?: {
		mapped_atoms: number;
		mapped_controls: number;
		mapping_records: number;
		mapping_skipped?: boolean;
		skip_reason?: string;
	};
}

export interface ExtractContentResult {
	success?: boolean;
	content: string;
	imageData?: { base64: string; mimeType: string } | null;
	fileName: string;
	fileType: string;
	fileSize: number;
}

export interface UploadWorkflowOptions {
	file: File;
	evidenceType: string;
	description: string;
	documentationArtifact: string;
	versionAction?: "replace" | "keep_both" | null;
	existingEvidence?: { id: string; version: number } | null;
}

export interface UploadWorkflowResult {
	extract: ExtractContentResult;
	upload: UploadOnlyResult;
}

export interface AssessmentWorkflowOptions {
	evidenceIds: string[];
	fileContent: string;
	imageData: { base64: string; mimeType: string } | null;
}

export interface AssessmentWorkflowResponse {
	success: boolean;
	assessments: AssessmentResult[];
	assessed_controls: number;
	requested_controls?: number;
	failed_controls?: Array<{
		control_id: string;
		error: string;
	}>;
	message: string;
}

function buildProgressHeaders(
	sessionId: string | null,
): Record<string, string> {
	return sessionId ? { "x-progress-session": sessionId } : {};
}

async function handleResponse(response: Response) {
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(payload.error || payload.message || "Request failed");
	}
	return payload;
}

interface GraphContentAssessment {
	isUsable: boolean;
	reason: "empty_content" | "extraction_failed" | null;
	contentLength: number;
	normalizedContent: string;
}

const EXTRACTION_FAILURE_MARKERS = [
	"content extraction failed",
	"could not be extracted",
	"contains no extractable text",
	"text extraction failed",
	"unsupported format",
];

export function assessExtractedGraphContent(
	content: string,
): GraphContentAssessment {
	const normalizedContent = content.trim();
	const contentLength = normalizedContent.length;

	if (contentLength === 0) {
		return {
			isUsable: false,
			reason: "empty_content",
			contentLength,
			normalizedContent,
		};
	}

	const lowerContent = normalizedContent.toLowerCase();
	const hasFailureMarker = EXTRACTION_FAILURE_MARKERS.some((marker) =>
		lowerContent.includes(marker),
	);

	if (hasFailureMarker) {
		return {
			isUsable: false,
			reason: "extraction_failed",
			contentLength,
			normalizedContent,
		};
	}

	return {
		isUsable: true,
		reason: null,
		contentLength,
		normalizedContent,
	};
}

export function createSmartEvidenceWorkflowClient(sessionId: string | null) {
	return {
		async runUploadWorkflow(
			options: UploadWorkflowOptions,
		): Promise<UploadWorkflowResult> {
			const extractForm = new FormData();
			extractForm.append("file", options.file);

			const extractResponse = await fetch("/api/evidence/extract-content", {
				method: "POST",
				body: extractForm,
				headers: buildProgressHeaders(sessionId),
			});

			const extractResult = (await handleResponse(
				extractResponse,
			)) as ExtractContentResult;
			const graphContent = assessExtractedGraphContent(extractResult.content);

			const uploadForm = new FormData();
			uploadForm.append("file", options.file);
			uploadForm.append("evidence_type", options.evidenceType);
			uploadForm.append(
				"description",
				options.description || `Evidence for ${options.documentationArtifact}`,
			);
			uploadForm.append(
				"documentation_artifact",
				options.documentationArtifact,
			);

			if (options.versionAction === "replace" && options.existingEvidence) {
				uploadForm.append("is_version_replacement", "true");
				uploadForm.append("replaces_evidence_id", options.existingEvidence.id);
				uploadForm.append(
					"new_version",
					String(options.existingEvidence.version + 1),
				);
			}

			const uploadResponse = await fetch("/api/evidence/upload-only", {
				method: "POST",
				body: uploadForm,
				headers: buildProgressHeaders(sessionId),
			});

			const uploadResult = (await handleResponse(
				uploadResponse,
			)) as UploadOnlyResult;

			const documentResponse = await fetch("/api/documents", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildProgressHeaders(sessionId),
				},
				body: JSON.stringify({
					sourceEvidenceId: uploadResult.evidence.id,
					content: graphContent.isUsable ? graphContent.normalizedContent : "",
					extractEvidence: graphContent.isUsable,
					metadata: {
						documentation_artifact: options.documentationArtifact,
						evidence_type: options.evidenceType,
						graph_content_quality: {
							usable: graphContent.isUsable,
							reason: graphContent.reason,
							content_length: graphContent.contentLength,
						},
					},
				}),
			});

			const documentPayload = (await handleResponse(documentResponse)) as {
				document?: { id?: string };
				extraction?: UploadOnlyResult["graph_extraction"];
			};
			const documentId = documentPayload.document?.id as string | undefined;
			const extractionPayload = documentPayload.extraction;
			const atomCount = extractionPayload?.atomIds?.length || 0;
			const canMapControls =
				Boolean(documentId) &&
				graphContent.isUsable &&
				atomCount > 0 &&
				uploadResult.discovered_controls.length > 0;

			if (canMapControls && documentId) {
				const mapControlsResponse = await fetch("/api/evidence/map-controls", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...buildProgressHeaders(sessionId),
					},
					body: JSON.stringify({
						documentId,
						scfControlIds: uploadResult.discovered_controls,
						mappingMethod: "rule",
						coverageStrength: "moderate",
						rationale: "Mapped from artifact-driven upload flow.",
					}),
				});

				const mapControlsPayload = await handleResponse(mapControlsResponse);
				uploadResult.graph_mapping = {
					mapped_atoms: mapControlsPayload.mapped_atoms || 0,
					mapped_controls: mapControlsPayload.mapped_controls || 0,
					mapping_records: mapControlsPayload.mapping_records || 0,
				};
			} else {
				uploadResult.graph_mapping = {
					mapped_atoms: 0,
					mapped_controls: 0,
					mapping_records: 0,
					mapping_skipped: true,
					skip_reason: !graphContent.isUsable
						? `graph_content_${graphContent.reason || "limited"}`
						: atomCount === 0
							? "no_atoms_created"
							: "no_discovered_controls",
				};
			}

			uploadResult.graph_document = documentId ? { id: documentId } : undefined;
			uploadResult.graph_extraction = {
				...extractionPayload,
				chunkCount: extractionPayload?.chunkCount || 0,
				createdAtomCount: extractionPayload?.createdAtomCount || 0,
				mappedCount: extractionPayload?.mappedCount || 0,
				atomIds: extractionPayload?.atomIds || [],
				quality:
					extractionPayload?.quality ||
					(graphContent.isUsable ? "ready" : "limited"),
				content_length:
					extractionPayload?.content_length ?? graphContent.contentLength,
				requested_extraction:
					extractionPayload?.requested_extraction ?? graphContent.isUsable,
				executed_extraction:
					extractionPayload?.executed_extraction ?? graphContent.isUsable,
				limited_reason:
					extractionPayload?.limited_reason ??
					(graphContent.reason ? `graph_content_${graphContent.reason}` : null),
			};

			return {
				extract: extractResult,
				upload: uploadResult,
			};
		},

		async runAssessmentWorkflow(
			options: AssessmentWorkflowOptions,
		): Promise<AssessmentWorkflowResponse> {
			const assessmentResponse = await fetch("/api/evidence/assess-uploaded", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildProgressHeaders(sessionId),
				},
				body: JSON.stringify({
					evidenceIds: options.evidenceIds,
					fileContent: options.fileContent,
					imageData: options.imageData,
				}),
			});

			const assessmentResult = await handleResponse(assessmentResponse);

			// Keep graph-native reporting materialized after every assessment run.
			await Promise.allSettled([
				fetch("/api/analysis/run-gap-analysis", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...buildProgressHeaders(sessionId),
					},
					body: JSON.stringify({}),
				}),
				fetch("/api/controls/build-coverage", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...buildProgressHeaders(sessionId),
					},
					body: JSON.stringify({ includeControls: false }),
				}),
			]);

			return assessmentResult as AssessmentWorkflowResponse;
		},
	};
}

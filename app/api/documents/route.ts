import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
	chunkAndBootstrapDocument,
	resolveEvidenceContent,
} from "@/lib/graph/service";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

interface CreateDocumentBody {
	sourceEvidenceId?: string;
	content?: string;
	fileName?: string;
	fileType?: string;
	fileSize?: number;
	storagePath?: string;
	metadata?: Record<string, unknown>;
	extractEvidence?: boolean;
}

interface EvidenceRecord {
	id: string;
	user_id: string;
	scf_control_id: string | null;
	file_name: string | null;
	file_type: string | null;
	file_size: number | null;
	file_path: string | null;
	storage_path: string | null;
	extracted_content: string | null;
	processed_content: string | null;
	evidence_data: unknown;
}

function buildSourceHash(content: string): string | null {
	if (!content) {
		return null;
	}

	return createHash("sha256").update(content).digest("hex");
}

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const limit = Math.min(
			parseInt(searchParams.get("limit") || "50", 10),
			200,
		);
		const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

		const {
			data: documents,
			error,
			count,
		} = await supabase
			.from("documents")
			.select("*", { count: "exact" })
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			documents: documents || [],
			total: count || 0,
			limit,
			offset,
			hasMore: offset + limit < (count || 0),
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to fetch documents",
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as CreateDocumentBody;
		let sourceEvidence: EvidenceRecord | null = null;

		if (body.sourceEvidenceId) {
			const { data: evidence, error: evidenceError } = await supabase
				.from("evidence")
				.select(
					"id, user_id, scf_control_id, file_name, file_type, file_size, file_path, storage_path, extracted_content, processed_content, evidence_data",
				)
				.eq("id", body.sourceEvidenceId)
				.eq("user_id", user.id)
				.maybeSingle();

			if (evidenceError) {
				return NextResponse.json(
					{ error: evidenceError.message },
					{ status: 500 },
				);
			}

			if (!evidence) {
				return NextResponse.json(
					{ error: "Source evidence not found" },
					{ status: 404 },
				);
			}

			sourceEvidence = evidence as EvidenceRecord;
		}

		const content =
			body.content ??
			(sourceEvidence ? resolveEvidenceContent(sourceEvidence) : "");
		const normalizedContent = content.trim();
		const contentLength = normalizedContent.length;
		const sourceHash = buildSourceHash(content);
		const extractionRequested = body.extractEvidence ?? true;

		const baseDocumentPayload = {
			user_id: user.id,
			source_evidence_id: sourceEvidence?.id ?? null,
			file_name: body.fileName ?? sourceEvidence?.file_name ?? null,
			file_type: body.fileType ?? sourceEvidence?.file_type ?? null,
			file_size: body.fileSize ?? sourceEvidence?.file_size ?? null,
			storage_path:
				body.storagePath ??
				sourceEvidence?.storage_path ??
				sourceEvidence?.file_path ??
				null,
			source_hash: sourceHash,
			ingestion_status: content ? "processed" : "pending",
			metadata: {
				...(body.metadata || {}),
				source: sourceEvidence ? "evidence" : "manual",
				graph_content_length: contentLength,
			},
		};

		let documentId: string;

		if (sourceEvidence?.id) {
			const { data: docRows, error: docError } = await supabase
				.from("documents")
				.upsert(baseDocumentPayload, { onConflict: "source_evidence_id" })
				.select("id")
				.single();

			if (docError || !docRows?.id) {
				return NextResponse.json(
					{ error: docError?.message || "Failed to upsert document" },
					{ status: 500 },
				);
			}

			documentId = docRows.id as string;
		} else {
			const { data: docRows, error: docError } = await supabase
				.from("documents")
				.insert(baseDocumentPayload)
				.select("id")
				.single();

			if (docError || !docRows?.id) {
				return NextResponse.json(
					{ error: docError?.message || "Failed to create document" },
					{ status: 500 },
				);
			}

			documentId = docRows.id as string;
		}

		const shouldExtractEvidence = extractionRequested && contentLength > 0;
		let extraction = {
			chunkCount: 0,
			createdAtomCount: 0,
			mappedCount: 0,
			atomIds: [] as string[],
			quality: contentLength > 0 ? ("ready" as const) : ("limited" as const),
			content_length: contentLength,
			requested_extraction: extractionRequested,
			executed_extraction: false,
			limited_reason: contentLength > 0 ? null : "empty_content",
		};

		if (shouldExtractEvidence) {
			const extractionResult = await chunkAndBootstrapDocument({
				supabase,
				documentId,
				userId: user.id,
				content,
				scfControlId: sourceEvidence?.scf_control_id,
			});
			extraction = {
				...extraction,
				...extractionResult,
				executed_extraction: true,
				limited_reason: null,
			};
		}

		return NextResponse.json({
			success: true,
			document: {
				id: documentId,
			},
			extraction,
			source_evidence_id: sourceEvidence?.id ?? null,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to create document",
			},
			{ status: 500 },
		);
	}
}

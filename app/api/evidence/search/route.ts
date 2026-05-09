import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type SearchType = "all" | "content" | "metadata";

interface EvidenceSearchParams {
	query: string;
	searchType: SearchType;
	includeContent: boolean;
	limit: number;
	offset: number;
	status?: string | null;
	evidenceType?: string | null;
	advanced?: boolean;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface EvidenceSearchRow extends Record<string, unknown> {
	extracted_content?: string | null;
}

function escapeLikeTerm(value: string): string {
	return value.replace(/[\\%_]/g, "\\$&");
}

async function runEvidenceSearch(
	supabase: SupabaseServerClient,
	userId: string,
	params: EvidenceSearchParams,
) {
	const normalizedLimit = Math.min(
		200,
		Math.max(1, Number(params.limit) || 50),
	);
	const normalizedOffset = Math.max(0, Number(params.offset) || 0);
	const escapedQuery = escapeLikeTerm(params.query);

	let baseSelect = `
    id,
    file_name,
    file_type,
    file_size,
    description,
    evidence_type,
    evidence_status,
    version,
    created_at,
    updated_at,
    content_extraction_status,
    content_extracted_at,
    scf_control:scf_controls(id, title, description),
    erl_global_id
  `;

	if (params.includeContent) {
		baseSelect += ", extracted_content";
	}

	let searchQuery = supabase
		.from("evidence")
		.select(baseSelect)
		.eq("user_id", userId);

	if (params.searchType === "content") {
		if (params.advanced) {
			const tsquery = params.query
				.split(/\s+/)
				.map((term) => term.trim())
				.filter(Boolean)
				.join(" | ");
			searchQuery = searchQuery
				.not("extracted_content", "is", null)
				.neq("content_extraction_status", "failed")
				.textSearch("extracted_content", tsquery, { type: "plain" });
		} else {
			searchQuery = searchQuery
				.not("extracted_content", "is", null)
				.textSearch("extracted_content", params.query, { type: "websearch" });
		}
	} else if (params.searchType === "metadata") {
		searchQuery = searchQuery.or(
			`file_name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`,
		);
	} else {
		searchQuery = searchQuery.or(
			`file_name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,extracted_content.ilike.%${escapedQuery}%`,
		);
	}

	if (params.status) {
		searchQuery = searchQuery.eq("evidence_status", params.status);
	}
	if (params.evidenceType) {
		searchQuery = searchQuery.eq("evidence_type", params.evidenceType);
	}

	searchQuery = searchQuery
		.order("created_at", { ascending: false })
		.range(normalizedOffset, normalizedOffset + normalizedLimit - 1);

	const { data: evidence, error } = await searchQuery;
	if (error) {
		throw new Error(`Search failed: ${error.message}`);
	}

	const typedEvidence = (evidence || []) as unknown as EvidenceSearchRow[];
	const highlightedResults = typedEvidence.map((item: EvidenceSearchRow) => {
		if (!params.includeContent || !item.extracted_content) {
			return item;
		}
		const content = String(item.extracted_content);
		const queryLower = params.query.toLowerCase();
		const contentLower = content.toLowerCase();
		const matchIndex = contentLower.indexOf(queryLower);
		if (matchIndex === -1) {
			return {
				...item,
				search_highlight: {
					snippet: null,
					match_position: -1,
					has_match: false,
				},
			};
		}

		const contextStart = Math.max(0, matchIndex - 100);
		const contextEnd = Math.min(
			content.length,
			matchIndex + params.query.length + 100,
		);
		return {
			...item,
			search_highlight: {
				snippet: content.substring(contextStart, contextEnd),
				match_position: matchIndex,
				has_match: true,
			},
		};
	});

	const { count } = await supabase
		.from("evidence")
		.select("*", { count: "estimated", head: true })
		.eq("user_id", userId);

	return {
		results: highlightedResults,
		pagination: {
			total: count,
			limit: normalizedLimit,
			offset: normalizedOffset,
			hasMore: normalizedOffset + normalizedLimit < (count || 0),
		},
	};
}

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q") || searchParams.get("query");
		if (!query) {
			return NextResponse.json(
				{ error: "Search query is required" },
				{ status: 400 },
			);
		}

		const searchType = (searchParams.get("type") || "all") as SearchType;
		const includeContent = searchParams.get("include_content") === "true";
		const limit = parseInt(searchParams.get("limit") || "50", 10);
		const offset = parseInt(searchParams.get("offset") || "0", 10);
		const status = searchParams.get("status");
		const evidenceType = searchParams.get("evidence_type");

		const payload = await runEvidenceSearch(supabase, user.id, {
			query,
			searchType:
				searchType === "content" || searchType === "metadata"
					? searchType
					: "all",
			includeContent,
			limit,
			offset,
			status,
			evidenceType,
			advanced: false,
		});

		return NextResponse.json({
			success: true,
			query,
			search_type: searchType,
			results: payload.results,
			pagination: payload.pagination,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Search failed" },
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

		const body = await request.json();
		const query = body?.query;
		if (!query || typeof query !== "string") {
			return NextResponse.json(
				{ error: "Search query is required" },
				{ status: 400 },
			);
		}

		const searchType = (body.search_type || "all") as SearchType;
		const includeContent = Boolean(body.include_content);
		const limit = Number(body.limit ?? 50);
		const offset = Number(body.offset ?? 0);
		const filters = body.filters || {};

		const payload = await runEvidenceSearch(supabase, user.id, {
			query,
			searchType:
				searchType === "content" || searchType === "metadata"
					? searchType
					: "all",
			includeContent,
			limit,
			offset,
			status: filters.status ?? null,
			evidenceType: filters.evidence_type ?? null,
			advanced: Boolean(body.advanced),
		});

		return NextResponse.json({
			success: true,
			query,
			search_type: searchType,
			advanced: Boolean(body.advanced),
			results: payload.results,
			pagination: payload.pagination,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Search failed" },
			{ status: 500 },
		);
	}
}

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const limit = parseInt(searchParams.get("limit") || "50");
		const offset = parseInt(searchParams.get("offset") || "0");
		const controlId = searchParams.get("control_id");
		const status = searchParams.get("status");
		const documentationArtifact = searchParams.get("documentation_artifact");

		let query = supabase
			.from("evidence")
			.select(`
        id,
        erl_id,
        erl_global_id,
        scf_control_id,
        evidence_type,
        file_name,
        file_path,
        file_size,
        file_type,
        description,
        evidence_status,
        submitted_at,
        created_at,
        updated_at,
        metadata,
        evidence_group_id,
        version,
        replaces_evidence_id,
        outdated_at,
        outdated_by
      `)
			.eq("user_id", user.id)
			.order("submitted_at", { ascending: false })
			.range(offset, offset + limit - 1);

		// Apply filters
		if (controlId) {
			query = query.eq("scf_control_id", controlId);
		}
		if (status) {
			query = query.eq("evidence_status", status);
		}
		if (documentationArtifact) {
			query = query.eq(
				"metadata->>documentation_artifact",
				documentationArtifact,
			);
		}

		const { data: evidence, error } = await query;

		if (error) {
			console.error("Error fetching evidence history:", error);
			return NextResponse.json(
				{ error: "Failed to fetch evidence history" },
				{ status: 500 },
			);
		}

		// Get summary statistics
		let statsQuery = supabase
			.from("evidence")
			.select("evidence_status, scf_control_id, version, metadata")
			.eq("user_id", user.id);

		// Apply same filters to stats
		if (controlId) {
			statsQuery = statsQuery.eq("scf_control_id", controlId);
		}
		if (status) {
			statsQuery = statsQuery.eq("evidence_status", status);
		}
		if (documentationArtifact) {
			statsQuery = statsQuery.eq(
				"metadata->>documentation_artifact",
				documentationArtifact,
			);
		}

		const { data: statsData } = await statsQuery;

		const stats = {
			total: statsData?.length || 0,
			by_status:
				statsData?.reduce((acc: Record<string, number>, item) => {
					acc[item.evidence_status] = (acc[item.evidence_status] || 0) + 1;
					return acc;
				}, {}) || {},
			unique_controls:
				new Set(statsData?.map((item) => item.scf_control_id)).size || 0,
			version_info:
				documentationArtifact && statsData
					? {
							versions: [
								...new Set(statsData.map((item) => item.version || 1)),
							].sort((a, b) => b - a),
							latest_version: Math.max(
								...statsData.map((item) => item.version || 1),
							),
							total_versions: new Set(
								statsData.map((item) => item.version || 1),
							).size,
						}
					: null,
		};

		return NextResponse.json({
			success: true,
			evidence: evidence || [],
			stats,
			pagination: {
				total: evidence?.length || 0,
				limit,
				offset,
				hasMore: offset + limit < (evidence?.length || 0),
			},
		});
	} catch (error) {
		console.error("Error in evidence history API:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

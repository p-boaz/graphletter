import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const controlId = searchParams.get("control_id");
		const areaOfFocus = searchParams.get("area_of_focus");
		const limit = searchParams.get("limit");

		// Use the new junction table with proper JOINs instead of the old array-based view
		let query = supabase
			.from("scf_control_evidence_mappings")
			.select(`
        scf_evidence_request_list!inner(
          erl_id,
          area_of_focus,
          documentation_artifact,
          artifact_description,
          scf_version,
          created_at
        ),
        relationship_type,
        priority,
        is_active
      `)
			.eq("is_active", true);

		// Filter by specific control ID
		if (controlId) {
			query = query.eq("scf_control_id", controlId);
		}

		// Filter by area of focus (need to filter on the joined table)
		if (areaOfFocus) {
			query = query.eq("scf_evidence_request_list.area_of_focus", areaOfFocus);
		}

		// Apply limit
		if (limit) {
			query = query.limit(parseInt(limit));
		}

		// Order by priority, then area of focus and ERL ID
		query = query
			.order("priority")
			.order("scf_evidence_request_list.area_of_focus")
			.order("scf_evidence_request_list.erl_id");

		const { data: evidenceRequests, error } = await query;

		if (error) {
			console.error("Error fetching evidence requests:", error);
			return NextResponse.json(
				{ error: "Failed to fetch evidence requests" },
				{ status: 500 },
			);
		}

		// Transform the data to match the expected format (flatten the joined structure)
		const transformedData =
			evidenceRequests?.map((item) => ({
				...item.scf_evidence_request_list,
				relationship_type: item.relationship_type,
				priority: item.priority,
			})) || [];

		return NextResponse.json(transformedData);
	} catch (error) {
		console.error("Error in evidence requests API:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// Get evidence request statistics
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { control_ids } = body;

		if (!control_ids || !Array.isArray(control_ids)) {
			return NextResponse.json(
				{ error: "control_ids array is required" },
				{ status: 400 },
			);
		}

		// Get evidence request counts per control using the new junction table
		const { data: stats, error } = await supabase
			.from("scf_control_evidence_mappings")
			.select(`
        scf_control_id,
        scf_evidence_request_list!inner(
          erl_id,
          area_of_focus
        )
      `)
			.in("scf_control_id", control_ids)
			.eq("is_active", true);

		if (error) {
			console.error("Error fetching evidence stats:", error);
			return NextResponse.json(
				{ error: "Failed to fetch evidence statistics" },
				{ status: 500 },
			);
		}

		// Group by control ID and calculate stats
		interface ControlStats {
			total_evidence_requests: number;
			areas_of_focus: Set<string>;
			evidence_ids: Set<string>;
		}

		const statsByControl =
			stats?.reduce((acc: Record<string, ControlStats>, item) => {
				const controlId = item.scf_control_id;
				const evidenceData = Array.isArray(item.scf_evidence_request_list)
					? item.scf_evidence_request_list[0]
					: item.scf_evidence_request_list;

				if (!acc[controlId]) {
					acc[controlId] = {
						total_evidence_requests: 0,
						areas_of_focus: new Set(),
						evidence_ids: new Set(),
					};
				}

				acc[controlId].total_evidence_requests++;
				if (evidenceData) {
					acc[controlId].areas_of_focus.add(evidenceData.area_of_focus);
					acc[controlId].evidence_ids.add(evidenceData.erl_id);
				}

				return acc;
			}, {}) || {};

		// Convert sets to counts
		interface FormattedStats {
			total_evidence_requests: number;
			unique_areas_count: number;
			unique_evidence_count: number;
			areas_of_focus: string[];
		}

		const formattedStats = Object.keys(statsByControl).reduce(
			(acc: Record<string, FormattedStats>, controlId) => {
				const stats = statsByControl[controlId];
				acc[controlId] = {
					total_evidence_requests: stats.total_evidence_requests,
					unique_areas_count: stats.areas_of_focus.size,
					unique_evidence_count: stats.evidence_ids.size,
					areas_of_focus: Array.from(stats.areas_of_focus),
				};
				return acc;
			},
			{},
		);

		return NextResponse.json(formattedStats);
	} catch (error) {
		console.error("Error in evidence statistics API:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

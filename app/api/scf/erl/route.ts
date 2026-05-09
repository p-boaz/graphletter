import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MappingRow {
	scf_control_id: string;
	relationship_type?: string;
	priority?: number;
}

interface ERLListRow {
	id: string;
	erl_id: string;
	area_of_focus: string | null;
	documentation_artifact: string;
	artifact_description: string | null;
	scf_control_evidence_mappings?: MappingRow[];
}

interface ERLFilteredRow {
	scf_evidence_request_list: {
		id: string;
		erl_id: string;
		area_of_focus: string | null;
		documentation_artifact: string;
		artifact_description: string | null;
	};
	relationship_type?: string;
	priority?: number;
}

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { searchParams } = new URL(request.url);

		const controlId = searchParams.get("control_id");
		const limit = parseInt(searchParams.get("limit") || "100");
		const offset = parseInt(searchParams.get("offset") || "0");

		let erlItems;
		let error;
		let count;

		if (controlId) {
			// Use the new junction table to find ERL items that map to this control
			const {
				data,
				error: queryError,
				count: queryCount,
			} = await supabase
				.from("scf_control_evidence_mappings")
				.select(
					`
          scf_evidence_request_list!inner(
            id,
            erl_id,
            area_of_focus,
            documentation_artifact,
            artifact_description
          ),
          relationship_type,
          priority
          `,
					{ count: "exact" },
				)
				.eq("scf_control_id", controlId)
				.eq("is_active", true)
				.order("priority", { ascending: true })
				.order("scf_evidence_request_list.erl_id", { ascending: true })
				.range(offset, offset + limit - 1);

			erlItems = data;
			error = queryError;
			count = queryCount;
		} else {
			// Get all evidence requests with their control mappings
			const {
				data,
				error: queryError,
				count: queryCount,
			} = await supabase
				.from("scf_evidence_request_list")
				.select(
					`
          id,
          erl_id,
          area_of_focus,
          documentation_artifact,
          artifact_description,
          scf_control_evidence_mappings!inner(
            scf_control_id,
            relationship_type,
            priority
          )
          `,
					{ count: "exact" },
				)
				.order("erl_id", { ascending: true })
				.range(offset, offset + limit - 1);

			erlItems = data;
			error = queryError;
			count = queryCount;
		}

		if (error) {
			console.error("Error fetching ERL items:", error);
			return NextResponse.json(
				{ error: "Failed to fetch evidence requirements" },
				{ status: 500 },
			);
		}

		// Transform the data to ensure consistent format
		const transformedItems = (
			(erlItems || []) as (ERLListRow | ERLFilteredRow)[]
		).map((item) => {
			if (controlId) {
				const filteredItem = item as ERLFilteredRow;
				// Data structure from junction table query
				return {
					id: filteredItem.scf_evidence_request_list.id,
					erl_id: filteredItem.scf_evidence_request_list.erl_id,
					area_of_focus: filteredItem.scf_evidence_request_list.area_of_focus,
					documentation_artifact:
						filteredItem.scf_evidence_request_list.documentation_artifact,
					artifact_description:
						filteredItem.scf_evidence_request_list.artifact_description,
					scf_control_mappings: [controlId], // This item maps to the filtered control
					relationship_type: filteredItem.relationship_type,
					priority: filteredItem.priority,
				};
			} else {
				const listItem = item as ERLListRow;
				// Data structure from evidence request list with mappings
				return {
					id: listItem.id,
					erl_id: listItem.erl_id,
					area_of_focus: listItem.area_of_focus,
					documentation_artifact: listItem.documentation_artifact,
					artifact_description: listItem.artifact_description,
					scf_control_mappings:
						listItem.scf_control_evidence_mappings?.map(
							(m) => m.scf_control_id,
						) || [],
					// Add relationship metadata if available
					control_mappings:
						listItem.scf_control_evidence_mappings?.map((m) => ({
							scf_control_id: m.scf_control_id,
							relationship_type: m.relationship_type,
							priority: m.priority,
						})) || [],
				};
			}
		});

		return NextResponse.json({
			success: true,
			erl_items: transformedItems,
			total: count || transformedItems.length,
			limit,
			offset,
			hasMore: offset + limit < (count || transformedItems.length),
		});
	} catch (error) {
		console.error("Error in ERL API:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

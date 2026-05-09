import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/database/supabase";

export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as { controlIds?: string[] };
		const { controlIds } = body;

		if (!controlIds || controlIds.length === 0) {
			return NextResponse.json(
				{ error: "controlIds array is required" },
				{ status: 400 },
			);
		}

		// Get all framework mappings for these controls
		const { data: mappings, error } = await supabaseAdmin
			.from("scf_control_mappings")
			.select(
				`
        control_id,
        framework_control_id,
        scf_frameworks (
          id,
          framework_name,
          framework_version,
          total_mappings
        )
      `,
			)
			.in("control_id", controlIds);

		if (error) {
			throw error;
		}

		// Group by framework and count unique controls touched
		const frameworkMap = new Map<
			string,
			{
				framework_name: string;
				framework_version: string | null;
				total_mappings: number;
				controls_touched: Set<string>;
				mapping_ids: string[];
			}
		>();

		for (const mapping of mappings || []) {
			const fw = mapping.scf_frameworks as unknown as {
				id: string;
				framework_name: string;
				framework_version: string | null;
				total_mappings: number;
			};
			if (!fw) continue;

			const existing = frameworkMap.get(fw.id);
			if (existing) {
				existing.controls_touched.add(mapping.control_id);
				existing.mapping_ids.push(mapping.framework_control_id);
			} else {
				frameworkMap.set(fw.id, {
					framework_name: fw.framework_name,
					framework_version: fw.framework_version,
					total_mappings: fw.total_mappings,
					controls_touched: new Set([mapping.control_id]),
					mapping_ids: [mapping.framework_control_id],
				});
			}
		}

		// Convert to array and sort by controls_touched descending
		const frameworks = Array.from(frameworkMap.entries())
			.map(([id, data]) => ({
				id,
				framework_name: data.framework_name,
				framework_version: data.framework_version,
				total_framework_mappings: data.total_mappings,
				controls_advanced: data.controls_touched.size,
				unique_requirements_touched: new Set(data.mapping_ids).size,
			}))
			.sort((a, b) => b.controls_advanced - a.controls_advanced);

		return NextResponse.json({
			total_frameworks_impacted: frameworks.length,
			total_controls_submitted: controlIds.length,
			frameworks,
		});
	} catch (error) {
		console.error("Error computing framework impact:", error);
		return NextResponse.json(
			{ error: "Failed to compute framework impact" },
			{ status: 500 },
		);
	}
}

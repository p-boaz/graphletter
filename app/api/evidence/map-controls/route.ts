import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

interface MapControlsBody {
	documentId?: string;
	atomIds?: string[];
	scfControlIds?: string[];
	mappingMethod?: "rule" | "llm" | "manual";
	coverageStrength?: "strong" | "moderate" | "weak" | "none";
	mappingPolarity?: "supports" | "contradicts";
	rationale?: string;
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as MapControlsBody;
		const scfControlIds = body.scfControlIds || [];

		if (scfControlIds.length === 0) {
			return NextResponse.json(
				{ error: "At least one scfControlId is required" },
				{ status: 400 },
			);
		}

		let atomIds = body.atomIds || [];

		if (atomIds.length === 0 && body.documentId) {
			const { data: atoms, error: atomsError } = await supabase
				.from("evidence_atoms")
				.select("id")
				.eq("document_id", body.documentId)
				.eq("user_id", user.id);

			if (atomsError) {
				return NextResponse.json(
					{ error: atomsError.message },
					{ status: 500 },
				);
			}

			atomIds = (atoms || []).map((atom) => atom.id as string);
		}

		if (atomIds.length === 0) {
			return NextResponse.json(
				{ error: "No atoms found to map" },
				{ status: 400 },
			);
		}

		const inserts = atomIds.flatMap((atomId) =>
			scfControlIds.map((scfControlId) => ({
				atom_id: atomId,
				scf_control_id: scfControlId,
				mapping_method: body.mappingMethod || "manual",
				coverage_strength: body.coverageStrength || "moderate",
				mapping_polarity: body.mappingPolarity || "supports",
				rationale: body.rationale || null,
			})),
		);

		const { error: upsertError } = await supabase
			.from("evidence_control_map")
			.upsert(inserts, { onConflict: "atom_id,scf_control_id" });

		if (upsertError) {
			return NextResponse.json({ error: upsertError.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			mapped_atoms: atomIds.length,
			mapped_controls: scfControlIds.length,
			mapping_records: inserts.length,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to map controls",
			},
			{ status: 500 },
		);
	}
}

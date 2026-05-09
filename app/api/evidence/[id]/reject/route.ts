import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const body = await request.json();
		const { rejection_reason, reviewed_at } = body;

		if (!rejection_reason || !rejection_reason.trim()) {
			return NextResponse.json(
				{ error: "Rejection reason is required" },
				{ status: 400 },
			);
		}

		// Verify the evidence belongs to the current user
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select("id, user_id, evidence_status, evidence_group_id")
			.eq("id", id)
			.eq("user_id", user.id)
			.single();

		if (evidenceError || !evidence) {
			return NextResponse.json(
				{ error: "Evidence not found or unauthorized" },
				{ status: 404 },
			);
		}

		// Update status for the whole evidence group so grouped rows stay consistent
		const reviewedAt = reviewed_at || new Date().toISOString();
		let updateQuery = supabase
			.from("evidence")
			.update({
				evidence_status: "rejected",
				reviewed_by: user.id,
				reviewed_at: reviewedAt,
				rejection_reason: rejection_reason,
				updated_at: new Date().toISOString(),
			})
			.eq("user_id", user.id);

		if (evidence.evidence_group_id) {
			updateQuery = updateQuery.eq(
				"evidence_group_id",
				evidence.evidence_group_id,
			);
		} else {
			updateQuery = updateQuery.eq("id", id);
		}

		const { data: updatedRows, error: updateError } =
			await updateQuery.select("id");

		if (updateError) {
			console.error("Error updating evidence status:", updateError);
			return NextResponse.json(
				{ error: "Failed to reject evidence" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Evidence rejected successfully",
			updated_count: updatedRows?.length || 0,
		});
	} catch (error) {
		console.error("Error rejecting evidence:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

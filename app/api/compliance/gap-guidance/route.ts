import { type NextRequest, NextResponse } from "next/server";
import { generateGuidance } from "@/lib/compliance/guidance-generator";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/gap-guidance");

interface RequestBody {
	erlId: string;
	artifact?: string;
	artifactDescription?: string;
	controlIds: string[];
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as RequestBody;

		if (!body.erlId || !body.controlIds || body.controlIds.length === 0) {
			return NextResponse.json(
				{ error: "erlId and controlIds are required" },
				{ status: 400 },
			);
		}

		// Fetch artifact details if not provided
		let artifact = body.artifact || "";
		let artifactDescription = body.artifactDescription || "";

		if (!artifact) {
			const { data: erlRow } = await supabaseAdmin
				.from("scf_evidence_request_list")
				.select("documentation_artifact, artifact_description")
				.eq("erl_id", body.erlId)
				.maybeSingle();

			if (erlRow) {
				artifact =
					(erlRow as { documentation_artifact: string })
						.documentation_artifact || body.erlId;
				artifactDescription =
					(erlRow as { artifact_description: string | null })
						.artifact_description || "";
			}
		}

		// Fetch control titles for better AI context
		const { data: controls } = await supabaseAdmin
			.from("scf_controls")
			.select("id, title")
			.in("id", body.controlIds);

		const controlTitles = body.controlIds.map((id) => {
			const ctrl = (controls || []).find(
				(c: { id: string; title: string | null }) => c.id === id,
			);
			return (
				(ctrl as { id: string; title: string | null } | undefined)?.title || ""
			);
		});

		const result = await generateGuidance(supabaseAdmin, {
			erlId: body.erlId,
			artifact,
			artifactDescription,
			controlIds: body.controlIds,
			controlTitles,
		});

		return NextResponse.json(result);
	} catch (error) {
		log.error("Gap guidance failed", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to generate guidance",
			},
			{ status: 500 },
		);
	}
}

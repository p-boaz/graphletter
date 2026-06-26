import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { parseJsonBody } from "@/lib/api/json-body";
import { type GapControl, resolveGapToErl } from "@/lib/compliance/gap-erl-resolver";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/compliance/gap-remediation");

interface RequestBody {
  frameworkId?: string;
  frameworkName?: string;
  controlIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody<RequestBody>(request, {});
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let gapControls: GapControl[];

    if (body.controlIds && body.controlIds.length > 0) {
      // Use provided control IDs as gap controls (caller already knows they're gaps)
      gapControls = body.controlIds.map((id) => ({
        scfControlId: id,
        status: "missing" as const,
        gapType: "no_evidence_mapping",
      }));
    } else {
      // Fetch latest gap analysis for the user's framework
      let query = supabase
        .from("control_gap_analysis")
        .select("scf_control_id, status, gap_type")
        .eq("user_id", user.id)
        .in("status", ["missing", "partial", "conflicting"])
        .order("created_at", { ascending: false });

      if (body.frameworkId) {
        query = query.eq("framework_id", body.frameworkId);
      }

      const { data: gapRows, error: gapError } = await query.limit(500);

      if (gapError) {
        log.error("Failed to fetch gaps", { error: gapError.message });
        return NextResponse.json({ error: gapError.message }, { status: 500 });
      }

      if (!gapRows || gapRows.length === 0) {
        return NextResponse.json({ remediations: [], totalGaps: 0 });
      }

      // Deduplicate by scf_control_id (take most recent)
      const seen = new Set<string>();
      gapControls = [];
      for (const row of gapRows) {
        if (!seen.has(row.scf_control_id)) {
          seen.add(row.scf_control_id);
          gapControls.push({
            scfControlId: row.scf_control_id,
            status: row.status as GapControl["status"],
            gapType: row.gap_type || undefined,
          });
        }
      }
    }

    const remediations = await resolveGapToErl(supabaseAdmin, gapControls);

    return NextResponse.json({
      remediations,
      totalGaps: gapControls.length,
      gapBreakdown: {
        missing: gapControls.filter((g) => g.status === "missing").length,
        partial: gapControls.filter((g) => g.status === "partial").length,
        conflicting: gapControls.filter((g) => g.status === "conflicting").length,
      },
    });
  } catch (error) {
    return apiError(
      "compliance.gap_remediation_failed",
      "Failed to resolve gap remediations",
      500,
      error
    );
  }
}

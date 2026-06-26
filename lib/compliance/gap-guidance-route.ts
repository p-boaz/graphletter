import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { generateGuidance } from "@/lib/compliance/guidance-generator";

interface RequestBody {
  erlId: string;
  artifact?: string;
  artifactDescription?: string;
  controlIds: string[];
}

interface GapGuidanceUser {
  id: string;
}

export interface GapGuidanceRouteDeps {
  createClient: () => Promise<SupabaseClient>;
  getCurrentUser: (supabase: SupabaseClient) => Promise<GapGuidanceUser | null>;
  supabaseAdmin: SupabaseClient;
  generateGuidance: typeof generateGuidance;
}

export function createGapGuidancePostHandler(deps: GapGuidanceRouteDeps) {
  return async function gapGuidancePost(request: NextRequest) {
    try {
      const supabase = await deps.createClient();
      const user = await deps.getCurrentUser(supabase);

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = (await request.json()) as RequestBody;

      if (!body.erlId || !body.controlIds || body.controlIds.length === 0) {
        return NextResponse.json({ error: "erlId and controlIds are required" }, { status: 400 });
      }

      let artifact = body.artifact || "";
      let artifactDescription = body.artifactDescription || "";

      if (!artifact) {
        const { data: erlRow } = await deps.supabaseAdmin
          .from("scf_evidence_request_list")
          .select("documentation_artifact, artifact_description")
          .eq("erl_id", body.erlId)
          .maybeSingle();

        if (erlRow) {
          artifact =
            (erlRow as { documentation_artifact: string }).documentation_artifact || body.erlId;
          artifactDescription =
            (erlRow as { artifact_description: string | null }).artifact_description || "";
        }
      }

      const { data: controls } = await deps.supabaseAdmin
        .from("scf_controls")
        .select("id, title")
        .in("id", body.controlIds);

      const controlTitles = body.controlIds.map((id) => {
        const ctrl = (controls || []).find(
          (c: { id: string; title: string | null }) => c.id === id
        );
        return (ctrl as { id: string; title: string | null } | undefined)?.title || "";
      });

      const result = await deps.generateGuidance(deps.supabaseAdmin, {
        erlId: body.erlId,
        artifact,
        artifactDescription,
        controlIds: body.controlIds,
        controlTitles,
      });

      return NextResponse.json(result);
    } catch (error) {
      return apiError("compliance.gap_guidance_failed", "Failed to generate guidance", 500, error);
    }
  };
}

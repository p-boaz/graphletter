import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

interface ArtifactRow {
  id: string;
  erl_id: string;
  documentation_artifact: string;
}

interface MappingRow {
  scf_control_id: string;
  priority: number | null;
  evidence_request_id: string;
}

interface ControlRow {
  id: string;
  title: string | null;
  description: string | null;
}

export async function GET() {
  try {
    const userScopedSupabase = await createClient();
    const user = await getCurrentUser(userScopedSupabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = supabaseAdmin;
    const { data: artifactRows, error: artifactError } = await adminSupabase
      .from("scf_evidence_request_list")
      .select("id, erl_id, documentation_artifact")
      .not("documentation_artifact", "is", null)
      .neq("documentation_artifact", "")
      .order("documentation_artifact");

    if (artifactError) {
      return NextResponse.json({ error: artifactError.message }, { status: 500 });
    }

    const artifacts = (artifactRows || []) as ArtifactRow[];
    if (artifacts.length === 0) {
      return NextResponse.json({ artifacts: [] });
    }

    const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const artifactIds = artifacts.map((artifact) => artifact.id);

    const { data: mappingRows, error: mappingError } = await adminSupabase
      .from("scf_control_evidence_mappings")
      .select("scf_control_id, priority, evidence_request_id")
      .in("evidence_request_id", artifactIds)
      .or("is_active.is.null,is_active.eq.true")
      .order("priority", { ascending: true });

    if (mappingError) {
      return NextResponse.json({ error: mappingError.message }, { status: 500 });
    }

    const controlIds = [
      ...new Set(((mappingRows || []) as MappingRow[]).map((row) => row.scf_control_id)),
    ];
    const controlById = new Map<string, ControlRow>();

    if (controlIds.length > 0) {
      const { data: controlRows, error: controlError } = await adminSupabase
        .from("scf_controls")
        .select("id, title, description")
        .in("id", controlIds);

      if (controlError) {
        return NextResponse.json({ error: controlError.message }, { status: 500 });
      }

      for (const control of (controlRows || []) as ControlRow[]) {
        controlById.set(control.id, control);
      }
    }

    const grouped = new Map<
      string,
      {
        artifact: string;
        erl_id: string;
        evidence_request_id: string;
        controls: Array<{
          scf_control_id: string;
          title: string;
          description: string;
          priority: number;
        }>;
      }
    >();

    for (const artifact of artifacts) {
      const key = `${artifact.erl_id}::${artifact.documentation_artifact}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          artifact: artifact.documentation_artifact,
          erl_id: artifact.erl_id,
          evidence_request_id: artifact.id,
          controls: [],
        });
      }
    }

    for (const mapping of (mappingRows || []) as MappingRow[]) {
      const artifact = artifactById.get(mapping.evidence_request_id);
      const control = controlById.get(mapping.scf_control_id);
      if (!artifact) {
        continue;
      }

      const key = `${artifact.erl_id}::${artifact.documentation_artifact}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          artifact: artifact.documentation_artifact,
          erl_id: artifact.erl_id,
          evidence_request_id: artifact.id,
          controls: [],
        });
      }

      const existing = grouped
        .get(key)
        ?.controls.some((item) => item.scf_control_id === mapping.scf_control_id);
      if (existing) {
        continue;
      }

      grouped.get(key)?.controls.push({
        scf_control_id: mapping.scf_control_id,
        title: control?.title || mapping.scf_control_id,
        description: control?.description || "",
        priority: mapping.priority ?? 999,
      });
    }

    const artifactOptions = [...grouped.values()]
      .map((item) => ({
        ...item,
        controls: item.controls.sort((a, b) => a.priority - b.priority),
      }))
      .sort((a, b) => {
        const artifactCompare = a.artifact.localeCompare(b.artifact);
        if (artifactCompare !== 0) return artifactCompare;
        return a.erl_id.localeCompare(b.erl_id);
      });

    return NextResponse.json({ artifacts: artifactOptions });
  } catch (error) {
    return apiError("erl.artifacts_get_failed", "Internal server error", 500, error);
  }
}

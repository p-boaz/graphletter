import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserInAdminAllowlist } from "@/utils/auth";

const log = createLogger("api/admin/artifacts");

export type AdminArtifactRecord = {
  id: string;
  documentation_artifact: string;
  artifact_description: string | null;
  scf_control_mappings: string[] | null;
};

type ArtifactInput = Partial<
  Pick<
    AdminArtifactRecord,
    "documentation_artifact" | "artifact_description" | "scf_control_mappings"
  >
>;

type AdminUser = {
  id?: string | null;
  email?: string | null;
};

export interface AdminArtifactsRepository {
  list(search: string): Promise<AdminArtifactRecord[]>;
  create(input: ArtifactInput): Promise<AdminArtifactRecord>;
  update(id: string, input: ArtifactInput): Promise<AdminArtifactRecord>;
  delete(id: string): Promise<void>;
}

export interface AdminArtifactsDeps {
  getUser(): Promise<AdminUser | null>;
  isAdmin(user: AdminUser): Promise<boolean>;
  repository: AdminArtifactsRepository;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function requireAdmin(deps: AdminArtifactsDeps): Promise<NextResponse | null> {
  const user = await deps.getUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  if (!(await deps.isAdmin(user))) {
    return jsonError("Forbidden", 403);
  }
  return null;
}

function normalizeControlMappings(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("scf_control_mappings must be an array");
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

async function parseArtifactInput(request: Request): Promise<ArtifactInput> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input: ArtifactInput = {};

  if (typeof body.documentation_artifact === "string") {
    input.documentation_artifact = body.documentation_artifact.trim();
  }
  if (typeof body.artifact_description === "string") {
    input.artifact_description = body.artifact_description.trim();
  }

  const mappings = normalizeControlMappings(body.scf_control_mappings);
  if (mappings !== undefined) {
    input.scf_control_mappings = mappings;
  }

  return input;
}

function createSupabaseArtifactsRepository(): AdminArtifactsRepository {
  async function getSupabaseAdmin() {
    return (await import("@/lib/database/supabase")).supabaseAdmin;
  }

  return {
    async list(search: string) {
      const supabaseAdmin = await getSupabaseAdmin();
      let query = supabaseAdmin
        .from("scf_evidence_request_list")
        .select("id, documentation_artifact, artifact_description, scf_control_mappings")
        .order("documentation_artifact");

      if (search) {
        query = query.ilike("documentation_artifact", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }
      return (data || []) as AdminArtifactRecord[];
    },

    async create(input: ArtifactInput) {
      const supabaseAdmin = await getSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from("scf_evidence_request_list")
        .insert([input])
        .select("id, documentation_artifact, artifact_description, scf_control_mappings")
        .single();

      if (error) {
        throw error;
      }
      return data as AdminArtifactRecord;
    },

    async update(id: string, input: ArtifactInput) {
      const supabaseAdmin = await getSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from("scf_evidence_request_list")
        .update(input)
        .eq("id", id)
        .select("id, documentation_artifact, artifact_description, scf_control_mappings")
        .single();

      if (error) {
        throw error;
      }
      return data as AdminArtifactRecord;
    },

    async delete(id: string) {
      const supabaseAdmin = await getSupabaseAdmin();
      const { error } = await supabaseAdmin.from("scf_evidence_request_list").delete().eq("id", id);

      if (error) {
        throw error;
      }
    },
  };
}

function productionDeps(): AdminArtifactsDeps {
  return {
    async getUser() {
      const supabase = await createClient();
      return getCurrentUser(supabase);
    },
    async isAdmin(user) {
      return isUserInAdminAllowlist(user);
    },
    repository: createSupabaseArtifactsRepository(),
  };
}

export function createAdminArtifactsHandlers(deps: AdminArtifactsDeps) {
  return {
    async GET(request: Request) {
      const denial = await requireAdmin(deps);
      if (denial) return denial;

      const search = new URL(request.url).searchParams.get("search")?.trim() || "";
      const artifacts = await deps.repository.list(search);
      return NextResponse.json({ artifacts });
    },

    async POST(request: Request) {
      const denial = await requireAdmin(deps);
      if (denial) return denial;

      const input = await parseArtifactInput(request);
      if (!input.documentation_artifact) {
        return jsonError("documentation_artifact is required", 400);
      }

      const artifact = await deps.repository.create(input);
      return NextResponse.json({ artifact }, { status: 201 });
    },

    async PATCH(request: Request) {
      const denial = await requireAdmin(deps);
      if (denial) return denial;

      const id = new URL(request.url).searchParams.get("id")?.trim();
      if (!id) {
        return jsonError("id is required", 400);
      }

      const input = await parseArtifactInput(request);
      const artifact = await deps.repository.update(id, input);
      return NextResponse.json({ artifact });
    },

    async DELETE(request: Request) {
      const denial = await requireAdmin(deps);
      if (denial) return denial;

      const id = new URL(request.url).searchParams.get("id")?.trim();
      if (!id) {
        return jsonError("id is required", 400);
      }

      await deps.repository.delete(id);
      return NextResponse.json({ success: true });
    },
  };
}

const handlers = createAdminArtifactsHandlers(productionDeps());

export async function GET(request: NextRequest) {
  try {
    return await handlers.GET(request);
  } catch (error) {
    log.error("admin_artifacts.get_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return apiError("admin_artifacts.get_failed", "Failed to load artifacts", 500, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlers.POST(request);
  } catch (error) {
    log.error("admin_artifacts.post_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return apiError("admin_artifacts.post_failed", "Failed to create artifact", 500, error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    return await handlers.PATCH(request);
  } catch (error) {
    log.error("admin_artifacts.patch_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return apiError("admin_artifacts.patch_failed", "Failed to update artifact", 500, error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await handlers.DELETE(request);
  } catch (error) {
    log.error("admin_artifacts.delete_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return apiError("admin_artifacts.delete_failed", "Failed to delete artifact", 500, error);
  }
}

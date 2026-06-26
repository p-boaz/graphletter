import { type NextRequest } from "next/server";
import {
  type ArtifactInput,
  createAdminArtifactsHandlers,
  type AdminArtifactRecord,
  type AdminArtifactsDeps,
  type AdminArtifactsRepository,
} from "@/lib/admin/artifacts-route-handlers";
import { apiError } from "@/lib/api/error-response";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserInAdminAllowlist } from "@/utils/auth";

const log = createLogger("api/admin/artifacts");

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

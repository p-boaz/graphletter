import { NextResponse } from "next/server";

export type AdminArtifactRecord = {
  id: string;
  documentation_artifact: string;
  artifact_description: string | null;
  scf_control_mappings: string[] | null;
};

export type ArtifactInput = Partial<
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

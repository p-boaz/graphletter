import { type NextRequest, NextResponse } from "next/server";
import {
  isEvidenceImportFormat,
  looksLikeUuid,
  parseEvidenceImportContent,
  toEvidenceInsertRows,
  validateEvidenceImportRows,
  type EvidenceImportFormat,
  type EvidenceImportReference,
} from "@/lib/evidence-import";
import { createRequestLogger, getOrCreateRequestId } from "@/lib/observability/logger";
import { createEvidenceServiceClient } from "@/lib/services/evidence/upload-utils";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type ImportMode = "preview" | "commit";

interface EvidenceImportRequestBody {
  mode?: string;
  format?: string;
  content?: string;
}

interface EvidenceRequestRow {
  id: string;
  erl_id: string;
  documentation_artifact: string | null;
  scf_control_mappings: string[] | null;
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createRequestLogger(requestId);

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as EvidenceImportRequestBody;
    const mode = parseMode(body.mode);
    const format = parseFormat(body.format);
    const content = typeof body.content === "string" ? body.content : "";

    if (!mode || !format) {
      return NextResponse.json(
        { error: "mode must be preview or commit, and format must be csv or json." },
        { status: 400 }
      );
    }

    let rawRows;
    try {
      rawRows = parseEvidenceImportContent(format, content);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Import file could not be parsed." },
        { status: 400 }
      );
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Import file has no data rows." }, { status: 400 });
    }

    const references = await loadReferences(rawRows);
    const validation = validateEvidenceImportRows(rawRows, references);

    if (mode === "preview") {
      return NextResponse.json({ success: true, ...validation });
    }

    if (validation.summary.invalidRows > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Import has invalid rows. Fix every row before committing.",
          ...validation,
        },
        { status: 422 }
      );
    }

    const serviceSupabase = createEvidenceServiceClient();
    const importedAt = new Date().toISOString();
    const insertRows = toEvidenceInsertRows(validation, user.id, importedAt);

    const { data, error } = await serviceSupabase.from("evidence").insert(insertRows).select("id");

    if (error) {
      logger.error("evidence.import.insert_failed", { detail: error.message });
      return NextResponse.json({ error: "Failed to import evidence rows." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...validation,
      committedRows: data?.length ?? insertRows.length,
      evidenceIds: data?.map((row) => row.id) ?? [],
    });
  } catch (error) {
    logger.error("evidence.import.failed", {
      detail: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to process evidence import." }, { status: 500 });
  }
}

function parseMode(value: string | undefined): ImportMode | null {
  if (value === "preview" || value === "commit") {
    return value;
  }
  return null;
}

function parseFormat(value: string | undefined): EvidenceImportFormat | null {
  if (value && isEvidenceImportFormat(value)) {
    return value;
  }
  return null;
}

async function loadReferences(rawRows: Array<{ fields: Record<string, string> }>) {
  const serviceSupabase = createEvidenceServiceClient();
  const controlIds = [
    ...new Set(rawRows.map((row) => row.fields.scf_control_id?.trim()).filter(Boolean)),
  ];
  const erlIdentifiers = [
    ...new Set(
      rawRows
        .map((row) => row.fields.erl_id?.trim() || row.fields.erl_global_id?.trim())
        .filter(Boolean)
    ),
  ];

  const controls = new Set<string>();
  if (controlIds.length > 0) {
    const { data, error } = await serviceSupabase
      .from("scf_controls")
      .select("id")
      .in("id", controlIds);
    if (error) {
      throw new Error(`Failed to validate SCF controls: ${error.message}`);
    }
    for (const control of data ?? []) {
      controls.add(control.id);
    }
  }

  const evidenceRequests = new Map<string, EvidenceImportReference>();
  if (erlIdentifiers.length > 0) {
    const uuidIdentifiers = erlIdentifiers.filter(looksLikeUuid);
    const globalIdentifiers = erlIdentifiers.filter((identifier) => !looksLikeUuid(identifier));
    const rows = [
      ...(await loadEvidenceRequestsByColumn("id", uuidIdentifiers)),
      ...(await loadEvidenceRequestsByColumn("erl_id", globalIdentifiers)),
    ];

    for (const row of rows) {
      const reference: EvidenceImportReference = {
        id: row.id,
        erlId: row.erl_id,
        documentationArtifact: row.documentation_artifact,
        controlMappings: row.scf_control_mappings ?? [],
      };
      evidenceRequests.set(row.id, reference);
      evidenceRequests.set(row.erl_id, reference);
    }
  }

  return { controls, evidenceRequests };
}

async function loadEvidenceRequestsByColumn(
  column: "id" | "erl_id",
  values: string[]
): Promise<EvidenceRequestRow[]> {
  if (values.length === 0) {
    return [];
  }

  const serviceSupabase = createEvidenceServiceClient();
  const { data, error } = await serviceSupabase
    .from("scf_evidence_request_list")
    .select("id, erl_id, documentation_artifact, scf_control_mappings")
    .in(column, values);

  if (error) {
    throw new Error(`Failed to validate ERL identifiers: ${error.message}`);
  }

  return (data ?? []) as EvidenceRequestRow[];
}

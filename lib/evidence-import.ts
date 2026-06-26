import { parse } from "csv-parse/sync";

export const EVIDENCE_IMPORT_FORMATS = ["csv", "json"] as const;
export type EvidenceImportFormat = (typeof EVIDENCE_IMPORT_FORMATS)[number];

export const EVIDENCE_IMPORT_COLUMNS = [
  "file_name",
  "scf_control_id",
  "evidence_type",
  "erl_id",
  "erl_global_id",
  "documentation_artifact",
  "description",
  "submitted_at",
] as const;

export const ALLOWED_EVIDENCE_IMPORT_TYPES = [
  "document",
  "screenshot",
  "policy",
  "procedure",
  "log",
  "certificate",
  "configuration",
  "other",
  "aws",
  "azure",
  "gcp",
  "github",
  "okta",
  "supabase",
] as const;

const ALLOWED_EVIDENCE_TYPE_SET = new Set<string>(ALLOWED_EVIDENCE_IMPORT_TYPES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNERSHIP_COLUMNS = new Set(["user_id", "submitted_by", "approved_by", "reviewed_by"]);

type EvidenceImportColumn = (typeof EVIDENCE_IMPORT_COLUMNS)[number];

export interface RawEvidenceImportRow {
  rowNumber: number;
  fields: Record<string, string>;
}

export interface EvidenceImportReference {
  id: string;
  erlId: string;
  documentationArtifact?: string | null;
  controlMappings?: string[];
}

export interface EvidenceImportReferences {
  controls: Set<string>;
  evidenceRequests: Map<string, EvidenceImportReference>;
}

export interface ValidatedEvidenceImportRow {
  rowNumber: number;
  status: "valid" | "invalid";
  errors: string[];
  values: {
    file_name: string;
    scf_control_id: string;
    evidence_type: string;
    erl_id: string | null;
    erl_global_id: string | null;
    documentation_artifact: string | null;
    description: string | null;
    submitted_at: string | null;
  };
}

export interface EvidenceImportValidationResult {
  rows: ValidatedEvidenceImportRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export function isEvidenceImportFormat(value: string): value is EvidenceImportFormat {
  return EVIDENCE_IMPORT_FORMATS.includes(value as EvidenceImportFormat);
}

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseEvidenceImportContent(
  format: EvidenceImportFormat,
  content: string
): RawEvidenceImportRow[] {
  if (!content.trim()) {
    throw new Error("Import file is empty.");
  }

  if (format === "json") {
    return parseJsonImport(content);
  }

  return parseCsvImport(content);
}

export function validateEvidenceImportRows(
  rows: RawEvidenceImportRow[],
  references: EvidenceImportReferences
): EvidenceImportValidationResult {
  const validatedRows = rows.map((row) => validateRow(row, references));
  const validRows = validatedRows.filter((row) => row.status === "valid").length;

  return {
    rows: validatedRows,
    summary: {
      totalRows: validatedRows.length,
      validRows,
      invalidRows: validatedRows.length - validRows,
    },
  };
}

export function toEvidenceInsertRows(
  validation: EvidenceImportValidationResult,
  userId: string,
  importedAt: string
): Array<Record<string, unknown>> {
  if (validation.summary.invalidRows > 0) {
    throw new Error("Cannot create evidence rows from invalid import data.");
  }

  return validation.rows.map((row) => ({
    user_id: userId,
    scf_control_id: row.values.scf_control_id,
    evidence_type: row.values.evidence_type,
    collection_method: "manual",
    erl_id: row.values.erl_id,
    erl_global_id: row.values.erl_global_id,
    file_name: row.values.file_name,
    file_path: null,
    file_size: null,
    file_type: "external/import",
    version: 1,
    description: row.values.description,
    submitted_by: userId,
    evidence_status: "submitted",
    submitted_at: row.values.submitted_at ?? importedAt,
    content_extraction_status: "skipped",
    metadata: {
      imported: true,
      import_source: "bulk_evidence_import",
      imported_at: importedAt,
      original_row_number: row.rowNumber,
      documentation_artifact: row.values.documentation_artifact,
    },
  }));
}

function parseCsvImport(content: string): RawEvidenceImportRow[] {
  let records: Array<Record<string, unknown>>;

  try {
    records = parse(content, {
      bom: true,
      columns: (headers: string[]) => headers.map(normalizeColumnName),
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, unknown>>;
  } catch (error) {
    throw new Error(
      `CSV could not be parsed: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  return records.map((record, index) => ({
    rowNumber: index + 2,
    fields: normalizeRecord(record),
  }));
}

function parseJsonImport(content: string): RawEvidenceImportRow[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `JSON could not be parsed: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("JSON import must be an array of row objects.");
  }

  return parsed.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`JSON row ${index + 1} must be an object.`);
    }

    return {
      rowNumber: index + 1,
      fields: normalizeRecord(record as Record<string, unknown>),
    };
  });
}

function normalizeRecord(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      normalizeColumnName(key),
      stringifyCell(value).trim(),
    ])
  );
}

function normalizeColumnName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function validateRow(
  row: RawEvidenceImportRow,
  references: EvidenceImportReferences
): ValidatedEvidenceImportRow {
  const errors: string[] = [];
  const field = (name: EvidenceImportColumn) => row.fields[name]?.trim() ?? "";

  for (const column of Object.keys(row.fields)) {
    if (OWNERSHIP_COLUMNS.has(column)) {
      errors.push(`${column} is not supported. Imported rows are owned by the signed-in user.`);
    }
  }

  const fileName = field("file_name");
  const scfControlId = field("scf_control_id");
  const evidenceType = field("evidence_type").toLowerCase();
  const erlIdentifier = field("erl_id") || field("erl_global_id");
  const description = nullable(field("description"));
  const submittedAtInput = field("submitted_at");
  const submittedAt = parseSubmittedAt(submittedAtInput, errors);

  if (!fileName) {
    errors.push("file_name is required.");
  } else if (fileName.length > 255) {
    errors.push("file_name must be 255 characters or fewer.");
  }

  if (!scfControlId) {
    errors.push("scf_control_id is required.");
  } else if (!references.controls.has(scfControlId)) {
    errors.push(`scf_control_id "${scfControlId}" does not match an SCF control.`);
  }

  if (!evidenceType) {
    errors.push("evidence_type is required.");
  } else if (!ALLOWED_EVIDENCE_TYPE_SET.has(evidenceType)) {
    errors.push(`evidence_type "${evidenceType}" is not supported.`);
  }

  let evidenceRequest: EvidenceImportReference | undefined;
  if (erlIdentifier) {
    evidenceRequest = references.evidenceRequests.get(erlIdentifier);
    if (!evidenceRequest) {
      errors.push(`ERL identifier "${erlIdentifier}" does not match an evidence request.`);
    } else if (
      scfControlId &&
      evidenceRequest.controlMappings?.length &&
      !evidenceRequest.controlMappings.includes(scfControlId)
    ) {
      errors.push(`ERL identifier "${erlIdentifier}" is not mapped to control "${scfControlId}".`);
    }
  }

  const documentationArtifact =
    nullable(field("documentation_artifact")) ?? evidenceRequest?.documentationArtifact ?? null;

  if (description && description.length > 2000) {
    errors.push("description must be 2000 characters or fewer.");
  }

  return {
    rowNumber: row.rowNumber,
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    values: {
      file_name: fileName,
      scf_control_id: scfControlId,
      evidence_type: evidenceType,
      erl_id: evidenceRequest?.id ?? null,
      erl_global_id: evidenceRequest?.erlId ?? nullable(field("erl_global_id")),
      documentation_artifact: documentationArtifact,
      description,
      submitted_at: submittedAt,
    },
  };
}

function nullable(value: string): string | null {
  return value ? value : null;
}

function parseSubmittedAt(value: string, errors: string[]): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push("submitted_at must be an ISO-8601 date or timestamp.");
    return null;
  }

  return date.toISOString();
}

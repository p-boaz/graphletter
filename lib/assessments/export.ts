import type { OverallVerdict } from "@/lib/assessments/summary";

/**
 * Serializers for getting assessment results out of the app — for sharing with
 * auditors, archiving, or tracking posture over time.
 *
 * These functions are intentionally pure (string in, string out) and carry no
 * UI or I/O dependencies, so they are trivially unit-testable and reusable from
 * an API route, a CLI script, or a download button. See issue #12.
 */

export interface AssessmentExportObjective {
  objective_id: string;
  result: OverallVerdict;
  confidence: number;
  reasoning: string;
  gaps?: string[];
  recommendations?: string[];
}

export interface AssessmentExportRecord {
  scf_control_id: string;
  control_title?: string;
  frameworks?: string[];
  overall_result: OverallVerdict;
  overall_confidence: number;
  summary?: string;
  objective_results: AssessmentExportObjective[];
}

/**
 * The full structured export: an indented JSON array of the records exactly as
 * supplied. This is the lossless format — it preserves objective-level detail,
 * gaps, and recommendations.
 */
export function assessmentsToJson(records: AssessmentExportRecord[]): string {
  return JSON.stringify(records, null, 2);
}

const CSV_COLUMNS = [
  "Control ID",
  "Title",
  "Frameworks",
  "Verdict",
  "Confidence %",
  "Objectives Passed",
  "Objectives Total",
  "Summary",
] as const;

/**
 * A flat, spreadsheet-friendly CSV with one row per control. This is a summary
 * view — objective-level reasoning/gaps are not included; use the JSON export
 * for the full picture.
 *
 * Output is RFC 4180-compliant: CRLF line endings, fields containing a comma,
 * quote, or newline are wrapped in double quotes with internal quotes doubled.
 * An empty input yields a header row only.
 */
export function assessmentsToCsv(records: AssessmentExportRecord[]): string {
  const rows = records.map((record) => {
    const passed = record.objective_results.filter((o) => o.result === "pass").length;
    return [
      record.scf_control_id,
      record.control_title ?? "",
      (record.frameworks ?? []).join("; "),
      formatVerdict(record.overall_result),
      String(toPercent(record.overall_confidence)),
      String(passed),
      String(record.objective_results.length),
      record.summary ?? "",
    ];
  });

  return [CSV_COLUMNS, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

function formatVerdict(verdict: OverallVerdict): string {
  return verdict.toUpperCase().replace(/_/g, " ");
}

/** Clamp a 0–1 confidence to a whole-number percent; non-finite input maps to 0. */
function toPercent(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

/** RFC 4180 field escaping. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

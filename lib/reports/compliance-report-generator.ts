import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostureScore } from "@/lib/compliance/posture-scorer";
import { createLogger } from "@/lib/logger";
import { sanitizeField, sanitizeForPDF } from "@/lib/reports/sanitize";

const log = createLogger("report-generator");

export interface ReportOptions {
  format: "pdf" | "csv";
  includeNarrative?: boolean;
  frameworkId?: string | null;
}

export interface ComplianceReportData {
  generatedAt: string;
  userId: string;
  posture: PostureScore | null;
  frameworks: FrameworkReportRow[];
  controlDetails: ControlReportRow[];
  evidenceSummary: EvidenceSummaryRow[];
  gapSummary: GapSummaryRow[];
}

interface FrameworkReportRow {
  frameworkId: string;
  frameworkName: string;
  mappedControls: number;
}

interface ControlReportRow {
  controlId: string;
  controlTitle: string;
  domainId: string;
  domainName: string;
  status: string;
  evidenceCount: number;
  latestAssessmentResult: string | null;
  latestAssessmentDate: string | null;
}

interface EvidenceSummaryRow {
  evidenceType: string;
  count: number;
  latestUpload: string | null;
}

interface GapSummaryRow {
  controlId: string;
  controlTitle: string;
  domainId: string;
  status: string;
  gapType: string;
}

interface GapAnalysisRow {
  scf_control_id: string;
  status: string;
  gap_type?: string;
}

interface AssessmentRow {
  scf_control_id: string;
  assessment_result: string;
  completed_at: string;
}

/**
 * Gather all data needed for a compliance report.
 */
export async function gatherReportData(
  supabase: SupabaseClient,
  userId: string,
  posture: PostureScore | null
): Promise<ComplianceReportData> {
  const startMs = Date.now();

  // Fetch frameworks and controls in parallel
  const [frameworksResult, evidenceResult, gapsResult, assessmentsResult] = await Promise.all([
    supabase.from("scf_frameworks").select("id, framework_name").order("framework_name"),
    supabase
      .from("evidence")
      .select("evidence_type, submitted_at")
      .eq("user_id", userId)
      .neq("evidence_status", "outdated"),
    supabase
      .from("control_gap_analysis")
      .select("scf_control_id, status, gap_type")
      .eq("user_id", userId),
    supabase
      .from("assessments")
      .select("scf_control_id, assessment_result, completed_at")
      .eq("user_id", userId)
      .eq("assessment_status", "completed")
      .order("completed_at", { ascending: false }),
  ]);

  // Process frameworks
  const frameworks: FrameworkReportRow[] = (frameworksResult.data || []).map(
    (f: { id: string; framework_name: string }) => ({
      frameworkId: f.id,
      frameworkName: sanitizeField("frameworkName", f.framework_name),
      mappedControls: 0,
    })
  );

  // Process evidence summary by type
  const evidenceByType = new Map<string, { count: number; latestUpload: string | null }>();
  for (const e of (evidenceResult.data || []) as Array<{
    evidence_type: string;
    submitted_at: string;
  }>) {
    const existing = evidenceByType.get(e.evidence_type);
    if (existing) {
      existing.count += 1;
      if (e.submitted_at && (!existing.latestUpload || e.submitted_at > existing.latestUpload)) {
        existing.latestUpload = e.submitted_at;
      }
    } else {
      evidenceByType.set(e.evidence_type, {
        count: 1,
        latestUpload: e.submitted_at,
      });
    }
  }
  const evidenceSummary: EvidenceSummaryRow[] = Array.from(evidenceByType.entries()).map(
    ([type, data]) => ({
      evidenceType: type,
      count: data.count,
      latestUpload: data.latestUpload,
    })
  );

  // Process gaps
  const latestAssessmentByControl = new Map<string, { result: string; date: string }>();
  for (const a of (assessmentsResult.data || []) as AssessmentRow[]) {
    if (!latestAssessmentByControl.has(a.scf_control_id)) {
      latestAssessmentByControl.set(a.scf_control_id, {
        result: a.assessment_result,
        date: a.completed_at,
      });
    }
  }

  const gapSummary: GapSummaryRow[] = [];
  const controlDetails: ControlReportRow[] = [];

  for (const gap of (gapsResult.data || []) as GapAnalysisRow[]) {
    const domainInfo = posture?.domains.find((d) => gap.scf_control_id.startsWith(d.domainId));
    const assessment = latestAssessmentByControl.get(gap.scf_control_id);

    controlDetails.push({
      controlId: sanitizeField("controlId", gap.scf_control_id),
      controlTitle: gap.scf_control_id,
      domainId: domainInfo?.domainId || "Unknown",
      domainName: sanitizeField("domainName", domainInfo?.domainName || "Unknown"),
      status: gap.status,
      evidenceCount: 0,
      latestAssessmentResult: assessment?.result ?? null,
      latestAssessmentDate: assessment?.date ?? null,
    });

    if (gap.status === "missing" || gap.status === "partial") {
      gapSummary.push({
        controlId: gap.scf_control_id,
        controlTitle: gap.scf_control_id,
        domainId: domainInfo?.domainId || "Unknown",
        status: gap.status,
        gapType: gap.gap_type || "no_evidence",
      });
    }
  }

  const durationMs = Date.now() - startMs;
  log.info("report_generator.data_gathered", {
    userId,
    frameworkCount: frameworks.length,
    controlCount: controlDetails.length,
    gapCount: gapSummary.length,
    durationMs,
  });

  return {
    generatedAt: new Date().toISOString(),
    userId,
    posture,
    frameworks,
    controlDetails,
    evidenceSummary,
    gapSummary,
  };
}

/**
 * Generate a CSV compliance report.
 */
export function generateCSVReport(data: ComplianceReportData): string {
  const lines: string[] = [];

  // Header section
  lines.push("Graphletter Compliance Report");
  lines.push(`Generated,${data.generatedAt}`);
  if (data.posture) {
    lines.push(`Overall Posture Score,${data.posture.overallScore}%`);
    lines.push(`Total Controls,${data.posture.totalControls}`);
    lines.push(`Compliant,${data.posture.compliantControls}`);
    lines.push(`Partial,${data.posture.partialControls}`);
    lines.push(`Missing,${data.posture.missingControls}`);
    lines.push(`Conflicting,${data.posture.conflictingControls}`);
  }
  lines.push("");

  // Domain breakdown
  if (data.posture?.domains.length) {
    lines.push("Domain Breakdown");
    lines.push("Domain,Tier,Weight,Total Controls,Compliant,Partial,Missing,Raw Score");
    for (const d of data.posture.domains) {
      lines.push(
        [
          csvEscape(d.domainName),
          d.tier,
          d.weight,
          d.totalControls,
          d.compliantControls,
          d.partialControls,
          d.missingControls,
          `${d.rawScore}%`,
        ].join(",")
      );
    }
    lines.push("");
  }

  // Control details
  lines.push("Control Details");
  lines.push("Control ID,Domain,Status,Latest Assessment,Assessment Date");
  for (const c of data.controlDetails) {
    lines.push(
      [
        csvEscape(c.controlId),
        csvEscape(c.domainName),
        c.status,
        c.latestAssessmentResult || "N/A",
        c.latestAssessmentDate || "N/A",
      ].join(",")
    );
  }
  lines.push("");

  // Evidence summary
  lines.push("Evidence Summary");
  lines.push("Type,Count,Latest Upload");
  for (const e of data.evidenceSummary) {
    lines.push([e.evidenceType, e.count, e.latestUpload || "N/A"].join(","));
  }
  lines.push("");

  // Gap summary
  if (data.gapSummary.length > 0) {
    lines.push("Gap Summary");
    lines.push("Control ID,Domain,Status,Gap Type");
    for (const g of data.gapSummary) {
      lines.push([csvEscape(g.controlId), csvEscape(g.domainId), g.status, g.gapType].join(","));
    }
  }

  return lines.join("\n");
}

/**
 * Generate a structured JSON report (for PDF rendering or API consumption).
 */
export function generateJSONReport(data: ComplianceReportData): string {
  return JSON.stringify(
    {
      report: {
        title: "Graphletter Compliance Report",
        generatedAt: data.generatedAt,
        posture: data.posture
          ? {
              overallScore: data.posture.overallScore,
              totalControls: data.posture.totalControls,
              compliantControls: data.posture.compliantControls,
              partialControls: data.posture.partialControls,
              missingControls: data.posture.missingControls,
              conflictingControls: data.posture.conflictingControls,
              domains: data.posture.domains.map((d) => ({
                domain: sanitizeForPDF(d.domainName),
                tier: d.tier,
                weight: d.weight,
                rawScore: d.rawScore,
                totalControls: d.totalControls,
                compliantControls: d.compliantControls,
              })),
            }
          : null,
        controlDetails: data.controlDetails,
        evidenceSummary: data.evidenceSummary,
        gapSummary: data.gapSummary,
      },
    },
    null,
    2
  );
}

function csvEscape(value: string): string {
  const sanitized = sanitizeForPDF(value, 500);
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

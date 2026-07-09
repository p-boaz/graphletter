"use client";

import { ChevronDown, ChevronUp, CircleHelp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AssessmentExportMenu } from "@/components/assessment-export-menu";
import { AssessmentResultsDisplay } from "@/components/assessment-results-display";
import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyTabState } from "@/components/dashboard/empty-tab-state";
import { Card, CardContent } from "@/components/ui/card";
import { isNewUser } from "@/lib/dashboard/is-new-user";
import { useEvidenceCount } from "@/lib/dashboard/use-evidence-count";
import type { MaturityAssessment, MaturityLevels } from "@/lib/client/smart-evidence-workflow";
import { glossaryTerms, resultGuidance } from "@/lib/content/compliance-explainer";

interface AssessmentRecord {
  id: string;
  evidence_id?: string;
  scf_control_id: string;
  assessment_result: string;
  assessment_status: string;
  assessment_notes: string;
  completed_at: string;
  metadata?: {
    confidence?: number;
    ai_generated?: boolean;
    maturity_assessment?: unknown;
    maturity_benchmark_snapshot?: unknown;
    objective_results?: Array<{
      result: string;
      confidence: number;
      reasoning: string;
    }>;
  };
  scf_controls?: {
    title: string;
    description: string;
  };
  linked_evidence?: Array<{
    id: string;
    file_name: string;
    evidence_type: string;
  }>;
}

export default function AssessmentsPage() {
  const [assessmentRecords, setAssessmentRecords] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);
  const evidenceCount = useEvidenceCount();

  const loadAssessmentData = useCallback(async () => {
    setLoading(true);
    try {
      const assessmentResponse = await fetch(`/api/assessments/history`, {
        cache: "no-store",
      });
      if (assessmentResponse.ok) {
        const assessmentData = await assessmentResponse.json();
        setAssessmentRecords(assessmentData.assessments || []);
      }
    } catch (error) {
      console.error("Error loading assessment data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessmentData();
  }, [loadAssessmentData]);

  // Convert AssessmentRecord[] to UnifiedAssessmentResult[] for the shared component
  const convertAssessmentRecords = (records: AssessmentRecord[]) => {
    return records.map((record) => ({
      id: record.id,
      scf_control_id: record.scf_control_id,
      assessment_status: record.assessment_status,
      overall_result: record.assessment_result,
      overall_confidence: record.metadata?.confidence || 0,
      summary: record.assessment_notes,
      control_title: record.scf_controls?.title,
      control_description: record.scf_controls?.description,
      completed_at: record.completed_at,
      ai_generated: record.metadata?.ai_generated,
      objective_results: record.metadata?.objective_results,
      maturity_assessment:
        (record.metadata?.maturity_assessment as MaturityAssessment | null) || null,
      maturity_levels:
        (record.metadata?.maturity_benchmark_snapshot as MaturityLevels | null) || null,
      linked_evidence: record.linked_evidence,
    }));
  };

  const objectiveExplainer = glossaryTerms.find((term) => term.id === "assessment-objectives");
  const resultStateExplainer = glossaryTerms.find((term) => term.id === "result-states");

  if (evidenceCount !== null && isNewUser({ evidenceCount })) {
    return (
      <DashboardLayout
        title="Assessment Results"
        description="View AI assessment results and compliance status for your security controls"
        showUploadButton={true}
      >
        <EmptyTabState
          title="No assessments yet"
          body="Assessment results appear here once you upload your first evidence document and we run it through the SCF control checks."
          cta={{ label: "Upload evidence", href: "/dashboard?upload=1" }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Assessment Results"
      description="View AI assessment results and compliance status for your security controls"
      showUploadButton={true}
    >
      <Card className="ft-card">
        <CardContent className="pt-6">
          {assessmentRecords.length > 0 && (
            <div className="mb-4 flex justify-end">
              <AssessmentExportMenu />
            </div>
          )}

          <div className="mb-4 rounded-lg border border-slate-200 bg-ft-cream/50 p-3 text-sm text-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>Need a quick explanation of SCF assessment objectives and result states?</p>
              <button
                type="button"
                data-testid="assessments-open-explainer"
                className="inline-flex items-center gap-1 font-semibold underline underline-offset-4"
                onClick={() => setShowExplainer((current) => !current)}
              >
                Open the explainer
                {showExplainer ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {showExplainer && (
            <div
              className="mb-4 space-y-4 rounded-lg border border-slate-200 bg-ft-cream/50 p-4"
              data-testid="assessments-inline-explainer"
            >
              <div className="ft-serif flex items-center gap-2 text-ft-black">
                <CircleHelp className="h-4 w-4" />
                <h4 className="font-semibold text-sm">In-context assessment explainer</h4>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="ft-eyebrow text-[11px]">SCF Assessment Objectives</p>
                  <p className="mt-1 text-slate-600 text-xs leading-relaxed">
                    {objectiveExplainer?.graphletterDefinition}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="ft-eyebrow text-[11px]">Result States</p>
                  <p className="mt-1 text-slate-600 text-xs leading-relaxed">
                    {resultStateExplainer?.plainDefinition}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {resultGuidance.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-md border border-slate-200 bg-white p-3"
                  >
                    <p className="ft-eyebrow text-[11px]">{item.status.replace("_", " ")}</p>
                    <p className="mt-1 text-slate-600 text-xs">{item.meaning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AssessmentResultsDisplay
            assessments={convertAssessmentRecords(assessmentRecords)}
            loading={loading}
            showLinkedEvidence={true}
            showCompletedDate={true}
            maxHeight="max-h-none"
            enableRowDetailDialog={true}
          />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

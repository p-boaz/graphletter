"use client";

import { useCallback, useEffect, useState } from "react";
import { AssessmentExportMenu } from "@/components/assessment-export-menu";
import { AssessmentResultsDisplay } from "@/components/assessment-results-display";
import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyTabState } from "@/components/dashboard/empty-tab-state";
import { Card, CardContent } from "@/components/ui/card";
import { isNewUser } from "@/lib/dashboard/is-new-user";
import { useEvidenceCount } from "@/lib/dashboard/use-evidence-count";
import type { MaturityAssessment, MaturityLevels } from "@/lib/client/smart-evidence-workflow";

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

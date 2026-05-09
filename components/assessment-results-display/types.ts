import type { MaturityAssessment, MaturityLevels } from "@/lib/client/smart-evidence-workflow";

// Unified interface that can handle both upload workflow and history data
export interface UnifiedAssessmentResult {
  id: string;
  scf_control_id: string;
  overall_result: string;
  overall_confidence: number;
  summary: string;
  control_title?: string;
  control_description?: string;
  control_guidance?: string;
  domain_name?: string;
  completed_at?: string;
  ai_generated?: boolean;
  objective_results?: Array<{
    scf_ao_id?: string;
    assessment_objective?: string;
    assessment_procedure?: string;
    expected_results?: string;
    result: string;
    confidence: number;
    reasoning: string;
    gaps?: string[];
    recommendations?: string[];
  }>;
  linked_evidence?: Array<{
    id: string;
    file_name: string;
    evidence_type: string;
  }>;
  maturity_assessment?: MaturityAssessment | null;
  maturity_levels?: MaturityLevels | null;
}

export interface AssessmentResultsDisplayProps {
  assessments: UnifiedAssessmentResult[];
  loading?: boolean;
  showLinkedEvidence?: boolean;
  showCompletedDate?: boolean;
  maxHeight?: string;
  enableRowDetailDialog?: boolean;
  /**
   * When true, skip rendering each control's collapsed summary header
   * (title/verdict/confidence) and show the per-objective breakdown
   * directly. Used when a parent surface (e.g. the Try It Out demo)
   * already renders its own headline and doesn't want a duplicate.
   */
  hideSummary?: boolean;
}

export type ObjectiveDetail = {
  description?: string;
  implementation_guidance?: string;
  examples?: string[];
  assessment_methods?: string[];
};

export type ControlObjective = NonNullable<UnifiedAssessmentResult["objective_results"]>[number] & {
  assessment_id: string;
};

export type ControlGroup = {
  control_id: string;
  control_title?: string;
  control_description?: string;
  control_guidance?: string;
  domain_name?: string;
  completed_at?: string;
  ai_generated?: boolean;
  linked_evidence?: UnifiedAssessmentResult["linked_evidence"];
  evidenceByAssessmentId: Record<string, UnifiedAssessmentResult["linked_evidence"]>;
  completedAtByAssessmentId: Record<string, string>;
  objectives: ControlObjective[];
  maturity_assessment?: MaturityAssessment | null;
  maturity_levels?: MaturityLevels | null;
};

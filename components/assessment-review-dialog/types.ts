import type { MaturityAssessment } from "@/lib/client/smart-evidence-workflow";

export interface AssessmentResult {
  id: string;
  scf_control_id: string;
  overall_result: "pass" | "fail" | "partial" | "not_applicable";
  overall_confidence: number;
  summary: string;
  control_title?: string;
  control_description?: string;
  objective_results?: Array<{
    scf_ao_id?: string;
    assessment_objective?: string;
    assessment_procedure?: string;
    expected_results?: string;
    result: string;
    confidence: number;
    reasoning: string;
    evidence_quotes?: Array<{
      start: number;
      end: number;
      text: string;
      supports: string;
    }>;
    gaps?: string[];
    recommendations?: string[];
  }>;
  maturity_assessment?: MaturityAssessment | null;
}

export interface AssessmentReviewResult {
  assessments: AssessmentResult[];
  source: {
    type: string;
    name: string;
    id: string;
  };
}

export interface AssessmentReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: AssessmentReviewResult | null;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  title?: string;
  description?: string;
  controlIds?: string[];
}
